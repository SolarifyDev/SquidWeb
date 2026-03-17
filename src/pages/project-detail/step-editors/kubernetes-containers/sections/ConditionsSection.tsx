import React from 'react'
import { StepConditionsSection } from '../../shared/StepConditionsSection'
import type { ContainersEditorState } from '../types'

interface ConditionsSectionProps {
  state: ContainersEditorState
  projectId?: number | null
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function ConditionsSection({ state, updateField, projectId }: ConditionsSectionProps) {
  return (
    <StepConditionsSection
      projectId={projectId}
      value={{
        environmentMode: state.environmentMode,
        environmentIds: state.environmentIds,
        channelIds: state.channelIds,
        runCondition: state.condition,
        conditionExpression: state.conditionExpression,
        packageRequirement: state.packageRequirement,
        required: state.isRequired,
        disabled: state.isDisabled,
      }}
      onChange={(next) => {
        updateField('environmentMode', next.environmentMode)
        updateField('environmentIds', next.environmentIds)
        updateField('channelIds', next.channelIds)
        updateField('condition', next.runCondition)
        updateField('conditionExpression', next.conditionExpression)
        updateField('packageRequirement', next.packageRequirement)
        updateField('isRequired', next.required)
        updateField('isDisabled', next.disabled)
      }}
    />
  )
}
