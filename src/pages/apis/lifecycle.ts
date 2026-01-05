import { get, post, put, del } from 'utils/request'

export enum RetentionPolicyUnit {
  Items = 0,
  Days = 1,
  Weeks = 2,
  Months = 3,
}

export interface RetentionPolicyDto {
  id: number
  unit: RetentionPolicyUnit
  quantityToKeep: number
  shouldKeepForever: boolean
}

export interface LifeCycleDto {
  id: number
  name: string | null
  dataVersion: string | null
  spaceId: number
  slug: string | null
  releaseRetentionPolicyId: number
  tentacleRetentionPolicyId: number
  releaseRetentionPolicy: RetentionPolicyDto
  tentacleRetentionPolicy: RetentionPolicyDto
}

export interface PhaseDto {
  id: number
  lifecycleId: number
  name: string | null
  automaticDeploymentTargets: string[] | null
  optionalDeploymentTargets: string[] | null
  minimumEnvironmentsBeforePromotion: number
  isOptionalPhase: boolean
  isPriorityPhase: boolean
  releaseRetentionPolicyId: number
  tentacleRetentionPolicyId: number
  releaseRetentionPolicy: RetentionPolicyDto
  tentacleRetentionPolicy: RetentionPolicyDto
}

export interface LifecyclePhaseDto {
  lifecycle: LifeCycleDto
  phases: PhaseDto[]
}

export interface GetLifeCyclesRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export interface GetLifeCycleResponseData {
  count: number
  lifeCycles: LifecyclePhaseDto[]
}

export function GetLifeCycles(params?: GetLifeCyclesRequest) {
  return get<GetLifeCycleResponseData>('/LifeCycle', { params })
}

export interface CreateLifeCycleCommand {
  lifecyclePhase: LifecyclePhaseDto
}

export interface CreateLifeCycleResponseData {
  lifecyclePhase: LifecyclePhaseDto
}

export function CreateLifeCycle(command: CreateLifeCycleCommand) {
  return post<CreateLifeCycleResponseData, CreateLifeCycleCommand>('/LifeCycle', command)
}

export interface UpdateLifeCycleCommand {
  lifecyclePhase: LifecyclePhaseDto
}

export interface UpdateLifeCycleResponseData {
  lifecyclePhase: LifecyclePhaseDto
}

export function UpdateLifeCycle(command: UpdateLifeCycleCommand) {
  return put<UpdateLifeCycleResponseData, UpdateLifeCycleCommand>('/LifeCycle', command)
}

export interface DeleteLifeCyclesCommand {
  ids: number[]
}

export interface DeleteLifeCyclesResponseData {
  failIds: number[]
}

export function DeleteLifeCycles(command: DeleteLifeCyclesCommand) {
  return del<DeleteLifeCyclesResponseData>('/LifeCycle', { data: command })
}
