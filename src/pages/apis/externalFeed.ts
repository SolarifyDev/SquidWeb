import { get, post } from 'utils/request'

export type ExternalFeedProperties = Record<string, string> | null

export interface ExternalFeedDto {
  id: number
  feedType: string
  feedUri: string
  username: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  passwordHasValue?: boolean
  properties?: ExternalFeedProperties
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
  feedUri: string
  username: string
  password: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  properties?: ExternalFeedProperties
  spaceId: number
}

export function createExternalFeed(command: CreateExternalFeedCommand) {
  return post<{ externalFeed: ExternalFeedDto }>('/external-feeds/create', command)
    .then((res) => res.externalFeed)
}

export interface UpdateExternalFeedCommand {
  id: number
  feedType: string
  feedUri: string
  username: string
  passwordNewValue?: string
  name: string
  slug: string
  packageAcquisitionLocationOptions: string[]
  properties?: ExternalFeedProperties
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

export function deleteExternalFeed(id: number) {
  return post<void>('/external-feeds/delete', { ids: [id] })
    .catch(() => {
      return post<void>('/external-feeds/delete', { id })
    })
}

export interface SearchExternalFeedPackagesRequest {
  feedId: number
  query: string
  take?: number
}

export interface SearchExternalFeedPackagesResponseData {
  packages: string[]
}

export function searchExternalFeedPackages(params: SearchExternalFeedPackagesRequest) {
  const query = {
    feedId: params.feedId,
    query: params.query,
    take: params.take ?? 20,
  }

  return get<SearchExternalFeedPackagesResponseData>('/external-feeds/search-packages', { params: query })
}

export interface ListExternalFeedPackageVersionsRequest {
  feedId: number
  packageId: string
  take?: number
  includePreRelease?: boolean
  filter?: string
}

export interface ListExternalFeedPackageVersionsResponseData {
  versions: string[]
}

export function listExternalFeedPackageVersions(params: ListExternalFeedPackageVersionsRequest) {
  const filter = params.filter?.trim()
  const query = {
    feedId: params.feedId,
    packageId: params.packageId,
    take: params.take ?? 30,
    includePreRelease: params.includePreRelease ?? false,
    ...(filter ? { filter } : {}),
  }

  return get<ListExternalFeedPackageVersionsResponseData>('/external-feeds/package-versions', { params: query })
}
