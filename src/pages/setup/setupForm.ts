import type { DatabaseTestResult, InstallRequest, PackageStorageChoice, RedisTestResult, SetupMode } from './api'
import type { SslMode } from './connectionString'

export interface SetupFormValues {
  dbMode: SetupMode
  dbConnectionString?: string
  dbCreateIfMissing: boolean
  pgHost?: string
  pgPort?: number
  pgDatabase?: string
  pgUsername?: string
  pgPassword?: string
  pgSslMode?: SslMode
  redisMode: SetupMode
  redisConnectionString?: string
  adminUserName: string
  adminPassword: string
  adminConfirmPassword: string
  externalUrl: string
  commsUrl?: string
}

export type SetupFieldName = keyof SetupFormValues

export const STEP_FIELDS: SetupFieldName[][] = [
  ['dbMode', 'dbConnectionString', 'redisMode', 'redisConnectionString'],
  ['adminUserName', 'adminPassword', 'adminConfirmPassword'],
  ['externalUrl', 'commsUrl'],
  [],
  [],
]

/** Index of the package storage step, which keeps its state outside the form (its fields come from provider descriptors). */
export const PACKAGE_STORAGE_STEP = 3

/** Install 400 error keys of the package storage section ("packageStorage", "packageStorage.kind") belong to that step. */
export function isPackageStorageError(key: string) {
  return key.toLowerCase().startsWith('packagestorage')
}

// Install 400 error keys (case-insensitive, as ASP.NET may PascalCase them) → form field.
const SERVER_ERROR_FIELDS: Record<string, SetupFieldName> = {
  'database.mode': 'dbMode',
  'database.connectionstring': 'dbConnectionString',
  'database.createifmissing': 'dbConnectionString',
  'redis.mode': 'redisMode',
  'redis.connectionstring': 'redisConnectionString',
  'admin.username': 'adminUserName',
  'admin.password': 'adminPassword',
  'server.externalurl': 'externalUrl',
  'server.commsurl': 'commsUrl',
}

const FIELD_LABELS: Record<SetupFieldName, string> = {
  dbMode: 'Database', dbConnectionString: 'Database connection string', dbCreateIfMissing: 'Create database',
  pgHost: 'Host', pgPort: 'Port', pgDatabase: 'Database', pgUsername: 'Username', pgPassword: 'Password', pgSslMode: 'SSL mode',
  redisMode: 'Redis', redisConnectionString: 'Redis connection string',
  adminUserName: 'Username', adminPassword: 'Password', adminConfirmPassword: 'Confirm password',
  externalUrl: 'External URL', commsUrl: 'Polling URL',
}

export function fieldLabel(field: SetupFieldName) {
  return FIELD_LABELS[field]
}

/** Connection-string fields only render while their External mode is selected; every other field is always mounted. */
export function isFieldRendered(field: SetupFieldName, values: Pick<SetupFormValues, 'dbMode' | 'redisMode'>) {
  if (field === 'dbConnectionString') return values.dbMode === 'External'
  if (field === 'redisConnectionString') return values.redisMode === 'External'

  return true
}

export interface MappedServerError {
  field: SetupFieldName
  message: string
  step: number
}

export interface MappedServerErrors {
  fieldErrors: MappedServerError[]
  unmatched: string[]
}

export function stepOfField(field: SetupFieldName) {
  return STEP_FIELDS.findIndex((fields) => fields.includes(field))
}

export function mapServerErrors(errors: Record<string, string> | undefined): MappedServerErrors {
  const result: MappedServerErrors = { fieldErrors: [], unmatched: [] }

  for (const [key, message] of Object.entries(errors ?? {})) {
    const field = SERVER_ERROR_FIELDS[key.toLowerCase()]
    if (field) result.fieldErrors.push({ field, message, step: stepOfField(field) })
    else result.unmatched.push(`${key}: ${message}`)
  }

  return result
}

export function buildInstallRequest(values: SetupFormValues, packageStorage?: PackageStorageChoice): InstallRequest {
  const external = (mode: SetupMode, value?: string) => (mode === 'External' ? (value ?? '').trim() : '')

  return {
    database: { mode: values.dbMode, connectionString: external(values.dbMode, values.dbConnectionString), createIfMissing: values.dbCreateIfMissing },
    redis: { mode: values.redisMode, connectionString: external(values.redisMode, values.redisConnectionString) },
    admin: { userName: values.adminUserName.trim(), password: values.adminPassword },
    server: { externalUrl: values.externalUrl.trim(), commsUrl: (values.commsUrl ?? '').trim() },
    ...(packageStorage ? { packageStorage } : {}),
  }
}

export interface DatabaseTestSnapshot {
  mode: SetupMode
  connectionString: string
  result: DatabaseTestResult
}

/** The database is usable when the connection works and the database exists or will be created. */
export function isDatabaseReady(result: DatabaseTestResult, createIfMissing: boolean) {
  return result.success && (result.databaseExists || (result.canCreateDatabase && createIfMissing))
}

/** External databases may only advance on a successful test of exactly the current connection string. */
export function canLeaveDatabaseStep(mode: SetupMode, connectionString: string | undefined, createIfMissing: boolean, test: DatabaseTestSnapshot | null) {
  if (mode === 'Builtin') return true
  if (!test || test.mode !== 'External') return false
  if (test.connectionString !== (connectionString ?? '').trim()) return false

  return isDatabaseReady(test.result, createIfMissing)
}

export interface RedisTestSnapshot {
  connectionString: string
  result: RedisTestResult
}

/** External Redis, like an external database, may only advance on a successful test of exactly the current string. */
export function canLeaveRedisSettings(mode: SetupMode, connectionString: string | undefined, test: RedisTestSnapshot | null) {
  if (mode === 'Builtin') return true
  if (!test || test.connectionString !== (connectionString ?? '').trim()) return false

  return test.result.success
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
  } catch {
    return false
  }
}
