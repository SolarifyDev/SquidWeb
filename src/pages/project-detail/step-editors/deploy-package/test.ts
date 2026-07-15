import { describe, expect, it } from 'vitest'
import {
  buildDeployPackageStepDto,
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

describe('deploy-package-model', () => {
  it('builds create dto with required properties', () => {
    const form: DeployPackageFormState = {
      stepName: 'Deploy Web',
      feedId: 3,
      packageId: 'Acme.Web',
      targetRoles: ['web'],
      installationDirectoryMode: 'Versioned',
      customInstallationDirectory: '',
      conditions: emptyConditions,
      startTrigger: 'StartAfterPrevious',
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
      targetRoles: [],
      installationDirectoryMode: 'Custom',
      customInstallationDirectory: '',
      conditions: emptyConditions,
      startTrigger: 'StartAfterPrevious',
    }).ok).toBe(false)
  })
})
