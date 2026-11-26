import type { PackageStoreProviderDescriptor } from 'pages/apis/packageStore'
import { buildInitialValue, buildSubmission, type ProviderFormValue } from 'components/providerForm/providerFormValues'
import type { PackageStorageChoice } from './api'

/** The store the server's schema is seeded with: local disk, every setting empty (= the data directory's default folder). */
export const DEFAULT_PACKAGE_STORE_KIND = 'FileSystem'

export interface PackageStorageSelection {
  kind: string
  value: ProviderFormValue
}

/** Before the providers have loaded there is no descriptor to build from, so nothing is filled in. */
export const DEFAULT_PACKAGE_STORAGE: PackageStorageSelection = { kind: DEFAULT_PACKAGE_STORE_KIND, value: { properties: {}, secrets: {} } }

export function descriptorOf(providers: PackageStoreProviderDescriptor[] | null, kind: string) {
  return providers?.find((provider) => provider.kind === kind)
}

export function selectionFor(descriptor: PackageStoreProviderDescriptor): PackageStorageSelection {
  return { kind: descriptor.kind, value: buildInitialValue(descriptor.fields) }
}

/** The selection the wizard starts with: the default kind built from its descriptor (field defaults, toggles), like choosing it by hand. */
export function initialSelection(providers: PackageStoreProviderDescriptor[]): PackageStorageSelection {
  const descriptor = descriptorOf(providers, DEFAULT_PACKAGE_STORE_KIND)

  return descriptor ? selectionFor(descriptor) : DEFAULT_PACKAGE_STORAGE
}

/** What would be sent: only values the user actually entered, so a field left empty is the same as one never touched. */
export function submissionOf(providers: PackageStoreProviderDescriptor[] | null, selection: PackageStorageSelection): PackageStorageChoice {
  const descriptor = descriptorOf(providers, selection.kind)
  const submission = descriptor ? buildSubmission(descriptor.fields, selection.value) : selection.value

  return { kind: selection.kind, properties: nonEmpty(submission.properties), secrets: nonEmpty(submission.secrets) }
}

function nonEmpty(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ''))
}

const sameValues = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a)

  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/** The default kind with exactly what an untouched form for it would send (descriptor defaults and toggles included), not a hard-coded empty set. */
export function isDefaultPackageStorage(choice: PackageStorageChoice, providers: PackageStoreProviderDescriptor[] | null = null) {
  if (choice.kind !== DEFAULT_PACKAGE_STORE_KIND) return false

  const descriptor = descriptorOf(providers, DEFAULT_PACKAGE_STORE_KIND)
  const baseline = descriptor ? submissionOf(providers, selectionFor(descriptor)) : { kind: choice.kind, properties: {}, secrets: {} }

  return sameValues(choice.properties, baseline.properties) && sameValues(choice.secrets, baseline.secrets)
}

/** The install request section: absent while the default is kept, so the request is identical to one from before this step existed. */
export function buildPackageStorageSection(providers: PackageStoreProviderDescriptor[] | null, selection: PackageStorageSelection): PackageStorageChoice | undefined {
  const choice = submissionOf(providers, selection)

  return isDefaultPackageStorage(choice, providers) ? undefined : choice
}

export interface PackageStorageSummary {
  title: string
  /** "Label: value" lines; secrets show only that they are set. */
  details: string[]
}

/** For the review step. A kept default says so; entered secrets are never shown, only that they are set. */
export function summarizePackageStorage(providers: PackageStoreProviderDescriptor[] | null, selection: PackageStorageSelection): PackageStorageSummary {
  const descriptor = descriptorOf(providers, selection.kind)
  const choice = submissionOf(providers, selection)
  const labelOf = (key: string) => descriptor?.fields.find((field) => field.key === key)?.label ?? key
  const title = descriptor?.displayName ?? selection.kind

  if (isDefaultPackageStorage(choice, providers)) return { title, details: ['Default settings (the data directory of this server)'] }

  return {
    title,
    details: [
      ...Object.entries(choice.properties).map(([key, value]) => `${labelOf(key)}: ${value}`),
      ...Object.keys(choice.secrets).map((key) => `${labelOf(key)}: set`),
    ],
  }
}
