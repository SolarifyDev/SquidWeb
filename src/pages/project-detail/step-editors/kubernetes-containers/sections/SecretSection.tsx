import React from 'react'
import { Input } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { KeyValueListEditor } from '../../shared/KeyValueListEditor'
import type { ContainersEditorState } from '../types'

interface SecretSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function SecretSection({ state, updateField }: SecretSectionProps) {
  return (
    <CollapsibleSection title="Secret" subtitle="Configure a Kubernetes Secret resource.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Secret name</label>
        <Input value={state.secretName} onChange={(e) => updateField('secretName', e.target.value)} placeholder="my-secret" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Secret items</label>
        <KeyValueListEditor items={state.secretValues} onChange={(v) => updateField('secretValues', v)} keyLabel="Key" valueLabel="Value" addLabel="Add Item" />
      </div>
    </CollapsibleSection>
  )
}
