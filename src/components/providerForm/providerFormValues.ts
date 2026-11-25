import type { ProviderFieldDescriptor } from 'pages/apis/packageStore'

/** What the user has entered. `secrets` holds only values typed in this session: a stored secret is never loaded. */
export interface ProviderFormValue {
  properties: Record<string, string>
  secrets: Record<string, string>
}

export type ProviderFormErrors = Record<string, string>

export function buildInitialValue(fields: ProviderFieldDescriptor[], existing?: Record<string, string>): ProviderFormValue {
  if (existing) return { properties: { ...existing }, secrets: {} }

  const properties: Record<string, string> = {}
  for (const field of fields) {
    if (field.kind !== 'Secret' && field.default) properties[field.key] = field.default
  }
  return { properties, secrets: {} }
}

function hasValue(field: ProviderFieldDescriptor, value: ProviderFormValue, secretHasValue: Record<string, boolean>) {
  if (field.kind === 'Secret') return Boolean(value.secrets[field.key]) || Boolean(secretHasValue[field.key])
  return Boolean(value.properties[field.key]?.trim())
}

export function validateProviderForm(fields: ProviderFieldDescriptor[], value: ProviderFormValue, secretHasValue: Record<string, boolean> = {}): ProviderFormErrors {
  const errors: ProviderFormErrors = {}
  for (const field of fields) {
    if (field.required && !hasValue(field, value, secretHasValue)) errors[field.key] = `${field.label} is required`
  }
  return errors
}

/** The payload to send: empty secrets are left out so the server keeps the stored ones; toggles always send an explicit value. */
export function buildSubmission(fields: ProviderFieldDescriptor[], value: ProviderFormValue): ProviderFormValue {
  const properties: Record<string, string> = {}
  const secrets: Record<string, string> = {}

  for (const field of fields) {
    if (field.kind === 'Secret') {
      const typed = value.secrets[field.key]
      if (typed) secrets[field.key] = typed
      continue
    }
    const entered = value.properties[field.key]
    if (field.kind === 'Toggle') properties[field.key] = entered === 'true' ? 'true' : 'false'
    else if (entered) properties[field.key] = entered
  }
  return { properties, secrets }
}
