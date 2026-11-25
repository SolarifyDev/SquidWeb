import type { ReactNode } from 'react'
import { Input, Select, Switch } from 'antd'
import { isSupportedFieldKind, type ProviderFieldDescriptor } from 'pages/apis/packageStore'
import type { ProviderFormErrors, ProviderFormValue } from './providerFormValues'

interface ProviderFormProps {
  fields: ProviderFieldDescriptor[]
  value: ProviderFormValue
  onChange: (value: ProviderFormValue) => void
  /** Whether a value is already stored for each secret field; such a field shows "unchanged" and sends nothing until typed into. */
  secretHasValue?: Record<string, boolean>
  errors?: ProviderFormErrors
  disabled?: boolean
}

export const UNCHANGED_SECRET_PLACEHOLDER = 'Unchanged (leave empty to keep the stored value)'

function FieldRow({ field, error, children }: { field: ProviderFieldDescriptor; error?: string; children: ReactNode }) {
  const inputId = `provider-field-${field.key}`
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {field.helpText ? <div className="mt-1 text-xs text-slate-500">{field.helpText}</div> : null}
      {error ? <div role="alert" className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  )
}

export default function ProviderForm({ fields, value, onChange, secretHasValue = {}, errors = {}, disabled }: ProviderFormProps) {
  const setProperty = (key: string, next: string) => onChange({ ...value, properties: { ...value.properties, [key]: next } })
  const setSecret = (key: string, next: string) => onChange({ ...value, secrets: { ...value.secrets, [key]: next } })

  const renderControl = (field: ProviderFieldDescriptor) => {
    const id = `provider-field-${field.key}`
    const status = errors[field.key] ? 'error' : undefined

    if (field.kind === 'Secret') {
      const placeholder = secretHasValue[field.key] ? UNCHANGED_SECRET_PLACEHOLDER : field.placeholder ?? undefined
      return (
        <Input.Password id={id} value={value.secrets[field.key] ?? ''} placeholder={placeholder} status={status} disabled={disabled} autoComplete="new-password" onChange={(event) => setSecret(field.key, event.target.value)} />
      )
    }
    if (field.kind === 'Select') {
      return (
        <Select
          id={id}
          className="w-full"
          value={value.properties[field.key] || undefined}
          placeholder={field.placeholder ?? undefined}
          status={status}
          disabled={disabled}
          allowClear={!field.required}
          options={field.options.map((option) => ({ value: option, label: option }))}
          onChange={(next) => setProperty(field.key, next ?? '')}
        />
      )
    }
    if (field.kind === 'Toggle') {
      return <Switch id={id} checked={value.properties[field.key] === 'true'} disabled={disabled} onChange={(checked) => setProperty(field.key, checked ? 'true' : 'false')} />
    }
    return (
      <Input id={id} className={field.kind === 'Path' ? 'font-mono' : undefined} value={value.properties[field.key] ?? ''} placeholder={field.placeholder ?? undefined} status={status} disabled={disabled} onChange={(event) => setProperty(field.key, event.target.value)} />
    )
  }

  const renderUnsupported = (field: ProviderFieldDescriptor) => (
    <div className="mb-4">
      <div className="mb-1 text-sm font-medium text-slate-700">{field.label}</div>
      <div role="note" className="text-xs text-amber-700">Unsupported field type "{field.kind}": this version cannot edit it.</div>
    </div>
  )

  return (
    <div>
      {fields.map((field) => !isSupportedFieldKind(field.kind) ? <div key={field.key}>{renderUnsupported(field)}</div> : (
        <FieldRow key={field.key} field={field} error={errors[field.key]}>
          {renderControl(field)}
        </FieldRow>
      ))}
    </div>
  )
}
