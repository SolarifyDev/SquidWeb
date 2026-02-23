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
  spaceId?: number
}

export function getLifecycles(params?: GetLifecyclesRequest) {
  return get<GetLifecyclesResponseData>('/lifecycle', { params })
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
  return post<LifecyclePhaseDto>('/lifecycle', command)
}
