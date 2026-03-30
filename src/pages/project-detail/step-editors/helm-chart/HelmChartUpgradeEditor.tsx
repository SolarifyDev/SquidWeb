import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Checkbox, Drawer, Input, Radio, Select, message } from 'antd'
import { MoreOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { getExternalFeeds, searchExternalFeedPackages, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { KeyValueListEditor, type KeyValueItem } from '../shared/KeyValueListEditor'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.HelmChartUpgrade'
const DEFAULT_STEP_NAME = 'Deploy a Helm Chart'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const STEP_RETRIES_ENABLED_PROPERTY = 'Squid.Step.RetriesEnabled'
const STEP_RETRIES_COUNT_PROPERTY = 'Squid.Step.RetriesCount'
const STEP_TIMEOUT_MINUTES_PROPERTY = 'Squid.Step.TimeoutInMinutes'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

type ChartSource = 'Package' | 'GitRepository'
type HelmClientTool = 'default' | 'local' | 'package'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'
type TemplateValueSourceType = 'Chart' | 'GitRepository' | 'Package' | 'KeyValues' | 'InlineYaml'

interface TemplateValueSource {
  id: string
  type: TemplateValueSourceType
  value: string
}

const TemplateValueSourceOptions: Array<{
  type: TemplateValueSourceType
  label: string
  description: string
}> = [
  { type: 'Chart', label: 'Files in the chart', description: 'Files sourced from the chart.' },
  { type: 'GitRepository', label: 'Files in a Git repository', description: 'Files sourced from a Git repository.' },
  { type: 'Package', label: 'Files in a package', description: 'Files sourced from a package.' },
  { type: 'KeyValues', label: 'Key values', description: 'Pass key values to Helm via --set.' },
  { type: 'InlineYaml', label: 'Inline YAML', description: 'Provide raw YAML values content.' },
]

const HelmProperties = {
  chartSource: ['Squid.Action.Helm.ChartSource'],
  packageFeed: ['Squid.Action.Package.FeedId'],
  packageId: ['Squid.Action.Package.PackageId'],
  chartPath: ['Squid.Action.Helm.ChartPath', 'Squid.Action.Helm.ChartDirectory'],
  releaseName: ['Squid.Action.Helm.ReleaseName'],
  namespace: ['Squid.Action.Kubernetes.Namespace', 'Squid.Action.KubernetesContainers.Namespace', 'Squid.Action.Helm.Namespace'],
  resetValues: ['Squid.Action.Helm.ResetValues'],
  timeout: ['Squid.Action.Helm.Timeout'],
  yamlValues: ['Squid.Action.Helm.YamlValues'],
  keyValues: ['Squid.Action.Helm.KeyValues', 'Squid.Action.Helm.TemplateValues'],
  valueSources: ['Squid.Action.Helm.ValueSources'],
  additionalArguments: ['Squid.Action.Helm.AdditionalArgs', 'Squid.Action.Helm.AdditionalArguments'],
  customHelmExecutable: ['Squid.Action.Helm.CustomHelmExecutable', 'Squid.Action.Helm.ClientPath'],
  legacyHelmClientTool: ['Squid.Action.Helm.ClientTool'],
  legacyHelmClientPackageId: ['Squid.Action.Helm.ClientPackageId'],
  gitRepositoryUrl: ['Squid.Action.Git.RepositoryUrl'],
  gitReference: ['Squid.Action.Git.Reference'],
  gitChartPath: ['Squid.Action.Helm.Git.ChartPath'],
  scriptSyntax: ['Squid.Action.Script.Syntax'],
} as const

interface HelmActionValues {
  chartSource: ChartSource
  packageFeed: string
  packageId: string
  chartPath: string
  releaseName: string
  namespace: string
  resetValues: boolean
  timeout: string
  templateValueSources: TemplateValueSource[]
  additionalArguments: string
  helmClientTool: HelmClientTool
  helmClientPath: string
  helmClientPackageId: string
  gitRepositoryUrl: string
  gitReference: string
  gitChartPath: string
}

const ActionPropertyFilterSet = new Set<string>(Object.values(HelmProperties).flat())
const StepPropertyFilterSet = new Set<string>([
  STEP_CONDITION_EXPRESSION_PROPERTY,
  STEP_RETRIES_ENABLED_PROPERTY,
  STEP_RETRIES_COUNT_PROPERTY,
  STEP_TIMEOUT_MINUTES_PROPERTY,
  ...TARGET_ROLE_PROPERTY_NAMES,
])

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

function normalizeChartSource(value: string | undefined): ChartSource {
  return value === 'GitRepository' ? 'GitRepository' : 'Package'
}

function normalizeHelmClientTool(value: string | undefined): HelmClientTool {
  if (value === 'local') return 'local'
  return 'default'
}

function resolveHelmClientTool(customExecutable: string | undefined, legacyTool: string | undefined): HelmClientTool {
  const normalizedLegacyTool = normalizeHelmClientTool(legacyTool)
  if (normalizedLegacyTool !== 'default') return normalizedLegacyTool
  if (customExecutable?.trim()) return 'local'
  return 'default'
}

function normalizeBoolean(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseTemplateValues(rawValue: string | undefined): KeyValueItem[] {
  if (!rawValue?.trim()) return []

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        const source = item && typeof item === 'object' ? item as Record<string, unknown> : {}
        const key = String(source.Key ?? source.key ?? source.Name ?? source.name ?? '')
        const value = String(source.Value ?? source.value ?? '')
        return { key, value }
      })
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: String(value ?? ''),
      }))
    }
  } catch {
    // Fallback to raw text lines below.
  }

  return rawValue
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('=')
      if (separator <= 0) return { key: line, value: '' }
      return {
        key: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      }
    })
}

function serializeTemplateValues(items: KeyValueItem[]): string {
  const normalized = items
    .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
    .filter((item) => item.key)
  const asObject = normalized.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value
    return acc
  }, {})
  return JSON.stringify(asObject)
}

function createTemplateValueSource(type: TemplateValueSourceType, value: string): TemplateValueSource {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    value,
  }
}

function isTemplateValueSourceSupported(type: TemplateValueSourceType): boolean {
  return type === 'InlineYaml' || type === 'KeyValues'
}

function normalizeTemplateValueSourceValue(source: TemplateValueSource): string {
  if (source.type !== 'KeyValues') return source.value
  return serializeTemplateValues(parseTemplateValues(source.value))
}

function buildTemplateValueSourcesForSave(sources: TemplateValueSource[]): TemplateValueSource[] {
  const normalized = sources
    .map((source) => ({
      ...source,
      value: normalizeTemplateValueSourceValue(source).trim(),
    }))
    .filter((source) => source.value.length > 0)
  return normalized
}

function parseTemplateValueSources(
  rawValueSources: string | undefined,
  legacyYamlValues: string | undefined,
  legacyKeyValues: string | undefined,
): TemplateValueSource[] {
  const fromValueSources: TemplateValueSource[] = []

  try {
    const parsed = JSON.parse(rawValueSources ?? '') as unknown
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const source = item as Record<string, unknown>
        const typeRaw = String(source.Type ?? source.type ?? '').trim()
        const value = String(source.Value ?? source.value ?? '')
        if (!typeRaw || !value.trim()) continue

        const type = typeRaw as TemplateValueSourceType
        if (!['Chart', 'GitRepository', 'Package', 'KeyValues', 'InlineYaml'].includes(type)) continue
        fromValueSources.push(createTemplateValueSource(type, type === 'KeyValues' ? normalizeTemplateValueSourceValue({ id: '', type, value }) : value))
      }
    }
  } catch {
    // noop
  }

  if (fromValueSources.length > 0) return fromValueSources

  const fallback: TemplateValueSource[] = []
  if (legacyYamlValues?.trim()) fallback.push(createTemplateValueSource('InlineYaml', legacyYamlValues))
  if (legacyKeyValues?.trim()) {
    const normalizedKeyValues = normalizeTemplateValueSourceValue({
      id: '',
      type: 'KeyValues',
      value: legacyKeyValues,
    })
    if (normalizedKeyValues.trim()) fallback.push(createTemplateValueSource('KeyValues', normalizedKeyValues))
  }
  return fallback
}

function getTemplateValueSourceSummary(source: TemplateValueSource): string {
  if (source.type === 'InlineYaml') {
    const firstLine = source.value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ''
    return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
  }
  if (source.type === 'KeyValues') {
    const count = parseTemplateValues(source.value).filter((item) => item.key.trim()).length
    return `${count} key value${count === 1 ? '' : 's'}`
  }
  const compact = source.value.replace(/\s+/g, ' ').trim()
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
}

function buildActionProperties(existingAction: DeploymentActionDto | undefined, values: HelmActionValues): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !ActionPropertyFilterSet.has(property.propertyName) && !property.propertyName.startsWith('Octopus.'),
  )
  const next: DeploymentActionPropertyDto[] = [...preserved]
  const hasFeed = values.packageFeed.trim().length > 0
  const hasPackage = values.packageId.trim().length > 0
  const useFeedPackage = hasFeed && hasPackage

  if (useFeedPackage) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.packageFeed[0],
      propertyValue: values.packageFeed.trim(),
    })
  }
  if (values.packageId.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.packageId[0],
      propertyValue: values.packageId.trim(),
    })
  }
  if (values.chartPath.trim() && !useFeedPackage) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.chartPath[0],
      propertyValue: values.chartPath.trim(),
    })
  }

  if (values.releaseName.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.releaseName[0],
      propertyValue: values.releaseName.trim(),
    })
  }
  if (values.namespace.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.namespace[0],
      propertyValue: values.namespace.trim(),
    })
  }

  next.push({
    id: 0,
    actionId: existingAction?.id ?? 0,
    propertyName: HelmProperties.resetValues[0],
    propertyValue: values.resetValues ? 'True' : 'False',
  })

  if (values.timeout.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.timeout[0],
      propertyValue: values.timeout.trim(),
    })
  }

  const normalizedSources = buildTemplateValueSourcesForSave(values.templateValueSources)
  const legacyYamlValues = normalizedSources
    .filter((source) => source.type === 'InlineYaml')
    .map((source) => source.value)
    .join('\n')
  const mergedKeyValues = normalizedSources
    .filter((source) => source.type === 'KeyValues')
    .flatMap((source) => parseTemplateValues(source.value))
    .filter((item) => item.key.trim())
  const serializedLegacyKeyValues = mergedKeyValues.length > 0 ? serializeTemplateValues(mergedKeyValues) : ''

  if (legacyYamlValues.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.yamlValues[0],
      propertyValue: legacyYamlValues,
    })
  }

  if (serializedLegacyKeyValues) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.keyValues[0],
      propertyValue: serializedLegacyKeyValues,
    })
  }

  if (normalizedSources.length > 0) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.valueSources[0],
      propertyValue: JSON.stringify(
        normalizedSources.map((source) => ({
          Type: source.type,
          Value: source.value,
        })),
      ),
    })
  }

  if (values.additionalArguments.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.additionalArguments[0],
      propertyValue: values.additionalArguments.trim(),
    })
  }

  if (values.helmClientTool === 'local' && values.helmClientPath.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HelmProperties.customHelmExecutable[0],
      propertyValue: values.helmClientPath.trim(),
    })
  }

  next.push({
    id: 0,
    actionId: existingAction?.id ?? 0,
    propertyName: HelmProperties.scriptSyntax[0],
    propertyValue: 'Bash',
  })

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  targetTags: string[],
  retriesEnabled: boolean,
  retryCount: number,
  timeoutMinutes: number,
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => !StepPropertyFilterSet.has(property.propertyName),
  )
  const next = [...preserved]

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
      propertyValue: 'True',
    })
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_RETRIES_COUNT_PROPERTY,
      propertyValue: String(Math.min(Math.max(retryCount, 1), 3)),
    })
  }

  if (timeoutMinutes > 0) {
    next.push({
      id: 0,
      stepId,
      propertyName: STEP_TIMEOUT_MINUTES_PROPERTY,
      propertyValue: String(timeoutMinutes),
    })
  }

  return next
}

export const HelmChartUpgradeEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function HelmChartUpgradeEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const action = step?.actions[0]
    const initialTemplateValueSources = parseTemplateValueSources(
      getActionProperty(action, HelmProperties.valueSources),
      getActionProperty(action, HelmProperties.yamlValues),
      getActionProperty(action, HelmProperties.keyValues),
    )
    const initialCustomHelmExecutable = getActionProperty(action, HelmProperties.customHelmExecutable) ?? ''
    const initialLegacyHelmClientTool = getActionProperty(action, HelmProperties.legacyHelmClientTool)
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [targetTags, setTargetTags] = useState<string[]>(() => (step ? getTargetRoles(step) : []))
    const [chartSource, setChartSource] = useState<ChartSource>(
      normalizeChartSource(getActionProperty(action, HelmProperties.chartSource)),
    )
    const [packageFeed, setPackageFeed] = useState(
      getActionProperty(action, HelmProperties.packageFeed) ?? '',
    )
    const [packageId, setPackageId] = useState(
      getActionProperty(action, HelmProperties.packageId) ?? '',
    )
    const [chartPath, setChartPath] = useState(
      getActionProperty(action, HelmProperties.chartPath) ?? '',
    )
    const [gitRepositoryUrl, setGitRepositoryUrl] = useState(
      getActionProperty(action, HelmProperties.gitRepositoryUrl) ?? '',
    )
    const [gitReference, setGitReference] = useState(
      getActionProperty(action, HelmProperties.gitReference) ?? 'main',
    )
    const [gitChartPath, setGitChartPath] = useState(
      getActionProperty(action, HelmProperties.gitChartPath) ?? '',
    )
    const [releaseName, setReleaseName] = useState(
      getActionProperty(action, HelmProperties.releaseName) ?? '',
    )
    const [namespace, setNamespace] = useState(
      getActionProperty(action, HelmProperties.namespace) ?? '',
    )
    const [resetValues, setResetValues] = useState(
      normalizeBoolean(getActionProperty(action, HelmProperties.resetValues)),
    )
    const [timeout, setTimeout] = useState(
      getActionProperty(action, HelmProperties.timeout) ?? '',
    )
    const [templateValueSources, setTemplateValueSources] = useState<TemplateValueSource[]>(initialTemplateValueSources)
    const [additionalArguments, setAdditionalArguments] = useState(
      getActionProperty(action, HelmProperties.additionalArguments) ?? '',
    )
    const [helmClientTool, setHelmClientTool] = useState<HelmClientTool>(
      resolveHelmClientTool(initialCustomHelmExecutable, initialLegacyHelmClientTool),
    )
    const [helmClientPath, setHelmClientPath] = useState(
      initialCustomHelmExecutable,
    )
    const [helmClientPackageId, setHelmClientPackageId] = useState(
      getActionProperty(action, HelmProperties.legacyHelmClientPackageId) ?? '',
    )
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(
      step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    )
    const [retriesEnabled, setRetriesEnabled] = useState(
      normalizeBoolean(getStepProperty(step?.properties, STEP_RETRIES_ENABLED_PROPERTY)),
    )
    const [retryCount, setRetryCount] = useState(
      parsePositiveInteger(getStepProperty(step?.properties, STEP_RETRIES_COUNT_PROPERTY), 1),
    )
    const [stepTimeoutMinutes, setStepTimeoutMinutes] = useState(() => {
      const parsed = Number.parseInt(getStepProperty(step?.properties, STEP_TIMEOUT_MINUTES_PROPERTY), 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    })
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
    const [templateValueDrawerOpen, setTemplateValueDrawerOpen] = useState(false)
    const [editingTemplateValueSourceIndex, setEditingTemplateValueSourceIndex] = useState<number | null>(null)
    const [templateValueSourceType, setTemplateValueSourceType] = useState<TemplateValueSourceType>('InlineYaml')
    const [templateValueInlineYaml, setTemplateValueInlineYaml] = useState('')
    const [templateValueKeyValues, setTemplateValueKeyValues] = useState<KeyValueItem[]>([])

    const loadFeeds = useCallback(async () => {
      setFeedsLoading(true)
      try {
        const response = await getExternalFeeds({ pageSize: 1000 })
        const sortedFeeds = [...(response.externalFeeds ?? [])].sort((a, b) => a.name.localeCompare(b.name))
        const next = sortedFeeds.map((feed) => ({ label: feed.name, value: String(feed.id) }))
        setFeeds(sortedFeeds)
        setPackageFeedOptions(next)
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

    useEffect(() => {
      const query = packageSearchTerm.trim()
      if (chartSource !== 'Package' || !selectedPackageFeedId || !query) {
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
    }, [chartSource, selectedPackageFeedId, packageSearchTerm])

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      const hasFeed = packageFeed.trim().length > 0
      const hasPackage = packageId.trim().length > 0
      if (hasFeed !== hasPackage) {
        message.warning('FeedId and PackageId must both be provided, or both be empty')
        return
      }

      if (chartSource === 'GitRepository') {
        message.warning('Git repository chart source is not supported by backend yet')
        return
      }

      if (helmClientTool === 'local' && !helmClientPath.trim()) {
        message.warning('Helm client path is required when using local Helm client')
        return
      }

      const actionValues: HelmActionValues = {
        chartSource,
        packageFeed,
        packageId,
        chartPath,
        releaseName,
        namespace,
        resetValues,
        timeout,
        templateValueSources,
        additionalArguments,
        helmClientTool,
        helmClientPath,
        helmClientPackageId,
        gitRepositoryUrl,
        gitReference,
        gitChartPath,
      }
      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions,
        targetTags,
        retriesEnabled,
        retryCount,
        stepTimeoutMinutes,
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

      const nextStep = {
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
      chartSource,
      packageFeed,
      packageId,
      chartPath,
      gitRepositoryUrl,
      gitReference,
      gitChartPath,
      releaseName,
      namespace,
      resetValues,
      timeout,
      templateValueSources,
      additionalArguments,
      helmClientTool,
      helmClientPath,
      helmClientPackageId,
      startTrigger,
      retriesEnabled,
      retryCount,
      stepTimeoutMinutes,
      conditions,
      step,
      processId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME
    const selectedFeedName = useMemo(
      () => feeds.find((feed) => String(feed.id) === packageFeed)?.name ?? '',
      [feeds, packageFeed],
    )
    const selectedTemplateValueSourceOption = useMemo(
      () => TemplateValueSourceOptions.find((option) => option.type === templateValueSourceType),
      [templateValueSourceType],
    )
    const resetTemplateValueDrawer = useCallback((nextType: TemplateValueSourceType = 'InlineYaml') => {
      setEditingTemplateValueSourceIndex(null)
      setTemplateValueSourceType(nextType)
      setTemplateValueInlineYaml('')
      setTemplateValueKeyValues([])
    }, [])
    const openTemplateValueDrawer = useCallback(() => {
      resetTemplateValueDrawer()
      setTemplateValueDrawerOpen(true)
    }, [resetTemplateValueDrawer])
    const openTemplateValueSourceEditor = useCallback((index: number, source: TemplateValueSource) => {
      if (!isTemplateValueSourceSupported(source.type)) {
        message.warning('This template values source type is not editable yet')
        return
      }

      setEditingTemplateValueSourceIndex(index)
      setTemplateValueSourceType(source.type)

      if (source.type === 'InlineYaml') {
        setTemplateValueInlineYaml(source.value)
        setTemplateValueKeyValues([])
      } else if (source.type === 'KeyValues') {
        setTemplateValueKeyValues(parseTemplateValues(source.value))
        setTemplateValueInlineYaml('')
      }

      setTemplateValueDrawerOpen(true)
    }, [])
    const closeTemplateValueDrawer = useCallback(() => {
      setTemplateValueDrawerOpen(false)
      resetTemplateValueDrawer()
    }, [resetTemplateValueDrawer])
    const saveTemplateValueSource = useCallback(() => {
      if (!isTemplateValueSourceSupported(templateValueSourceType)) {
        message.warning('This template values source is not supported by backend yet')
        return
      }

      if (templateValueSourceType === 'InlineYaml') {
        const normalizedInlineYaml = templateValueInlineYaml.trim()
        if (!normalizedInlineYaml) {
          message.warning('Inline YAML cannot be empty')
          return
        }
        setTemplateValueSources((prev) => {
          if (editingTemplateValueSourceIndex == null) return [...prev, createTemplateValueSource('InlineYaml', normalizedInlineYaml)]
          return prev.map((source, index) => (
            index === editingTemplateValueSourceIndex
              ? { ...source, type: 'InlineYaml', value: normalizedInlineYaml }
              : source
          ))
        })
        setTemplateValueDrawerOpen(false)
        resetTemplateValueDrawer()
        return
      }

      const normalizedKeyValues = templateValueKeyValues.filter((item) => item.key.trim())
      if (normalizedKeyValues.length === 0) {
        message.warning('Please add at least one key value')
        return
      }
      const serializedKeyValues = serializeTemplateValues(normalizedKeyValues)
      setTemplateValueSources((prev) => {
        if (editingTemplateValueSourceIndex == null) return [...prev, createTemplateValueSource('KeyValues', serializedKeyValues)]
        return prev.map((source, index) => (
          index === editingTemplateValueSourceIndex
            ? { ...source, type: 'KeyValues', value: serializedKeyValues }
            : source
        ))
      })
      setTemplateValueDrawerOpen(false)
      resetTemplateValueDrawer()
    }, [
      editingTemplateValueSourceIndex,
      templateValueInlineYaml,
      templateValueKeyValues,
      templateValueSourceType,
      resetTemplateValueDrawer,
    ])

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
              <div className="text-xs leading-tight text-slate-400">Deploy a Helm chart to Kubernetes</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
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

          <CollapsibleSection title="Chart Source" subtitle="Select the source of the chart." defaultOpen>
            <p className="m-0 text-xs text-slate-500">Charts can be contained in a package or a Git repository.</p>
            <Radio.Group value={chartSource} onChange={(event) => setChartSource(event.target.value as ChartSource)} className="flex flex-col gap-2">
              <Radio value="Package">
                <span className="text-sm">Package</span>
              </Radio>
              <Radio value="GitRepository">
                <span className="text-sm">Git repository</span>
              </Radio>
            </Radio.Group>
            {chartSource === 'GitRepository' ? (
              <p className="mb-0 mt-1 text-xs text-amber-600">
                Git repository chart source is not supported by backend yet and cannot be saved.
              </p>
            ) : null}
          </CollapsibleSection>

          {chartSource === 'Package' ? (
            <CollapsibleSection title="Chart Package" subtitle="Choose the package containing the chart you want to deploy." defaultOpen fullWidth>
              <div className="ml-[216px] space-y-4">
                <p className="m-0 text-xs text-slate-500">
                  Select an available package feed and then choose a package ID from that feed.
                </p>
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
                      className="w-full"
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
                      className="w-full min-w-0"
                      value={packageId}
                      placeholder="helm-chart-package-id"
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
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                      aria-label="Insert Variable"
                      onClick={() => message.info('Insert Variable is not available yet')}
                    >
                      <span className="text-[10px] font-semibold">{'{ }'}</span>
                    </button>
                  </div>
                  <p className="mb-0 mt-4 text-xs leading-relaxed text-slate-500">
                    Enter the ID of the package containing your Helm chart.
                    {selectedFeedName ? <> Searching in <code>{selectedFeedName}</code>.</> : null}
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          ) : (
            <CollapsibleSection title="Git Repository" subtitle="Configure the Git source containing your chart." defaultOpen fullWidth>
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
                <p className="mb-0 mt-1 text-xs text-slate-500">Branch, tag, or commit SHA to deploy from.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Chart Path</label>
                <Input
                  size="small"
                  value={gitChartPath}
                  onChange={(event) => setGitChartPath(event.target.value)}
                  placeholder="charts/my-service"
                />
                <p className="mb-0 mt-1 text-xs text-slate-500">Optional relative path to the chart directory inside the repository.</p>
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Chart Path" subtitle="Path to local/URL chart when not using FeedId + PackageId." defaultOpen>
            <div className="flex items-center gap-2">
              <Input
                size="small"
                value={chartPath}
                onChange={(event) => setChartPath(event.target.value)}
                placeholder="."
                disabled={chartSource === 'Package' && !!packageFeed.trim() && !!packageId.trim()}
              />
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Insert Variable"
                onClick={() => message.info('Insert Variable is not available yet')}
              >
                <span className="text-[10px] font-semibold">{'{ }'}</span>
              </button>
            </div>
            {chartSource === 'Package' && !!packageFeed.trim() && !!packageId.trim() ? (
              <p className="mb-0 mt-1 text-xs text-slate-500">
                FeedId + PackageId are set. ChartPath will be ignored by backend.
              </p>
            ) : null}
          </CollapsibleSection>

          <div className="rounded-lg border border-slate-200 p-3 space-y-4">
            <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Upgrade Options</div>

            <CollapsibleSection title="Kubernetes Release" subtitle="If a release by this name does not already exist, run an install." defaultOpen>
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  value={releaseName}
                  onChange={(event) => setReleaseName(event.target.value)}
                  placeholder="#{Squid.Action.Name | ToLower}-#{Squid.Environment.Name | ToLower}"
                />
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Insert Variable"
                  onClick={() => message.info('Insert Variable is not available yet')}
                >
                  <span className="text-[10px] font-semibold">{'{ }'}</span>
                </button>
              </div>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Helm release names must be unique across the cluster and may only contain lowercase alphanumeric and dash characters.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Namespace" subtitle="Specify the namespace the chart will be installed into." defaultOpen>
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  value={namespace}
                  onChange={(event) => setNamespace(event.target.value)}
                  placeholder="default"
                />
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Insert Variable"
                  onClick={() => message.info('Insert Variable is not available yet')}
                >
                  <span className="text-[10px] font-semibold">{'{ }'}</span>
                </button>
              </div>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                If left empty, the deployment target namespace is used.
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              title="Reset Values"
              subtitle="When upgrading, reset the values to the ones built into the chart with those provided in the current deployment."
              defaultOpen
            >
              <Checkbox checked={resetValues} onChange={(event) => setResetValues(event.target.checked)}>
                <span className="text-sm">Reset Values</span>
              </Checkbox>
              <p className="mb-0 mt-1 text-xs text-slate-500">Corresponds to <code>--reset-values</code> Helm argument.</p>
            </CollapsibleSection>

            <CollapsibleSection title="Timeout" subtitle="Duration to wait for any individual Kubernetes operation (for example jobs for hooks)." defaultOpen>
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  value={timeout}
                  onChange={(event) => setTimeout(event.target.value)}
                  placeholder="300s"
                />
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Insert Variable"
                  onClick={() => message.info('Insert Variable is not available yet')}
                >
                  <span className="text-[10px] font-semibold">{'{ }'}</span>
                </button>
              </div>
              <p className="mb-0 mt-1 text-xs text-slate-500">
                Helm expects a duration format such as <code>300s</code>.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Template Values" subtitle="Provide one or multiple values sources to be passed into the chart." defaultOpen fullWidth>
              <div className="flex justify-end pr-9">
                <button
                  type="button"
                  onClick={openTemplateValueDrawer}
                  className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <PlusOutlined style={{ fontSize: 11 }} />
                  Add
                </button>
              </div>
              {templateValueSources.length === 0 ? (
                <div className="text-xs text-slate-500">No template value sources configured yet.</div>
              ) : (
                <div className="space-y-2">
                  {templateValueSources.map((source, index) => {
                    const sourceOption = TemplateValueSourceOptions.find((option) => option.type === source.type)
                    return (
                      <div
                        key={source.id}
                        className="cursor-pointer rounded border border-slate-200 bg-white px-3 py-2 transition-colors hover:bg-slate-50"
                        onClick={() => openTemplateValueSourceEditor(index, source)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-700">
                              {sourceOption?.label ?? source.type}
                              {!isTemplateValueSourceSupported(source.type) ? ' (unsupported)' : ''}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{getTemplateValueSourceSummary(source) || 'No content'}</div>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                            aria-label="Remove template value source"
                            onClick={(event) => {
                              event.stopPropagation()
                              setTemplateValueSources((prev) => prev.filter((item) => item.id !== source.id))
                            }}
                          >
                            <span className="text-base leading-none">×</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Additional Arguments" subtitle={<span>Provide additional arguments passed to the <code>helm upgrade</code> command.</span>} defaultOpen>
              <div className="flex items-start gap-2">
                <Input.TextArea
                  value={additionalArguments}
                  onChange={(event) => setAdditionalArguments(event.target.value)}
                  autoSize={{ minRows: 2, maxRows: 8 }}
                  placeholder="--recreate-pods"
                />
                <button
                  type="button"
                  className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Insert Variable"
                  onClick={() => message.info('Insert Variable is not available yet')}
                >
                  <span className="text-[10px] font-semibold">{'{ }'}</span>
                </button>
              </div>
            </CollapsibleSection>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-4">
            <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Connection</div>

            <CollapsibleSection title="Helm Client Tool" subtitle="Select the Helm client tool to invoke." defaultOpen fullWidth>
              <Radio.Group value={helmClientTool} onChange={(event) => setHelmClientTool(event.target.value as HelmClientTool)} className="flex flex-col gap-2">
                <Radio value="default">
                  <span className="text-sm">Invoke <code>helm</code> command</span>
                </Radio>
                <div className="pl-6 text-xs text-slate-500">The Helm client will be available on the worker as the <code>helm</code> command.</div>
                <Radio value="local">
                  <span className="text-sm">Helm client tool available from another path</span>
                </Radio>
                <div className="pl-6 text-xs text-slate-500">The Helm client is available via a specific path.</div>
                <Radio value="package" disabled>
                  <span className="text-sm">Custom packaged Helm client tool (coming soon)</span>
                </Radio>
                <div className="pl-6 text-xs text-slate-500">This option is not supported yet.</div>
              </Radio.Group>

              {helmClientTool === 'local' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Helm client path</label>
                  <Input
                    size="small"
                    value={helmClientPath}
                    onChange={(event) => setHelmClientPath(event.target.value)}
                    placeholder="/usr/local/bin/helm"
                  />
                </div>
              ) : null}
            </CollapsibleSection>
          </div>

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

            <CollapsibleSection title="Time out" subtitle="If this step is still running after the set time has lapsed, the task will fail." defaultOpen>
              <label className="mb-1 block text-xs font-medium text-slate-600">Time out after minutes (0 means never time out)</label>
              <Input
                size="small"
                type="number"
                min={0}
                value={String(stepTimeoutMinutes)}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10)
                  if (!Number.isFinite(parsed) || parsed < 0) {
                    setStepTimeoutMinutes(0)
                    return
                  }
                  setStepTimeoutMinutes(parsed)
                }}
              />
            </CollapsibleSection>
          </CollapsibleSection>
        </div>

        <Drawer
          open={templateValueDrawerOpen}
          onClose={closeTemplateValueDrawer}
          width={640}
          title={editingTemplateValueSourceIndex != null ? 'Edit Template Values' : 'Add Template Values'}
          destroyOnClose={false}
          extra={(
            <div className="flex items-center gap-2">
              <Button onClick={closeTemplateValueDrawer}>Cancel</Button>
              <Button type="primary" onClick={saveTemplateValueSource}>Save</Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <CollapsibleSection title="Source" subtitle="Choose your template values source." defaultOpen fullWidth>
              <Radio.Group
                value={templateValueSourceType}
                onChange={(event) => {
                  const nextType = event.target.value as TemplateValueSourceType
                  setTemplateValueSourceType(nextType)
                }}
                className="flex flex-col gap-2"
              >
                {TemplateValueSourceOptions.map((option) => (
                  <Radio
                    key={option.type}
                    value={option.type}
                    disabled={!isTemplateValueSourceSupported(option.type)}
                  >
                    <span className="text-sm">
                      {option.label}
                      {!isTemplateValueSourceSupported(option.type) ? ' (coming soon)' : ''}
                    </span>
                  </Radio>
                ))}
              </Radio.Group>
            </CollapsibleSection>

            {templateValueSourceType === 'InlineYaml' ? (
              <CollapsibleSection
                title="Inline YAML"
                subtitle="Provide inline YAML content as values."
                defaultOpen
                fullWidth
              >
                <Input.TextArea
                  value={templateValueInlineYaml}
                  onChange={(event) => setTemplateValueInlineYaml(event.target.value)}
                  autoSize={{ minRows: 5, maxRows: 14 }}
                  placeholder={'replicaCount: 2\nservice:\n  type: ClusterIP'}
                />
              </CollapsibleSection>
            ) : null}

            {templateValueSourceType === 'KeyValues' ? (
              <CollapsibleSection
                title="Key values"
                subtitle="Pass key values to Helm via --set."
                defaultOpen
                fullWidth
              >
                <KeyValueListEditor
                  items={templateValueKeyValues}
                  onChange={setTemplateValueKeyValues}
                  keyLabel="Key"
                  valueLabel="Value"
                  addLabel="Add"
                  layout="octopus"
                />
              </CollapsibleSection>
            ) : null}

            {!isTemplateValueSourceSupported(templateValueSourceType) ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {selectedTemplateValueSourceOption?.label ?? 'This source'} is not supported by backend yet.
              </div>
            ) : null}
          </div>
        </Drawer>
      </div>
    )
  },
)
