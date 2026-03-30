import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Checkbox, Input, Radio, Select, message } from 'antd'
import { CopyOutlined, MoreOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import CodeMirror from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml'
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

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.KubernetesDeployRawYaml'
const DEFAULT_STEP_NAME = 'Deploy Kubernetes YAML'
const DEFAULT_TIMEOUT_SECONDS = '180'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

const RawYamlProperties = {
  yamlSource: ['Squid.Action.KubernetesYaml.Source'],
  inlineYaml: ['Squid.Action.KubernetesYaml.InlineYaml'],
  packageFeed: ['Squid.Action.Package.FeedId'],
  packageId: ['Squid.Action.Package.PackageId'],
  scriptSyntax: ['Squid.Action.Script.Syntax'],
  namespace: ['Squid.Action.KubernetesContainers.Namespace', 'Squid.Action.Kubernetes.Namespace'],
  objectStatusCheck: ['Squid.Action.KubernetesContainers.ObjectStatusCheck'],
  objectStatusTimeoutSeconds: ['Squid.Action.KubernetesContainers.ObjectStatusCheckTimeout', 'Squid.Action.KubernetesContainers.Timeout'],
  serverSideApplyEnabled: ['Squid.Action.Kubernetes.ServerSideApply.Enabled'],
  serverSideApplyFieldManager: ['Squid.Action.Kubernetes.ServerSideApply.FieldManager'],
  serverSideApplyForceConflicts: ['Squid.Action.Kubernetes.ServerSideApply.ForceConflicts'],
  structuredConfigurationVariablesEnabled: ['Squid.Action.StructuredConfigurationVariables.Enabled', 'Squid.Action.KubernetesYaml.EnableStructuredConfigurationVariables'],
} as const

const ActionPropertyFilterSet = new Set<string>([
  ...RawYamlProperties.yamlSource,
  ...RawYamlProperties.inlineYaml,
  ...RawYamlProperties.packageFeed,
  ...RawYamlProperties.packageId,
  ...RawYamlProperties.scriptSyntax,
  ...RawYamlProperties.namespace,
  ...RawYamlProperties.objectStatusCheck,
  ...RawYamlProperties.objectStatusTimeoutSeconds,
  ...RawYamlProperties.serverSideApplyEnabled,
  ...RawYamlProperties.serverSideApplyFieldManager,
  ...RawYamlProperties.serverSideApplyForceConflicts,
  ...RawYamlProperties.structuredConfigurationVariablesEnabled,
])

const StepPropertyFilterSet = new Set<string>([
  STEP_CONDITION_EXPRESSION_PROPERTY,
  ...TARGET_ROLE_PROPERTY_NAMES,
])

type YamlSource = 'Package' | 'Inline'
type ScriptSyntax = 'PowerShell' | 'Bash'
type ObjectStatusCheckMode = 'enabled' | 'disabled'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'

interface RawYamlActionValues {
  yamlSource: YamlSource
  inlineYaml: string
  packageFeed: string
  packageId: string
  scriptSyntax: ScriptSyntax
  namespace: string
  objectStatusCheck: ObjectStatusCheckMode
  stepTimeoutEnabled: boolean
  stepTimeoutSeconds: string
  structuredConfigurationVariablesEnabled: boolean
}

function getActionProperty(action: DeploymentActionDto | undefined, names: readonly string[]): string | undefined {
  if (!action) return undefined
  for (const name of names) {
    const value = action.properties.find((property) => property.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return undefined
}

function getStepProperty(stepProperties: DeploymentStepPropertyDto[] | undefined, name: string): string {
  if (!stepProperties) return ''
  return stepProperties.find((property) => property.propertyName === name)?.propertyValue ?? ''
}

function normalizeYamlSource(value: string | undefined): YamlSource {
  if (value === 'Package') return 'Package'
  return 'Inline'
}

function normalizeScriptSyntax(value: string | undefined): ScriptSyntax {
  if (value === 'Bash') return 'Bash'
  return 'PowerShell'
}

function normalizeObjectStatusCheck(value: string | undefined): ObjectStatusCheckMode {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'disabled' || normalized === 'false' || normalized === '0' || normalized === 'no') return 'disabled'
  return 'enabled'
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

function toTrueFalse(value: boolean): 'True' | 'False' {
  return value ? 'True' : 'False'
}

function dedentYaml(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return normalized

  const minIndent = nonEmptyLines.reduce((min, line) => {
    const match = line.match(/^[ \t]*/)
    const indent = match ? match[0].length : 0
    return Math.min(min, indent)
  }, Number.POSITIVE_INFINITY)

  if (!Number.isFinite(minIndent) || minIndent <= 0) return normalized

  return lines.map((line) => {
    if (line.trim().length === 0) return ''
    return line.slice(Math.min(minIndent, line.length))
  }).join('\n')
}

function buildActionProperties(
  existingAction: DeploymentActionDto | undefined,
  values: RawYamlActionValues,
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

  pushProperty(RawYamlProperties.scriptSyntax[0], values.scriptSyntax)
  pushProperty(RawYamlProperties.namespace[0], values.namespace.trim())
  pushProperty(RawYamlProperties.objectStatusCheck[0], values.objectStatusCheck === 'enabled' ? 'True' : 'False')

  if (values.objectStatusCheck === 'enabled') {
    if (values.stepTimeoutEnabled) {
      pushProperty(RawYamlProperties.objectStatusTimeoutSeconds[0], values.stepTimeoutSeconds.trim())
    }
  }

  pushProperty(RawYamlProperties.serverSideApplyEnabled[0], 'False')
  pushProperty(RawYamlProperties.structuredConfigurationVariablesEnabled[0], toTrueFalse(values.structuredConfigurationVariablesEnabled))

  if (values.yamlSource === 'Inline') {
    pushProperty(RawYamlProperties.inlineYaml[0], values.inlineYaml)
  }
  if (values.yamlSource === 'Package') {
    pushProperty(RawYamlProperties.packageFeed[0], values.packageFeed.trim())
    pushProperty(RawYamlProperties.packageId[0], values.packageId.trim())
  }

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  runCondition: string,
  conditionExpression: string,
  targetTags: string[],
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => !StepPropertyFilterSet.has(property.propertyName),
  )
  const next: DeploymentStepPropertyDto[] = [...preserved]

  if (runCondition === 'Variable' && conditionExpression.trim()) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: conditionExpression.trim(),
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

  return next
}

export const KubernetesRawYamlEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function KubernetesRawYamlEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'
    const initialTimeout = getActionProperty(action, RawYamlProperties.objectStatusTimeoutSeconds) ?? ''
    const initialPackageFeed = getActionProperty(action, RawYamlProperties.packageFeed) ?? ''
    const initialPackageId = getActionProperty(action, RawYamlProperties.packageId) ?? ''
    const persistedYamlSource = normalizeYamlSource(getActionProperty(action, RawYamlProperties.yamlSource))
    const hasInitialPackage = initialPackageFeed.trim().length > 0 && initialPackageId.trim().length > 0
    const initialYamlSource: YamlSource = persistedYamlSource === 'Package' || hasInitialPackage ? 'Package' : 'Inline'

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [targetTags, setTargetTags] = useState<string[]>(() => step ? getTargetRoles(step) : [])
    const [yamlSource, setYamlSource] = useState<YamlSource>(initialYamlSource)
    const [inlineYaml, setInlineYaml] = useState(
      getActionProperty(action, RawYamlProperties.inlineYaml) ?? '',
    )
    const [packageFeed, setPackageFeed] = useState(
      initialPackageFeed,
    )
    const [packageId, setPackageId] = useState(
      initialPackageId,
    )
    const [scriptSyntax, setScriptSyntax] = useState<ScriptSyntax>(
      normalizeScriptSyntax(getActionProperty(action, RawYamlProperties.scriptSyntax)),
    )
    const [namespace, setNamespace] = useState(getActionProperty(action, RawYamlProperties.namespace) ?? 'default')
    const [objectStatusCheck, setObjectStatusCheck] = useState<ObjectStatusCheckMode>(
      normalizeObjectStatusCheck(getActionProperty(action, RawYamlProperties.objectStatusCheck)),
    )
    const [stepTimeoutEnabled, setStepTimeoutEnabled] = useState(
      initialTimeout.trim().length > 0 || objectStatusCheck === 'enabled',
    )
    const [stepTimeoutSeconds, setStepTimeoutSeconds] = useState(
      initialTimeout || DEFAULT_TIMEOUT_SECONDS,
    )
    const [structuredConfigurationVariablesEnabled, setStructuredConfigurationVariablesEnabled] = useState(
      normalizeBoolean(getActionProperty(action, RawYamlProperties.structuredConfigurationVariablesEnabled), false),
    )
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
      step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    )
    const [conditions, setConditions] = useState<StepConditionsValue>({
      environmentMode: initialEnvironmentMode,
      environmentIds: initialEnvironmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
      channelIds: action?.channels ?? [],
      runCondition: step?.condition ?? 'Success',
      conditionExpression: getStepProperty(step?.properties, STEP_CONDITION_EXPRESSION_PROPERTY),
      packageRequirement: step?.packageRequirement ?? 'LetSquidDecide',
      required: step?.isRequired ?? false,
      disabled: step?.isDisabled ?? false,
    })
    const [feedsLoading, setFeedsLoading] = useState(false)
    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const [packageFeedOptions, setPackageFeedOptions] = useState<{ label: string; value: string }[]>([])
    const [packageSearchTerm, setPackageSearchTerm] = useState(packageId)
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
      if (yamlSource !== 'Package' || !selectedPackageFeedId || !query) {
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
    }, [yamlSource, selectedPackageFeedId, packageSearchTerm])

    const handleCopyInlineYaml = async () => {
      try {
        await navigator.clipboard.writeText(inlineYaml)
        message.success('Copied to clipboard')
      } catch {
        message.error('Failed to copy YAML')
      }
    }

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      const normalizedInlineYaml = yamlSource === 'Inline' ? dedentYaml(inlineYaml).trim() : ''
      const normalizedPackageFeed = packageFeed.trim()
      const normalizedPackageId = packageId.trim()

      if (yamlSource === 'Inline' && !normalizedInlineYaml) {
        message.warning('Inline YAML is required')
        return
      }

      if (yamlSource === 'Package') {
        const hasFeed = normalizedPackageFeed.length > 0
        const hasPackage = normalizedPackageId.length > 0
        if (hasFeed !== hasPackage) {
          message.warning('FeedId and PackageId must both be provided, or both be empty')
          return
        }
        if (!hasFeed || !hasPackage) {
          message.warning('Package source requires both FeedId and PackageId')
          return
        }
        const parsedFeedId = Number.parseInt(normalizedPackageFeed, 10)
        if (!Number.isFinite(parsedFeedId) || parsedFeedId <= 0) {
          message.warning('FeedId must be a positive integer string')
          return
        }
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

      const actionValues: RawYamlActionValues = {
        yamlSource,
        inlineYaml: normalizedInlineYaml,
        packageFeed: normalizedPackageFeed,
        packageId: normalizedPackageId,
        scriptSyntax,
        namespace: namespace.trim() || 'default',
        objectStatusCheck,
        stepTimeoutEnabled,
        stepTimeoutSeconds: normalizedTimeout,
        structuredConfigurationVariablesEnabled,
      }
      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions.runCondition,
        conditions.conditionExpression,
        targetTags,
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
        isRequired: action?.isRequired ?? false,
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
          ? await updateDeploymentStep({ id: step.id, step: nextStep })
          : await createDeploymentStep({ processId, step: nextStep })
        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }), [
      stepName,
      targetTags,
      yamlSource,
      inlineYaml,
      packageFeed,
      packageId,
      scriptSyntax,
      namespace,
      objectStatusCheck,
      stepTimeoutEnabled,
      stepTimeoutSeconds,
      structuredConfigurationVariablesEnabled,
      startTrigger,
      conditions,
      step,
      processId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME
    const showInlineYamlEditor = yamlSource === 'Inline'
    const showPackageEditor = yamlSource === 'Package'

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
              <div className="text-xs leading-tight text-slate-400">Deploy Kubernetes YAML</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
              <a href="https://oc.to/deployKubernetesYAML" target="_blank" rel="noopener noreferrer" className="text-xs text-squid-blue hover:underline">
                Docs
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="inline-flex items-center rounded border border-slate-300 px-3 py-[5px] text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Configure features
            </button>
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

          <CollapsibleSection title="YAML Source" subtitle="Select the source of the Kubernetes resources." defaultOpen fullWidth>
            <div className="ml-[216px] space-y-4">
              <Radio.Group
                value={yamlSource}
                onChange={(event) => setYamlSource(event.target.value as YamlSource)}
                className="flex flex-col gap-2"
              >
                <Radio value="Inline">
                  <span className="text-sm">Inline YAML</span>
                </Radio>
                <Radio value="Package">
                  <span className="text-sm">Package</span>
                </Radio>
              </Radio.Group>

              {showPackageEditor ? (
                <div className="rounded-md border border-slate-300 bg-white p-3 space-y-4">
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
                        className="w-full yaml-package-feed-select"
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
                        className="w-full min-w-0 yaml-package-id-autocomplete"
                        value={packageId}
                        placeholder="k8s-manifests"
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
                    <p className="m-0 mt-5 text-xs text-slate-500">
                      Enter the ID of the package.
                      {selectedFeedName ? <> Searching in <code>{selectedFeedName}</code>.</> : null}
                    </p>
                  </div>
                </div>
              ) : null}

              {showInlineYamlEditor ? (
                <div className="rounded-md border border-slate-300 bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-3 bg-slate-100 px-3 py-2.5 min-h-[56px] border-b border-slate-300">
                    <div className="h-10 flex items-center">
                      <Select
                        value={scriptSyntax}
                        className="w-52 yaml-value-format-select"
                        options={[
                          { label: 'PowerShell', value: 'PowerShell' },
                          { label: 'Bash', value: 'Bash' },
                        ]}
                        onChange={(value) => setScriptSyntax(value as ScriptSyntax)}
                      />
                    </div>
                    <div className="flex items-center gap-1 self-center">
                      <Button type="text" icon={<CopyOutlined />} onClick={handleCopyInlineYaml} className="!text-slate-700">
                        Copy to clipboard
                      </Button>
                      <Button type="text" icon={<SettingOutlined />} className="!text-slate-700" />
                    </div>
                  </div>
                  <div className="min-h-[430px]">
                    <CodeMirror
                      value={inlineYaml}
                      onChange={(value) => setInlineYaml(value)}
                      extensions={[yaml()]}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: true,
                        highlightActiveLineGutter: true,
                        indentOnInput: true,
                      }}
                      height="430px"
                      className="yaml-inline-codemirror"
                    />
                  </div>
                </div>
              ) : null}

              {showInlineYamlEditor ? (
                <p className="m-0 text-xs text-slate-500">
                  Insert variables with <code className="rounded bg-slate-100 px-1 py-0.5">control</code> + <code className="rounded bg-slate-100 px-1 py-0.5">i</code>. Fuzzy search supported.
                </p>
              ) : null}
            </div>
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
                    <span className="text-slate-500">(recommended)</span>
                  </span>
                </Radio>
                <Radio value="disabled">
                  <span className="text-sm">Don&apos;t do any verification checks</span>
                </Radio>
              </Radio.Group>

            {objectStatusCheck === 'enabled' ? (
              <div className="space-y-3">
                  <Checkbox
                    checked={stepTimeoutEnabled}
                    onChange={(event) => setStepTimeoutEnabled(event.target.checked)}
                  >
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
              ) : (
                <p className="m-0 text-xs text-slate-500">
                  The step will be marked complete without waiting for status updates from Kubernetes.
                </p>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Structured Configuration Variables"
              subtitle="Uses variables to replace values in your YAML sources"
              defaultOpen
            >
              <Checkbox
                checked={structuredConfigurationVariablesEnabled}
                onChange={(event) => setStructuredConfigurationVariablesEnabled(event.target.checked)}
              >
                <span className="text-sm">Enable Structured Configuration Variables</span>
              </Checkbox>
              <p className="m-0 text-xs text-slate-500">
                Learn more about{' '}
                <a href="https://oc.to/StructuredConfigurationVariables" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                  Structured Configuration Variables
                </a>{' '}
                and view{' '}
                <a href="https://oc.to/StructuredVariables" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                  examples
                </a>.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Namespace" subtitle="Specify the namespace of the Kubernetes context" defaultOpen>
              <label className="mb-1 block text-xs font-medium text-slate-600">Namespace</label>
              <Input
                size="small"
                value={namespace}
                onChange={(event) => setNamespace(event.target.value)}
                placeholder="Deployment Target Namespace"
              />
            </CollapsibleSection>
          </div>

          <StepConditionsSection
            projectId={projectId}
            value={conditions}
            onChange={setConditions}
            afterRunCondition={(
              <CollapsibleSection
                title="Start Trigger"
                subtitle="Control whether this step waits for the previous step to complete, or runs in parallel with it."
                defaultOpen
              >
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
        </div>
        <style>{`
          .yaml-value-format-select.ant-select-single {
            height: 40px !important;
          }
          .yaml-value-format-select.ant-select:not(.ant-select-customize-input) .ant-select-selector {
            background: #eef2f7 !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 8px !important;
            height: 40px !important;
            display: flex !important;
            align-items: center !important;
            padding: 0 12px !important;
            box-shadow: none !important;
          }
          .yaml-value-format-select.ant-select-focused:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16) !important;
          }
          .yaml-value-format-select.ant-select-single .ant-select-selection-item {
            line-height: 40px !important;
            display: flex !important;
            align-items: center !important;
          }
          .yaml-value-format-select.ant-select-single .ant-select-selection-placeholder {
            line-height: 40px !important;
            display: flex !important;
            align-items: center !important;
          }
          .yaml-value-format-select .ant-select-arrow {
            top: 50% !important;
            transform: translateY(-50%) !important;
            margin-top: 0 !important;
            display: flex !important;
            align-items: center !important;
          }
          .yaml-package-id-autocomplete.ant-select .ant-select-selector {
            min-height: 31px !important;
            height: 31px !important;
            display: flex !important;
            align-items: center !important;
          }
          .yaml-package-feed-select.ant-select .ant-select-selector {
            min-height: 31px !important;
            height: 31px !important;
            display: flex !important;
            align-items: center !important;
          }
          .yaml-package-feed-select.ant-select .ant-select-selection-item,
          .yaml-package-feed-select.ant-select .ant-select-selection-placeholder {
            line-height: 29px !important;
          }
          .yaml-package-feed-select.ant-select .ant-select-selection-search-input {
            height: 29px !important;
            line-height: 29px !important;
          }
          .yaml-package-feed-select .ant-select-arrow {
            top: 50% !important;
            transform: translateY(-50%) !important;
            margin-top: 0 !important;
          }
          .yaml-package-id-autocomplete.ant-select .ant-select-selection-item,
          .yaml-package-id-autocomplete.ant-select .ant-select-selection-placeholder {
            line-height: 29px !important;
          }
          .yaml-package-id-autocomplete.ant-select .ant-select-selection-search-input {
            height: 29px !important;
          }
          .yaml-inline-codemirror .cm-editor {
            height: 430px !important;
            min-height: 430px !important;
            border: 0 !important;
            outline: none !important;
          }
          .yaml-inline-codemirror .cm-scroller {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            line-height: 1.5 !important;
          }
          .yaml-inline-codemirror .cm-content {
            font-size: 15px !important;
            padding: 8px 12px !important;
          }
          .yaml-inline-codemirror .cm-gutters {
            border-right: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
          }
          .yaml-inline-codemirror .cm-focused {
            outline: none !important;
          }
        `}</style>
      </div>
    )
  },
)
