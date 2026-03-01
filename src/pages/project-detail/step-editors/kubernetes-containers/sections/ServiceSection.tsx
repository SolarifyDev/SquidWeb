import React from 'react'
import { Input, Button, Select, Radio } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { ContainersEditorState, ServicePort } from '../types'

interface ServiceSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

export function ServiceSection({ state, updateField }: ServiceSectionProps) {
  const updatePort = (index: number, field: keyof ServicePort, value: string) => {
    const ports = state.servicePorts.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    updateField('servicePorts', ports)
  }

  return (
    <CollapsibleSection title="Service" subtitle="Configure the Kubernetes Service resource.">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Service name</label>
        <Input value={state.serviceName} onChange={(e) => updateField('serviceName', e.target.value)} placeholder="my-service" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Service type</label>
        <Radio.Group value={state.serviceType} onChange={(e) => updateField('serviceType', e.target.value)}>
          <Radio value="ClusterIP"><span className="text-sm">ClusterIP</span></Radio>
          <Radio value="NodePort"><span className="text-sm">NodePort</span></Radio>
          <Radio value="LoadBalancer"><span className="text-sm">LoadBalancer</span></Radio>
        </Radio.Group>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Service ports</label>
        <div className="space-y-1">
          {state.servicePorts.map((port, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Name" value={port.name} onChange={(e) => updatePort(i, 'name', e.target.value)} className="flex-1" />
              <Input size="small" placeholder="Port" value={port.port} onChange={(e) => updatePort(i, 'port', e.target.value)} style={{ width: 70 }} />
              <Input size="small" placeholder="Target Port" value={port.targetPort} onChange={(e) => updatePort(i, 'targetPort', e.target.value)} style={{ width: 90 }} />
              {state.serviceType === 'NodePort' && (
                <Input size="small" placeholder="Node Port" value={port.nodePort} onChange={(e) => updatePort(i, 'nodePort', e.target.value)} style={{ width: 90 }} />
              )}
              <Select size="small" value={port.protocol} onChange={(v) => updatePort(i, 'protocol', v)} style={{ width: 80 }} options={[{ label: 'TCP', value: 'TCP' }, { label: 'UDP', value: 'UDP' }]} />
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => updateField('servicePorts', state.servicePorts.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => updateField('servicePorts', [...state.servicePorts, { name: '', port: '', targetPort: '', nodePort: '', protocol: 'TCP' }])} className="mt-1">Add Port</Button>
      </div>
    </CollapsibleSection>
  )
}
