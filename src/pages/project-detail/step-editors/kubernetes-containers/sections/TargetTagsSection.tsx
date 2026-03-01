import React from 'react'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { TargetTagSelect } from '../../shared/TargetTagSelect'
import type { ContainersEditorState } from '../types'

interface TargetTagsSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function TargetTagsSection({ state, updateField }: TargetTagsSectionProps) {
  const tags = state.targetRoles
    ? state.targetRoles.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <CollapsibleSection title="Target Tags" subtitle="Targets that this step will run on." defaultOpen>
      <TargetTagSelect
        value={tags}
        onChange={(values) => updateField('targetRoles', values.join(', '))}
      />
    </CollapsibleSection>
  )
}
