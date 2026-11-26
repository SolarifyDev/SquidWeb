import type { PackageStoreProviderDescriptor } from 'pages/apis/packageStore'
import { buildInitialValue, buildSubmission, type ProviderFormValue } from 'components/providerForm/providerFormValues'
import type { PackageStorageChoice } from './api'

/** The store the server's schema is seeded with: local disk, every setting empty (= the data directory's default folder). */
export const DEFAULT_PACKAGE_STORE_KIND = 'FileSystem'

export interface PackageStorageSelection {
  kind: string
  value: ProviderFormValue
}

export const DEFAULT_PACKAGE_STORAGE: PackageStorageSelection = { kind: DEFAULT_PACKAGE_STORE_KIND, value: { properties: {}, secrets: {} } }

export function descriptorOf(providers: PackageStoreProviderDescriptor[] | null, kind: string) {
  return providers?.find((provider) => provider.kind === kind)
}

export function selectionFor(descriptor: PackageStoreProviderDescriptor): PackageStorageSelection {
  return { kind: descriptor.kind, value: buildInitialValue(descriptor.fields) }
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

export function isDefaultPackageStorage(choice: PackageStorageChoice) {
  return choice.kind === DEFAULT_PACKAGE_STORE_KIND && Object.keys(choice.properties).length === 0 && Object.keys(choice.secrets).length === 0
}

/** The install request section: absent while the default is kept, so the request is identical to one from before this step existed. */
export function buildPackageStorageSection(providers: PackageStoreProviderDescriptor[] | null, selection: PackageStorageSelection): PackageStorageChoice | undefined {
  const choice = submissionOf(providers, selection)

  return isDefaultPackageStorage(choice) ? undefined : choice
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

  if (isDefaultPackageStorage(choice)) return { title, details: ['Default settings (the data directory of this server)'] }

  return {
    title,
    details: [
      ...Object.entries(choice.properties).map(([key, value]) => `${labelOf(key)}: ${value}`),
      ...Object.keys(choice.secrets).map((key) => `${labelOf(key)}: set`),
    ],
  }
}
