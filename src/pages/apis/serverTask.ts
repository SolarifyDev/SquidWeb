import { ApiError, axiosInstance, get, post, put } from 'utils/request'

export type DeploymentActivityLogNodeTypeValue = number | 'Task' | 'Step' | 'Action' | 'LogEntry'
export type DeploymentActivityLogNodeStatusValue = number | 'Pending' | 'Running' | 'Success' | 'Failed' | null
export type ServerTaskLogCategoryValue = number | 'Info' | 'Warning' | 'Error'

export interface ServerTaskSummaryDto {
  id: number
  name: string
  description: string
  state: string
  hasPendingInterruptions?: boolean
  HasPendingInterruptions?: boolean
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

export enum InterruptionType {
  GuidedFailure = 1,
  ManualIntervention = 2,
}

export type InterruptionFormControl =
  | { type: 'Paragraph'; text: string }
  | { type: 'TextArea'; label: string }
  | { type: 'SubmitButtonGroup'; buttons: string[] }

export interface InterruptionFormElement {
  name: string
  control: InterruptionFormControl
}

export interface InterruptionForm {
  elements: InterruptionFormElement[]
  values: Record<string, string>
}

export interface InterruptionDto {
  id: number
  serverTaskId: number
  interruptionType: InterruptionType
  stepName: string
  actionName: string
  machineName: string | null
  responsibleUserId: string | null
  isPending: boolean
  createdAt: string
  form: InterruptionForm
}

export interface GetPendingInterruptionsResponse {
  interruptions: InterruptionDto[]
}

export interface TakeResponsibilityBody {
  userId: string
}

export interface SubmitInterruptionBody {
  values: Record<string, string>
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

export function cancelServerTask(taskId: number) {
  return post<void>(`/tasks/${taskId}/cancel`)
}

export function getServerTaskInterruptions(taskId: number) {
  const normalizeInterruptionType = (value: unknown): InterruptionType => {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) {
      if (asNumber === InterruptionType.GuidedFailure) return InterruptionType.GuidedFailure
      if (asNumber === InterruptionType.ManualIntervention) return InterruptionType.ManualIntervention
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'guidedfailure' || normalized === 'guided failure') {
        return InterruptionType.GuidedFailure
      }
      if (normalized === 'manualintervention' || normalized === 'manual intervention') {
        return InterruptionType.ManualIntervention
      }
    }

    return InterruptionType.GuidedFailure
  }

  const normalizeControl = (control: any): InterruptionFormControl => {
    const type = String(control?.type ?? control?.Type ?? '')
    if (type === 'Paragraph') {
      return { type: 'Paragraph', text: String(control?.text ?? control?.Text ?? '') }
    }
    if (type === 'TextArea') {
      return { type: 'TextArea', label: String(control?.label ?? control?.Label ?? '') }
    }
    if (type === 'SubmitButtonGroup') {
      const buttonsRaw = control?.buttons ?? control?.Buttons
      return {
        type: 'SubmitButtonGroup',
        buttons: Array.isArray(buttonsRaw) ? buttonsRaw.map((item: unknown) => String(item)) : [],
      }
    }
    return { type: 'Paragraph', text: '' }
  }

  const normalizeInterruption = (item: any): InterruptionDto => {
    const rawForm = item?.form ?? item?.Form ?? {}
    const rawElements = rawForm?.elements ?? rawForm?.Elements ?? []
    const rawValues = rawForm?.values ?? rawForm?.Values ?? {}

    return {
      id: Number(item?.id ?? item?.Id ?? 0),
      serverTaskId: Number(item?.serverTaskId ?? item?.ServerTaskId ?? 0),
      interruptionType: normalizeInterruptionType(item?.interruptionType ?? item?.InterruptionType),
      stepName: String(item?.stepName ?? item?.StepName ?? ''),
      actionName: String(item?.actionName ?? item?.ActionName ?? ''),
      machineName: item?.machineName ?? item?.MachineName ?? null,
      responsibleUserId: item?.responsibleUserId ?? item?.ResponsibleUserId ?? null,
      isPending: Boolean(item?.isPending ?? item?.IsPending ?? false),
      createdAt: String(item?.createdAt ?? item?.CreatedAt ?? ''),
      form: {
        elements: Array.isArray(rawElements)
          ? rawElements.map((element: any): InterruptionFormElement => ({
            name: String(element?.name ?? element?.Name ?? ''),
            control: normalizeControl(element?.control ?? element?.Control ?? {}),
          }))
          : [],
        values: rawValues && typeof rawValues === 'object' ? Object.fromEntries(
          Object.entries(rawValues).map(([key, value]) => [key, String(value ?? '')]),
        ) : {},
      },
    }
  }

  const pickInterruptions = (value: any): InterruptionDto[] => {
    if (Array.isArray(value)) return value.map(normalizeInterruption)
    if (!value || typeof value !== 'object') return []
    const interruptions = (value as any).interruptions ?? (value as any).Interruptions
    return Array.isArray(interruptions) ? interruptions.map(normalizeInterruption) : []
  }

  return axiosInstance
    .get(`/tasks/${taskId}/interruptions`)
    .then((res) => {
      const body = res.data as any

      // Standard wrapped contract: { code, msg, data }
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && 'data' in body) {
        if (body.code !== 200) {
          throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
        }
        const interruptions = pickInterruptions(body.data)
        if (interruptions.length > 0 || (body.data && typeof body.data === 'object')) {
          return { interruptions } as GetPendingInterruptionsResponse
        }
        return { interruptions: [] } as GetPendingInterruptionsResponse
      }

      // GlobalExceptionFilter fallback shape: { code, msg } (without data)
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && !('data' in body) && !('interruptions' in body) && !('Interruptions' in body)) {
        throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
      }

      // Flat contract: { code, msg, interruptions }
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && 'interruptions' in body) {
        if (body.code !== 200) {
          throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
        }
        return { interruptions: pickInterruptions(body) } as GetPendingInterruptionsResponse
      }

      // Flat PascalCase contract: { code, msg, Interruptions }
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && 'Interruptions' in body) {
        if (body.code !== 200) {
          throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
        }
        return { interruptions: pickInterruptions(body) } as GetPendingInterruptionsResponse
      }

      // Raw model: { interruptions: [...] }
      if (body && typeof body === 'object' && 'interruptions' in body) {
        return { interruptions: pickInterruptions(body) } as GetPendingInterruptionsResponse
      }

      // Raw PascalCase model: { Interruptions: [...] }
      if (body && typeof body === 'object' && 'Interruptions' in body) {
        return { interruptions: pickInterruptions(body) } as GetPendingInterruptionsResponse
      }

      throw new Error('Unexpected interruptions response format.')
    })
}

export function takeInterruptionResponsibility(interruptionId: number, body: TakeResponsibilityBody) {
  return put<void, TakeResponsibilityBody>(`/interruptions/${interruptionId}/responsible`, body)
}

export function submitInterruption(interruptionId: number, body: SubmitInterruptionBody) {
  return post<void, SubmitInterruptionBody>(`/interruptions/${interruptionId}/submit`, body)
}
