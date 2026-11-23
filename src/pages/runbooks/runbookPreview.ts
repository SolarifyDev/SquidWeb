import { useCallback, useMemo, useState } from 'react'
import type { RunbookDto } from 'pages/apis/runbook'

export const PREVIEW_ENVIRONMENTS = ['Development', 'Test', 'Production']
export const FAILURE_MODES = [
  { value: 'default', label: 'Use the target environment default' },
  { value: 'guided', label: 'Use guided failure mode' },
  { value: 'fail', label: 'Fail without prompting' },
] as const

export type FailureMode = typeof FAILURE_MODES[number]['value']

export const DEFAULT_RUN_SETTINGS = {
  scope: 'all',
  environments: [] as string[],
  tenancy: 'untenanted',
  targetStatus: 'fail',
  failureMode: 'default' as FailureMode,
  retention: 'default',
  retainCount: 10,
  packageDownload: 'cached',
  targetDiscovery: 'skip',
}

export type RunSettings = typeof DEFAULT_RUN_SETTINGS

export interface PreviewSnapshot {
  name: string
  publishedAt: string
  steps: string[]
}

export interface PreviewRun {
  id: string
  snapshot: string
  environment: string
  createdAt: string
  scheduledAt?: string
  packageVersion?: string
  failureMode: FailureMode
  excludedSteps: string[]
  targetMode: string
  targetTags: string[]
}

interface RunbookPreview {
  snapshot: PreviewSnapshot | null
  publishedSnapshots: PreviewSnapshot[]
  runs: PreviewRun[]
  settings: RunSettings
}

const emptyPreview: RunbookPreview = { snapshot: null, publishedSnapshots: [], runs: [], settings: DEFAULT_RUN_SETTINGS }

export function useSessionPreview<T>(key: string, initial: T) {
  const [entry, setEntry] = useState<{ key: string; value: T }>()
  const storedValue = useMemo((): T => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored ? JSON.parse(stored) as T : initial
    } catch {
      return initial
    }
  }, [initial, key])
  const value = entry?.key === key ? entry.value : storedValue
  const update = useCallback((next: T) => {
    setEntry({ key, value: next })
    try {
      sessionStorage.setItem(key, JSON.stringify(next))
    } catch {
      // The page can still use the in-memory preview if session storage is unavailable.
    }
  }, [key])
  return [value, update] as const
}

export function useRunbookPreview(runbook: RunbookDto | null) {
  return useSessionPreview(`squid.runbook-preview.v1:${runbook?.spaceId}:${runbook?.projectId}:${runbook?.id}`, emptyPreview)
}
