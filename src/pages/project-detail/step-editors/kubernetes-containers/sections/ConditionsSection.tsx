import React from 'react'
import { Radio } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { ContainersEditorState } from '../types'

interface ConditionsSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function ConditionsSection({ state, updateField }: ConditionsSectionProps) {
  return (
    <CollapsibleSection title="Conditions" subtitle="Control when this step runs.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Run condition</label>
        <Radio.Group value={state.condition} onChange={(e) => updateField('condition', e.target.value)} className="flex flex-col gap-1">
          <Radio value="Success"><span className="text-sm">Success (only when all previous steps succeed)</span></Radio>
          <Radio value="Failure"><span className="text-sm">Failure (only when a previous step fails)</span></Radio>
          <Radio value="Always"><span className="text-sm">Always</span></Radio>
          <Radio value="Variable"><span className="text-sm">Variable</span></Radio>
        </Radio.Group>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Start trigger</label>
        <Radio.Group value={state.startTrigger} onChange={(e) => updateField('startTrigger', e.target.value)} className="flex flex-col gap-1">
          <Radio value="StartAfterPrevious"><span className="text-sm">Start after the previous step</span></Radio>
          <Radio value="StartWithPrevious"><span className="text-sm">Start with the previous step</span></Radio>
        </Radio.Group>
      </div>
    </CollapsibleSection>
  )
}
