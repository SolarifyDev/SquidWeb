import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Input, Radio, Select, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  updateDeploymentStep,
  type DeploymentActionDto,
  type DeploymentActionPropertyDto,
  type DeploymentStepPropertyDto,
} from 'pages/apis/deploymentProcess'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection, type StepEnvironmentMode } from '../shared/StepConditionsSection'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import { getTeams, type TeamDto } from 'pages/apis/team'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'https://localhost:7078/api'
const ACTION_TYPE = 'Squid.Manual'
const EVERYONE_VALUE = '__EVERYONE__'
const STEP_CONDITION_EXPRESSION_PROPERTY = 'Squid.Step.ConditionExpression'

const ManualProperties = {
  instructions: ['Squid.Action.Manual.Instructions', 'Octopus.Action.Manual.Instructions'],
  responsibleTeams: ['Squid.Action.Manual.ResponsibleTeamIds', 'Octopus.Action.Manual.ResponsibleTeamIds'],
  blockDeployments: ['Squid.Action.Manual.BlockDeployments', 'Octopus.Action.Manual.BlockDeployments'],
} as const

const AllManualKeys = [
  ...ManualProperties.instructions,
  ...ManualProperties.responsibleTeams,
  ...ManualProperties.blockDeployments,
]
const ManualKeySet = new Set<string>(AllManualKeys)

function getActionProperty(action: DeploymentActionDto | undefined, names: readonly string[]): string | undefined {
  if (!action) return undefined
  for (const name of names) {
    const value = action.properties.find((p) => p.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return undefined
}

function getStepProperty(stepProperties: DeploymentStepPropertyDto[] | undefined, name: string): string {
  if (!stepProperties) return ''
  return stepProperties.find((property) => property.propertyName === name)?.propertyValue ?? ''
}

function parseTeamValues(rawValue: string | undefined): string[] {
  if (!rawValue?.trim()) return []
  const trimmed = rawValue.trim()

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      // keep csv fallback
    }
  }

  return trimmed.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseSpaceNumericId(spaceId: string): number {
  const match = spaceId.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(spaceId)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

function buildActionProperties(
  existingAction: DeploymentActionDto | undefined,
  instructions: string,
  responsibleTeams: string[],
  blockDeployments: 'True' | 'False',
): DeploymentActionPropertyDto[] {
  const preserved = (existingAction?.properties ?? []).filter(
    (property) => !ManualKeySet.has(property.propertyName),
  )

  const next: DeploymentActionPropertyDto[] = [...preserved]

  if (instructions.trim()) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: ManualProperties.instructions[0],
      propertyValue: instructions.trim(),
    })
  }

  if (responsibleTeams.length) {
    next.push({
      id: 0,
      actionId: existingAction?.id ?? 0,
      propertyName: ManualProperties.responsibleTeams[0],
      propertyValue: responsibleTeams.join(','),
    })
  }

  next.push({
    id: 0,
    actionId: existingAction?.id ?? 0,
    propertyName: ManualProperties.blockDeployments[0],
    propertyValue: blockDeployments,
  })

  return next
}

function buildStepProperties(
  existingStepProperties: DeploymentStepPropertyDto[] | undefined,
  stepId: number,
  runCondition: string,
  conditionExpression: string,
): DeploymentStepPropertyDto[] {
  const preserved = (existingStepProperties ?? []).filter(
    (property) => property.propertyName !== STEP_CONDITION_EXPRESSION_PROPERTY,
  )

  if (runCondition === 'Variable' && conditionExpression.trim()) {
    return [
      ...preserved,
      {
        id: 0,
        stepId,
        propertyName: STEP_CONDITION_EXPRESSION_PROPERTY,
        propertyValue: conditionExpression.trim(),
      },
    ]
  }

  return preserved
}

export const ManualInterventionEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function ManualInterventionEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const action = step?.actions[0]
    const includeEnvironments = action?.environments ?? []
    const excludeEnvironments = action?.excludedEnvironments ?? []
    const initialEnvironmentMode: StepEnvironmentMode = excludeEnvironments.length > 0
      ? 'exclude'
      : includeEnvironments.length > 0
        ? 'include'
        : 'all'
    const [stepName, setStepName] = useState(step?.name ?? 'Manual Intervention Required')
    const [instructions, setInstructions] = useState(
      () => getActionProperty(action, ManualProperties.instructions) ?? '',
    )
    const [responsibleTeams, setResponsibleTeams] = useState<string[]>(
      () => parseTeamValues(getActionProperty(action, ManualProperties.responsibleTeams)),
    )
    const [blockDeployments, setBlockDeployments] = useState<'True' | 'False'>(
      () => {
        const raw = getActionProperty(action, ManualProperties.blockDeployments)
        return raw === 'True' ? 'True' : 'False'
      },
    )
    const [environmentMode, setEnvironmentMode] = useState<StepEnvironmentMode>(initialEnvironmentMode)
    const [environmentIds, setEnvironmentIds] = useState<number[]>(
      initialEnvironmentMode === 'exclude' ? excludeEnvironments : includeEnvironments,
    )
    const [channelIds, setChannelIds] = useState<number[]>(action?.channels ?? [])
    const [runCondition, setRunCondition] = useState(step?.condition ?? 'Success')
    const [conditionExpression, setConditionExpression] = useState(
      getStepProperty(step?.properties, STEP_CONDITION_EXPRESSION_PROPERTY),
    )
    const [packageRequirement, setPackageRequirement] = useState(step?.packageRequirement ?? 'LetSquidDecide')
    const [isRequired, setIsRequired] = useState(step?.isRequired ?? false)
    const [isDisabled, setIsDisabled] = useState(step?.isDisabled ?? false)
    const [teamsLoading, setTeamsLoading] = useState(false)
    const [teamOptions, setTeamOptions] = useState<TeamDto[]>([])

    useEffect(() => {
      const numericSpaceId = parseSpaceNumericId(spaceId)
      let cancelled = false

      setTeamsLoading(true)
      getTeams({ spaceId: numericSpaceId })
        .then((result) => {
          if (cancelled) return
          const teams = [...(result.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name))
          setTeamOptions(teams)
        })
        .catch(() => {
          if (cancelled) return
          setTeamOptions([])
        })
        .finally(() => {
          if (cancelled) return
          setTeamsLoading(false)
        })

      return () => {
        cancelled = true
      }
    }, [spaceId])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    const handleSave = async () => {
      const normalizedStepName = stepName.trim()
      if (!normalizedStepName) {
        message.warning('Step name is required')
        return
      }

      const actionProperties = buildActionProperties(action, instructions, responsibleTeams, blockDeployments)
      const stepProperties = buildStepProperties(step?.properties, step?.id ?? 0, runCondition, conditionExpression)
      const actionEnvironments = environmentMode === 'include' ? environmentIds : []
      const actionExcludedEnvironments = environmentMode === 'exclude' ? environmentIds : []
      const effectiveIsRequired = responsibleTeams.length > 0 ? true : isRequired

      const nextAction: DeploymentActionDto = {
        id: action?.id ?? 0,
        stepId: step?.id ?? 0,
        actionOrder: action?.actionOrder ?? 0,
        name: normalizedStepName,
        actionType: ACTION_TYPE,
        workerPoolId: action?.workerPoolId ?? null,
        isDisabled,
        isRequired: action?.isRequired ?? false,
        canBeUsedForProjectVersioning: action?.canBeUsedForProjectVersioning ?? false,
        createdAt: action?.createdAt ?? new Date().toISOString(),
        properties: actionProperties,
        environments: actionEnvironments,
        excludedEnvironments: actionExcludedEnvironments,
        channels: channelIds,
      }

      const nextStep = {
        id: step?.id ?? 0,
        processId,
        stepOrder: step?.stepOrder ?? 0,
        name: normalizedStepName,
        stepType: step?.stepType ?? 'Action',
        condition: runCondition,
        startTrigger: step?.startTrigger ?? 'StartAfterPrevious',
        packageRequirement,
        isDisabled,
        isRequired: effectiveIsRequired,
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
      instructions,
      responsibleTeams,
      blockDeployments,
      environmentMode,
      environmentIds,
      channelIds,
      runCondition,
      conditionExpression,
      packageRequirement,
      isRequired,
      isDisabled,
      step,
      processId,
    ])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || 'Manual Intervention Required'
    const teamSelectValue = responsibleTeams
    const knownTeamIds = new Set(teamOptions.map((team) => String(team.id)))
    const unknownResponsibleTeams = responsibleTeams
      .filter((id) => !knownTeamIds.has(id))
      .map((id) => ({ label: `Team #${id}`, value: id }))
    const selectOptions = [
      { label: 'Everyone', value: EVERYONE_VALUE },
      ...teamOptions.map((team) => ({ label: team.name, value: String(team.id) })),
      ...unknownResponsibleTeams,
    ]

    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 rounded overflow-hidden bg-slate-100" style={{ width: 40, height: 40 }}>
              <img
                src={logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 leading-tight">Pause deployment and require human intervention</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null && <span className="text-sm text-slate-400 font-medium">{stepIndex + 1}.</span>}
                <span className="text-sm font-semibold text-slate-800 truncate">{displayName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
              Configure features
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors" aria-label="More Step Actions">
              <MoreOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <CollapsibleSection title="Name" subtitle="Enter a short name for this manual step." defaultOpen>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Step name</label>
              <Input
                size="small"
                value={stepName}
                onChange={(event) => setStepName(event.target.value)}
                placeholder="Manual Intervention Required"
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Instructions"
            subtitle="These instructions will be presented to the user to follow."
            defaultOpen
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Instructions</label>
              <Input.TextArea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                autoSize={{ minRows: 1, maxRows: 8 }}
                placeholder="Describe what the approver needs to do before proceeding."
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-xs text-squid-blue hover:underline"
                onClick={() => message.info('Markdown toolbar is not available yet')}
              >
                Show markdown controls
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500 border border-slate-200"
                aria-label="Insert Variable"
                onClick={() => message.info('Insert Variable is not available yet')}
              >
                <span className="text-[12px] font-semibold">{'{ }'}</span>
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Responsible Teams"
            subtitle="Select the teams responsible for this manual step."
            defaultOpen
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsible teams</label>
              <Select
                mode="multiple"
                value={teamSelectValue}
                options={selectOptions}
                onChange={(values) => {
                  const selectedValues = Array.from(new Set((values as string[]).map((item) => item.trim()).filter(Boolean)))
                  if (selectedValues.includes(EVERYONE_VALUE)) {
                    // "Everyone" means no explicit team restriction.
                    setResponsibleTeams([])
                    return
                  }
                  setResponsibleTeams(selectedValues)
                }}
                placeholder="Everyone"
                size="small"
                className="w-full"
                loading={teamsLoading}
              />
            </div>
            <p className="text-xs text-slate-500 m-0">
              If no teams are specified, all users with deploy permission can perform this manual step.
            </p>
            <p className="text-xs text-slate-500 m-0">
              Specifying responsible teams will make the step unable to be skipped.
            </p>
          </CollapsibleSection>

          <CollapsibleSection
            title="Block Deployments"
            subtitle="Should other deployments be blocked while this manual intervention is awaiting action."
            defaultOpen
          >
            <p className="text-xs text-slate-500 m-0">
              If this manual step may pause for a long time, you can allow another deployment to begin while waiting.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Block Deployments</label>
              <Radio.Group value={blockDeployments} onChange={(event) => setBlockDeployments(event.target.value)}>
                <div className="space-y-2">
                  <Radio value="False">
                    <span className="text-sm">Allow another deployment to begin while awaiting intervention (default)</span>
                  </Radio>
                  <Radio value="True">
                    <span className="text-sm">Prevent other deployments while awaiting intervention</span>
                  </Radio>
                </div>
              </Radio.Group>
            </div>
          </CollapsibleSection>

          <StepConditionsSection
            projectId={projectId}
            value={{
              environmentMode,
              environmentIds,
              channelIds,
              runCondition,
              conditionExpression,
              packageRequirement,
              required: isRequired,
              disabled: isDisabled,
            }}
            requiredLocked={responsibleTeams.length > 0}
            requiredLockedReason={responsibleTeams.length > 0
              ? 'Responsible teams are specified, therefore this step is always required.'
              : undefined}
            onChange={(next) => {
              setEnvironmentMode(next.environmentMode)
              setEnvironmentIds(next.environmentIds)
              setChannelIds(next.channelIds)
              setRunCondition(next.runCondition)
              setConditionExpression(next.conditionExpression)
              setPackageRequirement(next.packageRequirement)
              setIsRequired(next.required)
              setIsDisabled(next.disabled)
            }}
          />
        </div>
      </div>
    )
  },
)
