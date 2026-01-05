import { get, post, put, del } from 'utils/request'

export interface ReleaseDto {
  id: number
  version: string | null
  assembled: string
  projectId: number
  projectVariableSetSnapshotId: number
  projectDeploymentProcessSnapshotId: number
  channelId: number
  dataVersion: string | null
  spaceId: number
  lastModified: string
}

export interface CreateReleaseSelectedPackageDto {
  actionName: string | null
  version: string | null
  packageReferenceName: string | null
}

export interface CreateReleaseCommand {
  version: string | null
  channelId: number
  projectId: number
  releaseNote: string | null
  selectedPackages: CreateReleaseSelectedPackageDto
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

export function GetReleases(params?: GetReleasesRequest) {
  return get<GetReleasesResponseData>('/Release', { params })
}

export function CreateRelease(command: CreateReleaseCommand) {
  return post<ReleaseDto, CreateReleaseCommand>('/Release', command)
}

export interface UpdateReleaseCommand {
  release: ReleaseDto
}

export function UpdateRelease(command: UpdateReleaseCommand) {
  return put<ReleaseDto, UpdateReleaseCommand>('/Release', command)
}

export interface DeleteReleaseCommand {
  releaseId: number
}

export function DeleteRelease(command: DeleteReleaseCommand) {
  return del<void>('/Release', { data: command })
}

export interface UpdateReleaseVariableCommand {
  releaseId: number
}

export function UpdateReleaseVariable(command: UpdateReleaseVariableCommand) {
  return put<void, UpdateReleaseVariableCommand>('/Release/variable', command)
}
