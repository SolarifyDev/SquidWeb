import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, Checkbox, Input, Modal, Radio, Select, message } from 'antd'
import { CloseOutlined, MoreOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
const ACTION_TYPE = 'Squid.IIS'
const DEFAULT_STEP_NAME = 'Deploy to IIS'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'
const TARGET_ROLE_PROPERTY_NAMES = ['Squid.Action.TargetRoles', 'TargetRoles'] as const

const PackageProperties = {
  feedId: ['Squid.Action.Package.FeedId', 'Octopus.Action.Package.FeedId'],
  packageId: ['Squid.Action.Package.PackageId', 'Octopus.Action.Package.PackageId'],
  version: ['Squid.Action.Package.PackageVersion', 'Octopus.Action.Package.PackageVersion'],
} as const

const IisProperties = {
  deploymentType: ['Squid.Action.IIS.DeploymentType', 'Octopus.Action.IIS.DeploymentType'],
  webSiteName: ['Squid.Action.IIS.WebSiteName', 'Octopus.Action.IIS.WebSiteName'],
  virtualDirectoryName: ['Squid.Action.IIS.VirtualDirectoryName', 'Octopus.Action.IIS.VirtualDirectoryName'],
  webApplicationName: ['Squid.Action.IIS.WebApplicationName', 'Octopus.Action.IIS.WebApplicationName'],
  physicalPathMode: ['Squid.Action.IIS.PhysicalPathMode', 'Octopus.Action.IIS.PhysicalPathMode'],
  relativePath: ['Squid.Action.IIS.RelativePath', 'Octopus.Action.IIS.RelativePath'],
  startWebSite: ['Squid.Action.IIS.StartWebSite', 'Octopus.Action.IIS.StartWebSite'],
  applicationPoolName: ['Squid.Action.IIS.ApplicationPoolName', 'Octopus.Action.IIS.ApplicationPoolName'],
  applicationPoolClr: ['Squid.Action.IIS.ApplicationPoolClrVersion', 'Octopus.Action.IIS.ApplicationPoolClrVersion'],
  applicationPoolIdentity: ['Squid.Action.IIS.ApplicationPoolIdentity', 'Octopus.Action.IIS.ApplicationPoolIdentity'],
  startApplicationPool: ['Squid.Action.IIS.StartApplicationPool', 'Octopus.Action.IIS.StartApplicationPool'],
  bindings: ['Squid.Action.IIS.Bindings', 'Octopus.Action.IIS.Bindings'],
  existingBindings: ['Squid.Action.IIS.ExistingBindings', 'Octopus.Action.IIS.ExistingBindings'],
  authAnonymous: ['Squid.Action.IIS.Auth.Anonymous', 'Octopus.Action.IIS.Auth.Anonymous'],
  authBasic: ['Squid.Action.IIS.Auth.Basic', 'Octopus.Action.IIS.Auth.Basic'],
  authWindows: ['Squid.Action.IIS.Auth.Windows', 'Octopus.Action.IIS.Auth.Windows'],
  replaceConfigVariables: ['Squid.Action.IIS.ReplaceConfigVariables', 'Octopus.Action.IIS.ReplaceConfigVariables'],
  runConfigTransforms: ['Squid.Action.IIS.RunConfigTransforms', 'Octopus.Action.IIS.RunConfigTransforms'],
  additionalTransforms: ['Squid.Action.IIS.AdditionalTransforms', 'Octopus.Action.IIS.AdditionalTransforms'],
} as const

const ActionPropertyFilterSet = new Set<string>([
  ...Object.values(PackageProperties).flat(),
  ...Object.values(IisProperties).flat(),
])
const StepPropertyFilterSet = new Set<string>([STEP_CONDITION_EXPRESSION_PROPERTY, ...TARGET_ROLE_PROPERTY_NAMES])

type IisDeploymentType = 'webSite' | 'virtualDirectory' | 'webApplication'
type PhysicalPathMode = 'packageRoot' | 'relativeToPackageRoot'
type ExistingBindingsMode = 'Replace' | 'Merge'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'
type AppPoolClrVersion = 'v2.0' | 'v4.0' | ''
type AppPoolIdentity = 'ApplicationPoolIdentity' | 'NetworkService' | 'LocalService' | 'LocalSystem'
type BindingProtocol = 'http' | 'https'

interface IisBinding {
  id: string
  protocol: BindingProtocol
  port: string
  ipAddress: string
  hostName: string
  enabled: boolean
}

interface IisActionValues {
  packageFeedId: string
  packageId: string
  packageVersion: string
  deploymentType: IisDeploymentType
  webSiteName: string
  virtualDirectoryName: string
  webApplicationName: string
  physicalPathMode: PhysicalPathMode
  relativePath: string
  startWebSite: boolean
  appPoolName: string
  appPoolClrVersion: AppPoolClrVersion
  appPoolIdentity: AppPoolIdentity
  startAppPool: boolean
  bindings: IisBinding[]
  existingBindings: ExistingBindingsMode
  authAnonymous: boolean
  authBasic: boolean
  authWindows: boolean
  replaceConfigVariables: boolean
  runConfigTransforms: boolean
  additionalTransforms: string
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

function normalizeBoolean(value: string | undefined, fallback = false): boolean {
  if (!value?.trim()) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

function normalizeDeploymentType(value: string | undefined): IisDeploymentType {
  if (value === 'virtualDirectory') return 'virtualDirectory'
  if (value === 'webApplication') return 'webApplication'
  return 'webSite'
}

function normalizePhysicalPathMode(value: string | undefined): PhysicalPathMode {
  return value === 'relativeToPackageRoot' ? 'relativeToPackageRoot' : 'packageRoot'
}

function normalizeExistingBindings(value: string | undefined): ExistingBindingsMode {
  return value === 'Merge' ? 'Merge' : 'Replace'
}

function normalizeClrVersion(value: string | undefined): AppPoolClrVersion {
  if (value === 'v2.0') return 'v2.0'
  if (value === '') return ''
  return 'v4.0'
}

function normalizeIdentity(value: string | undefined): AppPoolIdentity {
  if (value === 'NetworkService') return 'NetworkService'
  if (value === 'LocalService') return 'LocalService'
  if (value === 'LocalSystem') return 'LocalSystem'
  return 'ApplicationPoolIdentity'
}

function createDefaultBinding(): IisBinding {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    protocol: 'http',
    port: '80',
    ipAddress: '',
    hostName: '',
    enabled: true,
  }
}

function parseBindings(value: string | undefined): IisBinding[] {
  if (!value?.trim()) return [createDefaultBinding()]

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return [createDefaultBinding()]
    const next = parsed
      .map((entry): IisBinding | null => {
        if (!entry || typeof entry !== 'object') return null
        const source = entry as Record<string, unknown>
        const protocol = String(source.protocol ?? source.Protocol ?? 'http').toLowerCase()
        const normalizedProtocol: BindingProtocol = protocol === 'https' ? 'https' : 'http'
        const portValue = String(source.port ?? source.Port ?? (normalizedProtocol === 'https' ? '443' : '80'))
        const hostName = String(source.hostName ?? source.hostname ?? source.HostName ?? source.Hostname ?? source.host ?? '')
        const ipAddress = String(source.ipAddress ?? source.IPAddress ?? source.ip ?? '')
        const enabledValue = source.enabled ?? source.Enabled
        const enabled = typeof enabledValue === 'boolean'
          ? enabledValue
          : normalizeBoolean(
            typeof enabledValue === 'string' || typeof enabledValue === 'number' ? String(enabledValue) : undefined,
            true,
          )
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          protocol: normalizedProtocol,
          port: portValue,
          ipAddress,
          hostName,
          enabled,
        }
      })
      .filter((item): item is IisBinding => Boolean(item))
    return next.length > 0 ? next : [createDefaultBinding()]
  } catch {
    return [createDefaultBinding()]
  }
}

function serializeBindings(bindings: IisBinding[]): string {
  const normalized = bindings
    .map((binding) => ({
      protocol: binding.protocol,
      port: binding.port.trim(),
      ipAddress: binding.ipAddress.trim(),
      hostName: binding.hostName.trim(),
      enabled: binding.enabled,
    }))
  return JSON.stringify(normalized)
}

function buildActionProperties(existingAction: DeploymentActionDto | undefined, values: IisActionValues): DeploymentActionPropertyDto[] {
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

  pushProperty(PackageProperties.feedId[0], values.packageFeedId)
  pushProperty(PackageProperties.packageId[0], values.packageId)
  pushProperty(PackageProperties.version[0], values.packageVersion)
  pushProperty(IisProperties.deploymentType[0], values.deploymentType)
  pushProperty(IisProperties.webSiteName[0], values.webSiteName)
  pushProperty(IisProperties.virtualDirectoryName[0], values.virtualDirectoryName)
  pushProperty(IisProperties.webApplicationName[0], values.webApplicationName)
  pushProperty(IisProperties.physicalPathMode[0], values.physicalPathMode)
  pushProperty(IisProperties.relativePath[0], values.relativePath)
  pushProperty(IisProperties.startWebSite[0], values.startWebSite ? 'true' : 'false')
  pushProperty(IisProperties.applicationPoolName[0], values.appPoolName)
  pushProperty(IisProperties.applicationPoolClr[0], values.appPoolClrVersion, true)
  pushProperty(IisProperties.applicationPoolIdentity[0], values.appPoolIdentity)
  pushProperty(IisProperties.startApplicationPool[0], values.startAppPool ? 'true' : 'false')
  pushProperty(IisProperties.bindings[0], serializeBindings(values.bindings))
  pushProperty(IisProperties.existingBindings[0], values.existingBindings)
  pushProperty(IisProperties.authAnonymous[0], values.authAnonymous ? 'true' : 'false')
  pushProperty(IisProperties.authBasic[0], values.authBasic ? 'true' : 'false')
  pushProperty(IisProperties.authWindows[0], values.authWindows ? 'true' : 'false')
  pushProperty(IisProperties.replaceConfigVariables[0], values.replaceConfigVariables ? 'true' : 'false')
  pushProperty(IisProperties.runConfigTransforms[0], values.runConfigTransforms ? 'true' : 'false')
  pushProperty(IisProperties.additionalTransforms[0], values.additionalTransforms, true)

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  conditions: StepConditionsValue,
  targetTags: string[],
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

  return next
}

export const DeployToIisEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function DeployToIisEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'

    const [stepName, setStepName] = useState(step?.name ?? DEFAULT_STEP_NAME)
    const [targetTags, setTargetTags] = useState<string[]>(() => step ? getTargetRoles(step) : [])
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

    const [packageFeedId, setPackageFeedId] = useState(getActionProperty(action, PackageProperties.feedId) ?? '')
    const [packageId, setPackageId] = useState(getActionProperty(action, PackageProperties.packageId) ?? '')
    const [packageVersion, setPackageVersion] = useState(getActionProperty(action, PackageProperties.version) ?? '')
    const [feedsLoading, setFeedsLoading] = useState(false)
    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const [feedOptions, setFeedOptions] = useState<{ label: string; value: string }[]>([])
    const [packageSearchTerm, setPackageSearchTerm] = useState(packageId)
    const [packageSearchOptions, setPackageSearchOptions] = useState<string[]>([])
    const [packageSearchLoading, setPackageSearchLoading] = useState(false)
    const packageSearchRequestId = useRef(0)

    const [deploymentType, setDeploymentType] = useState<IisDeploymentType>(
      normalizeDeploymentType(getActionProperty(action, IisProperties.deploymentType)),
    )
    const [webSiteName, setWebSiteName] = useState(getActionProperty(action, IisProperties.webSiteName) ?? '')
    const [virtualDirectoryName, setVirtualDirectoryName] = useState(getActionProperty(action, IisProperties.virtualDirectoryName) ?? '')
    const [webApplicationName, setWebApplicationName] = useState(getActionProperty(action, IisProperties.webApplicationName) ?? '')
    const [physicalPathMode, setPhysicalPathMode] = useState<PhysicalPathMode>(
      normalizePhysicalPathMode(getActionProperty(action, IisProperties.physicalPathMode)),
    )
    const [relativePath, setRelativePath] = useState(getActionProperty(action, IisProperties.relativePath) ?? '')
    const [startWebSite, setStartWebSite] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.startWebSite), true),
    )
    const [appPoolName, setAppPoolName] = useState(getActionProperty(action, IisProperties.applicationPoolName) ?? '')
    const [appPoolClrVersion, setAppPoolClrVersion] = useState<AppPoolClrVersion>(
      normalizeClrVersion(getActionProperty(action, IisProperties.applicationPoolClr)),
    )
    const [appPoolIdentity, setAppPoolIdentity] = useState<AppPoolIdentity>(
      normalizeIdentity(getActionProperty(action, IisProperties.applicationPoolIdentity)),
    )
    const [startAppPool, setStartAppPool] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.startApplicationPool), true),
    )
    const [bindings, setBindings] = useState<IisBinding[]>(
      parseBindings(getActionProperty(action, IisProperties.bindings)),
    )
    const [bindingModalOpen, setBindingModalOpen] = useState(false)
    const [editingBindingId, setEditingBindingId] = useState<string | null>(null)
    const [bindingDraft, setBindingDraft] = useState<IisBinding>(() => createDefaultBinding())
    const [existingBindings, setExistingBindings] = useState<ExistingBindingsMode>(
      normalizeExistingBindings(getActionProperty(action, IisProperties.existingBindings)),
    )
    const [authAnonymous, setAuthAnonymous] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authAnonymous), false),
    )
    const [authBasic, setAuthBasic] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authBasic), false),
    )
    const [authWindows, setAuthWindows] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.authWindows), true),
    )
    const [replaceConfigVariables, setReplaceConfigVariables] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.replaceConfigVariables), true),
    )
    const [runConfigTransforms, setRunConfigTransforms] = useState(
      normalizeBoolean(getActionProperty(action, IisProperties.runConfigTransforms), true),
    )
    const [additionalTransforms, setAdditionalTransforms] = useState(
      getActionProperty(action, IisProperties.additionalTransforms) ?? '',
    )

    const loadFeeds = useCallback(async () => {
      setFeedsLoading(true)
      try {
        const response = await getExternalFeeds({ pageSize: 1000 })
        const sorted = [...(response.externalFeeds ?? [])].sort((a, b) => a.name.localeCompare(b.name))
        setFeeds(sorted)
        setFeedOptions(sorted.map((feed) => ({ label: feed.name, value: String(feed.id) })))
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

    const selectedFeedId = useMemo(() => {
      const parsed = Number.parseInt(packageFeedId, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      return parsed
    }, [packageFeedId])

    const selectedFeedName = useMemo(() => {
      if (!selectedFeedId) return ''
      return feeds.find((feed) => feed.id === selectedFeedId)?.name ?? ''
    }, [feeds, selectedFeedId])

    const feedSelectOptions = useMemo(() => {
      if (!packageFeedId.trim()) return feedOptions
      if (feedOptions.some((option) => option.value === packageFeedId)) return feedOptions
      return [...feedOptions, { label: `Feed #${packageFeedId}`, value: packageFeedId }]
    }, [feedOptions, packageFeedId])

    useEffect(() => {
      const query = packageSearchTerm.trim()
      if (!selectedFeedId || !query) {
        setPackageSearchOptions([])
        setPackageSearchLoading(false)
        return
      }

      const requestId = ++packageSearchRequestId.current
      const timer = window.setTimeout(() => {
        setPackageSearchLoading(true)
        searchExternalFeedPackages({ feedId: selectedFeedId, query, take: 20 })
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
    }, [selectedFeedId, packageSearchTerm])

    const handleRemoveBinding = (bindingId: string) => {
      setBindings((current) => current.filter((binding) => binding.id !== bindingId))
    }

    const openAddBindingModal = () => {
      setEditingBindingId(null)
      setBindingDraft(createDefaultBinding())
      setBindingModalOpen(true)
    }

    const openEditBindingModal = (binding: IisBinding) => {
      setEditingBindingId(binding.id)
      setBindingDraft({ ...binding })
      setBindingModalOpen(true)
    }

    const closeBindingModal = () => {
      setBindingModalOpen(false)
      setEditingBindingId(null)
    }

    const saveBindingDraft = () => {
      if (!bindingDraft.port.trim()) {
        message.warning('Port is required')
        return
      }

      if (editingBindingId) {
        setBindings((current) => current.map((binding) => (
          binding.id === editingBindingId
            ? { ...bindingDraft, id: editingBindingId }
            : binding
        )))
      } else {
        setBindings((current) => [...current, { ...bindingDraft, id: createDefaultBinding().id }])
      }

      closeBindingModal()
    }

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      if (targetTags.length === 0) {
        message.warning('You need at least one target tag')
        return
      }

      if (!packageFeedId.trim() || !packageId.trim()) {
        message.warning('Package feed and package ID are required')
        return
      }

      if (!webSiteName.trim()) {
        message.warning('Web site name is required')
        return
      }

      if (deploymentType === 'virtualDirectory' && !virtualDirectoryName.trim()) {
        message.warning('Virtual directory name is required')
        return
      }

      if (deploymentType === 'webApplication' && !webApplicationName.trim()) {
        message.warning('Web application name is required')
        return
      }

      if (physicalPathMode === 'relativeToPackageRoot' && !relativePath.trim()) {
        message.warning('Relative path is required when using relative physical path')
        return
      }

      const hasBindingWithoutPort = bindings.some((binding) => binding.enabled && !binding.port.trim())
      if (hasBindingWithoutPort) {
        message.warning('Each enabled binding must include a port')
        return
      }

      const actionValues: IisActionValues = {
        packageFeedId,
        packageId,
        packageVersion,
        deploymentType,
        webSiteName,
        virtualDirectoryName,
        webApplicationName,
        physicalPathMode,
        relativePath,
        startWebSite,
        appPoolName,
        appPoolClrVersion,
        appPoolIdentity,
        startAppPool,
        bindings,
        existingBindings,
        authAnonymous,
        authBasic,
        authWindows,
        replaceConfigVariables,
        runConfigTransforms,
        additionalTransforms,
      }
      const actionProperties = buildActionProperties(action, actionValues)
      const stepProperties = buildStepProperties(step?.properties, step?.id ?? 0, conditions, targetTags)
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
      startTrigger,
      conditions,
      packageFeedId,
      packageId,
      packageVersion,
      deploymentType,
      webSiteName,
      virtualDirectoryName,
      webApplicationName,
      physicalPathMode,
      relativePath,
      startWebSite,
      appPoolName,
      appPoolClrVersion,
      appPoolIdentity,
      startAppPool,
      bindings,
      existingBindings,
      authAnonymous,
      authBasic,
      authWindows,
      replaceConfigVariables,
      runConfigTransforms,
      additionalTransforms,
      step,
      processId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME
    const isVirtualDirectory = deploymentType === 'virtualDirectory'
    const isWebApplication = deploymentType === 'webApplication'
    const iisTargetSectionTitle = isVirtualDirectory ? 'Virtual Directory' : isWebApplication ? 'Web Application' : 'Web Site'
    const iisTargetSectionSubtitle = isVirtualDirectory
      ? 'Configure the details of the IIS Virtual Directory.'
      : isWebApplication
        ? 'Configure the details of the IIS Web Application'
        : 'Configure the details of the IIS Web Site.'
    const webSiteNameLabel = deploymentType === 'webSite' ? 'Web site name' : 'Parent web site name'
    const webSiteNameHelp = isVirtualDirectory
      ? 'The name of the parent Web Site for this Virtual Directory in IIS. The Web Site should already exist when this step runs.'
      : isWebApplication
        ? 'The name of the parent Web Site for this Web Application in IIS. The Web Site should already exist when this step runs.'
        : 'The display name of the IIS Web Site to create or reconfigure.'
    const childPathLabel = isVirtualDirectory || isWebApplication ? 'Virtual path' : 'Web application name'
    const childPathHelp = isVirtualDirectory
      ? (
        <>
          The virtual path in IIS relative to the parent Web Site. E.g. <code>/application1/directory2/mydirectory</code>.
          <br />
          Note: All parent directories/applications must already exist.
        </>
      )
      : (
        <>
          The virtual path in IIS relative to the parent Web Site. E.g. <code>/myapplication</code>.
          <br />
          Note: All parent directories/applications must already exist.
        </>
      )
    const packageRootTargetName = isWebApplication ? 'IIS Web Application' : isVirtualDirectory ? 'Virtual Directory' : 'IIS Web Site'
    const relativePathTargetName = isWebApplication ? 'Web Application' : isVirtualDirectory ? 'Virtual Directory' : 'IIS Web Site'
    const childPathValue = deploymentType === 'virtualDirectory' ? virtualDirectoryName : webApplicationName
    const childPathSetter = deploymentType === 'virtualDirectory' ? setVirtualDirectoryName : setWebApplicationName

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
              <div className="text-xs leading-tight text-slate-400">Deploy to IIS</div>
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

          <CollapsibleSection title="Target Tags" subtitle="This step will deploy to deployment targets with any of these matching tags." defaultOpen>
            <TargetTagSelect
              value={targetTags}
              onChange={setTargetTags}
              placeholder="Runs on targets with tags (type to add new)"
            />
            <div className="text-xs text-slate-500">You need at least one tag to select matching targets.</div>
          </CollapsibleSection>

          <CollapsibleSection title="Package Details" subtitle="Configure package source and version for IIS deployment." defaultOpen fullWidth>
            <CollapsibleSection title="Package" subtitle="Select the package containing your application." defaultOpen fullWidth>
              <div className="ml-[216px] space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Package feed</label>
                    <Select
                      value={packageFeedId || undefined}
                      options={feedSelectOptions}
                      onChange={(value) => {
                        const normalizedValue = String(value ?? '').trim()
                        setPackageFeedId(normalizedValue)
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
                      placeholder="Package ID"
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
                        selectedFeedId && packageSearchTerm.trim()
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">Version (optional)</label>
                  <Input
                    size="small"
                    value={packageVersion}
                    onChange={(event) => setPackageVersion(event.target.value)}
                    placeholder="1.0.0"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">Package will be locked to this version.</p>
                </div>
              </div>
            </CollapsibleSection>
          </CollapsibleSection>

          <CollapsibleSection title="IIS Web Site and Application Pool" subtitle="Configure IIS deployment mode, website, app pool, bindings, and auth." defaultOpen fullWidth>
            <CollapsibleSection title="IIS Deployment Type" subtitle="Configure the type of deployment." defaultOpen>
              <p className="m-0 text-xs text-slate-500">
                Learn more about deploying{' '}
                <a
                  href="https://oc.to/IISWebsitesAndApplications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-squid-blue hover:underline"
                >
                  IIS Websites and Applications
                </a>.
              </p>
              <Radio.Group
                value={deploymentType}
                onChange={(event) => setDeploymentType(event.target.value as IisDeploymentType)}
                className="flex flex-col gap-3"
              >
                <Radio value="webSite">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Web Site</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Web Site</span>
                  </div>
                </Radio>
                <Radio value="virtualDirectory">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Virtual Directory</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Virtual Directory as a child of an existing IIS Web Site</span>
                  </div>
                </Radio>
                <Radio value="webApplication">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-slate-700">IIS Web Application</span>
                    <span className="text-xs text-slate-500">Create or update an IIS Web Application as a child of an existing IIS Web Site</span>
                  </div>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>

            <CollapsibleSection title={iisTargetSectionTitle} subtitle={iisTargetSectionSubtitle} defaultOpen fullWidth>
              <div className="ml-[216px] space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{webSiteNameLabel}</label>
                  <Input
                    size="small"
                    value={webSiteName}
                    onChange={(event) => setWebSiteName(event.target.value)}
                    placeholder="Default Web Site"
                  />
                  <p className="mb-0 mt-1 text-xs text-slate-500">{webSiteNameHelp}</p>
                </div>

                {deploymentType !== 'webSite' ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{childPathLabel}</label>
                    <Input
                      size="small"
                      value={childPathValue}
                      onChange={(event) => childPathSetter(event.target.value)}
                      placeholder={deploymentType === 'virtualDirectory' ? 'app' : 'app'}
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">{childPathHelp}</p>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">Physical path</div>
                  <Radio.Group
                    value={physicalPathMode}
                    onChange={(event) => setPhysicalPathMode(event.target.value as PhysicalPathMode)}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="packageRoot">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">Package installation directory</span>
                        <span className="text-xs text-slate-500">
                          Configure this {packageRootTargetName} to serve content from the folder that Squid extracted the package to, or the Custom Installation Directory if specified.
                        </span>
                      </div>
                    </Radio>
                    <Radio value="relativeToPackageRoot">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">Relative path under package installation directory</span>
                        <span className="text-xs text-slate-500">
                          Configure this {relativePathTargetName} to serve content from a path that is relative to the folder that Squid extracted the package to, or the Custom Installation Directory if specified.
                        </span>
                      </div>
                    </Radio>
                  </Radio.Group>
                </div>

                {physicalPathMode === 'relativeToPackageRoot' ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Relative path</label>
                    <Input
                      size="small"
                      value={relativePath}
                      onChange={(event) => setRelativePath(event.target.value)}
                      placeholder="site"
                    />
                  </div>
                ) : null}

                {deploymentType === 'webSite' ? (
                  <Checkbox checked={startWebSite} onChange={(event) => setStartWebSite(event.target.checked)}>
                    <span className="text-sm">Start IIS Web Site</span>
                  </Checkbox>
                ) : null}
              </div>
            </CollapsibleSection>

            {deploymentType !== 'virtualDirectory' ? (
              <CollapsibleSection title="Application Pool" subtitle="Configure the details of the IIS Application Pool that will be created and used." defaultOpen fullWidth>
                <div className="ml-[216px] space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Application Pool name</label>
                    <Input
                      size="small"
                      value={appPoolName}
                      onChange={(event) => setAppPoolName(event.target.value)}
                      placeholder="MyAppPool"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">Name of the application pool in IIS to create or reconfigure.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">.NET CLR version</label>
                    <Select
                      value={appPoolClrVersion}
                      onChange={(value) => setAppPoolClrVersion(value as AppPoolClrVersion)}
                      options={[
                        { label: 'v4.0', value: 'v4.0' },
                        { label: 'v2.0', value: 'v2.0' },
                        { label: 'No Managed Code', value: '' },
                      ]}
                      size="small"
                      className="w-full"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">
                      The version of the .NET common language runtime that this application pool will use. Choose <strong>v2.0</strong> for applications built against .NET 2.0, 3.0 or 3.5. Choose <strong>v4.0</strong> for .NET 4.0 or 4.5
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Identity</label>
                    <Select
                      value={appPoolIdentity}
                      onChange={(value) => setAppPoolIdentity(value as AppPoolIdentity)}
                      options={[
                        { label: 'Application Pool Identity', value: 'ApplicationPoolIdentity' },
                        { label: 'Network Service', value: 'NetworkService' },
                        { label: 'Local Service', value: 'LocalService' },
                        { label: 'Local System', value: 'LocalSystem' },
                      ]}
                      size="small"
                      className="w-full"
                    />
                    <p className="mb-0 mt-1 text-xs text-slate-500">Which built-in account will the application pool run under.</p>
                  </div>

                  <div>
                    <Checkbox checked={startAppPool} onChange={(event) => setStartAppPool(event.target.checked)}>
                      <span className="text-sm">Start IIS Application Pool</span>
                    </Checkbox>
                    <p className="mb-0 mt-1 text-xs text-slate-500">Whether the deployment step should start the IIS Application Pool after a successful deployment or not.</p>
                  </div>
                </div>
              </CollapsibleSection>
            ) : null}

            {deploymentType === 'webSite' ? (
              <>
                <CollapsibleSection title="Bindings" subtitle="Bindings define what protocols, ports and host names this site will listen on." defaultOpen fullWidth>
                  <div className="ml-[216px] space-y-4">
                    <div className="w-full max-w-[520px] space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={openAddBindingModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                        >
                          <PlusOutlined style={{ fontSize: 11 }} />
                          Add
                        </button>
                      </div>

                      {bindings.length > 0 ? (
                        <ul className="space-y-2">
                          {bindings.map((binding) => (
                            <li
                              key={binding.id}
                              className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                              onClick={() => openEditBindingModal(binding)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openEditBindingModal(binding)
                                }
                              }}
                            >
                              <div className="text-sm text-slate-700 space-y-1">
                                <p className="mb-0">Protocol: <strong>{binding.protocol}</strong></p>
                                <p className="mb-0">Port: <strong>{binding.port || '(not set)'}</strong></p>
                                {binding.ipAddress.trim() ? <p className="mb-0">IP: <strong>{binding.ipAddress}</strong></p> : null}
                                {binding.hostName.trim() ? <p className="mb-0">Host: <strong>{binding.hostName}</strong></p> : null}
                                {!binding.enabled ? <p className="mb-0 text-amber-600">Disabled</p> : null}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRemoveBinding(binding.id)
                                }}
                                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Remove binding"
                              >
                                <CloseOutlined style={{ fontSize: 13 }} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mb-0 text-xs text-slate-500">No bindings configured yet.</p>
                      )}
                    </div>

                    <Modal
                      title={editingBindingId ? 'Edit Binding' : 'Add Binding'}
                      open={bindingModalOpen}
                      onCancel={closeBindingModal}
                      onOk={saveBindingDraft}
                      okText={editingBindingId ? 'Save' : 'Add'}
                      cancelText="Cancel"
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Protocol</label>
                          <Select
                            value={bindingDraft.protocol}
                            onChange={(value) => setBindingDraft((current) => ({
                              ...current,
                              protocol: value as BindingProtocol,
                              port: current.port.trim().length > 0
                                ? current.port
                                : value === 'https'
                                  ? '443'
                                  : '80',
                            }))}
                            className="w-full"
                            options={[
                              { label: 'HTTP', value: 'http' },
                              { label: 'HTTPS', value: 'https' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                          <Input
                            value={bindingDraft.port}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, port: event.target.value }))}
                            placeholder={bindingDraft.protocol === 'https' ? '443' : '80'}
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            The TCP port number that this binding will listen on.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">IP address</label>
                          <Input
                            value={bindingDraft.ipAddress}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, ipAddress: event.target.value }))}
                            placeholder="*"
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Use <code>*</code> for any address, or specify an address such as <code>10.0.0.1</code>.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Host name</label>
                          <Input
                            value={bindingDraft.hostName}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, hostName: event.target.value }))}
                            placeholder="www.contoso.com"
                          />
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Leave empty to use any host header.
                          </p>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-2">Binding status</div>
                          <Checkbox
                            checked={bindingDraft.enabled}
                            onChange={(event) => setBindingDraft((current) => ({ ...current, enabled: event.target.checked }))}
                          >
                            <span className="text-sm">Enabled</span>
                          </Checkbox>
                          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
                            Disable this binding to skip it (the binding will not be added).
                          </p>
                        </div>
                      </div>
                    </Modal>

                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-600">Existing Bindings</div>
                      <Radio.Group
                        value={existingBindings}
                        onChange={(event) => setExistingBindings(event.target.value as ExistingBindingsMode)}
                        className="flex flex-col gap-2"
                      >
                        <Radio value="Replace">
                          <span className="text-sm">Replace existing bindings <span className="text-slate-500">(default)</span></span>
                        </Radio>
                        <Radio value="Merge">
                          <span className="text-sm">Merge with existing bindings</span>
                        </Radio>
                      </Radio.Group>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="IIS Authentication" subtitle="Set which authentication modes will be enabled in IIS." defaultOpen fullWidth>
                  <div className="ml-[216px] space-y-3">
                    <div>
                      <Checkbox checked={authAnonymous} onChange={(event) => setAuthAnonymous(event.target.checked)}>
                        <span className="text-sm">Enable Anonymous authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow anonymous authentication.</p>
                    </div>

                    <div>
                      <Checkbox checked={authBasic} onChange={(event) => setAuthBasic(event.target.checked)}>
                        <span className="text-sm">Enable Basic authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow basic authentication with a 401 challenge.</p>
                    </div>

                    <div>
                      <Checkbox checked={authWindows} onChange={(event) => setAuthWindows(event.target.checked)}>
                        <span className="text-sm">Enable Windows authentication</span>
                      </Checkbox>
                      <p className="mb-0 mt-1 text-xs text-slate-500">Whether IIS should allow integrated Windows authentication with a 401 challenge.</p>
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            title=".NET Configuration Variables"
            subtitle="If set, replace appSettings and connectionString entries in any .config files."
            defaultOpen
          >
            <Checkbox checked={replaceConfigVariables} onChange={(event) => setReplaceConfigVariables(event.target.checked)}>
              <span className="text-sm">Replace entries in .config files</span>
            </Checkbox>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              Tentacle will scan <code>.config</code> files and replace matching keys using step variables.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            title=".NET Configuration Transforms"
            subtitle="Configure .NET XML configuration transforms."
            defaultOpen
            fullWidth
          >
            <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
              <div>
                <Checkbox checked={runConfigTransforms} onChange={(event) => setRunConfigTransforms(event.target.checked)}>
                  <span className="text-sm">Run default XML transforms</span>
                </Checkbox>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  Squid can run configuration transformation files. By default Squid looks for <em>*.Release.config</em> and <em>*.&lt;EnvironmentName&gt;.config</em>.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Additional transforms</label>
                <Input.TextArea
                  value={additionalTransforms}
                  onChange={(event) => setAdditionalTransforms(event.target.value)}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder="Web.Release.config => Web.config"
                />
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
                  <p className="mb-0">A comma- or newline-separated list of additional configuration transformation file rules. Example:</p>
                  <pre className="mb-0 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                    {'Web.Release.config => Web.config\n*.Foo.config => *.config\ncrossdomainpolicy.#{Squid.Environment.Name}.xml => crossdomainpolicy.xml'}
                  </pre>
                  <p className="mb-0">
                    If your configuration file is named <em>Bar.xml</em>, and your transformation file is named <em>Foo.xml</em>, enter <em>Foo.xml=&gt;Bar.xml</em>. Wildcards are supported, so transform files like <em>xyz.Foo.config</em> and <em>abc.Foo.config</em> can target matching config files with <em>*.Foo.config=&gt;*.Bar.config</em>.
                  </p>
                  <p className="mb-0">
                    For more information and advanced examples check{' '}
                    <a className="text-squid-blue hover:underline" href="https://oc.to/ConfigurationTransforms" target="_blank" rel="noreferrer noopener">
                      the documentation
                    </a>.
                  </p>
                </div>
              </div>
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
          </CollapsibleSection>
        </div>
      </div>
    )
  },
)
