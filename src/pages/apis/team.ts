import { get, post } from 'utils/request'

export interface TeamDto {
  id: number
  name: string
  description: string
  slug?: string
  spaceId: number
  isBuiltIn?: boolean
}

export interface GetTeamsRequest {
  spaceId?: number
}

export interface GetTeamsResponseData {
  teams: TeamDto[]
}

export interface GetTeamRequest {
  spaceId?: number
}

export interface CreateTeamCommand {
  name: string
  description: string
  spaceId: number
}

export interface UpdateTeamCommand {
  id: number
  name: string
  description: string
  spaceId: number
}

export interface DeleteTeamCommand {
  id: number
}

export interface TeamMemberDto {
  teamId: number
  userId: number
  userName?: string
  displayName?: string
}

export interface GetTeamMembersResponseData {
  members: TeamMemberDto[]
}

export interface UpdateTeamMemberCommand {
  userId: number
}

export interface ScopedUserRoleDto {
  id: number
  teamId: number
  userRoleId: number
  userRoleName: string
  spaceId: number | null
  projectIds: number[]
  environmentIds: number[]
  projectGroupIds: number[]
}

export interface GetTeamRolesResponseData {
  roles: ScopedUserRoleDto[]
}

export interface AssignTeamRoleCommand {
  userRoleId: number
  spaceId: number | null
}

export interface RemoveTeamRoleCommand {
  scopedUserRoleId: number
}

export interface UpdateTeamRoleScopeCommand {
  projectIds: number[]
  environmentIds: number[]
  projectGroupIds: number[]
}

function mapTeam(raw: any): TeamDto | null {
  const id = Number(raw?.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    name: String(raw?.name ?? '').trim(),
    description: String(raw?.description ?? ''),
    slug: typeof raw?.slug === 'string' ? raw.slug : undefined,
    spaceId: Number(raw?.spaceId ?? 0),
    isBuiltIn: typeof raw?.isBuiltIn === 'boolean' ? raw.isBuiltIn : undefined,
  }
}

function mapTeamList(payload: any): TeamDto[] {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.teams)
      ? payload.teams
      : []

  const mapped = source
    .map(mapTeam)
    .filter((team: TeamDto | null): team is TeamDto => team != null)
  return mapped.sort((a: TeamDto, b: TeamDto) => a.name.localeCompare(b.name))
}

function mapScopedUserRole(raw: any): ScopedUserRoleDto | null {
  const id = Number(raw?.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    teamId: Number(raw?.teamId ?? 0),
    userRoleId: Number(raw?.userRoleId ?? 0),
    userRoleName: String(raw?.userRoleName ?? ''),
    spaceId: raw?.spaceId == null ? null : Number(raw.spaceId),
    projectIds: Array.isArray(raw?.projectIds) ? raw.projectIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : [],
    environmentIds: Array.isArray(raw?.environmentIds) ? raw.environmentIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : [],
    projectGroupIds: Array.isArray(raw?.projectGroupIds) ? raw.projectGroupIds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)) : [],
  }
}

function mapTeamRoles(payload: any): ScopedUserRoleDto[] {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.roles)
      ? payload.roles
      : []
  return source
    .map(mapScopedUserRole)
    .filter((role: ScopedUserRoleDto | null): role is ScopedUserRoleDto => role != null)
}

export function getTeams(params?: GetTeamsRequest) {
  return get<any>('/teams/list', { params }).then((data) => ({ teams: mapTeamList(data) }))
}

export async function getTeam(teamId: number, request?: GetTeamRequest) {
  const candidates = [
    `/teams/${teamId}`,
    `/teams/detail/${teamId}`,
    `/teams/get/${teamId}`,
  ]

  for (const url of candidates) {
    try {
      const data = await get<any>(url)
      const mapped = mapTeam(data?.team ?? data)
      if (mapped) return mapped
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status === 404) continue
      throw error
    }
  }

  if (request?.spaceId != null) {
    const list = await getTeams({ spaceId: request.spaceId })
    const fallback = list.teams.find((team) => team.id === teamId)
    if (fallback) return fallback
  }

  throw new Error('Team not found')
}

export function createTeam(command: CreateTeamCommand) {
  return post<{ team: TeamDto }>('/teams/create', command).then((res) => res.team)
}

export function updateTeam(command: UpdateTeamCommand) {
  return post<{ team: TeamDto }>('/teams/update', command).then((res) => res.team)
}

export function deleteTeam(command: DeleteTeamCommand) {
  return post<void, DeleteTeamCommand>('/teams/delete', command)
}

export async function getTeamMembers(teamId: number) {
  const candidates = [
    `/teams/${teamId}/members`,
    `/teams/members/${teamId}`,
  ]

  for (const url of candidates) {
    try {
      const data = await get<any>(url)
      const source = Array.isArray(data)
        ? data
        : Array.isArray(data?.members)
          ? data.members
          : []
      const members = source
        .map((item: any) => ({
          teamId: Number(item?.teamId ?? teamId),
          userId: Number(item?.userId),
          userName: typeof (item?.userName ?? item?.UserName) === 'string' ? (item.userName ?? item.UserName) : undefined,
          displayName: typeof (item?.displayName ?? item?.DisplayName) === 'string' ? (item.displayName ?? item.DisplayName) : undefined,
        }))
        .filter((item: TeamMemberDto) => Number.isFinite(item.userId) && item.userId > 0)
      return { members }
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status === 404) continue
      throw error
    }
  }

  return { members: [] as TeamMemberDto[] }
}

export function addTeamMember(teamId: number, command: UpdateTeamMemberCommand) {
  return post<void, UpdateTeamMemberCommand>(`/teams/${teamId}/members/add`, command)
}

export function removeTeamMember(teamId: number, command: UpdateTeamMemberCommand) {
  return post<void, UpdateTeamMemberCommand>(`/teams/${teamId}/members/remove`, command)
}

export async function getTeamRoles(teamId: number) {
  const candidates = [
    `/teams/${teamId}/roles`,
    `/teams/roles/${teamId}`,
  ]

  for (const url of candidates) {
    try {
      const data = await get<any>(url)
      return { roles: mapTeamRoles(data) }
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status === 404) continue
      throw error
    }
  }

  return { roles: [] as ScopedUserRoleDto[] }
}

export function assignTeamRole(teamId: number, command: AssignTeamRoleCommand) {
  return post<ScopedUserRoleDto, AssignTeamRoleCommand>(`/teams/${teamId}/roles/assign`, command)
}

export function removeTeamRole(teamId: number, command: RemoveTeamRoleCommand) {
  return post<void, RemoveTeamRoleCommand>(`/teams/${teamId}/roles/remove`, command)
}

export function updateTeamRoleScope(teamId: number, scopedRoleId: number, command: UpdateTeamRoleScopeCommand) {
  return post<ScopedUserRoleDto, UpdateTeamRoleScopeCommand>(`/teams/${teamId}/roles/${scopedRoleId}/scope`, command)
}
