import type { ServerTaskListItemDto } from 'pages/apis/serverTask'
import { getProjects, type ProjectDto } from 'pages/apis/project'

const PROJECT_LOOKUP_TTL_MS = 30_000
const projectLookupCache = new Map<string, { project: ProjectDto | null; expiresAt: number }>()

export const RUNBOOK_NAME_MAX_LENGTH = 200
export const RUNBOOK_DESCRIPTION_MAX_LENGTH = 4000
export const RUNBOOK_TAG_MAX_LENGTH = 100
export const RUNBOOK_TAGS_MAX_COUNT = 50

export type RunbookTaskCategory = 'running' | 'waiting' | 'needsApproval' | 'completed'

export interface RunbookTaskStatus {
  category: RunbookTaskCategory | 'failed'
  label: string
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const RUNNING_TASK_STATES = new Set(['executing', 'cancelling'])
const WAITING_TASK_STATES = new Set(['pending'])
const FAILED_TASK_STATES = new Set(['failed', 'timedout', 'cancelled', 'canceled'])

export function classifyRunbookTask(task: Pick<ServerTaskListItemDto, 'state' | 'hasPendingInterruptions' | 'isCompleted'>): RunbookTaskStatus {
  const state = task.state.trim().toLowerCase()
  if (task.hasPendingInterruptions || state === 'paused' || state.includes('approval') || state.includes('manual')) {
    return { category: 'needsApproval', label: 'Needs approval', tone: 'warning' }
  }
  if (RUNNING_TASK_STATES.has(state)) return { category: 'running', label: 'Running', tone: 'info' }
  if (WAITING_TASK_STATES.has(state)) return { category: 'waiting', label: 'Waiting', tone: 'neutral' }
  if (state === 'success') return { category: 'completed', label: 'Success', tone: 'success' }
  if (FAILED_TASK_STATES.has(state)) {
    const label = state === 'timedout' ? 'Timed out' : state === 'failed' ? 'Failed' : 'Cancelled'
    return { category: 'failed', label, tone: 'danger' }
  }
  if (task.isCompleted) return { category: 'completed', label: task.state || 'Completed', tone: 'success' }
  return { category: 'waiting', label: task.state || 'Waiting', tone: 'neutral' }
}

export function formatRunbookTaskDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRunbookTaskDuration(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  if (safe < 60) return `${safe}s`
  const minutes = Math.floor(safe / 60)
  const remainingSeconds = safe % 60
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function findProjectByRouteName(projects: ProjectDto[], projectName: string) {
  return projects.find((project) => project.slug === projectName || project.name === projectName)
}

export async function resolveProjectByRouteName(projectName: string | undefined) {
  if (!projectName) return null

  const cached = projectLookupCache.get(projectName)
  if (cached && cached.expiresAt > Date.now()) return cached.project

  const response = await getProjects({ pageSize: 500 })
  const matched = findProjectByRouteName(response.projects ?? [], projectName)
  if (matched) {
    projectLookupCache.set(projectName, { project: matched, expiresAt: Date.now() + PROJECT_LOOKUP_TTL_MS })
    return matched
  }

  const fallback = await getProjects({ pageSize: 100, keyword: projectName })
  const resolved = findProjectByRouteName(fallback.projects ?? [], projectName) ?? null
  projectLookupCache.set(projectName, { project: resolved, expiresAt: Date.now() + PROJECT_LOOKUP_TTL_MS })
  return resolved
}

export function clearProjectLookupCache() {
  projectLookupCache.clear()
}

export function upsertProjectLookupCache(project: ProjectDto) {
  projectLookupCache.set(project.slug, { project, expiresAt: Date.now() + PROJECT_LOOKUP_TTL_MS })
  projectLookupCache.set(project.name, { project, expiresAt: Date.now() + PROJECT_LOOKUP_TTL_MS })
}

export function buildProjectBasePath(spaceId: string, projectName: string) {
  return `/${spaceId}/projects/${encodeURIComponent(projectName)}`
}

export function buildRunbooksPath(spaceId: string, projectName: string) {
  return `${buildProjectBasePath(spaceId, projectName)}/operations/runbooks`
}

export function buildRunbookPath(spaceId: string, projectName: string, runbookId: number) {
  return `${buildRunbooksPath(spaceId, projectName)}/${runbookId}`
}

export function buildRunbookProcessPath(spaceId: string, projectName: string, runbookId: number) {
  return `${buildRunbookPath(spaceId, projectName, runbookId)}/process`
}

export function buildRunbookRunsPath(spaceId: string, projectName: string, runbookId: number) {
  return `${buildRunbookPath(spaceId, projectName, runbookId)}/runs`
}

export function buildRunbookTriggersPath(spaceId: string, projectName: string) {
  return `${buildProjectBasePath(spaceId, projectName)}/operations/triggers`
}

export function buildRunbookSettingsPath(spaceId: string, projectName: string, runbookId: number) {
  return `${buildRunbookPath(spaceId, projectName, runbookId)}/settings`
}

export function parsePositiveId(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatRunbookDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export function normalizeRunbookTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const tag of tags) {
    const value = tag.trim()
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    normalized.push(value)
  }

  return normalized
}

export function validateRunbookMetadata({
  name,
  description,
  tags,
}: {
  name: string
  description?: string
  tags?: string[]
}) {
  const normalizedName = name.trim()
  const normalizedTags = normalizeRunbookTags(tags ?? [])

  if (!normalizedName) return { field: 'name', message: 'Runbook name is required.' }
  if (normalizedName.length > RUNBOOK_NAME_MAX_LENGTH) {
    return { field: 'name', message: `Runbook name must be at most ${RUNBOOK_NAME_MAX_LENGTH} characters.` }
  }
  if ((description ?? '').length > RUNBOOK_DESCRIPTION_MAX_LENGTH) {
    return { field: 'description', message: `Runbook description must be at most ${RUNBOOK_DESCRIPTION_MAX_LENGTH} characters.` }
  }
  if (normalizedTags.length > RUNBOOK_TAGS_MAX_COUNT) {
    return { field: 'tags', message: `A Runbook can have at most ${RUNBOOK_TAGS_MAX_COUNT} tags.` }
  }
  if (normalizedTags.some((tag) => tag.length > RUNBOOK_TAG_MAX_LENGTH)) {
    return { field: 'tags', message: `Runbook tags must be at most ${RUNBOOK_TAG_MAX_LENGTH} characters.` }
  }

  return null
}

export function resolveRunbookValidationField(error: {
  validationField?: string
  validationCode?: string
  message: string
}) {
  const explicitField = error.validationField?.trim().toLowerCase()
  if (explicitField) {
    if (explicitField.endsWith('name')) return 'name'
    if (explicitField.endsWith('description')) return 'description'
    if (explicitField.endsWith('tags')) return 'tags'
  }

  if (error.validationCode?.includes('name')) return 'name'
  if (error.validationCode?.includes('description')) return 'description'
  if (error.validationCode?.includes('tag')) return 'tags'

  const message = error.message.toLowerCase()
  if (message.includes('name')) return 'name'
  if (message.includes('description')) return 'description'
  if (message.includes('tag')) return 'tags'
  return null
}

export function isRunbookPermissionError(error: {
  message: string
  missingPermission?: string
}) {
  const missingPermission = error.missingPermission?.trim()
  if (missingPermission === 'RunbookView' || missingPermission === 'RunbookEdit') return true

  const message = error.message.toLowerCase()
  return message.includes('runbookview')
    || message.includes('runbookedit')
    || message.includes('permission denied')
    || message.includes('not authorized')
}
