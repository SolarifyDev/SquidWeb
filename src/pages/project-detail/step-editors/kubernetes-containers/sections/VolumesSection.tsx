import React from 'react'
import { Input, Select, Button } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { VolumeSpec } from '../types'

interface VolumesSectionProps {
  volumes: VolumeSpec[]
  onChange: (volumes: VolumeSpec[]) => void
}

const VOLUME_TYPES = [
  { label: 'ConfigMap', value: 'ConfigMap' },
  { label: 'Secret', value: 'Secret' },
  { label: 'EmptyDir', value: 'EmptyDir' },
  { label: 'PersistentVolumeClaim', value: 'PVC' },
  { label: 'HostPath', value: 'HostPath' },
]

export function VolumesSection({ volumes, onChange }: VolumesSectionProps) {
  const updateVolume = (index: number, field: keyof VolumeSpec, value: string) => {
    onChange(volumes.map((v, i) => (i === index ? { ...v, [field]: value } : v)))
  }

  return (
    <CollapsibleSection title="Volumes" subtitle="Add volumes to be exposed to the containers in this step." defaultOpen>
      <p className="text-xs text-slate-400 leading-relaxed mb-0">
        Volumes can reference externally managed storage devices, or can reference config map and secret resources managed by this step through the <strong>ConfigMap</strong> and <strong>Secret</strong> features.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...volumes, { Name: '', Type: '', ReferenceName: '' }])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <PlusOutlined style={{ fontSize: 11 }} />
          Add Volume
        </button>
      </div>
      {volumes.length > 0 && (
        <div className="space-y-2">
          {volumes.map((vol, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="small" placeholder="Name" value={vol.Name} onChange={(e) => updateVolume(i, 'Name', e.target.value)} className="flex-1" />
              <Select size="small" value={vol.Type || undefined} onChange={(v) => updateVolume(i, 'Type', v)} placeholder="Type" style={{ width: 140 }} options={VOLUME_TYPES} />
              <Input size="small" placeholder="Reference" value={vol.ReferenceName} onChange={(e) => updateVolume(i, 'ReferenceName', e.target.value)} className="flex-1" />
              <button
                type="button"
                onClick={() => onChange(volumes.filter((_, j) => j !== i))}
                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <CloseOutlined style={{ fontSize: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
