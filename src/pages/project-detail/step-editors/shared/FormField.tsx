import React from 'react'
import { Input } from 'antd'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helpText?: string
  type?: 'text' | 'number'
}

export function FormField({ label, value, onChange, placeholder, helpText, type = 'text' }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        size="small"
      />
      {helpText && <p className="text-xs text-slate-400 mt-1 mb-0">{helpText}</p>}
    </div>
  )
}
