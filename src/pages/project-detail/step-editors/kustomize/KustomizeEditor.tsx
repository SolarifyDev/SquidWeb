import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Radio, Select, message } from 'antd'
import { MoreOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { getDeploymentAccounts, type DeploymentAccountDto } from 'pages/apis/deploymentAccount'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import { useRunbookProcessContext } from '../shared/RunbookProcessContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.KubernetesKustomize'
const DEFAULT_STEP_NAME = 'Deploy with Kustomize'
const DEFAULT_BRANCH = 'main'
const DEFAULT_TIMEOUT_SECONDS = '180'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const STEP_RETRIES_ENABLED_PROPERTY = 'Squid.Step.RetriesEnabled'
const STEP_RETRIES_COUNT_PROPERTY = 'Squid.Step.RetriesCount'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

const KustomizeProperties = {
  repositoryUrl: ['Squid.Action.Git.RepositoryUrl'],
  gitReference: ['Squid.Action.Git.Reference'],
  gitCredentialType: ['Squid.Action.Git.CredentialType'],
  gitCredentialId: ['Squid.Action.Git.CredentialId'],
  overlayPath: ['Squid.Action.KubernetesKustomize.OverlayPath'],
  substituteTargetFiles: ['Squid.Action.SubstituteInFiles.TargetFiles'],
  objectStatusCheck: ['Squid.Action.KubernetesContainers.ObjectStatusCheck'],
  objectStatusTimeoutSeconds: ['Squid.Action.KubernetesContainers.ObjectStatusCheckTimeout'],
  objectStatusWaitForJobs: ['Squid.Action.KubernetesContainers.ObjectStatusCheckWaitForJobs'],
  scriptSyntax: ['Squid.Action.Script.Syntax'],
} as const

const RemovedActionPropertyNames = [
  'Squid.Action.Kubernetes.ServerSideApply.Enabled',
  'Squid.Action.Kubernetes.ServerSideApply.FieldManager',
  'Squid.Action.Kubernetes.ServerSideApply.ForceConflicts',
] as const

const RemovedStepPropertyNames = [
  'Squid.Action.WorkerPoolId',
  'Squid.Action.Container',
] as const

const ActionPropertyFilterSet = new Set<string>([...Object.values(KustomizeProperties).flat(), ...RemovedActionPropertyNames])
const StepPropertyFilterSet = new Set<string>([
  STEP_CONDITION_EXPRESSION_PROPERTY,
  STEP_RETRIES_ENABLED_PROPERTY,
  STEP_RETRIES_COUNT_PROPERTY,
  ...TARGET_ROLE_PROPERTY_NAMES,
  ...RemovedStepPropertyNames,
])

type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'
type GitAuthenticationMode = 'Library' | 'Anonymous'
type ObjectStatusCheckMode = 'enabled' | 'disabled'

interface KustomizeActionValues {
  repositoryUrl: string
  gitReference: string
  gitCredentialType: GitAuthenticationMode
  gitCredentialId: string
  overlayPath: string
  substituteTargetFiles: string
  objectStatusCheck: ObjectStatusCheckMode
  stepTimeoutEnabled: boolean
  stepTimeoutSeconds: string
  waitForJobs: boolean
  scriptSyntax: 'PowerShell' | 'Bash'
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

function normalizeBoolean(value: string | undefined, fallback = false): boolean {
  if (!value?.trim()) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

function normalizeObjectStatusCheck(value: string | undefined): ObjectStatusCheckMode {
  if (!value?.trim()) return 'enabled'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'false' || normalized === 'disabled' || normalized === '0' || normalized === 'no') return 'disabled'
  return 'enabled'
}

function normalizeGitAuthentication(value: string | undefined): GitAuthenticationMode {
  if (!value?.trim()) return 'Library'
  return value === 'Anonymous' ? 'Anonymous' : 'Library'
}

function normalizeScriptSyntax(value: string | undefined): 'PowerShell' | 'Bash' {
  return value === 'Bash' ? 'Bash' : 'PowerShell'
}

function toTrueFalse(value: boolean): 'True' | 'False' {
  return value ? 'True' : 'False'
}

function buildActionProperties(existingAction: DeploymentActionDto | undefined, values: KustomizeActionValues): DeploymentActionPropertyDto[] {
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

  pushProperty(KustomizeProperties.repositoryUrl[0], values.repositoryUrl)
  pushProperty(KustomizeProperties.gitReference[0], values.gitReference)
  pushProperty(KustomizeProperties.gitCredentialType[0], values.gitCredentialType)
  if (values.gitCredentialType === 'Library') pushProperty(KustomizeProperties.gitCredentialId[0], values.gitCredentialId)

  pushProperty(KustomizeProperties.overlayPath[0], values.overlayPath)
  pushProperty(KustomizeProperties.substituteTargetFiles[0], values.substituteTargetFiles, true)
  pushProperty(KustomizeProperties.objectStatusCheck[0], toTrueFalse(values.objectStatusCheck === 'enabled'))
  if (values.objectStatusCheck === 'enabled' && values.stepTimeoutEnabled) {
    pushProperty(KustomizeProperties.objectStatusTimeoutSeconds[0], values.stepTimeoutSeconds)
  }
  pushProperty(KustomizeProperties.objectStatusWaitForJobs[0], toTrueFalse(values.waitForJobs))
  pushProperty(KustomizeProperties.scriptSyntax[0], values.scriptSyntax)

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  targetTags: string[],
  retriesEnabled: boolean,
  retryCount: number,
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

  if (targetTags.length > 0) {
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

  return next
}

export const KustomizeEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function KustomizeEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const runbookContext = useRunbookProcessContext()
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const initialObjectStatusCheck = normalizeObjectStatusCheck(getActionProperty(action, KustomizeProperties.objectStatusCheck))
    const initialStepTimeout = getActionProperty(action, KustomizeProperties.objectStatusTimeoutSeconds) ?? ''

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [targetTags, setTargetTags] = useState<string[]>(() => step ? getTargetRoles(step) : [])

    const [repositoryUrl, setRepositoryUrl] = useState(getActionProperty(action, KustomizeProperties.repositoryUrl) ?? '')
    const [gitAuthenticationMode, setGitAuthenticationMode] = useState<GitAuthenticationMode>(
      normalizeGitAuthentication(getActionProperty(action, KustomizeProperties.gitCredentialType)),
    )
    const [gitCredentialId, setGitCredentialId] = useState(getActionProperty(action, KustomizeProperties.gitCredentialId) ?? '')
    const [gitCredentialsLoading, setGitCredentialsLoading] = useState(false)
    const [gitCredentials, setGitCredentials] = useState<DeploymentAccountDto[]>([])

    const [defaultBranch, setDefaultBranch] = useState(getActionProperty(action, KustomizeProperties.gitReference) || DEFAULT_BRANCH)
    const [overlayPath, setOverlayPath] = useState(getActionProperty(action, KustomizeProperties.overlayPath) ?? '')
    const [substituteTargetFiles, setSubstituteTargetFiles] = useState(getActionProperty(action, KustomizeProperties.substituteTargetFiles) ?? '')

    const [objectStatusCheck, setObjectStatusCheck] = useState<ObjectStatusCheckMode>(initialObjectStatusCheck)
    const [stepTimeoutEnabled, setStepTimeoutEnabled] = useState(initialStepTimeout.trim().length > 0 || initialObjectStatusCheck === 'enabled')
    const [stepTimeoutSeconds, setStepTimeoutSeconds] = useState(initialStepTimeout || DEFAULT_TIMEOUT_SECONDS)
    const [waitForJobs, setWaitForJobs] = useState(
      normalizeBoolean(getActionProperty(action, KustomizeProperties.objectStatusWaitForJobs), false),
    )
    const [scriptSyntax] = useState<'PowerShell' | 'Bash'>(
      normalizeScriptSyntax(getActionProperty(action, KustomizeProperties.scriptSyntax)),
    )

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
      normalizeBoolean(getStepProperty(step?.properties, [STEP_RETRIES_ENABLED_PROPERTY]), false),
    )
    const [retryCount, setRetryCount] = useState(() => {
      const parsed = Number.parseInt(getStepProperty(step?.properties, [STEP_RETRIES_COUNT_PROPERTY]), 10)
      return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.max(parsed, 1), 3) : 1
    })

    const loadGitCredentials = useCallback(async () => {
      setGitCredentialsLoading(true)
      try {
        const response = await getDeploymentAccounts({ pageSize: 1000 })
        const accounts = [...(response.deploymentAccounts ?? [])].sort((a, b) => a.name.localeCompare(b.name))
        setGitCredentials(accounts)
      } catch {
        message.error('Failed to load Git credentials')
      } finally {
        setGitCredentialsLoading(false)
      }
    }, [])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    useEffect(() => {
      void loadGitCredentials()
    }, [loadGitCredentials])

    const gitCredentialOptions = useMemo(
      () => gitCredentials.map((account) => ({ label: account.name, value: String(account.id) })),
      [gitCredentials],
    )

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      if (targetTags.length === 0) {
        message.warning('Target tags are required')
        return
      }

      if (!repositoryUrl.trim()) {
        message.warning('Repository URL is required')
        return
      }

      if (gitAuthenticationMode === 'Library' && !gitCredentialId.trim()) {
        message.warning('Please select a Git credential')
        return
      }

      if (retriesEnabled && (!Number.isFinite(retryCount) || retryCount < 1 || retryCount > 3)) {
        message.warning('Retries must be between 1 and 3')
        return
      }

      let normalizedTimeout = ''
      if (objectStatusCheck === 'enabled' && stepTimeoutEnabled) {
        const parsed = Number.parseInt(stepTimeoutSeconds.trim(), 10)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          message.warning('Timeout period in seconds must be a positive integer')
          return
        }
        normalizedTimeout = String(parsed)
      }

      const actionValues: KustomizeActionValues = {
        repositoryUrl: repositoryUrl.trim(),
        gitReference: defaultBranch.trim() || DEFAULT_BRANCH,
        gitCredentialType: gitAuthenticationMode,
        gitCredentialId: gitCredentialId.trim(),
        overlayPath: overlayPath.trim() || '.',
        substituteTargetFiles,
        objectStatusCheck,
        stepTimeoutEnabled,
        stepTimeoutSeconds: normalizedTimeout,
        waitForJobs,
        scriptSyntax,
      }

      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions,
        targetTags,
        retriesEnabled,
        retryCount,
      )

      const actionEnvironments = conditions.environmentMode === 'include' ? conditions.environmentIds : []
      const actionExcludedEnvironments = conditions.environmentMode === 'exclude' ? conditions.environmentIds : []

      const nextAction: DeploymentActionDto = {
        id: action?.id ?? 0,
        stepId: step?.id ?? 0,
        actionOrder: action?.actionOrder ?? 0,
        name: normalizedStepName,
        actionType: ACTION_TYPE,
        workerPoolId: null,
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
        stepType: step?.stepType ?? 'Action',
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
      targetTags,
      repositoryUrl,
      gitAuthenticationMode,
      gitCredentialId,
      defaultBranch,
      overlayPath,
      substituteTargetFiles,
      objectStatusCheck,
      stepTimeoutEnabled,
      stepTimeoutSeconds,
      waitForJobs,
      scriptSyntax,
      startTrigger,
      conditions,
      retriesEnabled,
      retryCount,
      step,
      processId,
      projectId,
      runbookContext?.runbookId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME

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
              <div className="text-xs leading-tight text-slate-400">Deploy with Kustomize</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
            </div>
          </div>

          <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label="More Step Actions">
            <MoreOutlined style={{ fontSize: 18 }} />
          </button>
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
            <Button type="link" className="!h-auto !px-0 !text-xs">Add notes</Button>
          </CollapsibleSection>

          <CollapsibleSection title="Target Tags" subtitle="This step will deploy to Kubernetes clusters with any of these matching tags." defaultOpen>
            <TargetTagSelect
              value={targetTags}
              onChange={setTargetTags}
              placeholder="On behalf of target tags (type to add new)"
            />
            <div className="text-xs text-slate-500">You need at least one tag to select matching targets.</div>
          </CollapsibleSection>

          <CollapsibleSection title="Configuration" defaultOpen fullWidth>
            <CollapsibleSection title="Repository URL" subtitle="Specify the URL of the Git repository" defaultOpen fullWidth>
              <div className="ml-[216px] space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Repository HTTPS URL</label>
                    <Input
                      size="small"
                      value={repositoryUrl}
                      onChange={(event) => setRepositoryUrl(event.target.value)}
                      placeholder="https://github.com/your-org/your-repo.git"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label="Insert variable"
                    onClick={() => message.info('Insert variable is not available yet')}
                  >
                    {'{}'}
                  </button>
                </div>
                <p className="m-0 text-xs text-slate-500">
                  E.g. <code>https://github.com/your-org/your-repo.git</code>
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Authentication" subtitle="Specify how to authenticate to the Git repository" defaultOpen>
              <div className="flex flex-col gap-2">
                <Radio
                  checked={gitAuthenticationMode === 'Library'}
                  onChange={() => setGitAuthenticationMode('Library')}
                  name="kustomizeGitCredentialType"
                >
                  <span className="text-sm">Git credentials</span>
                </Radio>

                {gitAuthenticationMode === 'Library' ? (
                  <div className="ml-6 space-y-3 pb-1">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Select Git credential</label>
                        <Select
                          size="small"
                          className="w-full kustomize-auth-credential-select"
                          options={gitCredentialOptions}
                          value={gitCredentialId || undefined}
                          onChange={(value) => setGitCredentialId(String(value ?? ''))}
                          placeholder="Select Git credential"
                          loading={gitCredentialsLoading}
                          showSearch
                          optionFilterProp="label"
                          allowClear
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                          aria-label="Refresh"
                          onClick={() => void loadGitCredentials()}
                        >
                          <ReloadOutlined style={{ fontSize: 13 }} />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                          aria-label="Add"
                          onClick={() => message.info('Create Git credential is not available here yet')}
                        >
                          <PlusOutlined style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <Radio
                  checked={gitAuthenticationMode === 'Anonymous'}
                  onChange={() => setGitAuthenticationMode('Anonymous')}
                  name="kustomizeGitCredentialType"
                >
                  <span className="text-sm">Anonymous</span>
                </Radio>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Branch Settings" subtitle="Specify the default branch you want to use" defaultOpen fullWidth>
              <div className="ml-[216px] space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Default Branch</label>
                    <Input
                      size="small"
                      value={defaultBranch}
                      onChange={(event) => setDefaultBranch(event.target.value)}
                      placeholder={DEFAULT_BRANCH}
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label="Insert variable"
                    onClick={() => message.info('Insert variable is not available yet')}
                  >
                    {'{}'}
                  </button>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Kustomization file directory"
              subtitle="Provide the path to the directory where your kustomization.yaml file is located"
              defaultOpen
              fullWidth
            >
              <div className="ml-[216px] space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Kustomization file directory</label>
                    <Input
                      size="small"
                      value={overlayPath}
                      onChange={(event) => setOverlayPath(event.target.value)}
                      placeholder="overlays/#{Squid.Environment.Name}"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label="Insert variable"
                    onClick={() => message.info('Insert variable is not available yet')}
                  >
                    {'{}'}
                  </button>
                </div>
                <p className="m-0 text-xs text-slate-500">
                  If your Kustomize repository uses overlays, consider using <code>#{'{Octopus.Environment.Name}'}</code> to indicate you have a subdirectory per environment.
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Substitute Variables in Files" subtitle="Configure files to perform variable substitution on." defaultOpen fullWidth>
              <div className="ml-[216px] space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Target Files</label>
                    <Input.TextArea
                      rows={3}
                      value={substituteTargetFiles}
                      onChange={(event) => setSubstituteTargetFiles(event.target.value)}
                      placeholder={'**/*.yaml\n**/*.yml'}
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                    aria-label="Insert variable"
                    onClick={() => message.info('Insert variable is not available yet')}
                  >
                    {'{}'}
                  </button>
                </div>
                <p className="m-0 text-xs leading-relaxed text-slate-500">
                  A newline-separated list of files to transform, relative to the root of the git repository. This field supports glob expression syntax e.g. <code>**/*.env</code>. See our{' '}
                  <a href="https://oc.to/glob-patterns-cheat-sheet" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                    glob expression cheat sheet
                  </a>{' '}
                  for more info.
                </p>
              </div>
            </CollapsibleSection>
          </CollapsibleSection>

          <div className="rounded-lg border border-slate-200 p-3 space-y-4">
            <div className="px-1 pt-1 text-sm font-semibold text-slate-700">Additional Configuration Options</div>

            <CollapsibleSection title="Kubernetes Object Status Check" subtitle="Configure how to validate the status of your Kubernetes objects" defaultOpen>
              <Radio.Group
                value={objectStatusCheck}
                onChange={(event) => setObjectStatusCheck(event.target.value as ObjectStatusCheckMode)}
                className="flex flex-col gap-2"
              >
                <Radio value="enabled">
                  <span className="text-sm">
                    Check that Kubernetes objects are running successfully{' '}
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Recommended</span>
                  </span>
                </Radio>
                {objectStatusCheck === 'enabled' ? (
                  <div className="space-y-3">
                    <p className="m-0 text-xs text-slate-500">
                      Get real-time status updates while this step is running and validate object status before this step is marked successful.
                    </p>

                    <div className="space-y-2">
                      <Checkbox checked={stepTimeoutEnabled} onChange={(event) => setStepTimeoutEnabled(event.target.checked)}>
                        <span className="text-sm">Step timeout</span>
                      </Checkbox>
                      {stepTimeoutEnabled ? (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Timeout period in seconds</label>
                          <Input
                            size="small"
                            value={stepTimeoutSeconds}
                            onChange={(event) => setStepTimeoutSeconds(event.target.value)}
                            placeholder={DEFAULT_TIMEOUT_SECONDS}
                          />
                        </div>
                      ) : null}
                    </div>

                    <Checkbox checked={waitForJobs} onChange={(event) => setWaitForJobs(event.target.checked)}>
                      <span className="text-sm">Wait for Jobs to complete during this step</span>
                    </Checkbox>
                  </div>
                ) : null}

                <Radio value="disabled">
                  <span className="text-sm">Don&apos;t do any verification checks</span>
                </Radio>
              </Radio.Group>

              {objectStatusCheck === 'disabled' ? (
                <p className="m-0 text-xs text-slate-500">
                  Squid will mark this step complete without waiting for status updates from Kubernetes.
                </p>
              ) : null}
            </CollapsibleSection>

            <CollapsibleSection title="Referenced Packages" subtitle="Add packages to be referenced by your scripts at execution-time" defaultOpen>
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

          </div>

          <CollapsibleSection title="Conditions" subtitle="Configure when and where this step should run." defaultOpen fullWidth>
            <StepConditionsSection
              value={conditions}
              onChange={setConditions}
              projectId={projectId}
              hideRootSection
              hidePackageRequirement
              hideDisabled
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

            <CollapsibleSection
              title="Rolling Deployment"
              subtitle="Configure a rolling deployment to control the number of deployment targets this step can deploy to at once."
              defaultOpen
            >
              <Checkbox checked={false} disabled>
                <span className="text-sm">Configure a rolling deployment</span>
              </Checkbox>
            </CollapsibleSection>

            <CollapsibleSection title="Retries" subtitle="Upon failure, this step will automatically retry" defaultOpen>
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
          </CollapsibleSection>
        </div>

        <style>{`
          .kustomize-auth-credential-select.ant-select .ant-select-selector {
            min-height: 31px !important;
            height: 31px !important;
            display: flex !important;
            align-items: center !important;
          }
          .kustomize-auth-credential-select.ant-select .ant-select-selection-item,
          .kustomize-auth-credential-select.ant-select .ant-select-selection-placeholder {
            line-height: 29px !important;
          }
          .kustomize-auth-credential-select.ant-select .ant-select-selection-search-input {
            height: 29px !important;
            line-height: 29px !important;
          }
          .kustomize-auth-credential-select .ant-select-arrow {
            top: 50% !important;
            transform: translateY(-50%) !important;
            margin-top: 0 !important;
          }

        `}</style>
      </div>
    )
  },
)
