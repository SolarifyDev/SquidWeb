import { useId, type ReactNode } from 'react'
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

interface FieldIds {
  input: string
  label: string
  help: string
  error: string
}

function describedBy(field: ProviderFieldDescriptor, ids: FieldIds, error?: string) {
  const parts = [field.helpText ? ids.help : null, error ? ids.error : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

function FieldMessages({ field, ids, error }: { field: ProviderFieldDescriptor; ids: FieldIds; error?: string }) {
  return (
    <>
      {field.helpText ? <div id={ids.help} className="mt-1 text-xs text-slate-500">{field.helpText}</div> : null}
      {error ? <div id={ids.error} role="alert" className="mt-1 text-xs text-red-600">{error}</div> : null}
    </>
  )
}

export default function ProviderForm({ fields, value, onChange, secretHasValue = {}, errors = {}, disabled }: ProviderFormProps) {
  const prefix = useId()
  const setProperty = (key: string, next: string) => onChange({ ...value, properties: { ...value.properties, [key]: next } })
  const setSecret = (key: string, next: string) => onChange({ ...value, secrets: { ...value.secrets, [key]: next } })

  const idsOf = (field: ProviderFieldDescriptor): FieldIds => ({
    input: `${prefix}-${field.key}`,
    label: `${prefix}-${field.key}-label`,
    help: `${prefix}-${field.key}-help`,
    error: `${prefix}-${field.key}-error`,
  })

  const renderControl = (field: ProviderFieldDescriptor, ids: FieldIds, error?: string) => {
    const status = error ? 'error' : undefined
    const aria = { 'aria-describedby': describedBy(field, ids, error), 'aria-invalid': error ? true : undefined }

    if (field.kind === 'Secret') {
      const placeholder = secretHasValue[field.key] ? UNCHANGED_SECRET_PLACEHOLDER : field.placeholder ?? undefined
      return <Input.Password id={ids.input} {...aria} value={value.secrets[field.key] ?? ''} placeholder={placeholder} status={status} disabled={disabled} autoComplete="new-password" onChange={(event) => setSecret(field.key, event.target.value)} />
    }
    if (field.kind === 'Select') {
      return (
        <Select
          id={ids.input}
          {...aria}
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
      return <Switch id={ids.input} {...aria} checked={value.properties[field.key] === 'true'} disabled={disabled} onChange={(checked) => setProperty(field.key, checked ? 'true' : 'false')} />
    }
    return <Input id={ids.input} {...aria} className={field.kind === 'Path' ? 'font-mono' : undefined} value={value.properties[field.key] ?? ''} placeholder={field.placeholder ?? undefined} status={status} disabled={disabled} onChange={(event) => setProperty(field.key, event.target.value)} />
  }

  const renderSupported = (field: ProviderFieldDescriptor, ids: FieldIds, error?: string): ReactNode => (
    <>
      <label htmlFor={ids.input} className="mb-1 block text-sm font-medium text-slate-700">
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {renderControl(field, ids, error)}
    </>
  )

  const renderUnsupported = (field: ProviderFieldDescriptor, ids: FieldIds): ReactNode => (
    <div role="group" aria-labelledby={ids.label}>
      <div id={ids.label} className="mb-1 text-sm font-medium text-slate-700">{field.label}</div>
      <div role="note" className="text-xs text-amber-700">Unsupported field type "{field.kind}": this version cannot edit it.</div>
    </div>
  )

  return (
    <div>
      {fields.map((field) => {
        const ids = idsOf(field)
        const error = errors[field.key]
        return (
          <div key={field.key} className="mb-4">
            {isSupportedFieldKind(field.kind) ? renderSupported(field, ids, error) : renderUnsupported(field, ids)}
            <FieldMessages field={field} ids={ids} error={error} />
          </div>
        )
      })}
    </div>
  )
}
