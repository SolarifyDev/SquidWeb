import { get, post } from 'utils/request'

export interface UserDto {
  id: number
  userName: string
  displayName: string
  isSystem?: boolean
  isActive?: boolean
  isDisabled?: boolean
  isService?: boolean
  emailAddress?: string | null
}

export interface GetUsersRequest {
  pageIndex?: number
  pageSize?: number
}

export interface GetUsersResponseData {
  users: UserDto[]
}

export interface CreateUserCommand {
  userName: string
  password: string
  displayName?: string
}

function toUserDto(raw: any): UserDto | null {
  const id = Number(raw?.id ?? raw?.userId)
  if (!Number.isFinite(id) || id <= 0) return null
  const userName = String(raw?.userName ?? raw?.username ?? '').trim()
  const displayNameSource = raw?.displayName ?? raw?.name ?? userName ?? ''
  const displayName = String(displayNameSource).trim()

  return {
    id,
    userName: userName || `Users-${id}`,
    displayName: displayName || userName || `Users-${id}`,
    isSystem: typeof raw?.isSystem === 'boolean' ? raw.isSystem : undefined,
    isActive:
      typeof raw?.isActive === 'boolean'
        ? raw.isActive
        : typeof raw?.isDisabled === 'boolean'
          ? !raw.isDisabled
          : undefined,
    isDisabled:
      typeof raw?.isDisabled === 'boolean'
        ? raw.isDisabled
        : typeof raw?.isActive === 'boolean'
          ? !raw.isActive
          : undefined,
    isService: typeof raw?.isService === 'boolean' ? raw.isService : undefined,
    emailAddress: raw?.emailAddress ?? raw?.email ?? null,
  }
}

function extractUsers(payload: any): UserDto[] {
  const directArray = Array.isArray(payload) ? payload : null
  const candidates = [
    directArray,
    payload?.users,
    payload?.userAccounts,
    payload?.items,
    payload?.list,
    payload?.data,
  ]
  const array = candidates.find((entry) => Array.isArray(entry))
  if (!Array.isArray(array)) return []

  const mapped = array.map(toUserDto).filter((item): item is UserDto => item != null)
  const dedup = new Map<number, UserDto>()
  for (const user of mapped) dedup.set(user.id, user)
  return Array.from(dedup.values())
}

export async function getUsers(params?: GetUsersRequest): Promise<GetUsersResponseData> {
  const query = {
    ...(params?.pageIndex != null ? { pageIndex: params.pageIndex } : {}),
    ...(params?.pageSize != null ? { pageSize: params.pageSize } : {}),
  }

  const data = await get<any>('/users/list', { params: query })
  return { users: extractUsers(data) }
}

export async function createUser(command: CreateUserCommand): Promise<UserDto> {
  const data = await post<any, CreateUserCommand>('/users/create', command)
  const candidates = [data?.userAccount, data?.user, data]

  for (const candidate of candidates) {
    const mapped = toUserDto(candidate)
    if (mapped) return mapped
  }

  throw new Error('Invalid create user response')
}
