import { ApiError, get, post } from 'utils/request'
import type { DeploymentProcessDto } from 'pages/apis/deploymentProcess'

export interface RunbookDto {
  id: number
  projectId: number
  spaceId: number
  name: string
  description: string
  tags: string[]
  processId: number
  variableSetId: number
  createdDate: string
  createdBy: number
  lastModifiedDate: string
  lastModifiedBy: number
}

export interface GetRunbooksRequest {
  projectId: number
  spaceId?: number
  pageIndex?: number
  pageSize?: number
}

export interface GetRunbooksResponseData {
  count: number
  runbooks: RunbookDto[]
}

export interface RunbookMetadataInput {
  name: string
  description?: string
  tags?: string[]
}

export interface CreateRunbookCommand {
  projectId: number
  spaceId: number
  name: string
  description?: string
  tags?: string[]
}

export interface UpdateRunbookCommand {
  id: number
  projectId: number
  spaceId?: number
  name: string
  description?: string
  tags?: string[]
}

export interface CopyRunbookCommand {
  sourceRunbookId: number
  projectId: number
  spaceId?: number
  name?: string
}

export interface DeleteRunbookCommand {
  id: number
  projectId: number
  spaceId?: number
}

export interface RunbookApiErrorDetails {
  message: string
  validationCode?: string
  validationField?: string
  missingPermission?: string
}

function normalizeMetadata(input: RunbookMetadataInput) {
  return {
    Name: input.name.trim(),
    Description: input.description?.trim() ?? '',
    Tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  }
}

export function getRunbooks(params: GetRunbooksRequest) {
  return get<GetRunbooksResponseData>('/runbooks/list', {
    params: {
      projectId: params.projectId,
      spaceId: params.spaceId,
      pageIndex: params.pageIndex ?? 1,
      pageSize: params.pageSize ?? 100,
    },
  })
}

export function getRunbook(id: number, projectId: number, spaceId?: number) {
  return get<RunbookDto>(`/runbooks/detail/${id}`, {
    params: { projectId, spaceId },
  })
}

export function createRunbook(command: CreateRunbookCommand) {
  return post<RunbookDto>('/runbooks/create', {
    Runbook: {
      ProjectId: command.projectId,
      SpaceId: command.spaceId,
      ...normalizeMetadata(command),
    },
  })
}

export function updateRunbook(command: UpdateRunbookCommand) {
  return post<RunbookDto>('/runbooks/update', {
    Id: command.id,
    ProjectId: command.projectId,
    SpaceId: command.spaceId,
    Runbook: normalizeMetadata(command),
  })
}

export function copyRunbook(command: CopyRunbookCommand) {
  return post<RunbookDto>('/runbooks/copy', {
    SourceRunbookId: command.sourceRunbookId,
    ProjectId: command.projectId,
    SpaceId: command.spaceId,
    Name: command.name?.trim() ?? '',
  })
}

export function deleteRunbook(command: DeleteRunbookCommand) {
  return post<{ id: number }>('/runbooks/delete', {
    Id: command.id,
    ProjectId: command.projectId,
    SpaceId: command.spaceId,
  })
}

export function getRunbookOwnedProcess(
  runbookId: number,
  processId: number,
  projectId: number,
  spaceId?: number,
) {
  return get<{ deploymentProcess: DeploymentProcessDto }>(
    `/deployment-processes/detail/${processId}`,
    {
      params: { projectId, runbookId, spaceId },
    },
  ).then((response) => response.deploymentProcess)
}

export function getRunbookApiErrorDetails(error: unknown): RunbookApiErrorDetails {
  const apiError = error instanceof ApiError ? error : null
  const raw = apiError?.raw
    ?? (error as { response?: { data?: unknown } } | null)?.response?.data
    ?? (error as { raw?: unknown } | null)?.raw
    ?? error

  const payload = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const message = String(
    payload.msg
      ?? payload.message
      ?? apiError?.message
      ?? (error instanceof Error ? error.message : '')
      ?? 'Request failed',
  ).trim()

  return {
    message: message || 'Request failed',
    validationCode: typeof payload.validationCode === 'string' ? payload.validationCode : undefined,
    validationField: typeof payload.validationField === 'string' ? payload.validationField : undefined,
    missingPermission: typeof payload.missingPermission === 'string' ? payload.missingPermission : undefined,
  }
}
