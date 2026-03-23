import { axiosInstance, get, post } from 'utils/request'
import type { VariableDto } from './variableSet'

export interface ReleaseDto {
  id: number
  version: string
  channelId: number
  projectId: number
  projectVariableSetSnapshotId?: number
  projectDeploymentProcessSnapshotId?: number
  spaceId: number
  assembled: string
  lastModified?: string
  releaseNote?: string
}

export interface GetReleasesRequest {
  pageIndex?: number
  pageSize?: number
  channelId?: number
  projectId?: number
}

export interface GetReleasesResponseData {
  count: number
  releases: ReleaseDto[]
  currentDeployedReleaseIds: number[]
}

export interface CreateReleaseSelectedPackageDto {
  actionName: string
  version: string
  packageReferenceName: string
}

export interface CreateReleaseCommand {
  version: string
  channelId: number
  projectId: number
  releaseNote: string
  selectedPackages: CreateReleaseSelectedPackageDto[]
  ignoreChannelRules?: boolean
}

export async function getReleases(params?: GetReleasesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 30,
    ...(typeof params?.projectId === 'number' ? { projectId: params.projectId } : {}),
    ...(typeof params?.channelId === 'number' ? { channelId: params.channelId } : {}),
  }

  try {
    // Squid.Api endpoint
    return await get<GetReleasesResponseData>('/releases/list', { params: query })
  } catch {
    // Backward-compatible endpoint
    return get<GetReleasesResponseData>('/release', { params: query })
  }
}

export async function createRelease(command: CreateReleaseCommand) {
  return post<ReleaseDto>('/releases/create', command)
}

export interface UpdateReleaseVariablesCommand {
  releaseId: number
}

export async function updateReleaseVariables(command: UpdateReleaseVariablesCommand) {
  // Backend returns bare 200 OK (no { code, msg, data } envelope) for this endpoint.
  await axiosInstance.post('/releases/update-variables', command)
}

export interface VariableSetSnapshotDataDto {
  variables: VariableDto[]
}

export interface VariableSetSnapshotDto {
  id: number
  data: VariableSetSnapshotDataDto
  createdAt: string
  createdBy: string
}

export interface GetReleaseVariableSnapshotResponseData {
  variableSnapshot: VariableSetSnapshotDto
}

export async function getReleaseVariableSnapshot(releaseId: number) {
  return get<GetReleaseVariableSnapshotResponseData>(`/releases/${releaseId}/variable-snapshot`)
}

export type ReleaseLifecycleProgressionValue = 'Complete' | 'Current' | 'Pending'

export interface ReleaseLifecycleProgressionDeploymentDto {
  deploymentId: number
  state: string
  created: string
  completedTime: string | null
}

export interface ReleaseLifecycleProgressionEnvironmentDto {
  environmentId: number
  environmentName: string
  isAutomatic: boolean
  canDeploy: boolean
  deployment: ReleaseLifecycleProgressionDeploymentDto | null
}

export interface ReleaseLifecycleProgressionPhaseDto {
  phaseId: number
  phaseName: string
  sortOrder: number
  isComplete: boolean
  isOptional: boolean
  progress: ReleaseLifecycleProgressionValue
  environments: ReleaseLifecycleProgressionEnvironmentDto[]
}

export interface ReleaseLifecycleProgressionDto {
  releaseId: number
  releaseVersion: string
  lifecycleId: number
  lifecycleName: string
  phases: ReleaseLifecycleProgressionPhaseDto[]
}

export function getReleaseLifecycleProgression(releaseId: number) {
  return get<ReleaseLifecycleProgressionDto>(`/releases/${releaseId}/progression`)
}
