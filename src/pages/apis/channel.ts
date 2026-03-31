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
  projectId: number
  pageSize?: number
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

export async function getChannels(params: GetChannelsRequest) {
  const query = {
    projectId: params.projectId,
    ...(typeof params.pageSize === 'number' ? { pageSize: params.pageSize } : {}),
    ...(params.keyword ? { keyword: params.keyword } : {}),
  }
  return get<GetChannelsResponseData>('/channels/list', { params: query })
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
