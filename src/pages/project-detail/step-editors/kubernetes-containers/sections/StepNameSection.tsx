import React from 'react'
import { Input } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { ContainersEditorState } from '../types'

interface StepNameSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function StepNameSection({ state, updateField }: StepNameSectionProps) {
  return (
    <CollapsibleSection title="Step Name" subtitle="A short, memorable, unique name for this step." defaultOpen>
      <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
      <Input
        value={state.stepName}
        onChange={(e) => updateField('stepName', e.target.value)}
        placeholder="e.g. Deploy Kubernetes Containers"
      />
    </CollapsibleSection>
  )
}
