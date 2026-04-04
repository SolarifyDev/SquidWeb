import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Dropdown, Input, Select, Spin, Tooltip, message, type MenuProps } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  DownloadOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  MoreOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { getDeployment, type DeploymentDto } from 'pages/apis/deployment'
import { getChannels } from 'pages/apis/channel'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { getLifecycles, type LifecycleDto } from 'pages/apis/lifecycle'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getReleases, type ReleaseDto } from 'pages/apis/release'
import { getTeams } from 'pages/apis/team'
import {
  cancelServerTask,
  getServerTaskDetails,
  getServerTaskInterruptions,
  submitInterruption,
  takeInterruptionResponsibility,
  type DeploymentActivityLogNodeStatusValue,
  type DeploymentActivityLogNodeTypeValue,
  type InterruptionDto,
  InterruptionType,
  type ServerTaskActivityNodeDto,
  type ServerTaskDetailsDto,
  type ServerTaskLogCategoryValue,
  type ServerTaskLogElementDto,
} from 'pages/apis/serverTask'
import { getAuthUser } from 'utils/auth'

type ActiveTabKey = 'taskSummary' | 'taskLog'
type NormalizedNodeStatus = 'Pending' | 'Running' | 'Success' | 'Failed' | 'Unknown'
type NormalizedNodeType = 'Task' | 'Step' | 'Action' | 'LogEntry' | 'Unknown'
type NormalizedLogCategory = 'Info' | 'Warning' | 'Error' | 'Unknown'
type HealthCheckEventKind = 'starting' | 'target' | 'completed'

interface InterruptionButtonUi {
  type: 'primary' | 'default'
  danger?: boolean
  className?: string
  tooltip?: string
}

interface FormattedHealthCheckLog {
  messageText: string
  detail?: string | null
  category?: NormalizedLogCategory
}

interface LocationState {
  taskId?: number
  environmentId?: number
}

const POLL_INTERVAL_MS = 3000
const DEFAULT_TAIL = 50
const DETAIL_TAIL_OPTIONS = [50, 100, 200, 500]

function toEnvironmentToken(environmentId: number): string {
  return `Environments-${environmentId}`
}

function buildEnvironmentIdsQuery(environmentIds: number[]): string {
  const params = new URLSearchParams()
  environmentIds.forEach((id) => params.append('environmentIds', toEnvironmentToken(id)))
  return params.toString()
}

function parseDeploymentId(input: string | undefined): number | null {
  if (!input) return null
  const direct = Number(input)
  if (Number.isFinite(direct)) return direct
  const suffix = input.match(/(\d+)$/)
  if (!suffix) return null
  const parsed = Number(suffix[1])
  return Number.isFinite(parsed) ? parsed : null
}

function parseSpaceNumericId(spaceId: string | undefined): number {
  const raw = String(spaceId ?? '')
  const match = raw.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseResponsibleTeamIds(rawValue: string | null | undefined): string[] {
  if (!rawValue?.trim()) return []
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'just now'
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return value
  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000))
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '<1s'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainSeconds = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${remainSeconds}s`
  if (minutes > 0) return `${minutes}m ${remainSeconds}s`
  return `${remainSeconds}s`
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getNodeDurationSeconds(node: ServerTaskActivityNodeDto): number | null {
  const started = parseTime(node.startedAt)
  if (started == null) return null
  const ended = parseTime(node.endedAt) ?? Date.now()
  if (ended < started) return null
  return Math.max(0, Math.floor((ended - started) / 1000))
}

function isTaskActive(state: string | null | undefined): boolean {
  return state === 'Pending'
    || state === 'Executing'
    || state === 'Cancelling'
    || state === 'Paused'
    || state === 'Suspended'
}

function hasTaskPendingInterruptions(task: ServerTaskDetailsDto['task'] | null | undefined): boolean {
  if (!task) return false
  return Boolean(task.hasPendingInterruptions ?? task.HasPendingInterruptions)
}

function interruptionTypeLabel(type: InterruptionType): string {
  if (type === InterruptionType.GuidedFailure) return 'Guided Failure'
  if (type === InterruptionType.ManualIntervention) return 'Manual Intervention'
  return 'Interruption'
}

function interruptionTitle(interruption: InterruptionDto | null | undefined): string {
  if (!interruption) return 'Interruption'

  const stepName = interruption.stepName?.trim() ?? ''
  if (stepName) return stepName

  const actionName = interruption.actionName?.trim() ?? ''
  if (actionName) return actionName

  return interruptionTypeLabel(interruption.interruptionType)
}

function toInterruptionErrorMessage(error: any): string {
  const rawMessage = String(error?.message ?? '').trim()
  if (!rawMessage) return 'Failed to load pending interruptions.'

  const lower = rawMessage.toLowerCase()
  if (lower.includes('metadata property') && lower.includes('control.type')) {
    return 'Interruption form payload cannot be parsed by the server (JSON polymorphic metadata order issue).'
  }

  return rawMessage
}

function uniquePendingInterruptions(items: InterruptionDto[]): InterruptionDto[] {
  const map = new Map<number, InterruptionDto>()
  for (const item of items) {
    if (!item.isPending) continue
    if (!map.has(item.id)) map.set(item.id, item)
  }
  return Array.from(map.values())
}

function deploymentStateLabel(state: string | null | undefined): string {
  switch (state) {
    case 'Pending':
      return 'Pending'
    case 'Executing':
      return 'Executing'
    case 'Paused':
      return 'Paused'
    case 'Suspended':
      return 'Suspended'
    case 'Success':
      return 'Success'
    case 'Failed':
      return 'Failed'
    case 'TimedOut':
      return 'Timed out'
    case 'Cancelling':
      return 'Cancelling'
    case 'Cancelled':
      return 'Cancelled'
    default:
      return 'Unknown'
  }
}

function deploymentStateColors(state: string | null | undefined) {
  switch (state) {
    case 'Success':
      return { bg: '#00874d', text: 'text-emerald-700' }
    case 'Executing':
      return { bg: '#1a77ca', text: 'text-blue-700' }
    case 'Paused':
    case 'Suspended':
      return { bg: '#f59e0b', text: 'text-amber-700' }
    case 'Pending':
      return { bg: '#757575', text: 'text-slate-600' }
    case 'Cancelling':
      return { bg: '#f59e0b', text: 'text-amber-700' }
    case 'Failed':
    case 'TimedOut':
      return { bg: '#d92d20', text: 'text-rose-700' }
    case 'Cancelled':
      return { bg: '#6b7280', text: 'text-slate-600' }
    default:
      return { bg: '#757575', text: 'text-slate-600' }
  }
}

function renderDeploymentStateIcon(state: string | null | undefined) {
  const tone = deploymentStateColors(state)

  if (state === 'Executing' || state === 'Pending' || state === 'Cancelling') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: tone.bg }}>
        <LoadingOutlined style={{ fontSize: 11 }} />
      </span>
    )
  }

  if (state === 'Success') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: tone.bg }}>
        <CheckOutlined style={{ fontSize: 11 }} />
      </span>
    )
  }

  if (state === 'Paused' || state === 'Suspended') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: tone.bg }}>
        <ExclamationCircleFilled style={{ fontSize: 12 }} />
      </span>
    )
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: tone.bg }}>
      <CloseOutlined style={{ fontSize: 11 }} />
    </span>
  )
}

function normalizeNodeStatus(value: DeploymentActivityLogNodeStatusValue): NormalizedNodeStatus {
  if (value == null) return 'Unknown'

  if (typeof value === 'number') {
    if (value === 0) return 'Pending'
    if (value === 1) return 'Running'
    if (value === 2) return 'Success'
    if (value === 3) return 'Failed'
    return 'Unknown'
  }

  if (value === 'Pending' || value === 'Running' || value === 'Success' || value === 'Failed') return value
  return 'Unknown'
}

function finalizeNodeStatusForCompletedTask(
  nodeStatus: NormalizedNodeStatus,
  taskState: string | null | undefined,
): NormalizedNodeStatus {
  if (isTaskActive(taskState)) return nodeStatus
  if (nodeStatus !== 'Running' && nodeStatus !== 'Pending') return nodeStatus

  if (taskState === 'Success') return 'Success'
  if (taskState === 'Failed' || taskState === 'TimedOut' || taskState === 'Cancelled' || taskState === 'Cancelling') {
    return 'Failed'
  }

  return nodeStatus
}

function normalizeNodeType(value: DeploymentActivityLogNodeTypeValue): NormalizedNodeType {
  if (typeof value === 'number') {
    if (value === 0) return 'Task'
    if (value === 1) return 'Step'
    if (value === 2) return 'Action'
    if (value === 3) return 'LogEntry'
    return 'Unknown'
  }

  if (value === 'Task' || value === 'Step' || value === 'Action' || value === 'LogEntry') return value
  return 'Unknown'
}

function normalizeLogCategory(value: ServerTaskLogCategoryValue): NormalizedLogCategory {
  if (typeof value === 'number') {
    if (value === 0) return 'Info'
    if (value === 1) return 'Warning'
    if (value === 2) return 'Error'
    return 'Unknown'
  }

  if (value === 'Info' || value === 'Warning' || value === 'Error') return value
  return 'Unknown'
}

function nodeStatusTextClass(status: NormalizedNodeStatus): string {
  if (status === 'Running') return 'text-blue-700'
  if (status === 'Success') return 'text-emerald-700'
  if (status === 'Failed') return 'text-rose-700'
  return 'text-slate-500'
}

function renderStatusDot(status: NormalizedNodeStatus) {
  if (status === 'Running') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
        <LoadingOutlined style={{ fontSize: 9 }} />
      </span>
    )
  }

  if (status === 'Success') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-white">
        <CheckOutlined style={{ fontSize: 9 }} />
      </span>
    )
  }

  if (status === 'Failed') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-700 text-white">
        <CloseOutlined style={{ fontSize: 9 }} />
      </span>
    )
  }

  return <span className="inline-flex h-4 w-4 rounded-full bg-slate-400" />
}

function logCategoryClass(category: NormalizedLogCategory): string {
  if (category === 'Error') return 'text-rose-700'
  if (category === 'Warning') return 'text-amber-700'
  return 'text-slate-700'
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    return null
  }

  return null
}

function readStringField(source: Record<string, unknown> | null, names: string[]): string | null {
  if (!source) return null
  for (const name of names) {
    const value = source[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readNumberField(source: Record<string, unknown> | null, names: string[]): number | null {
  if (!source) return null
  for (const name of names) {
    const value = source[name]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBooleanField(source: Record<string, unknown> | null, names: string[]): boolean | null {
  if (!source) return null
  for (const name of names) {
    const value = source[name]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }
  return null
}

function detectHealthCheckEventKind(log: ServerTaskLogElementDto, payload: Record<string, unknown> | null): HealthCheckEventKind | null {
  const eventType = readStringField(payload, ['eventType', 'EventType', 'type', 'Type', 'name', 'Name'])
  if (eventType) {
    const normalized = eventType.toLowerCase().replace(/\s+/g, '')
    if (normalized.includes('healthcheckstartingevent')) return 'starting'
    if (normalized.includes('healthchecktargetresultevent')) return 'target'
    if (normalized.includes('healthcheckcompletedevent')) return 'completed'
  }

  const combined = `${log.messageText ?? ''} ${log.detail ?? ''} ${log.source ?? ''}`.toLowerCase()
  if (combined.includes('healthcheckstartingevent')) return 'starting'
  if (combined.includes('healthchecktargetresultevent')) return 'target'
  if (combined.includes('healthcheckcompletedevent')) return 'completed'
  return null
}

function parseCountFromText(sourceText: string, pattern: RegExp): number | null {
  const matched = sourceText.match(pattern)
  if (!matched || matched.length < 2) return null
  const parsed = Number(matched[1])
  return Number.isFinite(parsed) ? parsed : null
}

function formatHealthCheckLog(log: ServerTaskLogElementDto): FormattedHealthCheckLog | null {
  const detailObject = parseJsonObject(log.detail)
  const messageObject = parseJsonObject(log.messageText)
  const payload = detailObject ?? messageObject
  const kind = detectHealthCheckEventKind(log, payload)
  if (!kind) return null

  const sourceText = `${log.messageText ?? ''} ${log.detail ?? ''}`

  if (kind === 'starting') {
    const targetCount = readNumberField(payload, ['targetCount', 'TargetCount', 'healthCheckTargetCount', 'HealthCheckTargetCount'])
      ?? parseCountFromText(sourceText, /(\d+)\s+targets?/i)
    const stepName = readStringField(payload, ['stepName', 'StepName'])
    const actionName = readStringField(payload, ['actionName', 'ActionName'])
    const messageText = targetCount != null
      ? `[Health Check] Starting health check for ${targetCount} target${targetCount === 1 ? '' : 's'}...`
      : '[Health Check] Starting health check...'
    const detail = [stepName, actionName].filter(Boolean).join(' / ') || null
    return { messageText, detail }
  }

  if (kind === 'target') {
    const machineName = readStringField(payload, ['machineName', 'MachineName']) ?? 'target'
    const healthy = readBooleanField(payload, ['healthCheckHealthy', 'HealthCheckHealthy', 'healthy', 'Healthy'])
    const healthCheckDetail = readStringField(payload, ['healthCheckDetail', 'HealthCheckDetail', 'detail', 'Detail'])
    const isHealthy = healthy !== false
    const icon = isHealthy ? '✅' : '❌'
    const fallback = isHealthy ? 'ok' : 'unhealthy'
    return {
      messageText: `${icon} ${machineName}: ${healthCheckDetail || fallback}`,
      detail: isHealthy ? null : '⚠️ Excluded from remaining steps',
      category: isHealthy ? 'Info' : 'Warning',
    }
  }

  const healthyCount = readNumberField(payload, ['healthCheckHealthyCount', 'HealthCheckHealthyCount', 'healthyCount', 'HealthyCount'])
    ?? parseCountFromText(sourceText, /(\d+)\s+healthy/i)
  const unhealthyCount = readNumberField(payload, ['healthCheckUnhealthyCount', 'HealthCheckUnhealthyCount', 'unhealthyCount', 'UnhealthyCount'])
    ?? parseCountFromText(sourceText, /(\d+)\s+unhealthy/i)
  const messageText = healthyCount != null && unhealthyCount != null
    ? `[Health Check] Completed: ${healthyCount} healthy, ${unhealthyCount} unhealthy`
    : '[Health Check] Completed'
  const detail = (unhealthyCount ?? 0) > 0
    ? `⚠️ ${unhealthyCount} unhealthy target${unhealthyCount === 1 ? '' : 's'} excluded from remaining steps`
    : null
  return {
    messageText,
    detail,
    category: (unhealthyCount ?? 0) > 0 ? 'Warning' : 'Info',
  }
}

function interruptionButtonUi(buttonLabel: string): InterruptionButtonUi {
  const baseActionButtonClass = '!h-9 !px-4 !border-squid-blue !text-squid-blue !bg-transparent hover:!border-blue-700 hover:!text-blue-700 hover:!bg-blue-50'
  const normalized = buttonLabel.trim().toLowerCase()
  if (normalized === 'abort') return { type: 'default', className: baseActionButtonClass }
  if (normalized === 'retry') return { type: 'default', className: baseActionButtonClass }
  if (normalized === 'ignore') return { type: 'default', className: baseActionButtonClass }
  if (normalized === 'proceed') return { type: 'default', className: baseActionButtonClass }
  if (normalized === 'exclude machine') {
    return {
      type: 'default',
      className: '!h-9 !px-4 !border-amber-400 !text-amber-700 !bg-transparent hover:!border-amber-500 hover:!text-amber-800 hover:!bg-amber-50',
      tooltip: '排除此机器，后续步骤将不再在此机器上执行',
    }
  }
  return { type: 'default', className: baseActionButtonClass }
}

function sortActivityNodes(nodes: ServerTaskActivityNodeDto[]): ServerTaskActivityNodeDto[] {
  return [...nodes].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id - b.id
  })
}

function formatStepDisplayName(name: string, sortOrder: number): string {
  if (!name) return `Step ${sortOrder}`
  if (/^Step\s+\d+\s*:/i.test(name.trim())) return name
  return `Step ${sortOrder}: ${name}`
}

function flattenNodeIds(nodes: ServerTaskActivityNodeDto[]): number[] {
  const result: number[] = []

  const walk = (items: ServerTaskActivityNodeDto[]) => {
    for (const item of items) {
      result.push(item.id)
      if (item.children.length > 0) walk(item.children)
    }
  }

  walk(nodes)
  return result
}

function buildParentMap(nodes: ServerTaskActivityNodeDto[]): Map<number, number | null> {
  const map = new Map<number, number | null>()

  const walk = (items: ServerTaskActivityNodeDto[]) => {
    for (const item of items) {
      map.set(item.id, item.parentId ?? null)
      if (item.children.length > 0) walk(item.children)
    }
  }

  walk(nodes)
  return map
}

function getNodePath(parentMap: Map<number, number | null>, nodeId: number): number[] {
  const path: number[] = []
  let current: number | null | undefined = nodeId

  while (typeof current === 'number') {
    path.push(current)
    current = parentMap.get(current)
  }

  return path.reverse()
}

function exportTaskLogs(taskId: number, roots: ServerTaskActivityNodeDto[]) {
  const lines: string[] = []

  const walk = (node: ServerTaskActivityNodeDto, depth: number) => {
    const indent = '  '.repeat(depth)
    const status = normalizeNodeStatus(node.status)
    lines.push(`${indent}${node.name} [${status}]`)

    const logs = [...(node.logElements ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    for (const log of logs) {
      const category = normalizeLogCategory(log.category)
      lines.push(`${indent}  ${log.sequenceNumber}: [${category}] ${log.messageText}`)
    }

    const children = sortActivityNodes(node.children ?? [])
    for (const child of children) walk(child, depth + 1)
  }

  for (const root of roots) walk(root, 0)

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `task-${taskId}-log.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const DeploymentDetail: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName, version, deploymentId: deploymentIdParam } = useParams<{
    spaceId: string
    projectName: string
    version: string
    deploymentId: string
  }>()
  const location = useLocation()
  const locationState = (location.state ?? null) as LocationState | null

  const decodedVersion = decodeURIComponent(version ?? '')
  const deploymentId = parseDeploymentId(deploymentIdParam)
  const encodedProjectName = encodeURIComponent(projectName ?? '')
  const encodedVersion = encodeURIComponent(decodedVersion)
  const baseProjectPath = `/${spaceId}/projects/${encodedProjectName}`

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTabKey>('taskLog')
  const [verbose, setVerbose] = useState(false)
  const [tail, setTail] = useState<number>(DEFAULT_TAIL)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [release, setRelease] = useState<ReleaseDto | null>(null)
  const [lifecycle, setLifecycle] = useState<LifecycleDto | null>(null)
  const [deployment, setDeployment] = useState<DeploymentDto | null>(null)
  const [taskDetails, setTaskDetails] = useState<ServerTaskDetailsDto | null>(null)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [expandedNodeIds, setExpandedNodeIds] = useState<number[]>([])
  const [interruptionsLoading, setInterruptionsLoading] = useState(false)
  const [interruptions, setInterruptions] = useState<InterruptionDto[]>([])
  const [interruptionDraftValues, setInterruptionDraftValues] = useState<Record<number, Record<string, string>>>({})
  const [interruptionLoadError, setInterruptionLoadError] = useState<string | null>(null)
  const [interruptionDetailsVisible, setInterruptionDetailsVisible] = useState(false)
  const [responsibilityLoadingId, setResponsibilityLoadingId] = useState<number | null>(null)
  const [submittingInterruptionId, setSubmittingInterruptionId] = useState<number | null>(null)
  const [locallyClaimedInterruptionIds, setLocallyClaimedInterruptionIds] = useState<number[]>([])
  const [cancellingTask, setCancellingTask] = useState(false)
  const [teamNameById, setTeamNameById] = useState<Record<string, string>>({})

  const authUser = useMemo(() => getAuthUser(), [])
  const currentUserIdentifier = useMemo(() => {
    if (!authUser) return null
    if (authUser.id != null) return String(authUser.id)
    if (authUser.userName) return authUser.userName
    if (authUser.displayName) return authUser.displayName
    return null
  }, [authUser])
  const currentUserCandidates = useMemo(() => {
    const values = [authUser?.id != null ? String(authUser.id) : null, authUser?.userName ?? null, authUser?.displayName ?? null]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.trim().toLowerCase())
    return new Set(values)
  }, [authUser])

  const envMap = useMemo(() => new Map(environments.map((item) => [item.id, item])), [environments])

  const taskSummary = taskDetails?.task ?? null
  const taskState = taskSummary?.state ?? null
  const taskHasPendingInterruptions = hasTaskPendingInterruptions(taskSummary)
  const taskMayBeWaitingInterruption = taskState === 'Paused' || taskState === 'Suspended'
  const taskId = deployment?.taskId ?? taskSummary?.id ?? locationState?.taskId ?? null
  const environmentId = deployment?.environmentId ?? locationState?.environmentId ?? null
  const pendingInterruptions = useMemo(() => uniquePendingInterruptions(interruptions), [interruptions])
  const hasPendingInterruptionsByList = pendingInterruptions.length > 0
  const shouldShowInterruptionPanel = taskHasPendingInterruptions || hasPendingInterruptionsByList || taskMayBeWaitingInterruption
  const activeInterruption = pendingInterruptions.length > 0 ? pendingInterruptions[0] : null
  const activeInterruptionAssignedUserId = activeInterruption?.responsibleUserId ?? null
  const activeInterruptionTeamIds = useMemo(
    () => parseResponsibleTeamIds(activeInterruption?.responsibleTeamIds),
    [activeInterruption?.responsibleTeamIds],
  )
  const activeInterruptionTeamNames = useMemo(
    () => activeInterruptionTeamIds.map((teamId) => teamNameById[teamId] ?? `Team #${teamId}`),
    [activeInterruptionTeamIds, teamNameById],
  )
  const activeInterruptionCanTakeResponsibility = activeInterruption?.canTakeResponsibility ?? true
  const activeInterruptionAssignedToCurrentUser = useMemo(() => {
    if (activeInterruptionAssignedUserId == null) return false
    return currentUserCandidates.has(String(activeInterruptionAssignedUserId).trim().toLowerCase())
  }, [activeInterruptionAssignedUserId, currentUserCandidates])
  const activeInterruptionClaimedLocally = Boolean(
    activeInterruption != null && locallyClaimedInterruptionIds.includes(activeInterruption.id),
  )
  const activeInterruptionClaimedByCurrentUser = Boolean(
    activeInterruptionAssignedToCurrentUser || activeInterruptionClaimedLocally,
  )
  const activeInterruptionClaimedByOtherUser = Boolean(
    activeInterruptionAssignedUserId != null && !activeInterruptionClaimedByCurrentUser,
  )
  const activeInterruptionRequiresAssignment = Boolean(
    activeInterruption != null && activeInterruptionAssignedUserId == null,
  )
  const activeInterruptionCanSubmit = Boolean(
    activeInterruptionCanTakeResponsibility && activeInterruptionClaimedByCurrentUser,
  )
  const activeInterruptionTitle = interruptionTitle(activeInterruption)
  const activeInterruptionElements = activeInterruption?.form?.elements ?? []
  const activeInterruptionDetailElements = activeInterruptionElements.filter((element) => element.control.type !== 'SubmitButtonGroup')
  const activeInterruptionSubmitGroups = activeInterruptionElements.filter((element) => element.control.type === 'SubmitButtonGroup')
  const showCancelButton = taskId != null && (
    taskState === 'Pending'
    || taskState === 'Executing'
    || taskState === 'Paused'
    || taskState === 'Suspended'
    || taskState === 'Cancelling'
  )
  const canCancelTask = taskId != null && (
    taskState === 'Pending'
    || taskState === 'Executing'
    || taskState === 'Paused'
    || taskState === 'Suspended'
  )
  const cancelInProgress = cancellingTask || taskState === 'Cancelling'

  const environmentName = environmentId != null ? envMap.get(environmentId)?.name ?? `Environment ${environmentId}` : '—'
  const releaseVersion = release?.version ?? decodedVersion
  const startedAt = taskSummary?.startTime ?? deployment?.created ?? null
  const deploymentTitle = `Deploy ${project?.name ?? projectName ?? ''} release ${releaseVersion} to ${environmentName}`

  const getNodeDisplayName = (node: ServerTaskActivityNodeDto): string => {
    const nodeType = normalizeNodeType(node.nodeType)
    if (nodeType === 'Task') return deploymentTitle
    if (nodeType === 'Step') return formatStepDisplayName(node.name, node.sortOrder)
    return node.name
  }

  const rootNodes = useMemo(() => sortActivityNodes(taskDetails?.activityLogs ?? []), [taskDetails])
  const allNodeIds = useMemo(() => flattenNodeIds(rootNodes), [rootNodes])
  const allExpanded = allNodeIds.length > 0 && allNodeIds.every((id) => expandedNodeIds.includes(id))
  const progressPercentage = Math.max(0, Math.min(100, taskDetails?.progress?.progressPercentage ?? 0))
  const lifecyclePhases = useMemo(
    () => lifecycle?.phases?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [],
    [lifecycle],
  )

  const nextLifecycleEnvironmentIds = useMemo(() => {
    if (environmentId == null || lifecyclePhases.length === 0) return []

    const phaseEnvironmentIds = lifecyclePhases.map((phase) => {
      const merged = [...(phase.automaticDeploymentTargetIds ?? []), ...(phase.optionalDeploymentTargetIds ?? [])]
      return Array.from(new Set(merged))
    })

    const currentPhaseIndex = phaseEnvironmentIds.findIndex((envIds) => envIds.includes(environmentId))
    if (currentPhaseIndex < 0) return []

    for (let index = currentPhaseIndex + 1; index < phaseEnvironmentIds.length; index += 1) {
      if (phaseEnvironmentIds[index].length > 0) return phaseEnvironmentIds[index]
    }

    return []
  }, [environmentId, lifecyclePhases])

  const nextLifecycleEnvironmentNames = useMemo(
    () => nextLifecycleEnvironmentIds
      .map((id) => envMap.get(id)?.name)
      .filter((name): name is string => Boolean(name)),
    [nextLifecycleEnvironmentIds, envMap],
  )

  const nextLifecycleDeployLabel = useMemo(() => {
    if (nextLifecycleEnvironmentNames.length === 0) return 'Deploy to...'
    if (nextLifecycleEnvironmentNames.length === 1) return `Deploy to ${nextLifecycleEnvironmentNames[0]}...`
    return `Deploy to ${nextLifecycleEnvironmentNames[0]}...`
  }, [nextLifecycleEnvironmentNames])

  const nextLifecycleDeployHref = useMemo(() => {
    if (nextLifecycleEnvironmentIds.length === 0) return null
    const query = buildEnvironmentIdsQuery(nextLifecycleEnvironmentIds)
    return `${baseProjectPath}/releases/${encodedVersion}/deployments/create?${query}`
  }, [baseProjectPath, encodedVersion, nextLifecycleEnvironmentIds])

  const redeployHref = useMemo(() => {
    const params = new URLSearchParams()
    if (environmentId != null) params.append('environmentIds', toEnvironmentToken(environmentId))
    if (deploymentId != null) params.append('previousDeploymentId', `Deployments-${deploymentId}`)
    const query = params.toString()
    return `${baseProjectPath}/releases/${encodedVersion}/deployments/create${query ? `?${query}` : ''}`
  }, [baseProjectPath, encodedVersion, environmentId, deploymentId])

  const parentMap = useMemo(() => buildParentMap(rootNodes), [rootNodes])

  const summaryNodes = useMemo(() => {
    if (rootNodes.length === 1 && rootNodes[0].children.length > 0) return sortActivityNodes(rootNodes[0].children)
    return rootNodes
  }, [rootNodes])

  useEffect(() => {
    if (!projectName || !decodedVersion || deploymentId == null) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const deploymentResult = await getDeployment(deploymentId, { verbose, tail })
        if (cancelled) return

        setDeployment(deploymentResult.deployment)
        setTaskDetails(deploymentResult.taskDetails ?? null)

        const [projectRes, environmentRes] = await Promise.all([
          getProjects({ pageSize: 500 }).catch(() => null),
          getEnvironments({ pageSize: 1000 }).catch(() => null),
        ])

        if (cancelled) return

        const foundProject = projectRes?.projects.find((item) => item.id === deploymentResult.deployment.projectId)
          ?? projectRes?.projects.find((item) => item.slug === projectName || item.name === projectName)
          ?? null

        setProject(foundProject)
        setEnvironments(environmentRes?.environments ?? [])
        const teamRes = await getTeams({ spaceId: parseSpaceNumericId(spaceId) }).catch(() => null)
        if (cancelled) return
        const nextTeamMap: Record<string, string> = {}
        for (const team of teamRes?.teams ?? []) {
          nextTeamMap[String(team.id)] = team.name
        }
        setTeamNameById(nextTeamMap)

        if (foundProject) {
          const [releaseRes, channelRes, lifecycleRes] = await Promise.all([
            getReleases({ projectId: foundProject.id, pageSize: 500 }).catch(() => null),
            getChannels({ projectId: foundProject.id, pageSize: 1000 }).catch(() => null),
            getLifecycles({ pageSize: 100 }).catch(() => null),
          ])
          if (cancelled) return

          const foundRelease = releaseRes?.releases.find((item) => item.id === deploymentResult.deployment.releaseId)
            ?? releaseRes?.releases.find((item) => item.version === decodedVersion)
            ?? null

          setRelease(foundRelease)

          const foundChannel = foundRelease
            ? channelRes?.channels.find((item) => item.id === foundRelease.channelId) ?? null
            : null

          const effectiveLifecycleId = foundChannel?.lifecycleId ?? foundProject.lifecycleId
          const foundLifecycle = lifecycleRes?.lifecycles.find((item) => item.id === effectiveLifecycleId) ?? null
          setLifecycle(foundLifecycle)
        } else {
          setRelease(null)
          setLifecycle(null)
        }
      } catch (error: any) {
        if (!cancelled) message.error(error?.message || 'Failed to load deployment details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [deploymentId, projectName, decodedVersion, spaceId])

  useEffect(() => {
    if (taskId == null) return

    let cancelled = false

    ;(async () => {
      try {
        const details = await getServerTaskDetails(taskId, { verbose, tail })
        if (!cancelled) setTaskDetails(details)
      } catch {
        if (!cancelled) message.error('Failed to load task details.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [taskId, verbose, tail])

  useEffect(() => {
    if (taskId == null || !isTaskActive(taskState) || taskHasPendingInterruptions) return

    let cancelled = false

    const timer = window.setInterval(() => {
      getServerTaskDetails(taskId, { verbose, tail })
        .then((details) => {
          if (!cancelled) setTaskDetails(details)
        })
        .catch(() => {
          // keep polling while active
        })
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [taskId, taskState, taskHasPendingInterruptions, verbose, tail])

  useEffect(() => {
    const shouldLoadInterruptions = taskHasPendingInterruptions || taskMayBeWaitingInterruption
    if (taskId == null || !shouldLoadInterruptions) {
      setInterruptions([])
      setInterruptionsLoading(false)
      setInterruptionLoadError(null)
      return
    }

    let cancelled = false
    setInterruptionsLoading(true)
    setInterruptionLoadError(null)

    getServerTaskInterruptions(taskId)
      .then((response) => {
        if (cancelled) return
        const pending = uniquePendingInterruptions(response.interruptions ?? [])
        setInterruptions(pending)
        setInterruptionDraftValues((prev) => {
          const next: Record<number, Record<string, string>> = { ...prev }
          for (const item of pending) {
            next[item.id] = {
              ...(item.form?.values ?? {}),
              ...(prev[item.id] ?? {}),
            }
          }
          return next
        })
      })
      .catch((error: any) => {
        if (!cancelled) {
          const errorMessage = toInterruptionErrorMessage(error)
          setInterruptionLoadError(errorMessage)
          message.error(errorMessage)
        }
      })
      .finally(() => {
        if (!cancelled) setInterruptionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, taskState, taskHasPendingInterruptions, taskMayBeWaitingInterruption])

  useEffect(() => {
    setExpandedNodeIds((prev) => {
      if (allNodeIds.length === 0) return []
      if (prev.length === 0) return allNodeIds
      return prev.filter((id) => allNodeIds.includes(id))
    })
  }, [allNodeIds])

  useEffect(() => {
    if (!shouldShowInterruptionPanel) {
      setInterruptionDetailsVisible(false)
    }
  }, [shouldShowInterruptionPanel])

  useEffect(() => {
    if (!shouldShowInterruptionPanel || activeInterruption == null) return
    if (activeInterruptionClaimedByCurrentUser) {
      setInterruptionDetailsVisible(true)
    }
  }, [
    shouldShowInterruptionPanel,
    activeInterruption?.id,
    activeInterruptionClaimedByCurrentUser,
  ])

  useEffect(() => {
    if (!shouldShowInterruptionPanel) return
    setActiveTab('taskSummary')
  }, [shouldShowInterruptionPanel, activeInterruption?.id])

  const toggleNode = (nodeId: number, expandable: boolean) => {
    if (!expandable) return
    setExpandedNodeIds((prev) => prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId])
  }

  const toggleAllNodes = () => {
    if (allExpanded) {
      setExpandedNodeIds([])
      return
    }

    setExpandedNodeIds(allNodeIds)
  }

  const handleSummaryJump = (nodeId: number) => {
    const path = getNodePath(parentMap, nodeId)
    setExpandedNodeIds((prev) => Array.from(new Set([...prev, ...path])))
    setActiveTab('taskLog')

    window.setTimeout(() => {
      const element = document.getElementById(`task-log-node-${nodeId}`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  const overflowMenuItems: MenuProps['items'] = [
    { key: 'editState', label: 'Edit state' },
    { key: 'redeploy', label: 'Re-deploy...' },
    { key: 'deployTo', label: 'Deploy to...' },
    { key: 'deleteDeployment', label: 'Delete deployment...' },
    { key: 'viewPrevious', label: 'View previous deployments' },
  ]

  const handleOverflowMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'editState') {
      message.info('Edit state is not implemented yet.')
      return
    }

    if (key === 'deleteDeployment') {
      message.info('Delete deployment is not implemented yet.')
      return
    }

    if (key === 'redeploy') {
      navigate(redeployHref)
      return
    }

    if (key === 'deployTo') {
      navigate(`${baseProjectPath}/releases/${encodedVersion}/deployments/create`)
      return
    }

    if (key === 'viewPrevious') {
      navigate(`${baseProjectPath}/tasks`)
    }
  }

  const updateInterruptionDraftValue = (interruptionId: number, fieldName: string, value: string) => {
    setInterruptionDraftValues((prev) => ({
      ...prev,
      [interruptionId]: {
        ...(prev[interruptionId] ?? {}),
        [fieldName]: value,
      },
    }))
  }

  const reloadInterruptions = async (targetTaskId: number) => {
    try {
      setInterruptionsLoading(true)
      setInterruptionLoadError(null)
      const response = await getServerTaskInterruptions(targetTaskId)
      const pending = uniquePendingInterruptions(response.interruptions ?? [])
      setInterruptions(pending)
      setLocallyClaimedInterruptionIds((prev) => {
        if (prev.length === 0) return prev
        const allowed = new Set(
          pending
            .filter((item) => {
              if (item.responsibleUserId == null) return true
              return currentUserCandidates.has(String(item.responsibleUserId).trim().toLowerCase())
            })
            .map((item) => item.id),
        )
        return prev.filter((id) => allowed.has(id))
      })
      setInterruptionDraftValues((prev) => {
        const next: Record<number, Record<string, string>> = { ...prev }
        for (const item of pending) {
          next[item.id] = {
            ...(item.form?.values ?? {}),
            ...(prev[item.id] ?? {}),
          }
        }
        return next
      })
      return pending
    } catch (error: any) {
      const errorMessage = toInterruptionErrorMessage(error)
      setInterruptionLoadError(errorMessage)
      message.error(errorMessage)
      throw error
    } finally {
      setInterruptionsLoading(false)
    }
  }

  const handleTakeResponsibility = async (interruptionId: number) => {
    if (taskId == null) return
    if (!currentUserIdentifier) {
      message.warning('Current user is unavailable, unable to take responsibility.')
      return
    }
    const interruption = pendingInterruptions.find((item) => item.id === interruptionId)
    if (interruption && interruption.canTakeResponsibility === false) {
      message.warning('You are not a member of a responsible team for this interruption.')
      return
    }

    setResponsibilityLoadingId(interruptionId)
    try {
      await takeInterruptionResponsibility(interruptionId, { userId: currentUserIdentifier })
      setLocallyClaimedInterruptionIds((prev) => prev.includes(interruptionId) ? prev : [...prev, interruptionId])
      await reloadInterruptions(taskId)
      setInterruptionDetailsVisible(true)
      message.success('Responsibility updated.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to take responsibility.')
    } finally {
      setResponsibilityLoadingId(null)
    }
  }

  const handleSubmitInterruption = async (interruption: InterruptionDto, result: string) => {
    if (taskId == null) return
    if (interruption.canTakeResponsibility === false) {
      message.warning('You are not a member of a responsible team for this interruption.')
      return
    }

    setSubmittingInterruptionId(interruption.id)
    try {
      const draftValues = interruptionDraftValues[interruption.id] ?? {}
      const values = {
        ...(interruption.form?.values ?? {}),
        ...draftValues,
        Result: result,
      }

      await submitInterruption(interruption.id, { values })

      const details = await getServerTaskDetails(taskId, { verbose, tail })
      setTaskDetails(details)

      if (hasTaskPendingInterruptions(details.task)) {
        await reloadInterruptions(taskId)
      } else {
        setInterruptions([])
      }

      message.success('Interruption submitted, task resumed.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to submit interruption.')
    } finally {
      setSubmittingInterruptionId(null)
    }
  }

  const handleCancelTask = async () => {
    if (taskId == null || !canCancelTask || cancelInProgress) return

    setCancellingTask(true)
    try {
      await cancelServerTask(taskId)
      message.success('Cancellation requested.')
      const details = await getServerTaskDetails(taskId, { verbose, tail }).catch(() => null)
      if (details) setTaskDetails(details)
    } catch (error: any) {
      message.error(error?.message || 'Failed to cancel deployment task.')
    } finally {
      setCancellingTask(false)
    }
  }

  const renderLogLine = (nodeId: number, log: ServerTaskLogElementDto, index: number, depth: number) => {
    const healthCheckLog = formatHealthCheckLog(log)
    const category = healthCheckLog?.category ?? normalizeLogCategory(log.category)
    const messageText = healthCheckLog?.messageText ?? log.messageText
    const detailText = healthCheckLog?.detail ?? (verbose ? log.detail : null)

    return (
      <div key={`${nodeId}-log-${log.id}-${log.sequenceNumber}`} className="grid grid-cols-[42px_minmax(0,1fr)] gap-1.5 py-1" style={{ paddingLeft: `${depth * 8 + 2}px` }}>
        <span className="text-right text-xs text-slate-400">{log.sequenceNumber || index + 1}</span>
        <div className="min-w-0">
          <div className={`break-words text-[13px] ${logCategoryClass(category)}`}>{messageText}</div>
          {detailText ? <div className="mt-0.5 break-words text-xs text-slate-500">{detailText}</div> : null}
        </div>
      </div>
    )
  }

  const renderLogBlock = (node: ServerTaskActivityNodeDto, depth: number, parentDurationSeconds: number | null): React.ReactNode => {
    const children = sortActivityNodes(node.children ?? [])
    const logs = [...(node.logElements ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    const expandable = children.length > 0 || logs.length > 0
    const expanded = expandedNodeIds.includes(node.id)
    const status = finalizeNodeStatusForCompletedTask(normalizeNodeStatus(node.status), taskState)
    const nodeType = normalizeNodeType(node.nodeType)
    const displayName = getNodeDisplayName(node)
    const nodeDurationSeconds = getNodeDurationSeconds(node)
    const barPercent = parentDurationSeconds && nodeDurationSeconds
      ? Math.max(2, Math.min(100, Math.round(nodeDurationSeconds * 100 / parentDurationSeconds)))
      : nodeDurationSeconds
        ? 3
        : 0

    return (
      <div key={node.id} id={`task-log-node-${node.id}`} className="bg-white">
        <button
          type="button"
          className="w-full px-3 py-2 text-left flex items-center justify-between gap-3 hover:bg-slate-50"
          onClick={() => toggleNode(node.id, expandable)}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <span className="min-w-0 flex items-center gap-2">
            <span className={`inline-flex w-4 justify-center transition-transform ${expanded ? 'rotate-90' : ''}`}>
              {expandable ? <DownOutlined style={{ fontSize: 10 }} /> : <span className="inline-block w-2" />}
            </span>
            {renderStatusDot(status)}
            <span className="truncate text-sm text-slate-800">{displayName}</span>
            {verbose ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{nodeType}</span> : null}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-1.5 w-[100px] rounded bg-slate-100 overflow-hidden">
              <span className="h-full rounded bg-slate-400" style={{ width: `${barPercent}%` }} />
            </span>
            <span className={`text-xs ${nodeStatusTextClass(status)}`}>{formatDuration(nodeDurationSeconds)}</span>
          </span>
        </button>

        {expanded ? (
          <div className="bg-white py-1">
            {logs.map((log, index) => renderLogLine(node.id, log, index, depth))}
            {children.length > 0 ? (
              <div className="space-y-1 px-0 py-1">
                {children.map((child) => renderLogBlock(child, depth + 1, nodeDurationSeconds))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  if (deploymentId == null) {
    return <div className="px-6 py-8 text-sm text-slate-500">Invalid deployment id.</div>
  }

  if (!deployment) {
    return <div className="px-6 py-8 text-sm text-slate-500">Deployment not found.</div>
  }

  const deploymentTone = deploymentStateColors(taskState)

  return (
    <div className="min-h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
      {isTaskActive(taskState) ? (
        <div className="h-1 bg-blue-100">
          <div className="h-full w-1/3 bg-blue-500 animate-pulse" />
        </div>
      ) : null}

      <div className="px-6 pt-4 pb-3 border-b border-slate-200">
        <nav className="mb-3">
          <ol className="flex items-center gap-1 text-sm">
            <li>
              <Link to={`${baseProjectPath}/releases`} className="text-squid-blue hover:underline">Releases</Link>
            </li>
            <li><span className="text-slate-300 mx-1">/</span></li>
            <li>
              <Link
                to={`${baseProjectPath}/releases/${encodedVersion}${release?.id ? `?releaseId=${release.id}` : ''}`}
                className="text-squid-blue hover:underline"
              >
                {releaseVersion}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {renderDeploymentStateIcon(taskState)}
              <h1 className="m-0 text-2xl font-semibold text-slate-900 truncate">{deploymentTitle}</h1>
            </div>
            {taskState !== 'Success' ? (
              <div className={`mt-1 text-sm ${deploymentTone.text}`}>{deploymentStateLabel(taskState)}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mr-2">
            <Button type="default" onClick={() => setActiveTab('taskSummary')}>Timeline</Button>
            {showCancelButton ? (
              <Button
                type="primary"
                danger
                onClick={handleCancelTask}
                loading={cancelInProgress}
                disabled={cancelInProgress}
                className="!shadow-none"
              >
                {cancelInProgress ? 'Cancelling...' : 'Cancel'}
              </Button>
            ) : nextLifecycleDeployHref ? (
              <Link to={nextLifecycleDeployHref}>
                <Button type="primary" className="!bg-green-700 hover:!bg-green-800 !border-green-700">
                  {nextLifecycleDeployLabel}
                </Button>
              </Link>
            ) : (
              <Button type="default" disabled className="!text-slate-400">{nextLifecycleDeployLabel}</Button>
            )}
            <Dropdown menu={{ items: overflowMenuItems, onClick: handleOverflowMenuClick }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                icon={<MoreOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                className="!border-0 !shadow-none hover:!bg-blue-50"
                aria-label="Overflow Menu Button"
              />
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="px-6 pt-2 border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === 'taskSummary' ? 'border-squid-blue text-squid-blue font-medium' : 'border-transparent text-slate-600'}`}
            onClick={() => setActiveTab('taskSummary')}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>Task Summary</span>
              {shouldShowInterruptionPanel ? (
                <span className="inline-flex text-amber-500" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                    <path d="M10 2.5L1.5 17h17L10 2.5zM10 6.8c.5 0 .9.4.9.9v4.1a.9.9 0 11-1.8 0V7.7c0-.5.4-.9.9-.9zm0 8.2a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z" />
                  </svg>
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === 'taskLog' ? 'border-squid-blue text-squid-blue font-medium' : 'border-transparent text-slate-600'}`}
            onClick={() => setActiveTab('taskLog')}
          >
            Task Log
          </button>
        </div>
      </div>

      {activeTab === 'taskSummary' ? (
        <div className="px-6 py-5 space-y-4">
          {shouldShowInterruptionPanel ? (
            <section className="rounded border border-amber-300 bg-amber-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M10 2.5L1.5 17h17L10 2.5zM10 6.8c.5 0 .9.4.9.9v4.1a.9.9 0 11-1.8 0V7.7c0-.5.4-.9.9-.9zm0 8.2a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-6 text-amber-900">{activeInterruptionTitle}</div>
                  <div className="mt-1 text-sm text-amber-800">
                    {activeInterruptionRequiresAssignment
                      ? 'This task is waiting for manual intervention and must be assigned before proceeding.'
                      : 'This task is waiting for manual intervention.'}
                  </div>

                  <div className="mt-2 flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-amber-900">
                      <span>
                        Assigned to:{' '}
                        {activeInterruptionAssignedUserId == null ? (
                          <strong><em>no one</em></strong>
                        ) : (
                          <strong>{activeInterruptionClaimedByCurrentUser ? 'you' : activeInterruptionAssignedUserId}</strong>
                        )}
                      </span>
                      {activeInterruptionRequiresAssignment && activeInterruption ? (
                        <Button
                          type="primary"
                          className="!h-10 !px-5 !bg-green-700 hover:!bg-green-800 !border-green-700"
                          loading={responsibilityLoadingId === activeInterruption.id}
                          disabled={!currentUserIdentifier || !activeInterruptionCanTakeResponsibility}
                          onClick={() => handleTakeResponsibility(activeInterruption.id)}
                        >
                          Assign to me
                        </Button>
                      ) : null}
                    </div>

                    {activeInterruptionTeamNames.length > 0 ? (
                      <div className="text-sm text-amber-900 text-right">
                        Responsible teams: <strong>{activeInterruptionTeamNames.join(', ')}</strong>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        className="text-sm text-squid-blue hover:underline"
                        onClick={() => setInterruptionDetailsVisible((prev) => !prev)}
                      >
                        {interruptionDetailsVisible ? 'Hide details' : 'Show details'}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-squid-blue hover:underline"
                        onClick={() => setActiveTab('taskLog')}
                      >
                        View log
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {interruptionDetailsVisible ? (
                interruptionsLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                    <Spin size="small" />
                    <span>Loading interruptions...</span>
                  </div>
                ) : interruptionLoadError ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-800">
                    <span>{interruptionLoadError}</span>
                    {taskId != null ? (
                      <Button size="small" onClick={() => void reloadInterruptions(taskId)}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                ) : activeInterruption == null ? (
                  <div className="mt-3 text-sm text-amber-800">No pending interruption details are available yet.</div>
                ) : !activeInterruptionCanTakeResponsibility ? (
                  <div className="mt-3 text-sm text-amber-800">
                    You are not a member of any responsible team for this interruption.
                  </div>
                ) : !activeInterruptionClaimedByCurrentUser ? (
                  <div className="mt-3 text-sm text-amber-800">
                    {activeInterruptionRequiresAssignment
                      ? 'Assign this interruption to yourself to continue.'
                      : activeInterruptionClaimedByOtherUser
                        ? `This interruption is currently handled by ${activeInterruptionAssignedUserId}.`
                        : 'You do not have permission to submit this interruption.'}
                  </div>
                ) : (
                  <div className="mt-4 rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {interruptionTypeLabel(activeInterruption.interruptionType)}
                    </div>

                    <div className="mt-3 space-y-3">
                      {activeInterruptionDetailElements.map((element) => {
                        const control = element.control
                        const key = `${activeInterruption.id}-${element.name}`
                        const draftValues = interruptionDraftValues[activeInterruption.id] ?? {}

                        if (control.type === 'Paragraph') {
                          return (
                            <div key={key} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                              {control.text}
                            </div>
                          )
                        }

                        if (control.type === 'TextArea') {
                          return (
                            <div key={key}>
                              <div className="mb-1 text-xs font-medium text-slate-600">{control.label || element.name}</div>
                              <Input.TextArea
                                autoSize={{ minRows: 1, maxRows: 6 }}
                                value={draftValues[element.name] ?? ''}
                                onChange={(event) => updateInterruptionDraftValue(activeInterruption.id, element.name, event.target.value)}
                              />
                            </div>
                          )
                        }

                        return (
                          <div key={key} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            Unsupported control payload for "{element.name}". Please verify backend JSON polymorphic serialization.
                          </div>
                        )
                      })}
                    </div>

                    {activeInterruptionSubmitGroups.length > 0 ? (
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        {activeInterruptionSubmitGroups.flatMap((element) => {
                          const control = element.control
                          if (control.type !== 'SubmitButtonGroup') return []
                          const groupKey = `${activeInterruption.id}-${element.name}`
                          const submitDisabled = submittingInterruptionId === activeInterruption.id || !activeInterruptionCanSubmit

                          return control.buttons.map((buttonLabel) => {
                            const ui = interruptionButtonUi(buttonLabel)
                            const button = (
                              <Button
                                key={`${groupKey}-${buttonLabel}`}
                                size="middle"
                                type={ui.type}
                                danger={ui.danger}
                                className={ui.className}
                                disabled={submitDisabled}
                                loading={submittingInterruptionId === activeInterruption.id}
                                onClick={() => handleSubmitInterruption(activeInterruption, buttonLabel)}
                              >
                                {buttonLabel}
                              </Button>
                            )

                            return ui.tooltip ? (
                              <Tooltip key={`${groupKey}-${buttonLabel}-tooltip`} title={ui.tooltip}>
                                {button}
                              </Tooltip>
                            ) : button
                          })
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              ) : null}
            </section>
          ) : null}

          <section className="bg-white">
            <div className="px-1 py-2 text-sm text-slate-600">
              Started <span className="font-medium text-slate-700">{formatRelative(startedAt)}</span> and ran for <span className="font-medium text-slate-700">{formatDuration(taskSummary?.durationSeconds)}</span>
            </div>
            <div className="px-1 py-1 space-y-0.5">
              {summaryNodes.length === 0 ? (
                <div className="px-2 py-2 text-sm text-slate-500">No activity summary available.</div>
              ) : (
                summaryNodes.map((node) => {
                  const status = finalizeNodeStatusForCompletedTask(normalizeNodeStatus(node.status), taskState)
                  const displayName = getNodeDisplayName(node)

                  return (
                    <button
                      key={node.id}
                      type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 text-left"
                      onClick={() => handleSummaryJump(node.id)}
                    >
                      {renderStatusDot(status)}
                      <span className="truncate text-sm text-slate-700">{displayName}</span>
                    </button>
                  )
                })
              )}
            </div>
          </section>

        </div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          <section className="bg-white">
            <div className="px-0 py-2 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                This task started <span className="font-medium text-slate-700">{formatRelative(startedAt)}</span> and ran for <span className="font-medium text-slate-700">{formatDuration(taskSummary?.durationSeconds)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input type="checkbox" checked={verbose} onChange={(e) => setVerbose(e.target.checked)} />
                  Verbose
                </label>
                <Button type="default" onClick={toggleAllNodes} disabled={allNodeIds.length === 0}>
                  Expand/Collapse
                </Button>
                <Button
                  type="default"
                  icon={<DownloadOutlined />}
                  disabled={taskId == null || rootNodes.length === 0}
                  onClick={() => {
                    if (taskId == null) return
                    exportTaskLogs(taskId, rootNodes)
                  }}
                >
                  Download
                </Button>
                <Select
                  value={tail}
                  style={{ width: 130 }}
                  onChange={(value) => setTail(value)}
                  options={DETAIL_TAIL_OPTIONS.map((item) => ({ label: `Tail ${item}`, value: item }))}
                />
                <Button type="default" icon={<SettingOutlined />} />
              </div>
            </div>
            <div className="px-0 py-2">
              <div className="text-sm text-slate-700">Progress: {progressPercentage}%</div>
              <div className="mt-2 h-2 rounded bg-slate-200 overflow-hidden">
                <div className="h-full bg-squid-blue transition-all" style={{ width: `${progressPercentage}%` }} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            {rootNodes.length === 0 ? (
              <div className="bg-white px-4 py-5 text-sm text-slate-500">No task activity logs available.</div>
            ) : (
              rootNodes.map((node) => renderLogBlock(node, 0, taskSummary?.durationSeconds ?? null))
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default DeploymentDetail
