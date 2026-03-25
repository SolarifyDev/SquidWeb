import React, { useState } from 'react'
import { Input, Select, Modal, Radio, message } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { VolumeSpec } from '../types'

interface VolumesSectionProps {
  volumes: VolumeSpec[]
  onChange: (volumes: VolumeSpec[]) => void
  configMapName: string
}

const VOLUME_TYPES = [
  { label: 'ConfigMap', value: 'ConfigMap' },
  { label: 'Secret', value: 'Secret' },
  { label: 'EmptyDir', value: 'EmptyDir' },
  { label: 'PersistentVolumeClaim', value: 'PVC' },
  { label: 'HostPath', value: 'HostPath' },
]

export function VolumesSection({ volumes, onChange, configMapName }: VolumesSectionProps) {
  const emptyVolume: VolumeSpec = {
    Name: '',
    Type: 'ConfigMap',
    ReferenceName: '',
    ResourceNameMode: 'LinkedResource',
    Items: [],
  }
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<VolumeSpec>(emptyVolume)

  const openAddModal = () => {
    setDraft(emptyVolume)
    setEditingIndex(null)
    setModalOpen(true)
  }

  const openEditModal = (volume: VolumeSpec, index: number) => {
    setDraft({ ...emptyVolume, ...volume, Type: volume.Type || 'ConfigMap' })
    setEditingIndex(index)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingIndex(null)
  }

  const handleSave = () => {
    const name = draft.Name.trim()
    if (!name) {
      message.error('Volume name is required')
      return
    }

    const normalizedItems = (draft.Items ?? [])
      .map((item) => ({ key: item.key.trim(), path: item.path.trim() }))
      .filter((item) => item.key || item.path)

    const normalized: VolumeSpec = {
      ...draft,
      Name: name,
      Type: draft.Type || 'ConfigMap',
      ReferenceName: draft.ReferenceName.trim(),
      ResourceNameMode: draft.Type === 'ConfigMap' ? (draft.ResourceNameMode ?? 'LinkedResource') : undefined,
      Items: normalizedItems,
    }

    if (editingIndex === null) {
      onChange([...volumes, normalized])
    } else {
      onChange(volumes.map((volume, index) => (index === editingIndex ? normalized : volume)))
    }

    closeModal()
  }

  const referenceLabel = draft.Type === 'ConfigMap'
    ? 'Config map resource name'
    : draft.Type === 'Secret'
      ? 'Secret resource name'
      : draft.Type === 'PVC'
        ? 'Persistent volume claim name'
        : draft.Type === 'HostPath'
          ? 'Host path'
          : 'Reference name'

  const referencePlaceholder = draft.Type === 'ConfigMap'
    ? 'my-config-map'
    : draft.Type === 'Secret'
      ? 'my-secret'
      : draft.Type === 'PVC'
        ? 'my-pvc'
        : draft.Type === 'HostPath'
          ? '/data/app'
          : ''

  const referenceHelper = draft.Type === 'ConfigMap'
    ? 'Reference the name of an existing ConfigMap resource.'
    : draft.Type === 'Secret'
      ? 'Reference the name of an existing Secret resource.'
      : draft.Type === 'PVC'
        ? 'Reference the claim name of an existing PersistentVolumeClaim.'
        : draft.Type === 'HostPath'
          ? 'Set the absolute host path to mount into this volume.'
          : ''

  const insertVariable = () => {
    message.info('Insert Variable is not available yet')
  }

  return (
    <CollapsibleSection title="Volumes" subtitle="Add volumes to be exposed to the containers in this step." defaultOpen>
      <p className="text-xs text-slate-400 leading-relaxed mb-0">
        Volumes can reference externally managed storage devices, or can reference config map and secret resources managed by this step through the <strong>ConfigMap</strong> and <strong>Secret</strong> features.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <PlusOutlined style={{ fontSize: 11 }} />
          Add Volume
        </button>
      </div>
      {volumes.length > 0 && (
        <ul className="space-y-2">
          {volumes.map((vol, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => openEditModal(vol, i)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openEditModal(vol, i)
                }
              }}
            >
              <div className="text-sm text-slate-700 space-y-1">
                <p className="mb-0">Name: <strong>{vol.Name || '(not set)'}</strong></p>
                <p className="mb-0">Type: <strong>{vol.Type || '(not set)'}</strong></p>
                {vol.Type === 'EmptyDir' && <p className="mb-0">Reference: —</p>}
                {vol.Type !== 'EmptyDir' && vol.ReferenceName.trim() && (
                  <p className="mb-0">Reference: <strong>{vol.ReferenceName}</strong></p>
                )}
                {vol.Type === 'ConfigMap' && (vol.Items ?? []).length > 0 && (
                  <p className="mb-0">Items: <strong>{(vol.Items ?? []).length}</strong></p>
                )}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange(volumes.filter((_, j) => j !== i))
                }}
                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Remove volume"
              >
                <CloseOutlined style={{ fontSize: 13 }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        title={editingIndex === null ? 'Add Volume' : 'Edit Volume'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editingIndex === null ? 'Add' : 'Save'}
        cancelText="Cancel"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Volume type</label>
            <Select
              value={draft.Type || 'ConfigMap'}
              onChange={(value) => {
                setDraft((previous) => ({
                  ...previous,
                  Type: value,
                  ResourceNameMode: value === 'ConfigMap' ? (previous.ResourceNameMode ?? 'LinkedResource') : undefined,
                  Items: value === 'ConfigMap' ? (previous.Items ?? []) : [],
                }))
              }}
              className="w-full"
              options={VOLUME_TYPES}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <Input
              value={draft.Name}
              onChange={(event) => setDraft((previous) => ({ ...previous, Name: event.target.value }))}
              placeholder="volume-name"
            />
          </div>

          {draft.Type === 'ConfigMap' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Config map resource name</p>
              <p className="text-xs text-slate-500 leading-relaxed mb-2">
                The volume can be linked to the config map resource created by the feature in this step, or linked to an external config map that was created outside the step.
              </p>
              <Radio.Group
                value={draft.ResourceNameMode ?? 'LinkedResource'}
                onChange={(event) => setDraft((previous) => ({ ...previous, ResourceNameMode: event.target.value }))}
                className="flex flex-col gap-2 mb-3"
              >
                <Radio value="LinkedResource">Reference the config map created as part of this step</Radio>
                <Radio value="CustomResource">Reference an external config map resource</Radio>
              </Radio.Group>

              {(draft.ResourceNameMode ?? 'LinkedResource') === 'CustomResource' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{referenceLabel}</label>
                  <Input
                    value={draft.ReferenceName}
                    onChange={(event) => setDraft((previous) => ({ ...previous, ReferenceName: event.target.value }))}
                    placeholder={referencePlaceholder}
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-500 leading-relaxed">
                  {configMapName.trim()
                    ? <>Will reference config map: <strong>{configMapName.trim()}</strong></>
                    : 'ConfigMap feature name is empty. The volume will fall back to the volume name when generating YAML.'}
                </div>
              )}
            </div>
          )}

          {draft.Type === 'ConfigMap' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Items</p>
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setDraft((previous) => ({ ...previous, Items: [...(previous.Items ?? []), { key: '', path: '' }] }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <PlusOutlined style={{ fontSize: 11 }} />
                  Add Item
                </button>
              </div>

              {(draft.Items ?? []).length > 0 && (
                <ul className="space-y-2">
                  {(draft.Items ?? []).map((item, index) => (
                    <li key={index} className="border border-slate-200 rounded px-4 py-3 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Key</label>
                            <div className="flex items-end gap-1">
                              <Input
                                placeholder=""
                                value={item.key}
                                onChange={(event) => {
                                  const next = [...(draft.Items ?? [])]
                                  next[index] = { ...next[index], key: event.target.value }
                                  setDraft((previous) => ({ ...previous, Items: next }))
                                }}
                              />
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                aria-label="Insert Variable"
                                onClick={insertVariable}
                              >
                                <span className="text-[10px] font-semibold">{'{ }'}</span>
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Path</label>
                            <div className="flex items-end gap-1">
                              <Input
                                placeholder=""
                                value={item.path}
                                onChange={(event) => {
                                  const next = [...(draft.Items ?? [])]
                                  next[index] = { ...next[index], path: event.target.value }
                                  setDraft((previous) => ({ ...previous, Items: next }))
                                }}
                              />
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                aria-label="Insert Variable"
                                onClick={insertVariable}
                              >
                                <span className="text-[10px] font-semibold">{'{ }'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = [...(draft.Items ?? [])]
                            next.splice(index, 1)
                            setDraft((previous) => ({ ...previous, Items: next }))
                          }}
                          className="inline-flex items-center justify-center self-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          aria-label="Remove item"
                        >
                          <CloseOutlined style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {draft.Type !== 'EmptyDir' && draft.Type !== 'ConfigMap' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{referenceLabel}</label>
              <Input
                value={draft.ReferenceName}
                onChange={(event) => setDraft((previous) => ({ ...previous, ReferenceName: event.target.value }))}
                placeholder={referencePlaceholder}
              />
              {referenceHelper && <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">{referenceHelper}</p>}
            </div>
          )}
        </div>
      </Modal>
    </CollapsibleSection>
  )
}
