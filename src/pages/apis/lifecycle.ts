import { get, post } from 'utils/request'

export type RetentionPolicyUnit = 0 | 1 | 2 | 3

export interface LifecycleSummaryDto {
  id: number
  name: string
  description?: string | null
  dataVersion?: number[] | null
  spaceId: number
  slug: string
  releaseRetentionUnit: RetentionPolicyUnit
  releaseRetentionQuantity: number
  releaseRetentionKeepForever: boolean
  tentacleRetentionUnit: RetentionPolicyUnit
  tentacleRetentionQuantity: number
  tentacleRetentionKeepForever: boolean
}

export interface LifecyclePhaseDto {
  id: number
  lifecycleId: number
  name: string
  sortOrder: number
  automaticDeploymentTargetIds: number[]
  optionalDeploymentTargetIds: number[]
  minimumEnvironmentsBeforePromotion: number
  isOptionalPhase: boolean
  isPriorityPhase: boolean
  releaseRetentionUnit?: RetentionPolicyUnit | null
  releaseRetentionQuantity?: number | null
  releaseRetentionKeepForever?: boolean | null
  tentacleRetentionUnit?: RetentionPolicyUnit | null
  tentacleRetentionQuantity?: number | null
  tentacleRetentionKeepForever?: boolean | null
}

export interface LifecycleDetailDto {
  lifecycle: LifecycleSummaryDto
  phases: LifecyclePhaseDto[]
}

export interface LifecycleDto {
  id: number
  name: string
  slug: string
  description: string | null
  spaceId: number
  json: string
  lastModifiedOn: string | null
  lastModifiedBy: string
  phases: LifecyclePhaseDto[]
  lifecycle: LifecycleSummaryDto
}

export interface GetLifecyclesResponseData {
  count: number
  lifecycles: LifecycleDto[]
}

export interface GetLifecyclesRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export function getLifecycles(params?: GetLifecyclesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 100,
    ...(params?.keyword ? { keyword: params.keyword } : {}),
  }

  return get<{ count: number; lifeCycles: LifecycleDetailDto[] }>('/lifecycles/list', { params: query })
    .then((res) => ({
      count: res.count ?? 0,
      lifecycles: (res.lifeCycles ?? []).map((item) => {
        const phases = item.phases ?? []
        return {
          id: item.lifecycle?.id ?? 0,
          name: item.lifecycle?.name ?? '',
          slug: item.lifecycle?.slug ?? '',
          description: item.lifecycle?.description ?? null,
          spaceId: item.lifecycle?.spaceId ?? 0,
          json: JSON.stringify({
            phases: phases.map((p) => ({
              name: p.name,
              isOptionalPhase: p.isOptionalPhase,
            })),
          }),
          lastModifiedOn: null,
          lastModifiedBy: '',
          phases,
          lifecycle: item.lifecycle,
        }
      }),
    }))
}

// ── Create / Update ───────────────────────────────────────────────────────────

export interface CreateLifecycleCommand {
  lifecyclePhase: LifecycleDetailDto
}

export function createLifecycle(command: CreateLifecycleCommand) {
  return post<{ lifecyclePhase: LifecycleDetailDto }>('/lifecycles/create', command)
    .then((res) => res.lifecyclePhase)
}

export interface UpdateLifecycleCommand {
  lifecyclePhase: LifecycleDetailDto
}

export function updateLifecycle(command: UpdateLifecycleCommand) {
  return post<{ lifecyclePhase: LifecycleDetailDto }>('/lifecycles/update', command)
    .then((res) => res.lifecyclePhase)
}

export function deleteLifecycles(ids: number[]) {
  return post<{ failIds: number[] }>('/lifecycles/delete', { ids })
    .then((res) => res.failIds ?? [])
}
