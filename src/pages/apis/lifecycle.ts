import { get, post } from 'utils/request'

export interface LifecycleDto {
  id: number
  name: string
  slug: string
  description: string
  spaceId: number
  json: string
  lastModifiedOn: string | null
  lastModifiedBy: string
}

export interface GetLifecyclesResponseData {
  count: number
  lifecycles: LifecycleDto[]
}

export interface GetLifecyclesRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
  spaceId?: number
}

export function getLifecycles(params?: GetLifecyclesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 100,
    keyword: params?.keyword,
  }

  return get<{ count: number; lifeCycles: LifecyclePhaseDto[] }>('/lifecycles/list', { params: query })
    .then((res) => ({
      count: res.count ?? 0,
      lifecycles: (res.lifeCycles ?? []).map((item) => ({
        id: item.lifecycle.id,
        name: item.lifecycle.name,
        slug: item.lifecycle.slug ?? '',
        description: '',
        spaceId: item.lifecycle.spaceId,
        json: JSON.stringify({
          phases: (item.phases ?? []).map((p) => ({
            name: p.name,
            isOptionalPhase: p.isOptionalPhase,
          })),
        }),
        lastModifiedOn: null,
        lastModifiedBy: '',
      })),
    }))
}

// ── Create / Update ───────────────────────────────────────────────────────────

export interface RetentionPolicyDto {
  shouldKeepForever: boolean
  quantityToKeep: number
  unit: string  // 'Days' | 'Releases' | 'Items'
}

export interface LifecycleSummaryDto {
  id: number
  name: string
  description: string
  spaceId: number
  slug?: string
  dataVersion?: number[] | null
  releaseRetentionPolicyId?: number
  tentacleRetentionPolicyId?: number
  releaseRetentionPolicy: RetentionPolicyDto
  tentacleRetentionPolicy: RetentionPolicyDto
}

export interface PhaseDto {
  id: number
  lifecycleId: number
  name: string
  automaticDeploymentTargets: string[]
  optionalDeploymentTargets: string[]
  minimumEnvironmentsBeforePromotion: number
  isOptionalPhase: boolean
  isPriorityPhase: boolean
  releaseRetentionPolicyId: number
  tentacleRetentionPolicyId: number
}

export interface LifecyclePhaseDto {
  lifecycle: LifecycleSummaryDto
  phases: PhaseDto[]
}

export interface CreateLifecycleCommand {
  lifecyclePhase: LifecyclePhaseDto
}

export function createLifecycle(command: CreateLifecycleCommand) {
  return post<{ lifecyclePhase: LifecyclePhaseDto }>('/lifecycles/create', command)
    .then((res) => res.lifecyclePhase)
}
