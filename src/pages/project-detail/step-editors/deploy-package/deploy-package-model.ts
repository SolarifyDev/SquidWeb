import type {
  DeploymentActionDto,
  DeploymentActionPropertyDto,
  DeploymentStepDto,
  DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import type { StepConditionsValue } from '../shared/StepConditionsSection'

export const ACTION_TYPE = 'Squid.TentaclePackage'
export const DEFAULT_STEP_NAME = 'Deploy a Package'

export const PackageProperties = {
  feedId: 'Squid.Action.Package.FeedId',
  packageId: 'Squid.Action.Package.PackageId',
  packageVersion: 'Squid.Action.Package.PackageVersion',
  installationDirectoryMode: 'Squid.Action.Package.InstallationDirectoryMode',
  customInstallationDirectory: 'Squid.Action.Package.CustomInstallationDirectory',
} as const

export const PackageConfigProperties = {
  configurationVariablesEnabled: 'Squid.Action.ConfigurationVariables.Enabled',
  configurationTransformsEnabled: 'Squid.Action.ConfigurationTransforms.Enabled',
  configurationTransformsEnvironmentName: 'Squid.Action.ConfigurationTransforms.EnvironmentName',
  configurationTransformsAdditional: 'Squid.Action.ConfigurationTransforms.AdditionalTransforms',
  substituteInFilesEnabled: 'Squid.Action.SubstituteInFiles.Enabled',
  substituteInFilesTargetFiles: 'Squid.Action.SubstituteInFiles.TargetFiles',
  substituteFailOnUnresolved: 'Squid.Action.SubstituteInFiles.ShouldFailDeploymentOnSubstitutionFails',
  jsonConfigVariablesEnabled: 'Squid.Action.JsonConfigVariables.Enabled',
  jsonConfigVariablesTargets: 'Squid.Action.JsonConfigVariables.Targets',
} as const

export const PackageInstallOptionProperties = {
  purgeBeforeInstall: 'Squid.Action.Package.PurgeBeforeInstall',
  preservePaths: 'Squid.Action.Package.PreservePaths',
  skipIfAlreadyInstalled: 'Squid.Action.Package.SkipIfAlreadyInstalled',
  retentionCount: 'Squid.Action.Package.RetentionCount',
  useCurrentPointer: 'Squid.Action.Package.UseCurrentPointer',
  rollbackOnFailure: 'Squid.Action.Package.RollbackOnFailure',
} as const

export const DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME = '#{Squid.Environment.Name}'

export const StepControlProperties = {
  runOnServer: 'Squid.Action.RunOnServer',
  executionLocation: 'Squid.Action.Script.ExecutionLocation',
  retriesEnabled: 'Squid.Step.RetriesEnabled',
  retriesCount: 'Squid.Step.RetriesCount',
  timeout: 'Squid.Step.Timeout',
  timeoutMinutesLegacy: 'Squid.Step.TimeoutInMinutes',
  maxParallelism: 'Squid.Step.MaxParallelism',
  targetRoles: 'Squid.Action.TargetRoles',
  conditionExpression: 'Squid.Step.ConditionExpression',
} as const

const TARGET_ROLE_PROPERTY = StepControlProperties.targetRoles
const STEP_CONDITION_EXPRESSION_PROPERTY = StepControlProperties.conditionExpression

export type InstallationDirectoryMode = 'Versioned' | 'Custom'
export type ExecutionLocationMode = 'DeploymentTarget'
export type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'

export interface DeployPackageFormState {
  stepName: string
  feedId: number | null
  feedType?: string | null
  packageId: string
  packageVersion: string
  targetRoles: string[]
  installationDirectoryMode: InstallationDirectoryMode
  customInstallationDirectory: string
  executionLocation: ExecutionLocationMode
  startTrigger: StartTriggerMode
  retriesEnabled: boolean
  retryCount: number // 1..3
  maxParallelism: number // 0 = off
  timeoutMinutes: number // 0 = never
  configurationVariablesEnabled: boolean
  configurationTransformsEnabled: boolean
  configurationTransformsEnvironmentName: string
  additionalTransforms: string
  substituteInFilesEnabled: boolean
  substituteInFilesTargetFiles: string
  substituteFailOnUnresolved: boolean
  structuredConfigEnabled: boolean
  structuredConfigTargets: string
  purgeBeforeInstall: boolean
  preservePaths: string
  skipIfAlreadyInstalled: boolean
  retentionCount: number
  useCurrentPointer: boolean
  rollbackOnFailure: boolean
  conditions: StepConditionsValue
}

export interface ValidateResult {
  ok: boolean
  message?: string
}

export function normalizeInstallationDirectoryMode(value?: string | null): InstallationDirectoryMode {
  return value?.toLowerCase() === 'custom' ? 'Custom' : 'Versioned'
}

export function normalizeBoolean(value?: string): boolean {
  if (!value?.trim()) return false
  const n = value.trim().toLowerCase()
  return n === 'true' || n === '1' || n === 'yes'
}

export function normalizeExecutionLocation(_value?: string, _runOnServer = false): ExecutionLocationMode {
  // Deploy a Package always installs on each matched deployment target.
  // Worker/server execution locations are not supported for this step type.
  return 'DeploymentTarget'
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

export function getActionProperty(
  action: DeploymentActionDto | null | undefined,
  name: string,
): string | undefined {
  return action?.properties.find((p) => p.propertyName === name)?.propertyValue
}

export function getStepProperty(
  properties: DeploymentStepPropertyDto[] | undefined,
  name: string,
): string {
  return properties?.find((p) => p.propertyName === name)?.propertyValue ?? ''
}

export function getTargetRoles(step: DeploymentStepDto | null | undefined): string[] {
  if (!step) return []
  const value = getStepProperty(step.properties, TARGET_ROLE_PROPERTY) || getStepProperty(step.properties, 'TargetRoles')
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
}


export function secondsToTimeoutMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.ceil(seconds / 60)
}

export function timeoutMinutesToSeconds(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.floor(minutes) * 60
}

export function normalizeDeployPackageForm(step: DeploymentStepDto | null): DeployPackageFormState {
  const action = step?.actions[0]
  const includeEnvironments = action?.environments ?? []
  const excludeEnvironments = action?.excludedEnvironments ?? []
  const environmentMode = excludeEnvironments.length > 0
    ? 'exclude'
    : includeEnvironments.length > 0
      ? 'include'
      : 'all'

  const runOnServer = normalizeBoolean(getStepProperty(step?.properties, StepControlProperties.runOnServer))
  const retriesEnabled = normalizeBoolean(getStepProperty(step?.properties, StepControlProperties.retriesEnabled))
  const retryCountRaw = parsePositiveInt(getStepProperty(step?.properties, StepControlProperties.retriesCount), 1)
  const retryCount = retryCountRaw > 0 ? Math.min(Math.max(retryCountRaw, 1), 3) : 1

  const timeoutSecondsRaw = parsePositiveInt(getStepProperty(step?.properties, StepControlProperties.timeout), NaN)
  let timeoutMinutes = 0
  if (Number.isFinite(timeoutSecondsRaw) && timeoutSecondsRaw > 0) {
    timeoutMinutes = secondsToTimeoutMinutes(timeoutSecondsRaw)
  } else {
    const legacyMinutes = parsePositiveInt(
      getStepProperty(step?.properties, StepControlProperties.timeoutMinutesLegacy),
      NaN,
    )
    if (Number.isFinite(legacyMinutes) && legacyMinutes > 0) {
      timeoutMinutes = legacyMinutes
    }
  }

  const maxParallelismRaw = parsePositiveInt(
    getStepProperty(step?.properties, StepControlProperties.maxParallelism),
    0,
  )
  const maxParallelism = maxParallelismRaw > 0 ? maxParallelismRaw : 0

  return {
    stepName: step?.name ?? DEFAULT_STEP_NAME,
    feedId: Number.parseInt(getActionProperty(action, PackageProperties.feedId) ?? '', 10) || null,
    packageId: getActionProperty(action, PackageProperties.packageId) ?? '',
    packageVersion: getActionProperty(action, PackageProperties.packageVersion) ?? '',
    targetRoles: getTargetRoles(step),
    installationDirectoryMode: normalizeInstallationDirectoryMode(
      getActionProperty(action, PackageProperties.installationDirectoryMode),
    ),
    customInstallationDirectory: getActionProperty(action, PackageProperties.customInstallationDirectory) ?? '',
    executionLocation: normalizeExecutionLocation(
      getActionProperty(action, StepControlProperties.executionLocation),
      runOnServer,
    ),
    startTrigger: step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
    retriesEnabled,
    retryCount,
    maxParallelism,
    timeoutMinutes,
    configurationVariablesEnabled: normalizeBoolean(
      getActionProperty(action, PackageConfigProperties.configurationVariablesEnabled),
    ),
    configurationTransformsEnabled: normalizeBoolean(
      getActionProperty(action, PackageConfigProperties.configurationTransformsEnabled),
    ),
    configurationTransformsEnvironmentName:
      getActionProperty(action, PackageConfigProperties.configurationTransformsEnvironmentName)
      ?? DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME,
    additionalTransforms:
      getActionProperty(action, PackageConfigProperties.configurationTransformsAdditional) ?? '',
    substituteInFilesEnabled: normalizeBoolean(
      getActionProperty(action, PackageConfigProperties.substituteInFilesEnabled),
    ),
    substituteInFilesTargetFiles:
      getActionProperty(action, PackageConfigProperties.substituteInFilesTargetFiles) ?? '',
    substituteFailOnUnresolved: normalizeBoolean(
      getActionProperty(action, PackageConfigProperties.substituteFailOnUnresolved),
    ),
    structuredConfigEnabled: normalizeBoolean(
      getActionProperty(action, PackageConfigProperties.jsonConfigVariablesEnabled),
    ),
    structuredConfigTargets:
      getActionProperty(action, PackageConfigProperties.jsonConfigVariablesTargets) ?? '',
    purgeBeforeInstall: normalizeBoolean(
      getActionProperty(action, PackageInstallOptionProperties.purgeBeforeInstall),
    ),
    preservePaths:
      getActionProperty(action, PackageInstallOptionProperties.preservePaths) ?? '',
    skipIfAlreadyInstalled: normalizeBoolean(
      getActionProperty(action, PackageInstallOptionProperties.skipIfAlreadyInstalled),
    ),
    retentionCount: Math.max(
      0,
      parsePositiveInt(getActionProperty(action, PackageInstallOptionProperties.retentionCount), 0),
    ),
    useCurrentPointer: normalizeBoolean(
      getActionProperty(action, PackageInstallOptionProperties.useCurrentPointer),
    ),
    rollbackOnFailure: normalizeBoolean(
      getActionProperty(action, PackageInstallOptionProperties.rollbackOnFailure),
    ),
    conditions: {
      environmentMode,
      environmentIds: environmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
      channelIds: action?.channels ?? [],
      runCondition: step?.condition ?? 'Success',
      conditionExpression: getStepProperty(step?.properties, STEP_CONDITION_EXPRESSION_PROPERTY),
      packageRequirement: step?.packageRequirement ?? 'LetSquidDecide',
      required: step?.isRequired ?? false,
      disabled: step?.isDisabled ?? false,
    },
  }
}

export function validateDeployPackageForm(form: DeployPackageFormState): ValidateResult {
  if (!form.stepName.trim()) return { ok: false, message: 'Step name is required' }
  if (!form.feedId || form.feedId <= 0) return { ok: false, message: 'Feed is required' }
  if (form.feedId > 0 && !form.feedType?.trim()) {
    return {
      ok: false,
      message: 'Feed type is required / still loading. Wait for feeds to load or re-select the feed.',
    }
  }
  if (isUnsupportedDeployPackageFeedType(form.feedType)) {
    return {
      ok: false,
      message: `Feed type '${form.feedType}' cannot be installed by Deploy a Package. Use an archive-capable feed (NuGet/GitHub/HTTP).`,
    }
  }
  if (!form.packageId.trim()) return { ok: false, message: 'Package is required' }
  if (form.targetRoles.length === 0) return { ok: false, message: 'At least one target role is required' }
  if (form.installationDirectoryMode === 'Custom' && !form.customInstallationDirectory.trim()) {
    return { ok: false, message: 'Custom installation directory is required' }
  }
  if (form.retriesEnabled && (form.retryCount < 1 || form.retryCount > 3)) {
    return { ok: false, message: 'Retries must be between 1 and 3' }
  }
  if (!Number.isFinite(form.timeoutMinutes) || form.timeoutMinutes < 0) {
    return { ok: false, message: 'Timeout must be zero or a positive integer' }
  }
  if (!Number.isFinite(form.maxParallelism) || (form.maxParallelism !== 0 && form.maxParallelism < 1)) {
    return { ok: false, message: 'Max parallelism must be zero or a positive integer' }
  }
  return { ok: true }
}

export function buildDeployPackageStepDto(args: {
  form: DeployPackageFormState
  processId: number
  existingStep: DeploymentStepDto | null
}): DeploymentStepDto {
  const { form, processId, existingStep } = args
  const existingAction = existingStep?.actions[0]
  const normalizedName = form.stepName.trim() || DEFAULT_STEP_NAME
  // Deploy a Package always runs on each matched deployment target.
  const runOnServer = false
  const executionLocation: ExecutionLocationMode = 'DeploymentTarget'

  const knownActionPropertyNames = new Set<string>([
    PackageProperties.feedId,
    PackageProperties.packageId,
    PackageProperties.packageVersion,
    PackageProperties.installationDirectoryMode,
    PackageProperties.customInstallationDirectory,
    StepControlProperties.executionLocation,
    PackageConfigProperties.configurationVariablesEnabled,
    PackageConfigProperties.configurationTransformsEnabled,
    PackageConfigProperties.configurationTransformsEnvironmentName,
    PackageConfigProperties.configurationTransformsAdditional,
    PackageConfigProperties.substituteInFilesEnabled,
    PackageConfigProperties.substituteInFilesTargetFiles,
    PackageConfigProperties.substituteFailOnUnresolved,
    PackageConfigProperties.jsonConfigVariablesEnabled,
    PackageConfigProperties.jsonConfigVariablesTargets,
    PackageInstallOptionProperties.purgeBeforeInstall,
    PackageInstallOptionProperties.preservePaths,
    PackageInstallOptionProperties.skipIfAlreadyInstalled,
    PackageInstallOptionProperties.retentionCount,
    PackageInstallOptionProperties.useCurrentPointer,
    PackageInstallOptionProperties.rollbackOnFailure,
  ])

  const preserved = (existingAction?.properties ?? []).filter(
    (p) => !knownActionPropertyNames.has(p.propertyName),
  )

  const nextProperties: DeploymentActionPropertyDto[] = [
    ...preserved.map((p) => ({ ...p })),
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: PackageProperties.feedId,
      propertyValue: String(form.feedId ?? ''),
    },
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: PackageProperties.packageId,
      propertyValue: form.packageId.trim(),
    },
    ...(form.packageVersion.trim()
      ? [{
          id: 0,
          actionId: existingAction?.id ?? 0,
          propertyName: PackageProperties.packageVersion,
          propertyValue: form.packageVersion.trim(),
        }]
      : []),
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: PackageProperties.installationDirectoryMode,
      propertyValue: form.installationDirectoryMode,
    },
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: StepControlProperties.executionLocation,
      propertyValue: executionLocation,
    },
  ]

  if (form.installationDirectoryMode === 'Custom') {
    nextProperties.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: PackageProperties.customInstallationDirectory,
      propertyValue: form.customInstallationDirectory.trim(),
    })
  }

  const actionId = existingAction?.id ?? 0
  const pushActionProp = (propertyName: string, propertyValue: string) => {
    nextProperties.push({ id: 0, actionId, propertyName, propertyValue })
  }

  if (form.configurationVariablesEnabled) {
    pushActionProp(PackageConfigProperties.configurationVariablesEnabled, 'True')
  }

  if (form.configurationTransformsEnabled) {
    pushActionProp(PackageConfigProperties.configurationTransformsEnabled, 'True')
    pushActionProp(
      PackageConfigProperties.configurationTransformsEnvironmentName,
      form.configurationTransformsEnvironmentName.trim()
        || DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME,
    )
    if (form.additionalTransforms.trim()) {
      pushActionProp(
        PackageConfigProperties.configurationTransformsAdditional,
        form.additionalTransforms.trim(),
      )
    }
  }

  if (form.substituteInFilesEnabled) {
    pushActionProp(PackageConfigProperties.substituteInFilesEnabled, 'True')
    if (form.substituteInFilesTargetFiles.trim()) {
      pushActionProp(
        PackageConfigProperties.substituteInFilesTargetFiles,
        form.substituteInFilesTargetFiles.trim(),
      )
    }
    if (form.substituteFailOnUnresolved) {
      pushActionProp(PackageConfigProperties.substituteFailOnUnresolved, 'True')
    }
  }

  if (form.structuredConfigEnabled) {
    pushActionProp(PackageConfigProperties.jsonConfigVariablesEnabled, 'True')
    if (form.structuredConfigTargets.trim()) {
      pushActionProp(
        PackageConfigProperties.jsonConfigVariablesTargets,
        form.structuredConfigTargets.trim(),
      )
    }
  }

  if (form.purgeBeforeInstall) {
    pushActionProp(PackageInstallOptionProperties.purgeBeforeInstall, 'True')
  }
  if (form.preservePaths.trim()) {
    pushActionProp(PackageInstallOptionProperties.preservePaths, form.preservePaths.trim())
  }
  if (form.skipIfAlreadyInstalled) {
    pushActionProp(PackageInstallOptionProperties.skipIfAlreadyInstalled, 'True')
  }
  if (form.retentionCount > 0) {
    pushActionProp(PackageInstallOptionProperties.retentionCount, String(form.retentionCount))
  }
  if (form.useCurrentPointer) {
    pushActionProp(PackageInstallOptionProperties.useCurrentPointer, 'True')
  }
  if (form.rollbackOnFailure) {
    pushActionProp(PackageInstallOptionProperties.rollbackOnFailure, 'True')
  }

  const actionEnvironments = form.conditions.environmentMode === 'include' ? form.conditions.environmentIds : []
  const actionExcludedEnvironments = form.conditions.environmentMode === 'exclude' ? form.conditions.environmentIds : []

  const nextAction: DeploymentActionDto = {
    id: existingAction?.id ?? 0,
    stepId: existingStep?.id ?? 0,
    actionOrder: existingAction?.actionOrder ?? 0,
    name: normalizedName,
    actionType: ACTION_TYPE,
    workerPoolId: existingAction?.workerPoolId ?? null,
    isDisabled: form.conditions.disabled,
    isRequired: form.conditions.required,
    canBeUsedForProjectVersioning: existingAction?.canBeUsedForProjectVersioning ?? true,
    createdAt: existingAction?.createdAt ?? new Date().toISOString(),
    properties: nextProperties,
    environments: actionEnvironments,
    excludedEnvironments: actionExcludedEnvironments,
    channels: form.conditions.channelIds,
  }

  const knownStepPropertyNames = new Set([
    TARGET_ROLE_PROPERTY,
    'TargetRoles',
    STEP_CONDITION_EXPRESSION_PROPERTY,
    StepControlProperties.runOnServer,
    StepControlProperties.retriesEnabled,
    StepControlProperties.retriesCount,
    StepControlProperties.timeout,
    StepControlProperties.timeoutMinutesLegacy,
    StepControlProperties.maxParallelism,
  ])
  const preservedStepProperties = (existingStep?.properties ?? []).filter(
    (p) => !knownStepPropertyNames.has(p.propertyName),
  )

  const stepProperties: DeploymentStepPropertyDto[] = [
    ...preservedStepProperties.map((p) => ({ ...p })),
    {
      id: 0,
      stepId: existingStep?.id ?? 0,
      propertyName: TARGET_ROLE_PROPERTY,
      propertyValue: form.targetRoles.join(','),
    },
    {
      id: 0,
      stepId: existingStep?.id ?? 0,
      propertyName: StepControlProperties.runOnServer,
      propertyValue: runOnServer ? 'true' : 'false',
    },
  ]

  if (form.retriesEnabled) {
    stepProperties.push(
      {
        id: 0,
        stepId: existingStep?.id ?? 0,
        propertyName: StepControlProperties.retriesEnabled,
        propertyValue: 'true',
      },
      {
        id: 0,
        stepId: existingStep?.id ?? 0,
        propertyName: StepControlProperties.retriesCount,
        propertyValue: String(Math.min(Math.max(form.retryCount, 1), 3)),
      },
    )
  }

  const timeoutSeconds = timeoutMinutesToSeconds(form.timeoutMinutes)
  if (timeoutSeconds > 0) {
    stepProperties.push({
      id: 0,
      stepId: existingStep?.id ?? 0,
      propertyName: StepControlProperties.timeout,
      propertyValue: String(timeoutSeconds),
    })
  }

  if (form.maxParallelism > 0) {
    stepProperties.push({
      id: 0,
      stepId: existingStep?.id ?? 0,
      propertyName: StepControlProperties.maxParallelism,
      propertyValue: String(form.maxParallelism),
    })
  }

  if (form.conditions.conditionExpression?.trim()) {
    stepProperties.push({
      id: 0,
      stepId: existingStep?.id ?? 0,
      propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
      propertyValue: form.conditions.conditionExpression,
    })
  }

  return {
    id: existingStep?.id ?? 0,
    processId,
    stepOrder: existingStep?.stepOrder ?? 0,
    name: normalizedName,
    stepType: 'DeployPackage',
    condition: form.conditions.runCondition,
    startTrigger: form.startTrigger,
    packageRequirement: form.conditions.packageRequirement,
    isDisabled: form.conditions.disabled,
    isRequired: form.conditions.required,
    createdAt: existingStep?.createdAt ?? new Date().toISOString(),
    properties: stepProperties,
    actions: [nextAction],
  }
}

export function isUnsupportedDeployPackageFeedType(feedType?: string | null): boolean {
  const t = (feedType ?? '').toLowerCase()
  return t.includes('docker') || t.includes('helm') || t.includes('container')
}

export function isNuGetFeedType(feedType?: string | null): boolean {
  if (!feedType) return false
  return feedType.toLowerCase().includes('nuget')
}
