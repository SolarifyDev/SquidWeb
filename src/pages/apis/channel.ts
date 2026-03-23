import { get, post } from 'utils/request'

export interface ChannelActionPackageDto {
  actionName?: string | null
  packageReferenceName?: string | null
  deploymentAction?: string | null
  packageReference?: string | null
}

export interface ChannelVersionRuleDto {
  id?: number
  channelId?: number
  actionNames?: string | null
  actionName?: string | null
  packageReferenceName?: string | null
  packageId?: string | null
  versionRange?: string | null
  preReleaseTag?: string | null
  sortOrder?: number
  actionPackage?: ChannelActionPackageDto | null
}

export interface ChannelDto {
  id: number
  name: string
  description: string
  projectId: number
  lifecycleId: number | null
  spaceId: number
  slug: string
  isDefault: boolean
  versionRules?: ChannelVersionRuleDto[]
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

export async function getChannel(id: number) {
  try {
    return await get<ChannelDto>(`/channels/${id}`)
  } catch {
    return get<ChannelDto>(`/channel/${id}`)
  }
}

export async function getChannelVersionRules(channelId: number) {
  try {
    return await get<ChannelVersionRuleDto[]>(`/channels/${channelId}/rules`)
  } catch {
    try {
      return await get<ChannelVersionRuleDto[]>(`/channel/${channelId}/rules`)
    } catch {
      return []
    }
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
