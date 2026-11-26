import { get, post } from 'utils/request'

export const SUPPORTED_FIELD_KINDS = ['Text', 'Secret', 'Select', 'Path', 'Toggle'] as const

export type ProviderFieldKind = (typeof SUPPORTED_FIELD_KINDS)[number]

export function isSupportedFieldKind(kind: string): kind is ProviderFieldKind {
  return (SUPPORTED_FIELD_KINDS as readonly string[]).includes(kind)
}

export interface ProviderFieldDescriptor {
  key: string
  label: string
  /** Sent by name. A name this client does not know is kept as is, so the form can say it is unsupported. */
  kind: ProviderFieldKind | (string & {})
  required: boolean
  default?: string | null
  placeholder?: string | null
  helpText?: string | null
  options: string[]
  /** Secret fields only: the non-secret fields the stored value depends on. Changing one makes the stored secret unusable. */
  boundTo?: string[] | null
  /** Marks the field whose value tells where the store keeps packages; shown as the store's location. */
  isLocation?: boolean | null
}

export interface PackageStoreProviderDescriptor {
  kind: string
  displayName: string
  description?: string | null
  fields: ProviderFieldDescriptor[]
}

export interface PackageStoreDto {
  id: number
  name: string
  kind: string
  properties: Record<string, string>
  secretHasValue: Record<string, boolean>
  isDefault: boolean
  lastTestedDate?: string | null
  lastTestSucceeded?: boolean | null
  lastTestMessage?: string | null
  warnings: string[]
}

export interface PackageStoreTestResult {
  success: boolean
  message: string
  /** Things worth knowing even when the test passed, such as a folder that will not survive an upgrade. */
  warnings?: string[] | null
}

// A probe may write to a slow remote store: allow far longer than the default request timeout.
const PROBE_TIMEOUT_MS = 90000

export interface SavePackageStoreCommand {
  name: string
  properties: Record<string, string>
  secrets: Record<string, string>
}

export interface TestPackageStoreSettingsCommand {
  kind: string
  properties: Record<string, string>
  secrets: Record<string, string>
  /** A saved store of the same kind whose stored secrets fill any secret left out. */
  storeId?: number
}

export interface CreatePackageStoreCommand extends SavePackageStoreCommand {
  kind: string
}

export interface UpdatePackageStoreCommand extends SavePackageStoreCommand {
  id: number
}

function normalizeDescriptor(raw: PackageStoreProviderDescriptor): PackageStoreProviderDescriptor {
  return {
    ...raw,
    fields: (raw.fields ?? []).map((field) => ({ ...field, options: field.options ?? [] })),
  }
}

function normalizeStore(raw: PackageStoreDto): PackageStoreDto {
  return { ...raw, properties: raw.properties ?? {}, secretHasValue: raw.secretHasValue ?? {}, warnings: raw.warnings ?? [] }
}

export async function getPackageStores() {
  return (await get<PackageStoreDto[]>('/package-stores/list')).map(normalizeStore)
}

export async function getPackageStoreProviders() {
  return (await get<PackageStoreProviderDescriptor[]>('/package-stores/providers')).map(normalizeDescriptor)
}

export function createPackageStore(command: CreatePackageStoreCommand) {
  return post<PackageStoreDto, CreatePackageStoreCommand>('/package-stores/create', command)
}

export function updatePackageStore(command: UpdatePackageStoreCommand) {
  return post<PackageStoreDto, UpdatePackageStoreCommand>('/package-stores/update', command)
}

export function deletePackageStore(id: number) {
  return post<void, { id: number }>('/package-stores/delete', { id })
}

export function setDefaultPackageStore(id: number) {
  return post<PackageStoreDto, { id: number }>('/package-stores/set-default', { id })
}

export function testPackageStore(id: number) {
  return post<PackageStoreTestResult, { id: number }>('/package-stores/test', { id }, { timeout: PROBE_TIMEOUT_MS })
}

export function testPackageStoreSettings(command: TestPackageStoreSettingsCommand) {
  return post<PackageStoreTestResult, TestPackageStoreSettingsCommand>('/package-stores/test-settings', command, { timeout: PROBE_TIMEOUT_MS })
}
