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
  projectId?: number
  keyword?: string
}

export interface GetChannelsResponseData {
  count: number
  channels: ChannelDto[]
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
