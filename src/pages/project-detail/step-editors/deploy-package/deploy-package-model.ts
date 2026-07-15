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
  installationDirectoryMode: 'Squid.Action.Package.InstallationDirectoryMode',
  customInstallationDirectory: 'Squid.Action.Package.CustomInstallationDirectory',
} as const

const TARGET_ROLE_PROPERTY = 'Squid.Action.TargetRoles'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'

export type InstallationDirectoryMode = 'Versioned' | 'Custom'

export interface DeployPackageFormState {
  stepName: string
  feedId: number | null
  packageId: string
  targetRoles: string[]
  installationDirectoryMode: InstallationDirectoryMode
  customInstallationDirectory: string
  conditions: StepConditionsValue
  startTrigger: 'StartAfterPrevious' | 'StartWithPrevious'
}

export interface ValidateResult {
  ok: boolean
  message?: string
}

export function normalizeInstallationDirectoryMode(value?: string | null): InstallationDirectoryMode {
  return value?.toLowerCase() === 'custom' ? 'Custom' : 'Versioned'
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

export function normalizeDeployPackageForm(step: DeploymentStepDto | null): DeployPackageFormState {
  const action = step?.actions[0]
  const includeEnvironments = action?.environments ?? []
  const excludeEnvironments = action?.excludedEnvironments ?? []
  const environmentMode = excludeEnvironments.length > 0
    ? 'exclude'
    : includeEnvironments.length > 0
      ? 'include'
      : 'all'

  return {
    stepName: step?.name ?? DEFAULT_STEP_NAME,
    feedId: Number.parseInt(getActionProperty(action, PackageProperties.feedId) ?? '', 10) || null,
    packageId: getActionProperty(action, PackageProperties.packageId) ?? '',
    targetRoles: getTargetRoles(step),
    installationDirectoryMode: normalizeInstallationDirectoryMode(
      getActionProperty(action, PackageProperties.installationDirectoryMode),
    ),
    customInstallationDirectory: getActionProperty(action, PackageProperties.customInstallationDirectory) ?? '',
    startTrigger: step?.startTrigger === 'StartWithPrevious' ? 'StartWithPrevious' : 'StartAfterPrevious',
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
  if (!form.feedId || form.feedId <= 0) return { ok: false, message: 'NuGet feed is required' }
  if (!form.packageId.trim()) return { ok: false, message: 'Package is required' }
  if (form.targetRoles.length === 0) return { ok: false, message: 'At least one target role is required' }
  if (form.installationDirectoryMode === 'Custom' && !form.customInstallationDirectory.trim()) {
    return { ok: false, message: 'Custom installation directory is required' }
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

  const knownPropertyNames = new Set<string>([
    PackageProperties.feedId,
    PackageProperties.packageId,
    PackageProperties.installationDirectoryMode,
    PackageProperties.customInstallationDirectory,
  ])

  const preserved = (existingAction?.properties ?? []).filter(
    (p) => !knownPropertyNames.has(p.propertyName),
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
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: PackageProperties.installationDirectoryMode,
      propertyValue: form.installationDirectoryMode,
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

  const knownStepPropertyNames = new Set([TARGET_ROLE_PROPERTY, 'TargetRoles', STEP_CONDITION_EXPRESSION_PROPERTY])
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
  ]

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

export function isNuGetFeedType(feedType?: string | null): boolean {
  if (!feedType) return false
  return feedType.toLowerCase().includes('nuget')
}
