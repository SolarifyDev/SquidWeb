import axios, { type AxiosError } from 'axios'
import { resolveApiBaseUrl } from 'utils/apiBase'

// The setup endpoints exist only while the server runs in "setup mode" (no database configured yet).
// They answer plain JSON (no { code, msg, data } envelope) and are called without the auth'd axios
// instance: there is no user yet, only the one-time setup token printed in the server logs.

export const SETUP_TOKEN_HEADER = 'X-Setup-Token'

// Connection tests and install may legitimately take a while server-side (DNS, TCP and TLS timeouts,
// database creation): wait long enough for the server's own explanation to arrive.
export const LONG_REQUEST_TIMEOUT_MS = 45000
export const STATUS_TIMEOUT_MS = 3000
export const PROGRESS_TIMEOUT_MS = 5000

export type SetupMode = 'Builtin' | 'External'

export interface SetupStatus {
  required: boolean
  builtinDatabaseAvailable?: boolean
  builtinRedisAvailable?: boolean
  suggestedExternalUrl?: string
  defaultPollingPort?: number
  /** Set when /data is an anonymous Docker volume that a container re-create (upgrade) would lose. */
  dataVolumeWarning?: string | null
}

export interface DatabaseTestRequest {
  mode: SetupMode
  connectionString: string
}

export interface DatabaseTestResult {
  success: boolean
  serverVersion: string | null
  databaseExists: boolean
  canCreateDatabase: boolean
  message: string
}

export interface RedisTestRequest {
  connectionString: string
}

export interface RedisTestResult {
  success: boolean
  message: string
}

export interface InstallRequest {
  database: { mode: SetupMode; connectionString: string; createIfMissing: boolean }
  redis: { mode: SetupMode; connectionString: string }
  admin: { userName: string; password: string }
  server: { externalUrl: string; commsUrl: string }
}

export interface InstallValidationError {
  message: string
  errors?: Record<string, string>
}

export type SetupProgressState = 'Idle' | 'Running' | 'Completed' | 'Failed'
export type SetupStepStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Skipped'

export interface SetupProgressStep {
  key: string
  title: string
  status: SetupStepStatus
  message: string | null
}

export interface SetupProgress {
  state: SetupProgressState
  steps: SetupProgressStep[]
  error: string | null
}

function setupUrl(path: string) {
  return `${resolveApiBaseUrl()}/setup${path}`
}

function tokenHeaders(token: string) {
  return { [SETUP_TOKEN_HEADER]: token }
}

/** HTTP status of a failed setup call, or undefined for network errors / timeouts. */
export function httpStatusOf(error: unknown): number | undefined {
  return (error as AxiosError | undefined)?.response?.status
}

export type SetupFailureKind = 'unauthorized' | 'notFound' | 'transient' | 'other'

/** Network errors, timeouts and 5xx are transient (e.g. the server swapping modes); 4xx are answers. */
export function classifyFailure(error: unknown): SetupFailureKind {
  const status = httpStatusOf(error)
  if (status === undefined || status >= 500) return 'transient'
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'notFound'

  return 'other'
}

export function responseBodyOf<T>(error: unknown): T | undefined {
  return (error as AxiosError<T> | undefined)?.response?.data
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await axios.get<SetupStatus>(setupUrl('/status'), { timeout: STATUS_TIMEOUT_MS })
  return res.data
}

export async function testDatabase(token: string, request: DatabaseTestRequest): Promise<DatabaseTestResult> {
  const res = await axios.post<DatabaseTestResult>(setupUrl('/database/test'), request, { headers: tokenHeaders(token), timeout: LONG_REQUEST_TIMEOUT_MS })
  return res.data
}

export async function testRedis(token: string, request: RedisTestRequest): Promise<RedisTestResult> {
  const res = await axios.post<RedisTestResult>(setupUrl('/redis/test'), request, { headers: tokenHeaders(token), timeout: LONG_REQUEST_TIMEOUT_MS })
  return res.data
}

export async function startInstall(token: string, request: InstallRequest): Promise<void> {
  await axios.post(setupUrl('/install'), request, { headers: tokenHeaders(token), timeout: LONG_REQUEST_TIMEOUT_MS })
}

export async function getSetupProgress(token: string): Promise<SetupProgress> {
  const res = await axios.get<SetupProgress>(setupUrl('/progress'), { headers: tokenHeaders(token), timeout: PROGRESS_TIMEOUT_MS })
  return res.data
}
