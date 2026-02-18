import { get } from 'utils/request'

export interface ChannelDto {
  id: number
  name: string
  description: string
  projectId: number
  lifecycleId: number
  spaceId: number
  slug: string
  isDefault: boolean
}

export interface GetChannelsRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetChannelsResponseData {
  count: number
  channels: ChannelDto[]
}

export function getChannels(params?: GetChannelsRequest) {
  return get<GetChannelsResponseData>('/channel', { params })
}
