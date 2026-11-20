import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Button, Input, Radio, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  getTargetRoles,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepConditionsValue, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import { useRunbookProcessContext } from '../shared/RunbookProcessContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string
const ACTION_TYPE = 'Squid.HealthCheck'
const DEFAULT_STEP_NAME = 'Health Check'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'

const HealthCheckProperties = {
  healthCheckType: [
    'Squid.Action.HealthCheck.Type',
    'Squid.Action.HealthCheck.HealthCheckType',
    'Octopus.Action.HealthCheck.Type',
    'Octopus.Action.HealthCheck.HealthCheckType',
  ],
  errorHandling: ['Squid.Action.HealthCheck.ErrorHandling', 'Octopus.Action.HealthCheck.ErrorHandling'],
  newMachines: [
    'Squid.Action.HealthCheck.IncludeMachinesInDeployment',
    'Squid.Action.HealthCheck.NewDeploymentTargets',
    'Octopus.Action.HealthCheck.IncludeMachinesInDeployment',
    'Octopus.Action.HealthCheck.NewDeploymentTargets',
  ],
} as const

const TargetRolePropertyNames = ['Squid.Action.TargetRoles', 'TargetRoles'] as const
const StepPropertyFilterSet = new Set<string>([STEP_CONDITION_EXPRESSION_PROPERTY, ...TargetRolePropertyNames])
const ActionPropertyFilterSet = new Set<string>([
  ...HealthCheckProperties.healthCheckType,
  ...HealthCheckProperties.errorHandling,
  ...HealthCheckProperties.newMachines,
])

type HealthCheckType = 'FullHealthCheck' | 'ConnectionTest'
type HealthCheckErrorHandling = 'TreatExceptionsAsErrors' | 'TreatExceptionsAsWarnings'
type NewMachineBehavior = 'DoNotAlterMachines' | 'IncludeCheckedMachines'
type StartTriggerMode = 'StartAfterPrevious' | 'StartWithPrevious'

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

function buildActionProperties(
  existingAction: DeploymentActionDto | undefined,
  healthCheckType: HealthCheckType,
  errorHandling: HealthCheckErrorHandling,
  newMachineBehavior: NewMachineBehavior,
): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !ActionPropertyFilterSet.has(property.propertyName),
  )

  return [
    ...preserved,
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HealthCheckProperties.healthCheckType[0],
      propertyValue: healthCheckType,
    },
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HealthCheckProperties.errorHandling[0],
      propertyValue: errorHandling,
    },
    {
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: HealthCheckProperties.newMachines[0],
      propertyValue: newMachineBehavior,
    },
  ]
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
  const next = [...preserved]

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
      propertyName: TargetRolePropertyNames[0],
      propertyValue: targetTags.join(','),
    })
  }

  return next
}

function normalizeHealthCheckType(value: string | undefined): HealthCheckType {
  return value === 'ConnectionTest' ? 'ConnectionTest' : 'FullHealthCheck'
}

function normalizeErrorHandling(value: string | undefined): HealthCheckErrorHandling {
  return value === 'TreatExceptionsAsWarnings' ? 'TreatExceptionsAsWarnings' : 'TreatExceptionsAsErrors'
}

function normalizeNewMachineBehavior(value: string | undefined): NewMachineBehavior {
  return value === 'IncludeCheckedMachines' ? 'IncludeCheckedMachines' : 'DoNotAlterMachines'
}

export const HealthCheckEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function HealthCheckEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const runbookContext = useRunbookProcessContext()
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
    const [healthCheckType, setHealthCheckType] = useState<HealthCheckType>(
      normalizeHealthCheckType(getActionProperty(action, HealthCheckProperties.healthCheckType)),
    )
    const [errorHandling, setErrorHandling] = useState<HealthCheckErrorHandling>(
      normalizeErrorHandling(getActionProperty(action, HealthCheckProperties.errorHandling)),
    )
    const [newMachineBehavior, setNewMachineBehavior] = useState<NewMachineBehavior>(
      normalizeNewMachineBehavior(getActionProperty(action, HealthCheckProperties.newMachines)),
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

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      const actionEnvironments = conditions.environmentMode === 'include' ? conditions.environmentIds : []
      const actionExcludedEnvironments = conditions.environmentMode === 'exclude' ? conditions.environmentIds : []
      const actionProperties = buildActionProperties(action, healthCheckType, errorHandling, newMachineBehavior)
      const stepProperties = buildStepProperties(
        step?.properties,
        step?.id ?? 0,
        conditions.runCondition,
        conditions.conditionExpression,
        targetTags,
      )

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
      healthCheckType,
      errorHandling,
      newMachineBehavior,
      startTrigger,
      conditions,
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
              <div className="text-xs leading-tight text-slate-400">Health Check</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
              <a href="https://oc.to/runHealthCheck" target="_blank" rel="noopener noreferrer" className="text-xs text-squid-blue hover:underline">
                Docs
              </a>
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
              placeholder="On behalf of target tags (type to add new)"
            />
            <div className="text-xs text-slate-500">You need at least one tag to select matching targets.</div>
          </CollapsibleSection>

          <CollapsibleSection title="Health check" subtitle="Configure health check behavior." defaultOpen fullWidth>
            <CollapsibleSection title="Health check type" subtitle="Choose to perform a full health check or a connection-only test." defaultOpen>
              <Radio.Group
                value={healthCheckType}
                onChange={(event) => setHealthCheckType(event.target.value as HealthCheckType)}
                className="flex flex-col gap-2"
              >
                <Radio value="FullHealthCheck">
                  <span className="text-sm">Perform a full health check <span className="text-slate-500">(default)</span></span>
                </Radio>
                <Radio value="ConnectionTest">
                  <span className="text-sm">Perform a connection-only test</span>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>

            <CollapsibleSection title="Health check errors" subtitle="Select which action to take on a health check error." defaultOpen>
              <Radio.Group
                value={errorHandling}
                onChange={(event) => setErrorHandling(event.target.value as HealthCheckErrorHandling)}
                className="flex flex-col gap-2"
              >
                <Radio value="TreatExceptionsAsErrors">
                  <span className="text-sm">Fail the deployment <span className="text-slate-500">(default)</span></span>
                </Radio>
                <Radio value="TreatExceptionsAsWarnings">
                  <span className="text-sm">Skip deployment targets that are unavailable</span>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>
          </CollapsibleSection>

          <CollapsibleSection title="Machine Selection" subtitle="Control machine selection behaviors for this step." defaultOpen fullWidth>
            <CollapsibleSection title="New Deployment Targets" subtitle="Select which action to take on new machines." defaultOpen>
              <Radio.Group
                value={newMachineBehavior}
                onChange={(event) => setNewMachineBehavior(event.target.value as NewMachineBehavior)}
                className="flex flex-col gap-2"
              >
                <Radio value="DoNotAlterMachines">
                  <span className="text-sm">Ignore any newly available deployment targets <span className="text-slate-500">(default)</span></span>
                </Radio>
                <Radio value="IncludeCheckedMachines">
                  <span className="text-sm">Include new deployment targets in the deployment</span>
                </Radio>
              </Radio.Group>
            </CollapsibleSection>
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
