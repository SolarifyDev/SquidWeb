import { get } from 'utils/request'

export interface ExternalFeedDto {
  id: number
  feedType: string
  apiVersion: string
  registryPath: string
  feedUri: string
  username: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  spaceId: number
}

export interface GetExternalFeedsRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetExternalFeedsResponseData {
  count: number
  externalFeeds: ExternalFeedDto[]
}

export function getExternalFeeds(params?: GetExternalFeedsRequest) {
  return get<GetExternalFeedsResponseData>('/externalfeed', { params })
}
