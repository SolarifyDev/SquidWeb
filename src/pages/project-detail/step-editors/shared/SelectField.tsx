import React from 'react'
import { Select } from 'antd'

interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps {
  label: string
  value: string | string[]
  onChange: (value: string | string[]) => void
  options: SelectOption[]
  mode?: 'multiple' | 'tags'
  placeholder?: string
}

export function SelectField({ label, value, onChange, options, mode, placeholder }: SelectFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        mode={mode}
        placeholder={placeholder}
        size="small"
        className="w-full"
      />
    </div>
  )
}
