import type { PushBuiltInPackageData } from 'pages/apis/builtInPackages'
import { ApiError } from 'utils/request'

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

export function shortSha(sha: string | null | undefined) {
  return sha ? sha.slice(0, 8) : '—'
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const ARCHIVE_EXTENSION = /\.(zip|tar\.gz|tgz)$/i

export function isSupportedArchiveName(name: string) {
  return ARCHIVE_EXTENSION.test(name)
}

/** A package id to prefill from a file or folder name: the extension and a trailing `.1.2.3` version are dropped. */
export function suggestPackageId(name: string) {
  const withoutExtension = name.replace(ARCHIVE_EXTENSION, '')
  const versioned = withoutExtension.match(/^(.+?)[.-]v?\d+\.\d+.*$/)

  return (versioned ? versioned[1] : withoutExtension).trim()
}

export interface UploadOutcome {
  tone: 'success' | 'info'
  title: string
  detail: string
}

export function describePushResult(data: PushBuiltInPackageData): UploadOutcome {
  const { packageId, version } = data.package

  if (data.deduplicated)
    return { tone: 'info', title: `Unchanged — same content as version ${version}`, detail: `Nothing was stored for ${packageId}: the latest version already holds these exact bytes, so no version number was used.` }

  if (data.replaced) return { tone: 'success', title: `Replaced version ${version}`, detail: `${packageId} ${version} was overwritten with the new content.` }

  return { tone: 'success', title: `Published version ${version}`, detail: `${packageId} ${version} is now in the Squid packages feed.` }
}

export interface UploadFailure {
  title: string
  detail: string
}

const FAILURE_TITLES: Record<number, string> = {
  400: 'Package rejected',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Version conflict',
  413: 'Package too large',
}

/**
 * The status a failure stands for. The Squid backend answers business errors with HTTP 200 and the real status in the
 * envelope `code`, which the request helper raises as an ApiError, so that comes first; a transport-level HTTP status
 * (for example a proxy's 413) is the fallback.
 */
export function failureStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.code

  return (error as { response?: { status?: number } } | null)?.response?.status
}

/** Turns a failed push into a title (by status) and the server's own message, which says exactly what to fix. */
export function describePushFailure(error: unknown): UploadFailure {
  const failure = error as { response?: { status?: number; data?: { msg?: string | null } }; message?: string } | null
  const serverMessage = failure?.response?.data?.msg
  const status = failureStatus(error)

  return {
    title: (status != null && FAILURE_TITLES[status]) || 'Upload failed',
    detail: serverMessage || failure?.message || 'The upload did not complete.',
  }
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const failure = error as { response?: { data?: { msg?: string | null } }; message?: string } | null

  return failure?.response?.data?.msg || failure?.message || fallback
}

export const VERSION_PRESETS = [
  { key: 'counter', label: 'Auto-increment', template: '1.0.{counter}', hint: 'Next number each upload: 1.0.1, 1.0.2, ...' },
  { key: 'date', label: 'Date + daily counter', template: '{date:yyyy.MM.dd}.{counter:daily}', hint: 'Today\'s date, with a counter that restarts each day' },
  { key: 'source', label: 'From project file', template: '{source.version}', hint: 'Read from the package.json or project file inside the package' },
  { key: 'input', label: 'Typed each time', template: '{input}', hint: 'You enter the version on every upload' },
] as const
