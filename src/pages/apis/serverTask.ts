import { get } from 'utils/request'

export type DeploymentActivityLogNodeTypeValue = number | 'Task' | 'Step' | 'Action' | 'LogEntry'
export type DeploymentActivityLogNodeStatusValue = number | 'Pending' | 'Running' | 'Success' | 'Failed' | null
export type ServerTaskLogCategoryValue = number | 'Info' | 'Warning' | 'Error'

export interface ServerTaskSummaryDto {
  id: number
  name: string
  description: string
  state: string
  queueTime: string
  startTime: string | null
  completedTime: string | null
  lastModified: string
  errorMessage: string | null
  hasWarningsOrErrors: boolean
  spaceId: number | null
  projectId: number
  environmentId: number
  durationSeconds: number
}

export interface ServerTaskProgressDto {
  progressPercentage: number
  estimatedTimeRemaining: string | null
}

export interface ServerTaskLogElementDto {
  id: number
  sequenceNumber: number
  category: ServerTaskLogCategoryValue
  messageText: string
  detail: string | null
  source: string | null
  occurredAt: string
}

export interface ServerTaskActivityNodeDto {
  id: number
  parentId: number | null
  name: string
  nodeType: DeploymentActivityLogNodeTypeValue
  status: DeploymentActivityLogNodeStatusValue
  startedAt: string
  endedAt: string | null
  sortOrder: number
  logElements: ServerTaskLogElementDto[]
  children: ServerTaskActivityNodeDto[]
}

export interface ServerTaskDetailsDto {
  task: ServerTaskSummaryDto
  activityLogs: ServerTaskActivityNodeDto[]
  physicalLogSize: number
  progress: ServerTaskProgressDto
}

export interface ServerTaskLogPageDto {
  items: ServerTaskLogElementDto[]
  hasMore: boolean
  lastSequenceNumber: number | null
  nextAfterSequenceNumber: number | null
}

export interface GetServerTaskDetailsParams {
  verbose?: boolean
  tail?: number
}

export interface GetServerTaskLogsParams {
  afterSequenceNumber?: number
  take?: number
}

export function getServerTask(taskId: number) {
  return get<ServerTaskSummaryDto>(`/tasks/${taskId}`)
}

export function getServerTaskDetails(taskId: number, params?: GetServerTaskDetailsParams) {
  return get<ServerTaskDetailsDto>(`/tasks/${taskId}/details`, { params })
}

export function getServerTaskLogs(taskId: number, params?: GetServerTaskLogsParams) {
  return get<ServerTaskLogPageDto>(`/tasks/${taskId}/logs`, { params })
}

export function getServerTaskNodeLogs(taskId: number, nodeId: number, params?: GetServerTaskLogsParams) {
  return get<ServerTaskLogPageDto>(`/tasks/${taskId}/nodes/${nodeId}/logs`, { params })
}
