import { get, post, put, del } from 'utils/request'

// 对应后端 ChannelDto
export interface ChannelDto {
  id: number
  name: string | null
  description: string | null
  projectId: number
  lifecycleId: number
  dataVersion: string | null
  spaceId: number
  slug: string | null
  isDefault: boolean
}

export interface GetChannelsRequest {
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export interface GetChannelsResponseData {
  count: number
  channels: ChannelDto[]
}

export function GetChannels(params?: GetChannelsRequest) {
  return get<GetChannelsResponseData>('/Channel', { params })
}

export interface CreateChannelCommand {
  channel: ChannelDto
}

export function CreateChannel(command: CreateChannelCommand) {
  return post<ChannelDto, CreateChannelCommand>('/Channel', command)
}

export interface UpdateChannelCommand {
  channel: ChannelDto
}

export function UpdateChannel(command: UpdateChannelCommand) {
  return put<ChannelDto, UpdateChannelCommand>('/Channel', command)
}

export interface DeleteChannelsCommand {
  ids: number[]
}

export interface DeleteChannelsResponseData {
  failIds: number[]
}

export function DeleteChannels(command: DeleteChannelsCommand) {
  return del<DeleteChannelsResponseData>('/Channel', { data: command })
}
