import React from 'react'
import { Input, Button } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { KeyValueListEditor } from '../../shared/KeyValueListEditor'
import type { ContainersEditorState, IngressRule, IngressTls } from '../types'

interface IngressSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function IngressSection({ state, updateField }: IngressSectionProps) {
  const updateRule = (index: number, rule: IngressRule) => {
    updateField('ingressRules', state.ingressRules.map((r, i) => (i === index ? rule : r)))
  }

  return (
    <CollapsibleSection title="Ingress" subtitle="Configure the Kubernetes Ingress resource.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Ingress name</label>
        <Input value={state.ingressName} onChange={(e) => updateField('ingressName', e.target.value)} placeholder="my-ingress" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Ingress class name</label>
        <Input value={state.ingressClassName} onChange={(e) => updateField('ingressClassName', e.target.value)} placeholder="nginx" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Ingress annotations</label>
        <KeyValueListEditor items={state.ingressAnnotations} onChange={(v) => updateField('ingressAnnotations', v)} addLabel="Add Annotation" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Host rules</label>
        <div className="space-y-3">
          {state.ingressRules.map((rule, ri) => (
            <div key={ri} className="border border-slate-100 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input size="small" placeholder="Host (e.g. example.com)" value={rule.host} onChange={(e) => updateRule(ri, { ...rule, host: e.target.value })} className="flex-1" />
                <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('ingressRules', state.ingressRules.filter((_, j) => j !== ri))} />
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Paths</div>
              {rule.paths.map((path, pi) => (
                <div key={pi} className="flex items-center gap-2">
                  <Input size="small" placeholder="Path" value={path.path} onChange={(e) => {
                    const paths = rule.paths.map((p, j) => (j === pi ? { ...p, path: e.target.value } : p))
                    updateRule(ri, { ...rule, paths })
                  }} style={{ width: 100 }} />
                  <Input size="small" placeholder="Path Type" value={path.pathType} onChange={(e) => {
                    const paths = rule.paths.map((p, j) => (j === pi ? { ...p, pathType: e.target.value } : p))
                    updateRule(ri, { ...rule, paths })
                  }} style={{ width: 100 }} />
                  <Input size="small" placeholder="Service Name" value={path.backend.serviceName} onChange={(e) => {
                    const paths = rule.paths.map((p, j) => (j === pi ? { ...p, backend: { ...p.backend, serviceName: e.target.value } } : p))
                    updateRule(ri, { ...rule, paths })
                  }} className="flex-1" />
                  <Input size="small" placeholder="Port" value={path.backend.servicePort} onChange={(e) => {
                    const paths = rule.paths.map((p, j) => (j === pi ? { ...p, backend: { ...p.backend, servicePort: e.target.value } } : p))
                    updateRule(ri, { ...rule, paths })
                  }} style={{ width: 70 }} />
                  <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => {
                    const paths = rule.paths.filter((_, j) => j !== pi)
                    updateRule(ri, { ...rule, paths })
                  }} />
                </div>
              ))}
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateRule(ri, { ...rule, paths: [...rule.paths, { path: '/', pathType: 'Prefix', backend: { serviceName: '', servicePort: '' } }] })}>Add Path</Button>
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('ingressRules', [...state.ingressRules, { host: '', paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: '', servicePort: '' } }] }])} className="mt-2">Add Host Rule</Button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">TLS certificates</label>
        <div className="space-y-2">
          {state.ingressTls.map((tls, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Hosts (comma-separated)" value={tls.hosts.join(', ')} onChange={(e) => {
                const updated: IngressTls = { ...tls, hosts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }
                updateField('ingressTls', state.ingressTls.map((t, j) => (j === i ? updated : t)))
              }} className="flex-1" />
              <Input size="small" placeholder="Secret Name" value={tls.secretName} onChange={(e) => {
                const updated: IngressTls = { ...tls, secretName: e.target.value }
                updateField('ingressTls', state.ingressTls.map((t, j) => (j === i ? updated : t)))
              }} className="flex-1" />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('ingressTls', state.ingressTls.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('ingressTls', [...state.ingressTls, { hosts: [], secretName: '' }])} className="mt-1">Add TLS</Button>
      </div>
    </CollapsibleSection>
  )
}
