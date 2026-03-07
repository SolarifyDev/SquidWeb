import { get, post } from 'utils/request'

export interface ChannelDto {
  id: number
  name: string
  description: string
  projectId: number
  lifecycleId: number | null
  spaceId: number
  slug: string
  isDefault: boolean
}

export interface GetChannelsRequest {
  pageIndex?: number
  pageSize?: number
  projectId?: number
  keyword?: string
}

export interface GetChannelsResponseData {
  count: number
  channels: ChannelDto[]
}

export interface UpdateChannelCommand {
  id: number
  channel: ChannelDto
}

export async function getChannels(params?: GetChannelsRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.keyword ? { keyword: params.keyword } : {}),
    ...(typeof params?.projectId === 'number' ? { projectId: params.projectId } : {}),
  }

  try {
    // Squid.Api endpoint
    return await get<GetChannelsResponseData>('/channels/list', { params: query })
  } catch {
    // Backward-compatible endpoint
    return get<GetChannelsResponseData>('/channel', { params: query })
  }
}

export async function updateChannel(command: UpdateChannelCommand) {
  try {
    const res = await post<ChannelDto | { channel: ChannelDto }>('/channels/update', command)
    if (res && typeof res === 'object' && 'channel' in res) {
      return (res as { channel: ChannelDto }).channel
    }
    return res as ChannelDto
  } catch {
    const res = await post<ChannelDto | { channel: ChannelDto }>('/channel/update', command)
    if (res && typeof res === 'object' && 'channel' in res) {
      return (res as { channel: ChannelDto }).channel
    }
    return res as ChannelDto
  }
}
