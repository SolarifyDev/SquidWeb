import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Checkbox, Input, Radio, Select, message } from 'antd'
import { CopyOutlined, MoreOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import CodeMirror from '@uiw/react-codemirror'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { getExternalFeeds, searchExternalFeedPackages, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import { useRunbookProcessContext } from '../shared/RunbookProcessContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.Script'
const DEFAULT_STEP_NAME = 'Run a Script'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const STEP_RETRIES_ENABLED_PROPERTY = 'Squid.Step.RetriesEnabled'
const STEP_RETRIES_COUNT_PROPERTY = 'Squid.Step.RetriesCount'
const STEP_TIMEOUT_PROPERTY = 'Squid.Step.Timeout'
const STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY = 'Squid.Step.TimeoutInMinutes'
const STEP_MAX_PARALLELISM_PROPERTY = 'Squid.Step.MaxParallelism'
const STEP_RUN_ON_SERVER_PROPERTY = 'Squid.Action.RunOnServer'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

const ScriptProperties = {
  scriptSource: ['Squid.Action.Script.ScriptSource'],
  scriptBody: ['Squid.Action.Script.ScriptBody'],
  scriptSyntax: ['Squid.Action.Script.Syntax'],
  packageFeed: ['Squid.Action.Package.FeedId'],
  packageId: ['Squid.Action.Package.PackageId'],
  packageScriptFile: ['Squid.Action.Script.ScriptFileName'],
  gitRepositoryUrl: ['Squid.Action.Git.RepositoryUrl'],
  gitReference: ['Squid.Action.Git.Reference'],
  gitScriptPath: ['Squid.Action.Script.ScriptPath'],
  executionLocation: ['Squid.Action.Script.ExecutionLocation'],
} as const

const ActionPropertyFilterSet = new Set<string>(Object.values(ScriptProperties).flat())
const StepPropertyFilterSet = new Set<string>([
  STEP_CONDITION_EXPRESSION_PROPERTY,
  STEP_RETRIES_ENABLED_PROPERTY,
  STEP_RETRIES_COUNT_PROPERTY,
  STEP_TIMEOUT_PROPERTY,
  STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY,
  STEP_MAX_PARALLELISM_PROPERTY,
  STEP_RUN_ON_SERVER_PROPERTY,
  ...TARGET_ROLE_PROPERTY_NAMES,
])

type ScriptSource = 'Inline' | 'GitRepository' | 'Package'
type ScriptSyntax = 'PowerShell' | 'Bash' | 'CSharp' | 'FSharp' | 'Python'
type ExecutionLocationMode = 'WorkerPool' | 'WorkerPoolForRoles' | 'DeploymentTarget'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'

interface ScriptActionValues {
  scriptBody: string
  scriptSyntax: ScriptSyntax
}

function getActionProperty(action: DeploymentActionDto | undefined, names: readonly string[]): string | undefined {
  if (!action) return undefined
  for (const name of names) {
    const value = action.properties.find((property) => property.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return undefined
}

function getStepProperty(stepProperties: DeploymentStepPropertyDto[] | undefined, names: readonly string[]): string {
  if (!stepProperties) return ''
  for (const name of names) {
    const value = stepProperties.find((property) => property.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return ''
}

function normalizeScriptSource(value: string | undefined): ScriptSource {
  if (value === 'GitRepository') return 'GitRepository'
  if (value === 'Package') return 'Package'
  return 'Inline'
}

function normalizeScriptSyntax(value: string | undefined): ScriptSyntax {
  if (value === 'Bash') return 'Bash'
  if (value === 'CSharp') return 'CSharp'
  if (value === 'FSharp') return 'FSharp'
  if (value === 'Python') return 'Python'
  return 'PowerShell'
}

function normalizeExecutionLocation(value: string | undefined): ExecutionLocationMode {
  if (value === 'WorkerPool') return 'WorkerPool'
  if (value === 'WorkerPoolForRoles') return 'WorkerPoolForRoles'
  return 'DeploymentTarget'
}

function normalizeBoolean(value: string | undefined): boolean {
  if (!value?.trim()) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function buildActionProperties(
  existingAction: DeploymentActionDto | undefined,
  values: ScriptActionValues,
): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !ActionPropertyFilterSet.has(property.propertyName) && !property.propertyName.startsWith('Octopus.'),
  )
  const next: DeploymentActionPropertyDto[] = [...preserved]

  const pushProperty = (name: string, value: string, allowEmpty = false) => {
    if (!allowEmpty && value.trim() === '') return
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: name,
      propertyValue: value,
    })
  }

  pushProperty(ScriptProperties.scriptBody[0], values.scriptBody, true)
  pushProperty(ScriptProperties.scriptSyntax[0], values.scriptSyntax)

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  runOnServer: boolean,
  targetTags: string[],
  retriesEnabled: boolean,
  retryCount: number,
  timeoutSeconds: number,
  maxParallelism: number,
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => !StepPropertyFilterSet.has(property.propertyName),
  )
  const next: DeploymentStepPropertyDto[] = [...preserved]

  if (conditions.runCondition === 'Variable' && conditions.conditionExpression.trim()) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: conditions.conditionExpression.trim(),
    })
  }

  next.push({
    id: 0,
    stepId,
    propertyName: STEP_RUN_ON_SERVER_PROPERTY,
    propertyValue: runOnServer ? 'true' : 'false',
  })

  if (!runOnServer && targetTags.length > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: TARGET_ROLE_PROPERTY_NAMES[0],
      propertyValue: targetTags.join(','),
    })
  }

  if (retriesEnabled) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_RETRIES_ENABLED_PROPERTY,
      propertyValue: 'true',
    })
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_RETRIES_COUNT_PROPERTY,
      propertyValue: String(Math.min(Math.max(retryCount, 1), 3)),
    })
  }

  if (timeoutSeconds > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_TIMEOUT_PROPERTY,
      propertyValue: String(timeoutSeconds),
    })
  }

  if (maxParallelism > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_MAX_PARALLELISM_PROPERTY,
      propertyValue: String(maxParallelism),
    })
  }

  return next
}

export const RunScriptEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function RunScriptEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const runbookContext = useRunbookProcessContext()
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const initialPackageFeed = getActionProperty(action, ScriptProperties.packageFeed) ?? ''
    const initialPackageId = getActionProperty(action, ScriptProperties.packageId) ?? ''
    const initialPackageScriptFile = getActionProperty(action, ScriptProperties.packageScriptFile) ?? ''
    const initialGitRepositoryUrl = getActionProperty(action, ScriptProperties.gitRepositoryUrl) ?? ''
    const initialGitScriptPath = getActionProperty(action, ScriptProperties.gitScriptPath) ?? ''
    const persistedSource = normalizeScriptSource(getActionProperty(action, ScriptProperties.scriptSource))
    const hasPackage = initialPackageFeed.trim().length > 0 && initialPackageId.trim().length > 0
    const hasGit = initialGitRepositoryUrl.trim().length > 0 || initialGitScriptPath.trim().length > 0
    const initialScriptSource: ScriptSource = hasPackage
      ? 'Package'
      : hasGit
        ? 'GitRepository'
        : persistedSource
    const initialTargetTags = step ? getTargetRoles(step) : []
    const initialRunOnServer = normalizeBoolean(getStepProperty(step?.properties, [STEP_RUN_ON_SERVER_PROPERTY]))
    const persistedExecutionLocation = normalizeExecutionLocation(getActionProperty(action, ScriptProperties.executionLocation))
    const initialExecutionLocation: ExecutionLocationMode = initialRunOnServer
      ? 'WorkerPool'
      : persistedExecutionLocation === 'WorkerPool'
        ? initialTargetTags.length > 0
          ? 'WorkerPoolForRoles'
          : 'DeploymentTarget'
        : persistedExecutionLocation

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [scriptSource, setScriptSource] = useState<ScriptSource>(initialScriptSource)
    const [scriptSyntax, setScriptSyntax] = useState<ScriptSyntax>(
      normalizeScriptSyntax(getActionProperty(action, ScriptProperties.scriptSyntax)),
    )
    const [inlineScript, setInlineScript] = useState(getActionProperty(action, ScriptProperties.scriptBody) ?? '')
    const [packageFeed, setPackageFeed] = useState(initialPackageFeed)
    const [packageId, setPackageId] = useState(initialPackageId)
    const [packageScriptFile, setPackageScriptFile] = useState(initialPackageScriptFile)
    const [gitRepositoryUrl, setGitRepositoryUrl] = useState(initialGitRepositoryUrl)
    const [gitReference, setGitReference] = useState(getActionProperty(action, ScriptProperties.gitReference) ?? 'main')
    const [gitScriptPath, setGitScriptPath] = useState(initialGitScriptPath)
    const [executionLocation, setExecutionLocation] = useState<ExecutionLocationMode>(initialExecutionLocation)
    const [targetTags, setTargetTags] = useState<string[]>(initialTargetTags)
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
      step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    )
    const [conditions, setConditions] = useState<StepConditionsValue>({
      environmentMode: initialEnvironmentMode,
      environmentIds: initialEnvironmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
      channelIds: action?.channels ?? [],
      runCondition: step?.condition ?? 'Success',
      conditionExpression: getStepProperty(step?.properties, [STEP_CONDITION_EXPRESSION_PROPERTY]),
      packageRequirement: step?.packageRequirement ?? 'LetSquidDecide',
      required: step?.isRequired ?? false,
      disabled: step?.isDisabled ?? false,
    })
    const [retriesEnabled, setRetriesEnabled] = useState(
      normalizeBoolean(getStepProperty(step?.properties, [STEP_RETRIES_ENABLED_PROPERTY])),
    )
    const [retryCount, setRetryCount] = useState(() => {
      const parsed = Number.parseInt(getStepProperty(step?.properties, [STEP_RETRIES_COUNT_PROPERTY]), 10)
      return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.max(parsed, 1), 3) : 1
    })
    const [stepTimeoutSeconds, setStepTimeoutSeconds] = useState(() => {
      const timeoutSeconds = Number.parseInt(getStepProperty(step?.properties, [STEP_TIMEOUT_PROPERTY]), 10)
      if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) return timeoutSeconds
      const timeoutMinutesLegacy = Number.parseInt(getStepProperty(step?.properties, [STEP_TIMEOUT_MINUTES_LEGACY_PROPERTY]), 10)
      return Number.isFinite(timeoutMinutesLegacy) && timeoutMinutesLegacy > 0 ? timeoutMinutesLegacy * 60 : 0
    })
    const [maxParallelism, setMaxParallelism] = useState(() => {
      const parsed = Number.parseInt(getStepProperty(step?.properties, [STEP_MAX_PARALLELISM_PROPERTY]), 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    })
    const [feedsLoading, setFeedsLoading] = useState(false)
    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const [packageFeedOptions, setPackageFeedOptions] = useState<{ label: string; value: string }[]>([])
    const [packageSearchTerm, setPackageSearchTerm] = useState(initialPackageId)
    const [packageSearchOptions, setPackageSearchOptions] = useState<string[]>([])
    const [packageSearchLoading, setPackageSearchLoading] = useState(false)
    const packageSearchRequestId = useRef(0)

    const loadFeeds = useCallback(async () => {
      setFeedsLoading(true)
      try {
        const response = await getExternalFeeds({ pageSize: 1000 })
        const sortedFeeds = [...(response.externalFeeds ?? [])].sort((a, b) => a.name.localeCompare(b.name))
        setFeeds(sortedFeeds)
        setPackageFeedOptions(sortedFeeds.map((feed) => ({ label: feed.name, value: String(feed.id) })))
      } catch {
        message.error('Failed to load feeds')
      } finally {
        setFeedsLoading(false)
      }
    }, [])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    useEffect(() => {
      void loadFeeds()
    }, [loadFeeds])

    useEffect(() => {
      setPackageSearchTerm(packageId)
    }, [packageId])

    const packageFeedSelectOptions = useMemo(() => {
      if (!packageFeed.trim()) return packageFeedOptions
      if (packageFeedOptions.some((option) => option.value === packageFeed)) return packageFeedOptions
      return [...packageFeedOptions, { label: `Feed #${packageFeed}`, value: packageFeed }]
    }, [packageFeed, packageFeedOptions])

    const selectedPackageFeedId = useMemo(() => {
      const parsed = Number.parseInt(packageFeed, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      return parsed
    }, [packageFeed])

    const selectedFeedName = useMemo(() => {
      if (!selectedPackageFeedId) return ''
      return feeds.find((feed) => feed.id === selectedPackageFeedId)?.name ?? ''
    }, [feeds, selectedPackageFeedId])

    useEffect(() => {
      const query = packageSearchTerm.trim()
      if (scriptSource !== 'Package' || !selectedPackageFeedId || !query) {
        setPackageSearchOptions([])
        setPackageSearchLoading(false)
        return
      }

      const requestId = ++packageSearchRequestId.current
      const timer = window.setTimeout(() => {
        setPackageSearchLoading(true)
        searchExternalFeedPackages({ feedId: selectedPackageFeedId, query, take: 20 })
          .then((response) => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchOptions((response.packages ?? []).filter(Boolean))
          })
          .catch(() => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchOptions([])
          })
          .finally(() => {
            if (requestId !== packageSearchRequestId.current) return
            setPackageSearchLoading(false)
          })
      }, 300)

      return () => window.clearTimeout(timer)
    }, [scriptSource, selectedPackageFeedId, packageSearchTerm])

    const handleCopyScript = async () => {
      try {
        await navigator.clipboard.writeText(inlineScript)
        message.success('Copied to clipboard')
      } catch {
        message.error('Failed to copy script')
      }
    }

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      if (!inlineScript.trim()) {
        message.warning('Script body is required')
        return
      }

      if (retriesEnabled && (!Number.isFinite(retryCount) || retryCount < 1 || retryCount > 3)) {
        message.warning('Retries must be between 1 and 3')
        return
      }

      if (executionLocation !== 'WorkerPool' && targetTags.length === 0) {
        message.warning('Target tags are required when running on deployment targets')
        return
      }

      if (!Number.isFinite(stepTimeoutSeconds) || stepTimeoutSeconds < 0) {
        message.warning('Time out must be zero or a positive integer')
        return
      }

      if (!Number.isFinite(maxParallelism) || maxParallelism < 0) {
        message.warning('Max parallelism must be zero or a positive integer')
        return
      }

      const actionValues: ScriptActionValues = {
        scriptBody: inlineScript,
        scriptSyntax,
      }

      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions,
        executionLocation === 'WorkerPool',
        targetTags,
        retriesEnabled,
        retryCount,
        stepTimeoutSeconds,
        maxParallelism,
      )
      const actionEnvironments = conditions.environmentMode === 'include' ? conditions.environmentIds : []
      const actionExcludedEnvironments = conditions.environmentMode === 'exclude' ? conditions.environmentIds : []

      const nextAction: DeploymentActionDto = {
        id: action?.id ?? 0,
        stepId: step?.id ?? 0,
        actionOrder: action?.actionOrder ?? 0,
        name: normalizedStepName,
        actionType: ACTION_TYPE,
        workerPoolId: action?.workerPoolId ?? null,
        isDisabled: conditions.disabled,
        isRequired: conditions.required,
        canBeUsedForProjectVersioning: action?.canBeUsedForProjectVersioning ?? false,
        createdAt: action?.createdAt ?? new Date().toISOString(),
        properties: actionProperties,
        environments: actionEnvironments,
        excludedEnvironments: actionExcludedEnvironments,
        channels: conditions.channelIds,
      }

      const nextStep: DeploymentStepDto = {
        id: step?.id ?? 0,
        processId,
        stepOrder: step?.stepOrder ?? 0,
        name: normalizedStepName,
        stepType: 'RunScript',
        condition: conditions.runCondition,
        startTrigger,
        packageRequirement: conditions.packageRequirement,
        isDisabled: conditions.disabled,
        isRequired: conditions.required,
        createdAt: step?.createdAt ?? new Date().toISOString(),
        properties: stepProperties,
        actions: [nextAction],
      }

      try {
        const saved = step
          ? await updateDeploymentStep({ id: step.id, projectId, runbookId: runbookContext?.runbookId, step: nextStep })
          : await createDeploymentStep({ processId, projectId, runbookId: runbookContext?.runbookId, step: nextStep })
        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }), [
      stepName,
      scriptSource,
      scriptSyntax,
      inlineScript,
      packageFeed,
      packageId,
      packageScriptFile,
      gitRepositoryUrl,
      gitReference,
      gitScriptPath,
      executionLocation,
      targetTags,
      startTrigger,
      conditions,
      retriesEnabled,
      retryCount,
      stepTimeoutSeconds,
      maxParallelism,
      step,
      processId,
      projectId,
      runbookContext?.runbookId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME

    const executionLocationDescription = executionLocation === 'DeploymentTarget'
      ? 'Execute on each deployment target with the selected target tags.'
      : executionLocation === 'WorkerPoolForRoles'
        ? 'Execute on a worker on behalf of each deployment target with selected target tags.'
        : 'Execute once on a worker.'

    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
                onError={(event) => {
                  ;(event.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs leading-tight text-slate-400">Run a Script</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label="More Step Actions">
              <MoreOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <CollapsibleSection title="Step Name" subtitle="A short, memorable, unique name for this step." defaultOpen>
            <label className="mb-1 block text-xs font-medium text-slate-600">Step name</label>
            <Input
              size="small"
              value={stepName}
              onChange={(event) => setStepName(event.target.value)}
              placeholder={DEFAULT_STEP_NAME}
            />
          </CollapsibleSection>

          {executionLocation !== 'WorkerPool' ? (
            <CollapsibleSection title="Target Tags" subtitle="This step will deploy to deployment targets with any of these matching tags." defaultOpen>
              <TargetTagSelect
                value={targetTags}
                onChange={setTargetTags}
                placeholder={executionLocation === 'WorkerPoolForRoles' ? 'On behalf of target tags (type to add new)' : 'Runs on targets with tags (type to add new)'}
              />
              <div className="text-xs text-slate-500">You need at least one tag to select matching targets.</div>
            </CollapsibleSection>
          ) : null}

          <div className="rounded-lg border border-slate-200 p-3 space-y-4">
            <div className="px-1 text-sm font-semibold text-slate-700">Script</div>

            <CollapsibleSection title="Script Source" subtitle="Select where the script is defined." defaultOpen>
              <Radio.Group
                value={scriptSource}
                onChange={(event) => setScriptSource(event.target.value as ScriptSource)}
                className="flex flex-col gap-2"
              >
                <Radio value="Inline">
                  <span className="text-sm">Inline script <span className="text-slate-500">(default)</span></span>
                </Radio>
                <Radio value="GitRepository">
                  <span className="text-sm">Git repository</span>
                </Radio>
                <Radio value="Package">
                  <span className="text-sm">Package</span>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>

            {scriptSource === 'Inline' ? (
              <CollapsibleSection
                title="Inline Source Code"
                subtitle="Select the script language and enter the body of the script that will be executed."
                defaultOpen
                fullWidth
              >
                <div className="ml-[216px] space-y-3">
                  <div className="rounded-md border border-slate-300 bg-white overflow-hidden">
                    <div className="flex items-center justify-between gap-3 bg-slate-100 px-3 py-2.5 min-h-[56px] border-b border-slate-300">
                      <div className="h-10 flex items-center">
                        <Select
                          value={scriptSyntax}
                          className="w-52 script-syntax-select"
                          options={[
                            { label: 'PowerShell', value: 'PowerShell' },
                            { label: 'Bash', value: 'Bash' },
                            { label: 'C#', value: 'CSharp' },
                            { label: 'F#', value: 'FSharp' },
                            { label: 'Python', value: 'Python' },
                          ]}
                          onChange={(value) => setScriptSyntax(value as ScriptSyntax)}
                        />
                      </div>
                      <div className="flex items-center gap-1 self-center">
                        <Button type="text" icon={<CopyOutlined />} onClick={handleCopyScript} className="!text-slate-700">
                          Copy to clipboard
                        </Button>
                        <Button type="text" className="!text-slate-700" onClick={() => message.info('Insert variable is not available yet')}>
                          Insert variable
                        </Button>
                        <Button type="text" className="!text-slate-700" onClick={() => message.info('Full screen is not available yet')}>
                          Enter full screen
                        </Button>
                        <Button type="text" icon={<SettingOutlined />} className="!text-slate-700" onClick={() => message.info('Editor settings are not available yet')} />
                      </div>
                    </div>
                    <div className="min-h-[430px]">
                      <CodeMirror
                        value={inlineScript}
                        onChange={(value) => setInlineScript(value)}
                        basicSetup={{
                          lineNumbers: true,
                          foldGutter: true,
                          highlightActiveLine: true,
                          highlightActiveLineGutter: true,
                          indentOnInput: true,
                        }}
                        height="430px"
                        className="script-inline-codemirror"
                      />
                    </div>
                  </div>

                  <p className="m-0 text-xs text-slate-500">
                    Insert variables with <code className="rounded bg-slate-100 px-1 py-0.5">control</code> + <code className="rounded bg-slate-100 px-1 py-0.5">i</code>. Fuzzy search supported.
                  </p>
                </div>
              </CollapsibleSection>
            ) : null}

            {scriptSource === 'GitRepository' ? (
              <CollapsibleSection
                title="Git Repository"
                subtitle="Configure the repository that contains your script."
                defaultOpen
                fullWidth
              >
                <div className="ml-[216px] space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Repository URL</label>
                    <Input
                      size="small"
                      value={gitRepositoryUrl}
                      onChange={(event) => setGitRepositoryUrl(event.target.value)}
                      placeholder="https://github.com/your-org/your-repo.git"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reference</label>
                    <Input
                      size="small"
                      value={gitReference}
                      onChange={(event) => setGitReference(event.target.value)}
                      placeholder="main"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">Branch, tag, or commit SHA.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Script path</label>
                    <Input
                      size="small"
                      value={gitScriptPath}
                      onChange={(event) => setGitScriptPath(event.target.value)}
                      placeholder="scripts/deploy.ps1"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">Path to the script file inside the repository.</p>
                  </div>
                </div>
              </CollapsibleSection>
            ) : null}

            {scriptSource === 'Package' ? (
              <CollapsibleSection title="Script Package" subtitle="Choose the package containing the script to execute." defaultOpen fullWidth>
                <div className="ml-[216px] space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Package feed</label>
                      <Select
                        value={packageFeed || undefined}
                        options={packageFeedSelectOptions}
                        onChange={(value) => {
                          const normalizedValue = String(value ?? '').trim()
                          setPackageFeed(normalizedValue)
                          if (!normalizedValue) {
                            setPackageId('')
                            setPackageSearchTerm('')
                            setPackageSearchOptions([])
                            return
                          }
                          setPackageSearchTerm(packageId)
                        }}
                        size="small"
                        className="w-full script-package-feed-select"
                        showSearch
                        loading={feedsLoading}
                        allowClear
                        optionFilterProp="label"
                        placeholder="Select a feed..."
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                      aria-label="Refresh feeds"
                      onClick={() => void loadFeeds()}
                    >
                      <ReloadOutlined style={{ fontSize: 13 }} />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Package ID</label>
                    <div className="flex min-h-[28px] items-center gap-2">
                      <AutoComplete
                        size="small"
                        className="w-full min-w-0 script-package-id-autocomplete"
                        value={packageId}
                        placeholder="script-package-id"
                        options={packageSearchOptions.map((value) => ({ value }))}
                        onSearch={setPackageSearchTerm}
                        onSelect={(value) => {
                          setPackageSearchTerm(value)
                          setPackageId(value)
                        }}
                        onChange={(value) => {
                          setPackageSearchTerm(value)
                          setPackageId(value)
                        }}
                        filterOption={false}
                        allowClear
                        notFoundContent={
                          selectedPackageFeedId && packageSearchTerm.trim()
                            ? packageSearchLoading
                              ? 'Searching packages...'
                              : 'No packages found'
                            : null
                        }
                      />
                    </div>
                    <p className="mb-0 mt-4 text-xs leading-relaxed text-slate-500">
                      Enter the ID of the package.
                      {selectedFeedName ? <> Searching in <code>{selectedFeedName}</code>.</> : null}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Script file</label>
                    <Input
                      size="small"
                      value={packageScriptFile}
                      onChange={(event) => setPackageScriptFile(event.target.value)}
                      placeholder="scripts/deploy.ps1"
                    />
                    <p className="mb-0 mt-1 text-xs leading-relaxed text-slate-500">
                      This field supports glob patterns, for example <code>scripts/*.ps1</code>.
                    </p>
                  </div>
                </div>
              </CollapsibleSection>
            ) : null}
          </div>

          <CollapsibleSection title="Referenced Packages" subtitle="Add packages to be referenced by your scripts at execution-time." defaultOpen>
            <p className="m-0 text-xs text-slate-500">
              Learn more about{' '}
              <a href="https://oc.to/ScriptStepPackageReferences" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                package references
              </a>.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Add
              </button>
            </div>
            <div className="h-12 rounded border border-dashed border-slate-200 bg-slate-50" />
          </CollapsibleSection>

          <CollapsibleSection title="Execution Location" subtitle="Where will Squid run this step?" defaultOpen fullWidth>
            <div className="ml-[216px] space-y-3">
              <Radio.Group
                value={executionLocation}
                onChange={(event) => setExecutionLocation(event.target.value as ExecutionLocationMode)}
                className="flex flex-col gap-2"
              >
                <Radio value="WorkerPool">
                  <span className="text-sm">Run once on a worker</span>
                </Radio>
                <Radio value="WorkerPoolForRoles">
                  <span className="text-sm">Run on a worker on behalf of each deployment target</span>
                </Radio>
                <Radio value="DeploymentTarget">
                  <span className="text-sm">Run on each deployment target</span>
                </Radio>
              </Radio.Group>
              <p className="m-0 text-xs text-slate-500">{executionLocationDescription}</p>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Conditions" subtitle="Configure when and where this step should run." defaultOpen fullWidth>
            <StepConditionsSection
              value={conditions}
              onChange={setConditions}
              projectId={projectId}
              hideRootSection
              afterRunCondition={(
                <CollapsibleSection title="Start Trigger" subtitle="Control whether this step waits for the previous step to complete, or runs in parallel with it." defaultOpen>
                  <Radio.Group
                    value={startTrigger}
                    onChange={(event) => setStartTrigger(event.target.value as StartTriggerMode)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="StartWithPrevious">
                      <span className="text-sm">Run in parallel with the previous step</span>
                    </Radio>
                    <Radio value="StartAfterPrevious">
                      <span className="text-sm">Wait for all previous steps to complete, then start</span>
                    </Radio>
                  </Radio.Group>
                </CollapsibleSection>
              )}
            />

            <CollapsibleSection title="Retries" subtitle="Upon failure, this step will automatically retry." defaultOpen>
              <Checkbox checked={retriesEnabled} onChange={(event) => setRetriesEnabled(event.target.checked)}>
                <span className="text-sm">Allow retries (max. 3)</span>
              </Checkbox>
              {retriesEnabled ? (
                <div className="max-w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Retries</label>
                  <Input
                    size="small"
                    type="number"
                    min={1}
                    max={3}
                    value={String(retryCount)}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10)
                      if (!Number.isFinite(parsed)) {
                        setRetryCount(1)
                        return
                      }
                      setRetryCount(Math.min(Math.max(parsed, 1), 3))
                    }}
                  />
                </div>
              ) : null}
            </CollapsibleSection>

            <CollapsibleSection
              title="Rolling Deployment"
              subtitle="Configure a rolling deployment to control the number of deployment targets this step can deploy to at once."
              defaultOpen
            >
              <Checkbox
                checked={maxParallelism > 0}
                onChange={(event) => setMaxParallelism(event.target.checked ? Math.max(maxParallelism, 1) : 0)}
              >
                <span className="text-sm">Configure a rolling deployment</span>
              </Checkbox>
              {maxParallelism > 0 ? (
                <div className="mt-2 max-w-[220px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Maximum parallel targets</label>
                  <Input
                    size="small"
                    type="number"
                    min={1}
                    value={String(maxParallelism)}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10)
                      if (!Number.isFinite(parsed) || parsed < 1) {
                        setMaxParallelism(1)
                        return
                      }
                      setMaxParallelism(parsed)
                    }}
                  />
                </div>
              ) : null}
            </CollapsibleSection>

            <CollapsibleSection
              title="Time out"
              subtitle="If this step is still running after the set time has lapsed, the task will fail."
              defaultOpen
            >
              <label className="mb-1 block text-xs font-medium text-slate-600">Time out after seconds (0 means never time out)</label>
              <Input
                size="small"
                type="number"
                min={0}
                value={String(stepTimeoutSeconds)}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  if (!Number.isFinite(parsed) || parsed < 0) {
                    setStepTimeoutSeconds(0)
                    return
                  }
                  setStepTimeoutSeconds(parsed)
                }}
              />
            </CollapsibleSection>
          </CollapsibleSection>
        </div>
        <style>{`
          .script-syntax-select.ant-select-single {
            height: 40px !important;
          }
          .script-syntax-select.ant-select:not(.ant-select-customize-input) .ant-select-selector {
            background: #eef2f7 !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 8px !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            padding: 0 12px !important;
            box-shadow: none !important;
          }
          .script-syntax-select.ant-select-focused:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16) !important;
          }
          .script-syntax-select.ant-select-single .ant-select-selection-item,
          .script-syntax-select.ant-select-single .ant-select-selection-placeholder {
            line-height: 40px !important;
            display: flex !important;
            align-items: center !important;
          }
          .script-syntax-select .ant-select-arrow {
            top: 50% !important;
            transform: translateY(-50%) !important;
            margin-top: 0 !important;
            display: flex !important;
            align-items: center !important;
          }
          .script-package-id-autocomplete.ant-select .ant-select-selector {
            min-height: 31px !important;
            height: 31px !important;
            display: flex !important;
            align-items: center !important;
          }
          .script-package-feed-select.ant-select .ant-select-selector {
            min-height: 31px !important;
            height: 31px !important;
            display: flex !important;
            align-items: center !important;
          }
          .script-package-feed-select.ant-select .ant-select-selection-item,
          .script-package-feed-select.ant-select .ant-select-selection-placeholder {
            line-height: 29px !important;
          }
          .script-package-feed-select.ant-select .ant-select-selection-search-input {
            height: 29px !important;
            line-height: 29px !important;
          }
          .script-package-feed-select .ant-select-arrow {
            top: 50% !important;
            transform: translateY(-50%) !important;
            margin-top: 0 !important;
          }
          .script-package-id-autocomplete.ant-select .ant-select-selection-item,
          .script-package-id-autocomplete.ant-select .ant-select-selection-placeholder {
            line-height: 29px !important;
          }
          .script-package-id-autocomplete.ant-select .ant-select-selection-search-input {
            height: 29px !important;
          }
          .script-inline-codemirror .cm-editor {
            height: 430px !important;
            min-height: 430px !important;
            border: 0 !important;
            outline: none !important;
          }
          .script-inline-codemirror .cm-scroller {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            line-height: 1.5 !important;
          }
          .script-inline-codemirror .cm-content {
            font-size: 15px !important;
            padding: 8px 12px !important;
          }
          .script-inline-codemirror .cm-gutters {
            border-right: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
          }
          .script-inline-codemirror .cm-focused {
            outline: none !important;
          }
        `}</style>
      </div>
    )
  },
)
