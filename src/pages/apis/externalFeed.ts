import { get, post } from 'utils/request'

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
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
  }

  return get<GetExternalFeedsResponseData>('/external-feeds/list', { params: query })
}

export interface CreateExternalFeedCommand {
  feedType: string
  apiVersion: string
  registryPath: string
  feedUri: string
  username: string
  password: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  spaceId: number
}

export function createExternalFeed(command: CreateExternalFeedCommand) {
  return post<{ externalFeed: ExternalFeedDto }>('/external-feeds/create', command)
    .then((res) => res.externalFeed)
}

export interface UpdateExternalFeedCommand {
  id: number
  feedType: string
  apiVersion: string
  registryPath: string
  feedUri: string
  username: string
  password: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  spaceId: number
}

export function updateExternalFeed(command: UpdateExternalFeedCommand) {
  return post<{ externalFeed: ExternalFeedDto }>('/external-feeds/update', command)
    .then((res) => res.externalFeed)
}

export interface TestExternalFeedResult {
  success: boolean
  message?: string
}

export function testExternalFeed(id: number) {
  return post<TestExternalFeedResult>('/external-feeds/test', { id })
}
