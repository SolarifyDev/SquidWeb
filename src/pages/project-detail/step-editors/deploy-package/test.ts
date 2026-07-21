import { describe, expect, it } from 'vitest'
import {
  buildDeployPackageStepDto,
  isUnsupportedDeployPackageFeedType,
  normalizeDeployPackageForm,
  validateDeployPackageForm,
  type DeployPackageFormState,
} from './deploy-package-model'

const emptyConditions = {
  environmentMode: 'all' as const,
  environmentIds: [] as number[],
  channelIds: [] as number[],
  runCondition: 'Success',
  conditionExpression: '',
  packageRequirement: 'LetSquidDecide',
  required: false,
  disabled: false,
}

const validBaseForm = {
  stepName: 'Deploy Web',
  feedId: 3,
  feedType: 'NuGet',
  packageId: 'Acme.Web',
  packageVersion: '',
  targetRoles: ['web'],
  installationDirectoryMode: 'Versioned' as const,
  customInstallationDirectory: '',
  executionLocation: 'DeploymentTarget' as const,
  startTrigger: 'StartAfterPrevious' as const,
  retriesEnabled: false,
  retryCount: 1,
  maxParallelism: 0,
  timeoutMinutes: 0,
  configurationVariablesEnabled: false,
  configurationTransformsEnabled: false,
  configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
  additionalTransforms: '',
  substituteInFilesEnabled: false,
  substituteInFilesTargetFiles: '',
  substituteFailOnUnresolved: false,
  structuredConfigEnabled: false,
  structuredConfigTargets: '',
  purgeBeforeInstall: false,
  preservePaths: '',
  skipIfAlreadyInstalled: false,
  retentionCount: 0,
  useCurrentPointer: false,
  rollbackOnFailure: false,
  conditions: emptyConditions,
} satisfies DeployPackageFormState

describe('deploy-package-model', () => {
  it('normalizes optional package version and timeout minutes', () => {
    const form = normalizeDeployPackageForm({
      id: 1,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy a Package',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: new Date().toISOString(),
      properties: [
        { id: 1, stepId: 1, propertyName: 'Squid.Step.Timeout', propertyValue: '120' },
        { id: 2, stepId: 1, propertyName: 'Squid.Action.TargetRoles', propertyValue: 'web' },
      ],
      actions: [{
        id: 13,
        stepId: 1,
        actionOrder: 0,
        name: 'Deploy a Package',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: false,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 13, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '1' },
          { id: 2, actionId: 13, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Newtonsoft.Json' },
          { id: 3, actionId: 13, propertyName: 'Squid.Action.Package.PackageVersion', propertyValue: '13.0.3' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
    })

    expect(form.packageVersion).toBe('13.0.3')
    expect(form.timeoutMinutes).toBe(2)
  })

  it('builds package version property and stores timeout as seconds', () => {
    const form: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      feedType: 'NuGet',
      packageId: 'Acme.Web',
      packageVersion: '1.2.3',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 5,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }

    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: null })
    const actionProps = dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue])
    const stepProps = dto.properties.map((p) => [p.propertyName, p.propertyValue])

    expect(actionProps).toContainEqual(['Squid.Action.Package.PackageVersion', '1.2.3'])
    expect(stepProps).toContainEqual(['Squid.Step.Timeout', '300'])
  })

  it('rejects negative timeout minutes', () => {
    const form = {
      ...validBaseForm,
      timeoutMinutes: -1,
    }
    expect(validateDeployPackageForm(form).ok).toBe(false)
  })

  it('builds create dto with required properties', () => {
    const form: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }
    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: null })
    const props = dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue])
    expect(props).toContainEqual(['Squid.Action.Package.FeedId', '3'])
    expect(props).toContainEqual(['Squid.Action.Package.PackageId', 'Acme.Web'])
    expect(props).toContainEqual(['Squid.Action.Package.InstallationDirectoryMode', 'Versioned'])
  })

  it('preserves unknown existing properties on edit', () => {
    const existing = {
      id: 9,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy Web',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: new Date().toISOString(),
      actions: [{
        id: 1,
        stepId: 9,
        actionOrder: 0,
        name: 'Deploy Web',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: false,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 1, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '3' },
          { id: 2, actionId: 1, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Acme.Web' },
          { id: 3, actionId: 1, propertyName: 'Custom.Unknown', propertyValue: 'keep-me' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
      properties: [],
    } as any
    const form = normalizeDeployPackageForm(existing)
    form.packageId = 'Acme.Web'
    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: existing })
    expect(dto.actions[0].properties.some((p) => p.propertyName === 'Custom.Unknown' && p.propertyValue === 'keep-me')).toBe(true)
  })

  it('validates required fields and custom path', () => {
    expect(validateDeployPackageForm({
      stepName: '',
      feedId: null,
      packageId: '',
      packageVersion: '',
      targetRoles: [],
      installationDirectoryMode: 'Custom',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }).ok).toBe(false)
  })

  it('normalizes and builds full step control properties', () => {
    const existing = {
      id: 9,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy Web',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartWithPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: true,
      createdAt: new Date().toISOString(),
      properties: [
        { id: 1, stepId: 9, propertyName: 'Squid.Action.TargetRoles', propertyValue: 'web' },
        { id: 2, stepId: 9, propertyName: 'Squid.Action.RunOnServer', propertyValue: 'false' },
        { id: 3, stepId: 9, propertyName: 'Squid.Step.RetriesEnabled', propertyValue: 'true' },
        { id: 4, stepId: 9, propertyName: 'Squid.Step.RetriesCount', propertyValue: '2' },
        { id: 5, stepId: 9, propertyName: 'Squid.Step.Timeout', propertyValue: '45' },
        { id: 6, stepId: 9, propertyName: 'Squid.Step.MaxParallelism', propertyValue: '3' },
      ],
      actions: [{
        id: 1,
        stepId: 9,
        actionOrder: 0,
        name: 'Deploy Web',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: true,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 1, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '3' },
          { id: 2, actionId: 1, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Acme.Web' },
          { id: 3, actionId: 1, propertyName: 'Squid.Action.Script.ExecutionLocation', propertyValue: 'DeploymentTarget' },
          { id: 4, actionId: 1, propertyName: 'Custom.Unknown', propertyValue: 'keep-me' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
    } as any

    const form = normalizeDeployPackageForm(existing)
    expect(form.executionLocation).toBe('DeploymentTarget')
    expect(form.startTrigger).toBe('StartWithPrevious')
    expect(form.retriesEnabled).toBe(true)
    expect(form.retryCount).toBe(2)
    expect(form.timeoutMinutes).toBe(1)
    expect(form.maxParallelism).toBe(3)

    form.executionLocation = 'DeploymentTarget'
    form.retriesEnabled = true
    form.retryCount = 3
    form.timeoutMinutes = 2
    form.maxParallelism = 2

    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: existing })
    const stepProps = Object.fromEntries(dto.properties.map((p) => [p.propertyName, p.propertyValue]))
    const actionProps = Object.fromEntries(dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue]))

    expect(dto.startTrigger).toBe('StartWithPrevious')
    expect(stepProps['Squid.Action.RunOnServer']).toBe('false')
    expect(stepProps['Squid.Step.RetriesEnabled']).toBe('true')
    expect(stepProps['Squid.Step.RetriesCount']).toBe('3')
    expect(stepProps['Squid.Step.Timeout']).toBe('120')
    expect(stepProps['Squid.Step.MaxParallelism']).toBe('2')
    expect(actionProps['Squid.Action.Script.ExecutionLocation']).toBe('DeploymentTarget')
    expect(actionProps['Custom.Unknown']).toBe('keep-me')
  })

  it('validates retries/timeout/rolling ranges', () => {
    const base: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: true,
      retryCount: 9,
      maxParallelism: 0,
      timeoutMinutes: -1,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }
    expect(validateDeployPackageForm(base).ok).toBe(false)
  })

  it('maps WorkerPool execution location to RunOnServer=true', () => {
    const form: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'WorkerPool',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }
    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: null })
    const stepProps = Object.fromEntries(dto.properties.map((p) => [p.propertyName, p.propertyValue]))
    expect(stepProps['Squid.Action.RunOnServer']).toBe('true')
  })

  it('preserves WorkerPoolForRoles when RunOnServer=true on normalize and build', () => {
    const existing = {
      id: 9,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy Web',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: new Date().toISOString(),
      properties: [
        { id: 1, stepId: 9, propertyName: 'Squid.Action.TargetRoles', propertyValue: 'web' },
        { id: 2, stepId: 9, propertyName: 'Squid.Action.RunOnServer', propertyValue: 'true' },
      ],
      actions: [{
        id: 1,
        stepId: 9,
        actionOrder: 0,
        name: 'Deploy Web',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: false,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 1, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '3' },
          { id: 2, actionId: 1, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Acme.Web' },
          { id: 3, actionId: 1, propertyName: 'Squid.Action.Script.ExecutionLocation', propertyValue: 'WorkerPoolForRoles' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
    } as any

    const form = normalizeDeployPackageForm(existing)
    expect(form.executionLocation).toBe('WorkerPoolForRoles')

    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: existing })
    const stepProps = Object.fromEntries(dto.properties.map((p) => [p.propertyName, p.propertyValue]))
    const actionProps = Object.fromEntries(dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue]))

    expect(actionProps['Squid.Action.Script.ExecutionLocation']).toBe('WorkerPoolForRoles')
    expect(stepProps['Squid.Action.RunOnServer']).toBe('true')
  })

  it('omits timeout and maxParallelism properties when zero', () => {
    const form: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'WorkerPoolForRoles',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }
    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: null })
    const stepProps = Object.fromEntries(dto.properties.map((p) => [p.propertyName, p.propertyValue]))
    const actionProps = Object.fromEntries(dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue]))

    expect(stepProps['Squid.Step.Timeout']).toBeUndefined()
    expect(stepProps['Squid.Step.MaxParallelism']).toBeUndefined()
    expect(stepProps['Squid.Action.RunOnServer']).toBe('true')
    expect(actionProps['Squid.Action.Script.ExecutionLocation']).toBe('WorkerPoolForRoles')
  })

  it('normalizes and builds configuration rewrite properties', () => {
    const existing = {
      id: 9,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy Web',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: new Date().toISOString(),
      properties: [
        { id: 1, stepId: 9, propertyName: 'Squid.Action.TargetRoles', propertyValue: 'web' },
      ],
      actions: [{
        id: 1,
        stepId: 9,
        actionOrder: 0,
        name: 'Deploy Web',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: false,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 1, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '3' },
          { id: 2, actionId: 1, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Acme.Web' },
          { id: 3, actionId: 1, propertyName: 'Squid.Action.ConfigurationVariables.Enabled', propertyValue: 'True' },
          { id: 4, actionId: 1, propertyName: 'Squid.Action.ConfigurationTransforms.Enabled', propertyValue: 'True' },
          { id: 5, actionId: 1, propertyName: 'Squid.Action.ConfigurationTransforms.EnvironmentName', propertyValue: '#{Squid.Environment.Name}' },
          { id: 6, actionId: 1, propertyName: 'Squid.Action.SubstituteInFiles.Enabled', propertyValue: 'True' },
          { id: 7, actionId: 1, propertyName: 'Squid.Action.SubstituteInFiles.TargetFiles', propertyValue: 'appsettings.json' },
          { id: 8, actionId: 1, propertyName: 'Squid.Action.JsonConfigVariables.Enabled', propertyValue: 'True' },
          { id: 9, actionId: 1, propertyName: 'Squid.Action.JsonConfigVariables.Targets', propertyValue: '**/appsettings.json' },
          { id: 10, actionId: 1, propertyName: 'Custom.Keep', propertyValue: 'yes' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
    } as any

    const form = normalizeDeployPackageForm(existing)
    expect(form.configurationVariablesEnabled).toBe(true)
    expect(form.configurationTransformsEnabled).toBe(true)
    expect(form.substituteInFilesEnabled).toBe(true)
    expect(form.structuredConfigEnabled).toBe(true)

    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: existing })
    const actionProps = Object.fromEntries(dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue]))
    expect(actionProps['Squid.Action.ConfigurationVariables.Enabled']).toBe('True')
    expect(actionProps['Squid.Action.JsonConfigVariables.Targets']).toBe('**/appsettings.json')
    expect(actionProps['Custom.Keep']).toBe('yes')
  })

  it('normalizes and builds installation option properties', () => {
    const existing = {
      id: 9,
      processId: 1,
      stepOrder: 1,
      name: 'Deploy Web',
      stepType: 'DeployPackage',
      condition: 'Success',
      startTrigger: 'StartAfterPrevious',
      packageRequirement: 'LetSquidDecide',
      isDisabled: false,
      isRequired: false,
      createdAt: new Date().toISOString(),
      properties: [
        { id: 1, stepId: 9, propertyName: 'Squid.Action.TargetRoles', propertyValue: 'web' },
      ],
      actions: [{
        id: 1,
        stepId: 9,
        actionOrder: 0,
        name: 'Deploy Web',
        actionType: 'Squid.TentaclePackage',
        workerPoolId: null,
        isDisabled: false,
        isRequired: false,
        canBeUsedForProjectVersioning: true,
        createdAt: new Date().toISOString(),
        properties: [
          { id: 1, actionId: 1, propertyName: 'Squid.Action.Package.FeedId', propertyValue: '3' },
          { id: 2, actionId: 1, propertyName: 'Squid.Action.Package.PackageId', propertyValue: 'Acme.Web' },
          { id: 3, actionId: 1, propertyName: 'Squid.Action.Package.PurgeBeforeInstall', propertyValue: 'True' },
          { id: 4, actionId: 1, propertyName: 'Squid.Action.Package.PreservePaths', propertyValue: 'App_Data/**\nlogs/**' },
          { id: 5, actionId: 1, propertyName: 'Squid.Action.Package.SkipIfAlreadyInstalled', propertyValue: 'True' },
          { id: 6, actionId: 1, propertyName: 'Squid.Action.Package.RetentionCount', propertyValue: '3' },
          { id: 7, actionId: 1, propertyName: 'Squid.Action.Package.UseCurrentPointer', propertyValue: 'True' },
          { id: 8, actionId: 1, propertyName: 'Squid.Action.Package.RollbackOnFailure', propertyValue: 'True' },
          { id: 9, actionId: 1, propertyName: 'Custom.Keep', propertyValue: 'yes' },
        ],
        environments: [],
        excludedEnvironments: [],
        channels: [],
      }],
    } as any

    const form = normalizeDeployPackageForm(existing)
    expect(form.purgeBeforeInstall).toBe(true)
    expect(form.preservePaths).toBe('App_Data/**\nlogs/**')
    expect(form.skipIfAlreadyInstalled).toBe(true)
    expect(form.retentionCount).toBe(3)
    expect(form.useCurrentPointer).toBe(true)
    expect(form.rollbackOnFailure).toBe(true)

    const dto = buildDeployPackageStepDto({ form, processId: 1, existingStep: existing })
    const actionProps = Object.fromEntries(dto.actions[0].properties.map((p) => [p.propertyName, p.propertyValue]))
    expect(actionProps['Squid.Action.Package.PurgeBeforeInstall']).toBe('True')
    expect(actionProps['Squid.Action.Package.PreservePaths']).toBe('App_Data/**\nlogs/**')
    expect(actionProps['Squid.Action.Package.SkipIfAlreadyInstalled']).toBe('True')
    expect(actionProps['Squid.Action.Package.RetentionCount']).toBe('3')
    expect(actionProps['Squid.Action.Package.UseCurrentPointer']).toBe('True')
    expect(actionProps['Squid.Action.Package.RollbackOnFailure']).toBe('True')
    expect(actionProps['Custom.Keep']).toBe('yes')
  })

  it('detects unsupported deploy package feed types', () => {
    expect(isUnsupportedDeployPackageFeedType('Docker')).toBe(true)
    expect(isUnsupportedDeployPackageFeedType('Docker Container Registry')).toBe(true)
    expect(isUnsupportedDeployPackageFeedType('Helm')).toBe(true)
    expect(isUnsupportedDeployPackageFeedType('AWS Elastic Container Registry')).toBe(true)
    expect(isUnsupportedDeployPackageFeedType('NuGet')).toBe(false)
    expect(isUnsupportedDeployPackageFeedType('GitHub')).toBe(false)
    expect(isUnsupportedDeployPackageFeedType('Maven')).toBe(false)
  })

  it('rejects unsupported docker/helm feed types on validate', () => {
    const base: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      feedType: 'Docker',
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }
    const docker = validateDeployPackageForm(base)
    expect(docker.ok).toBe(false)
    expect(docker.message).toContain('cannot be installed by Deploy a Package')

    const helm = validateDeployPackageForm({ ...base, feedType: 'Helm' })
    expect(helm.ok).toBe(false)

    const nuget = validateDeployPackageForm({ ...base, feedType: 'NuGet' })
    expect(nuget.ok).toBe(true)

    const github = validateDeployPackageForm({ ...base, feedType: 'GitHub' })
    expect(github.ok).toBe(true)
  })

  it('fails closed when feedId is set but feedType is unavailable', () => {
    const base: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      feedType: null,
      packageId: 'Acme.Web',
      packageVersion: '',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      executionLocation: 'DeploymentTarget',
      startTrigger: 'StartAfterPrevious',
      retriesEnabled: false,
      retryCount: 1,
      maxParallelism: 0,
      timeoutMinutes: 0,
      configurationVariablesEnabled: false,
      configurationTransformsEnabled: false,
      configurationTransformsEnvironmentName: '#{Squid.Environment.Name}',
      additionalTransforms: '',
      substituteInFilesEnabled: false,
      substituteInFilesTargetFiles: '',
      substituteFailOnUnresolved: false,
      structuredConfigEnabled: false,
      structuredConfigTargets: '',
      purgeBeforeInstall: false,
      preservePaths: '',
      skipIfAlreadyInstalled: false,
      retentionCount: 0,
      useCurrentPointer: false,
      rollbackOnFailure: false,
      conditions: emptyConditions,
    }

    const missing = validateDeployPackageForm(base)
    expect(missing.ok).toBe(false)
    expect((missing.message ?? '').toLowerCase()).toMatch(/feed type.*(required|loading)/)

    const empty = validateDeployPackageForm({ ...base, feedType: '' })
    expect(empty.ok).toBe(false)
    expect((empty.message ?? '').toLowerCase()).toMatch(/feed type.*(required|loading)/)

    const whitespace = validateDeployPackageForm({ ...base, feedType: '   ' })
    expect(whitespace.ok).toBe(false)

    // still reject unsupported when type is present
    const docker = validateDeployPackageForm({ ...base, feedType: 'Docker' })
    expect(docker.ok).toBe(false)
    expect(docker.message).toContain('cannot be installed by Deploy a Package')
  })

})
