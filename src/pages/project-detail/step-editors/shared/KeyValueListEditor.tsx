import React from 'react'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'

export interface KeyValueItem {
  key: string
  value: string
}

interface KeyValueListEditorProps {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyLabel?: string
  valueLabel?: string
  addLabel?: string
}

function UnderlineInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[11px] text-slate-400 mb-0.5 leading-none">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-slate-300 focus:border-blue-500 focus:outline-none text-sm text-slate-800 py-0.5 px-0 placeholder-slate-300 transition-colors"
      />
    </div>
  )
}

export function KeyValueListEditor({
  items,
  onChange,
  keyLabel = 'Name',
  valueLabel = 'Value',
  addLabel = 'Add',
}: KeyValueListEditorProps) {
  const updateItem = (index: number, field: 'key' | 'value', val: string) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const addItem = () => {
    onChange([...items, { key: '', value: '' }])
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <PlusOutlined style={{ fontSize: 11 }} />
          {addLabel}
        </button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-end gap-2">
              <UnderlineInput label={keyLabel} value={item.key} onChange={(v) => updateItem(i, 'key', v)} />
              <div className="flex-shrink-0 self-center text-slate-300 pb-1 text-base leading-none">|</div>
              <UnderlineInput label={valueLabel} value={item.value} onChange={(v) => updateItem(i, 'value', v)} />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex-shrink-0 self-center p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Remove"
              >
                <CloseOutlined style={{ fontSize: 14 }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
