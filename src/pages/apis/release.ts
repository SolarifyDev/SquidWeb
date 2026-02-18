import { get } from 'utils/request'

export interface ReleaseDto {
  id: number
  version: string
  channelId: number
  projectId: number
  releaseNote: string
  spaceId: number
  assembled: string
  lastModifiedOn: string | null
  lastModifiedBy: string
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

export function getReleases(params?: GetReleasesRequest) {
  return get<GetReleasesResponseData>('/release', { params })
}
