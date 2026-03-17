import React from 'react'
import { Radio } from 'antd'

interface RadioOption {
  label: string
  value: string
}

interface RadioFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: RadioOption[]
}

export function RadioField({ label, value, onChange, options }: RadioFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Radio.Group value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <Radio key={opt.value} value={opt.value}>
            <span className="text-sm">{opt.label}</span>
          </Radio>
        ))}
      </Radio.Group>
    </div>
  )
}
