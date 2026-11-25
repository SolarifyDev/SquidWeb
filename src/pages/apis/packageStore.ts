import { get, post } from 'utils/request'

export type ProviderFieldKind = 'Text' | 'Secret' | 'Select' | 'Path' | 'Toggle'

// The server serializes the enum as its number; accept the name too so a converter change cannot break the form.
const FIELD_KINDS_BY_NUMBER: ProviderFieldKind[] = ['Text', 'Secret', 'Select', 'Path', 'Toggle']

export interface ProviderFieldDescriptor {
  key: string
  label: string
  kind: ProviderFieldKind
  required: boolean
  default?: string | null
  placeholder?: string | null
  helpText?: string | null
  options: string[]
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
}

export interface SavePackageStoreCommand {
  name: string
  properties: Record<string, string>
  secrets: Record<string, string>
}

export interface CreatePackageStoreCommand extends SavePackageStoreCommand {
  kind: string
}

export interface UpdatePackageStoreCommand extends SavePackageStoreCommand {
  id: number
}

function normalizeFieldKind(raw: unknown): ProviderFieldKind {
  if (typeof raw === 'number') return FIELD_KINDS_BY_NUMBER[raw] ?? 'Text'
  return FIELD_KINDS_BY_NUMBER.find((kind) => kind === raw) ?? 'Text'
}

function normalizeDescriptor(raw: PackageStoreProviderDescriptor): PackageStoreProviderDescriptor {
  return {
    ...raw,
    fields: (raw.fields ?? []).map((field) => ({ ...field, kind: normalizeFieldKind(field.kind), options: field.options ?? [] })),
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
  return post<PackageStoreTestResult, { id: number }>('/package-stores/test', { id })
}
