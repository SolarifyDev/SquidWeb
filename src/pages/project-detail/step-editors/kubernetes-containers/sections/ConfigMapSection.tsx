import React from 'react'
import { Input } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { KeyValueListEditor } from '../../shared/KeyValueListEditor'
import type { ContainersEditorState } from '../types'

interface ConfigMapSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function ConfigMapSection({ state, updateField }: ConfigMapSectionProps) {
  return (
    <CollapsibleSection title="Config Map" subtitle="Configure a Kubernetes ConfigMap resource.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Config map name</label>
        <Input value={state.configMapName} onChange={(e) => updateField('configMapName', e.target.value)} placeholder="my-config" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Config map items</label>
        <KeyValueListEditor items={state.configMapValues} onChange={(v) => updateField('configMapValues', v)} keyLabel="Filename / Key" valueLabel="Content / Value" addLabel="Add Item" />
      </div>
    </CollapsibleSection>
  )
}
