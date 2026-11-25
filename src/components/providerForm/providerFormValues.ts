import { isSupportedFieldKind, type ProviderFieldDescriptor } from 'pages/apis/packageStore'

/** What the user has entered. `secrets` holds only values typed in this session: a stored secret is never loaded. */
export interface ProviderFormValue {
  properties: Record<string, string>
  secrets: Record<string, string>
}

export type ProviderFormErrors = Record<string, string>

/** Descriptor defaults first, then the stored values on top: a field missing from an older stored record still gets its default. */
export function buildInitialValue(fields: ProviderFieldDescriptor[], existing?: Record<string, string>): ProviderFormValue {
  const properties: Record<string, string> = {}
  for (const field of fields) {
    if (field.kind !== 'Secret' && field.default) properties[field.key] = field.default
  }
  return { properties: { ...properties, ...existing }, secrets: {} }
}

/**
 * Whether a stored secret can still be reused: not when a non-secret field it is bound to was changed from `baseline`
 * (the value the form started with), because the stored secret belongs to the old value.
 */
export function effectiveSecretHasValue(fields: ProviderFieldDescriptor[], secretHasValue: Record<string, boolean>, baseline: Record<string, string>, value: ProviderFormValue): Record<string, boolean> {
  const effective = { ...secretHasValue }
  for (const field of fields) {
    const changed = field.boundTo?.some((key) => (value.properties[key] ?? '') !== (baseline[key] ?? ''))
    if (field.kind === 'Secret' && changed) effective[field.key] = false
  }
  return effective
}

function validateSupported(field: ProviderFieldDescriptor, value: ProviderFormValue, secretHasValue: Record<string, boolean>) {
  if (!field.required || field.kind === 'Toggle') return null
  const filled = field.kind === 'Secret' ? Boolean(value.secrets[field.key]) || Boolean(secretHasValue[field.key]) : Boolean(value.properties[field.key]?.trim())
  return filled ? null : `${field.label} is required`
}

function validateUnsupported(field: ProviderFieldDescriptor, value: ProviderFormValue) {
  if (!field.required || value.properties[field.key]) return null
  return `${field.label} is required but its type "${field.kind}" is not supported by this version, so the store cannot be saved here`
}

export function validateProviderForm(fields: ProviderFieldDescriptor[], value: ProviderFormValue, secretHasValue: Record<string, boolean> = {}): ProviderFormErrors {
  const errors: ProviderFormErrors = {}
  for (const field of fields) {
    const problem = isSupportedFieldKind(field.kind) ? validateSupported(field, value, secretHasValue) : validateUnsupported(field, value)
    if (problem) errors[field.key] = problem
  }
  return errors
}

/**
 * The payload to send: empty secrets are left out so the server keeps the stored ones; toggles always send an explicit value;
 * a value of a field this client cannot edit goes back exactly as it was stored, because an update replaces all stored properties.
 */
export function buildSubmission(fields: ProviderFieldDescriptor[], value: ProviderFormValue): ProviderFormValue {
  const properties: Record<string, string> = {}
  const secrets: Record<string, string> = {}

  for (const field of fields) {
    const entered = value.properties[field.key]
    if (!isSupportedFieldKind(field.kind)) {
      if (entered !== undefined) properties[field.key] = entered
    } else if (field.kind === 'Secret') {
      const typed = value.secrets[field.key]
      if (typed) secrets[field.key] = typed
    } else if (field.kind === 'Toggle') properties[field.key] = entered === 'true' ? 'true' : 'false'
    else if (entered) properties[field.key] = entered
  }
  return { properties, secrets }
}
