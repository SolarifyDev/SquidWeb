import React from 'react'
import { Input, Button } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { ContainersEditorState } from '../types'

interface PodSchedulingSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function PodSchedulingSection({ state, updateField }: PodSchedulingSectionProps) {
  return (
    <CollapsibleSection title="Pod Scheduling" subtitle="Image pull secret settings.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Image pull secrets</label>
        <div className="space-y-1">
          {state.imagePullSecrets.map((secret, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Secret Name" value={secret.name} onChange={(e) => updateField('imagePullSecrets', state.imagePullSecrets.map((s, j) => (j === i ? { name: e.target.value } : s)))} className="flex-1" />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('imagePullSecrets', state.imagePullSecrets.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('imagePullSecrets', [...state.imagePullSecrets, { name: '' }])} className="mt-1">Add Secret</Button>
      </div>

    </CollapsibleSection>
  )
}
