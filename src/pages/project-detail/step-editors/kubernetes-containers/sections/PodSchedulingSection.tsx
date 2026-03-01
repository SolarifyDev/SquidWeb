import React from 'react'
import { Input, Button } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { ContainersEditorState, Toleration, SysctlEntry, DnsOption } from '../types'

interface PodSchedulingSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function PodSchedulingSection({ state, updateField }: PodSchedulingSectionProps) {
  const updateToleration = (index: number, field: keyof Toleration, value: string) => {
    updateField('tolerations', state.tolerations.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  const updateSysctl = (index: number, field: keyof SysctlEntry, value: string) => {
    updateField('sysctls', state.sysctls.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const updateDnsOption = (index: number, field: keyof DnsOption, value: string) => {
    updateField('dnsConfigOptions', state.dnsConfigOptions.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  return (
    <CollapsibleSection title="Pod Scheduling" subtitle="Tolerations, affinity, DNS and security settings.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tolerations</label>
        <div className="space-y-1">
          {state.tolerations.map((tol, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Key" value={tol.key} onChange={(e) => updateToleration(i, 'key', e.target.value)} className="flex-1" />
              <Input size="small" placeholder="Operator" value={tol.operator} onChange={(e) => updateToleration(i, 'operator', e.target.value)} style={{ width: 90 }} />
              <Input size="small" placeholder="Value" value={tol.value} onChange={(e) => updateToleration(i, 'value', e.target.value)} className="flex-1" />
              <Input size="small" placeholder="Effect" value={tol.effect} onChange={(e) => updateToleration(i, 'effect', e.target.value)} style={{ width: 110 }} />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('tolerations', state.tolerations.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('tolerations', [...state.tolerations, { key: '', operator: 'Equal', value: '', effect: '' }])} className="mt-1">Add Toleration</Button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Node affinity (JSON)</label>
        <Input.TextArea size="small" rows={3} value={state.nodeAffinity} onChange={(e) => updateField('nodeAffinity', e.target.value)} placeholder='{"requiredDuringSchedulingIgnoredDuringExecution": ...}' />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Pod affinity (JSON)</label>
        <Input.TextArea size="small" rows={3} value={state.podAffinity} onChange={(e) => updateField('podAffinity', e.target.value)} placeholder="Optional pod affinity JSON" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Pod anti-affinity (JSON)</label>
        <Input.TextArea size="small" rows={3} value={state.podAntiAffinity} onChange={(e) => updateField('podAntiAffinity', e.target.value)} placeholder="Optional pod anti-affinity JSON" />
      </div>

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

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Sysctls</label>
        <div className="space-y-1">
          {state.sysctls.map((sysctl, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Name" value={sysctl.name} onChange={(e) => updateSysctl(i, 'name', e.target.value)} className="flex-1" />
              <Input size="small" placeholder="Value" value={sysctl.value} onChange={(e) => updateSysctl(i, 'value', e.target.value)} className="flex-1" />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('sysctls', state.sysctls.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('sysctls', [...state.sysctls, { name: '', value: '' }])} className="mt-1">Add Sysctl</Button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">DNS config options</label>
        <div className="space-y-1">
          {state.dnsConfigOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Name" value={opt.name} onChange={(e) => updateDnsOption(i, 'name', e.target.value)} className="flex-1" />
              <Input size="small" placeholder="Value" value={opt.value} onChange={(e) => updateDnsOption(i, 'value', e.target.value)} className="flex-1" />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('dnsConfigOptions', state.dnsConfigOptions.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('dnsConfigOptions', [...state.dnsConfigOptions, { name: '', value: '' }])} className="mt-1">Add Option</Button>
      </div>
    </CollapsibleSection>
  )
}
