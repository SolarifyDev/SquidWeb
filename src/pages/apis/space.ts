import { get, post } from 'utils/request'

export interface SpaceDto {
  id: number
  name: string
  slug: string
  description?: string
  isDefault: boolean
  taskQueueStopped?: boolean
  isPrivate?: boolean
}

export interface SpaceManagerTeamDto {
  teamId: number
  teamName: string
}

export interface SpaceManagerUserDto {
  userId: number
  userName: string
  displayName: string
}

export interface SpaceManagersDto {
  teams: SpaceManagerTeamDto[]
  users: SpaceManagerUserDto[]
}

export interface CreateSpaceCommand {
  name: string
  slug?: string
  description?: string
  isPrivate?: boolean
  ownerTeamIds?: number[]
  ownerUserIds?: number[]
}

export interface UpdateSpaceCommand {
  id: number
  name: string
  slug?: string
  description?: string
  taskQueueStopped?: boolean
  isPrivate?: boolean
  ownerTeamIds?: number[]
  ownerUserIds?: number[]
}

export interface DeleteSpaceCommand {
  id: number
}

function mapSpace(raw: any): SpaceDto | null {
  const id = Number(raw?.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    name: String(raw?.name ?? '').trim(),
    slug: String(raw?.slug ?? `Spaces-${id}`).trim() || `Spaces-${id}`,
    description: typeof raw?.description === 'string' ? raw.description : undefined,
    isDefault: Boolean(raw?.isDefault),
    taskQueueStopped: typeof raw?.taskQueueStopped === 'boolean' ? raw.taskQueueStopped : undefined,
    isPrivate: typeof raw?.isPrivate === 'boolean' ? raw.isPrivate : undefined,
  }
}

function normalizeSpaces(payload: any): SpaceDto[] {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.spaces)
      ? payload.spaces
      : []
  return source
    .map((raw: any) => mapSpace(raw))
    .filter((space: SpaceDto | null): space is SpaceDto => space != null)
}

function shouldTryNextSpaceRoute(error: unknown): boolean {
  const status = (error as any)?.response?.status ?? (error as any)?.status
  return status === 400 || status === 404 || status === 405 || status === 415 || status === 422
}

export async function getSpaces() {
  const candidates = ['/spaces/list', '/space']
  let lastError: unknown = null

  for (const route of candidates) {
    try {
      const data = await get<any>(route)
      return normalizeSpaces(data)
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  throw lastError ?? new Error('List spaces endpoint not found')
}

export async function getSpace(id: number): Promise<SpaceDto> {
  const candidates = [`/spaces/${id}`, `/space/${id}`]
  let lastError: unknown = null

  for (const route of candidates) {
    try {
      const payload = await get<any>(route)
      const mapped = mapSpace(payload?.space ?? payload)
      if (mapped) return mapped
      throw new Error('Invalid get space response')
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  throw lastError ?? new Error('Get space endpoint not found')
}

export async function getSpaceManagers(id: number): Promise<SpaceManagersDto> {
  const candidates = [`/spaces/${id}/managers`, `/space/${id}/managers`]
  let lastError: unknown = null

  for (const route of candidates) {
    try {
      const payload = await get<any>(route)
      const managerPayload = payload?.managers ?? payload
      const rawTeams = Array.isArray(managerPayload?.teams)
        ? managerPayload.teams
        : Array.isArray(managerPayload)
          ? managerPayload
          : []
      const rawUsers = Array.isArray(managerPayload?.users) ? managerPayload.users : []

      const teams = rawTeams
        .map((item: any) => ({
          teamId: Number(item?.teamId),
          teamName: String(item?.teamName ?? '').trim(),
        }))
        .filter((item: SpaceManagerTeamDto) => Number.isFinite(item.teamId) && item.teamId > 0)

      const users = rawUsers
        .map((item: any) => ({
          userId: Number(item?.userId),
          userName: String(item?.userName ?? '').trim(),
          displayName: String(item?.displayName ?? '').trim(),
        }))
        .filter((item: SpaceManagerUserDto) => Number.isFinite(item.userId) && item.userId > 0)

      return { teams, users }
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  if ((lastError as any)?.response?.status === 404 || (lastError as any)?.status === 404) {
    return { teams: [], users: [] }
  }
  throw lastError ?? new Error('Get space managers endpoint not found')
}

export async function createSpace(command: CreateSpaceCommand): Promise<SpaceDto> {
  const candidates: Array<() => Promise<any>> = [
    () => post<any, CreateSpaceCommand>('/spaces/create', command),
    () => post<any, CreateSpaceCommand>('/space/create', command),
  ]

  let lastError: unknown = null
  for (const attempt of candidates) {
    try {
      const payload = await attempt()
      const spaces = normalizeSpaces(payload)
      if (spaces.length > 0) return spaces[0]
      if (payload?.space) {
        const mapped = normalizeSpaces([payload.space])
        if (mapped[0]) return mapped[0]
      }
      const mapped = mapSpace(payload)
      if (mapped) return mapped
      throw new Error('Invalid create space response')
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  throw lastError ?? new Error('Create space endpoint not found')
}

export async function updateSpace(command: UpdateSpaceCommand): Promise<SpaceDto> {
  const candidates: Array<() => Promise<any>> = [
    () => post<any, UpdateSpaceCommand>('/spaces/update', command),
    () => post<any, UpdateSpaceCommand>('/space/update', command),
  ]

  let lastError: unknown = null
  for (const attempt of candidates) {
    try {
      const payload = await attempt()
      const spaces = normalizeSpaces(payload)
      if (spaces.length > 0) return spaces[0]
      if (payload?.space) {
        const mapped = normalizeSpaces([payload.space])
        if (mapped[0]) return mapped[0]
      }
      const mapped = mapSpace(payload)
      if (mapped) return mapped
      return {
        id: command.id,
        name: String(payload?.name ?? command.name),
        slug: String(payload?.slug ?? command.slug ?? `Spaces-${command.id}`),
        description: typeof payload?.description === 'string' ? payload.description : command.description,
        isDefault: Boolean(payload?.isDefault),
        taskQueueStopped: typeof payload?.taskQueueStopped === 'boolean' ? payload.taskQueueStopped : command.taskQueueStopped,
        isPrivate: typeof payload?.isPrivate === 'boolean' ? payload.isPrivate : command.isPrivate,
      }
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  throw lastError ?? new Error('Update space endpoint not found')
}

export async function deleteSpace(command: DeleteSpaceCommand): Promise<void> {
  const candidates: Array<() => Promise<any>> = [
    () => post<void, DeleteSpaceCommand>('/spaces/delete', command),
    () => post<void, DeleteSpaceCommand>('/space/delete', command),
  ]

  let lastError: unknown = null
  for (const attempt of candidates) {
    try {
      await attempt()
      return
    } catch (error) {
      lastError = error
      if (!shouldTryNextSpaceRoute(error)) throw error
    }
  }

  throw lastError ?? new Error('Delete space endpoint not found')
}
