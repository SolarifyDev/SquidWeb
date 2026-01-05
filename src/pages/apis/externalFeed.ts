import { get, post, put, del } from 'utils/request'

export interface ExternalFeedDto {
  id: number
  feedType: string | null
  apiVersion: string | null
  registryPath: string | null
  feedUri: string | null
  username: string | null
  passwordHasValue: boolean
  name: string | null
  slug: string | null
  packageAcquisitionLocationOptions: string[] | null
  spaceId: number
  lastModifiedOn: string | null
  lastModifiedBy: string | null
}

export interface GetExternalFeedsRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetExternalFeedsResponseData {
  count: number
  externalFeeds: ExternalFeedDto[]
}

export function GetExternalFeeds(params?: GetExternalFeedsRequest) {
  return get<GetExternalFeedsResponseData>('/ExternalFeed', { params })
}

export interface CreateExternalFeedCommand {
  feedType: string | null
  apiVersion: string | null
  registryPath: string | null
  feedUri: string | null
  username: string | null
  password: string | null
  name: string | null
  slug: string | null
  packageAcquisitionLocationOptions: string[] | null
  spaceId: number
}

export interface CreateExternalFeedResponseData {
  externalFeed: ExternalFeedDto
}

export function CreateExternalFeed(command: CreateExternalFeedCommand) {
  return post<CreateExternalFeedResponseData, CreateExternalFeedCommand>('/ExternalFeed', command)
}

export interface UpdateExternalFeedCommand {
  id: number
  feedType: string | null
  apiVersion: string | null
  registryPath: string | null
  feedUri: string | null
  username: string | null
  passwordNewValue: string | null
  name: string | null
  slug: string | null
  packageAcquisitionLocationOptions: string[] | null
  spaceId: number
}

export interface UpdateExternalFeedResponseData {
  externalFeed: ExternalFeedDto
}

export function UpdateExternalFeed(command: UpdateExternalFeedCommand) {
  return put<UpdateExternalFeedResponseData, UpdateExternalFeedCommand>('/ExternalFeed', command)
}

export interface DeleteExternalFeedsCommand {
  ids: number[]
}

export interface DeleteExternalFeedsResponseData {
  failIds: number[]
}

export function DeleteExternalFeeds(command: DeleteExternalFeedsCommand) {
  return del<DeleteExternalFeedsResponseData>('/ExternalFeed', { data: command })
}
