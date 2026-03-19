import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Dropdown, Input, Modal, Select, Spin, Switch, message, type MenuProps } from 'antd'
import { CloseOutlined, FilterOutlined, MoreOutlined, UserOutlined } from '@ant-design/icons'
import { useSpace } from 'contexts/SpaceContext'
import {
  addTeamMember,
  assignTeamRole,
  createTeam,
  deleteTeam,
  getTeam,
  getTeamMembers,
  getTeamRoles,
  getTeams,
  removeTeamRole,
  removeTeamMember,
  updateTeamRoleScope,
  updateTeam,
  type ScopedUserRoleDto,
  type TeamDto,
  type TeamMemberDto,
} from 'pages/apis/team'
import { getUserRoles, type UserRoleDto } from 'pages/apis/userRole'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { getProjectGroups, type ProjectGroupDto } from 'pages/apis/projectGroup'
import { getSpaces, type SpaceDto } from 'pages/apis/space'
import { getUsers, type UserDto } from 'pages/apis/user'
import { SettingsDetailPanel as DetailPanel } from './components/DetailFormTemplate'

type TeamDetailTab = 'members' | 'userRoles' | 'settings'
type TeamSettingsCardKey = 'name' | 'description'

interface TeamFormState {
  name: string
  description: string
}

const EMPTY_FORM: TeamFormState = { name: '', description: '' }
const DEFAULT_VISIBLE_MEMBER_COUNT = 12
const DEFAULT_TEAM_SETTINGS_EXPANDED: Record<TeamSettingsCardKey, boolean> = { name: true, description: true }

function SpaceScopeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  )
}

function parseSpaceNumericId(spaceId: string): number {
  const match = spaceId.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(spaceId)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

function parseTeamIdFromSlug(teamSlug: string | null): number | null {
  if (!teamSlug) return null
  const match = teamSlug.match(/^Teams-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(teamSlug)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function extractTeamSlug(pathname: string, spaceId: string): string | null {
  const prefix = `/${spaceId}/settings/teams/`
  if (!pathname.startsWith(prefix)) return null
  const segment = pathname.slice(prefix.length).split('/')[0] ?? ''
  return segment ? decodeURIComponent(segment) : null
}

function buildUserIds(members: TeamMemberDto[]): number[] {
  const uniqueIds = new Set<number>()
  for (const member of members) {
    const userId = Number(member.userId)
    if (!Number.isFinite(userId) || userId <= 0) continue
    uniqueIds.add(userId)
  }
  return Array.from(uniqueIds).sort((a, b) => a - b)
}

function getMemberCountLabel(count: number) {
  return count === 1 ? '1 member' : `${count} members`
}

function getUserDisplayName(userId: number) {
  return `Users-${userId}`
}

function parseTeamDetailTab(value: string | null): TeamDetailTab {
  if (value === 'members' || value === 'userRoles' || value === 'settings') return value
  return 'members'
}

function describeRoleScoping(role: ScopedUserRoleDto) {
  const projectGroupsText = role.projectGroupIds.length > 0
    ? `${role.projectGroupIds.length} project group(s)`
    : 'all project groups'
  const projectsText = role.projectIds.length > 0
    ? `${role.projectIds.length} project(s)`
    : 'all projects'
  const environmentsText = role.environmentIds.length > 0
    ? `${role.environmentIds.length} environment(s)`
    : 'all environments'
  return `Team has permissions for ${projectGroupsText}, ${projectsText}, and ${environmentsText}.`
}

function normalizeScopeIds(ids: number[]) {
  return Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0))).sort((a, b) => a - b)
}

function areScopeIdsEqual(left: number[], right: number[]) {
  const normalizedLeft = normalizeScopeIds(left)
  const normalizedRight = normalizeScopeIds(right)
  if (normalizedLeft.length !== normalizedRight.length) return false
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    if (normalizedLeft[index] !== normalizedRight[index]) return false
  }
  return true
}

function hasRoleScopeChanged(left: ScopedUserRoleDto, right: ScopedUserRoleDto) {
  if (!areScopeIdsEqual(left.projectGroupIds, right.projectGroupIds)) return true
  if (!areScopeIdsEqual(left.projectIds, right.projectIds)) return true
  if (!areScopeIdsEqual(left.environmentIds, right.environmentIds)) return true
  return false
}

function normalizeTeamSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function isLegacySpaceSlug(value: string) {
  return /^Spaces-\d+$/i.test(value.trim())
}

export function TeamsSettings({
  spaceId,
  canView,
  canCreate,
  canEdit,
  canDelete,
}: {
  spaceId: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const { space } = useSpace()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const numericSpaceId = useMemo(() => parseSpaceNumericId(spaceId), [spaceId])

  const [loadingTeams, setLoadingTeams] = useState(false)
  const [teams, setTeams] = useState<TeamDto[]>([])

  const [nameFilter, setNameFilter] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [includeSystemTeams, setIncludeSystemTeams] = useState(true)
  const [memberCountByTeamId, setMemberCountByTeamId] = useState<Record<number, number>>({})
  const [loadingMemberCounts, setLoadingMemberCounts] = useState(false)

  const [loadingMembers, setLoadingMembers] = useState(false)
  const [members, setMembers] = useState<TeamMemberDto[]>([])
  const [loadingTeamDetail, setLoadingTeamDetail] = useState(false)
  const [teamDetail, setTeamDetail] = useState<TeamDto | null>(null)
  const [showAllMembers, setShowAllMembers] = useState(false)
  const [submittingMember, setSubmittingMember] = useState(false)
  const [memberDialogVisible, setMemberDialogVisible] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<UserDto[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  const [detailTab, setDetailTab] = useState<TeamDetailTab>('members')

  const [loadingTeamRoles, setLoadingTeamRoles] = useState(false)
  const [teamRoles, setTeamRoles] = useState<ScopedUserRoleDto[]>([])
  const [teamRoleDrafts, setTeamRoleDrafts] = useState<ScopedUserRoleDto[]>([])
  const [loadedTeamRolesTeamId, setLoadedTeamRolesTeamId] = useState<number | null>(null)
  const [nextDraftRoleId, setNextDraftRoleId] = useState(-1)
  const [savingTeamRoles, setSavingTeamRoles] = useState(false)
  const [allUserRoles, setAllUserRoles] = useState<UserRoleDto[]>([])
  const [spaces, setSpaces] = useState<SpaceDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [projectGroups, setProjectGroups] = useState<ProjectGroupDto[]>([])
  const [loadingScopeOptions, setLoadingScopeOptions] = useState(false)

  const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false)
  const [assignRoleUserRoleId, setAssignRoleUserRoleId] = useState<number | null>(null)
  const [assignRoleSpaceId, setAssignRoleSpaceId] = useState<number | null>(numericSpaceId)

  const [editingScopeRole, setEditingScopeRole] = useState<ScopedUserRoleDto | null>(null)
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false)
  const [scopeSubmitting, setScopeSubmitting] = useState(false)
  const [scopeProjectIds, setScopeProjectIds] = useState<number[]>([])
  const [scopeEnvironmentIds, setScopeEnvironmentIds] = useState<number[]>([])
  const [scopeProjectGroupIds, setScopeProjectGroupIds] = useState<number[]>([])

  const [teamDialogVisible, setTeamDialogVisible] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamDto | null>(null)
  const [teamFormState, setTeamFormState] = useState<TeamFormState>(EMPTY_FORM)
  const [savingTeam, setSavingTeam] = useState(false)
  const [teamSettingsForm, setTeamSettingsForm] = useState<TeamFormState>(EMPTY_FORM)
  const [teamSettingsExpanded, setTeamSettingsExpanded] = useState<Record<TeamSettingsCardKey, boolean>>(DEFAULT_TEAM_SETTINGS_EXPANDED)
  const [savingTeamSettings, setSavingTeamSettings] = useState(false)

  const teamSlug = useMemo(() => extractTeamSlug(location.pathname, spaceId), [location.pathname, spaceId])
  const legacySpaceValue = useMemo(() => {
    if (!teamSlug) return null
    if (!teamSlug.toLowerCase().startsWith('spaces=')) return null
    return decodeURIComponent(teamSlug.slice('spaces='.length))
  }, [teamSlug])

  const selectedTeamId = useMemo(() => parseTeamIdFromSlug(teamSlug), [teamSlug])
  const selectedTeam = useMemo(() => {
    if (selectedTeamId == null) return null
    return teams.find((team) => team.id === selectedTeamId) ?? null
  }, [selectedTeamId, teams])
  const activeTeam = useMemo(() => teamDetail ?? selectedTeam, [teamDetail, selectedTeam])

  const uniqueMembers = useMemo(() => {
    const memberMap = new Map<number, TeamMemberDto>()
    for (const member of members) {
      const userId = Number(member.userId)
      if (!Number.isFinite(userId) || userId <= 0) continue
      const previous = memberMap.get(userId)
      memberMap.set(userId, {
        ...previous,
        ...member,
        userId,
        teamId: Number(member.teamId) || previous?.teamId || 0,
      })
    }
    return Array.from(memberMap.values()).sort((a, b) => Number(a.userId) - Number(b.userId))
  }, [members])
  const allMemberUserIds = useMemo(() => uniqueMembers.map((member) => Number(member.userId)), [uniqueMembers])
  const visibleMembers = useMemo(() => {
    if (showAllMembers) return uniqueMembers
    return uniqueMembers.slice(0, DEFAULT_VISIBLE_MEMBER_COUNT)
  }, [showAllMembers, uniqueMembers])
  const userById = useMemo(() => {
    const map = new Map<number, UserDto>()
    for (const user of users) map.set(user.id, user)
    return map
  }, [users])
  const memberIdSet = useMemo(() => new Set(allMemberUserIds), [allMemberUserIds])
  const addableUsers = useMemo(() => users.filter((user) => !memberIdSet.has(user.id)), [memberIdSet, users])
  const shouldShowMemberToggle = allMemberUserIds.length > DEFAULT_VISIBLE_MEMBER_COUNT
  const shouldShowBottomMemberActions = allMemberUserIds.length > DEFAULT_VISIBLE_MEMBER_COUNT
  const spaceById = useMemo(() => {
    const map = new Map<number, SpaceDto>()
    for (const item of spaces) map.set(item.id, item)
    return map
  }, [spaces])

  const rawSpaceFilter = useMemo(() => searchParams.get('spaces')?.trim() || '', [searchParams])
  const normalizedSpaceFilter = useMemo(() => {
    if (!rawSpaceFilter) return space.name || 'Default'
    if (isLegacySpaceSlug(rawSpaceFilter)) return space.name || 'Default'
    return rawSpaceFilter
  }, [rawSpaceFilter, space.name])
  const spaceFilter = normalizedSpaceFilter
  const detailTabFromUrl = useMemo(() => parseTeamDetailTab(searchParams.get('activeTab')), [searchParams])
  const searchParamsWithoutActiveTab = useMemo(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('activeTab')
    return next
  }, [searchParams])
  const teamsListPath = useMemo(() => {
    const query = searchParamsWithoutActiveTab.toString()
    return `/${spaceId}/settings/teams${query ? `?${query}` : ''}`
  }, [searchParamsWithoutActiveTab, spaceId])
  const buildTeamDetailPath = useCallback((teamId: number, tab?: TeamDetailTab) => {
    const next = new URLSearchParams(searchParamsWithoutActiveTab)
    if (tab) next.set('activeTab', tab)
    const query = next.toString()
    return `/${spaceId}/settings/teams/Teams-${teamId}${query ? `?${query}` : ''}`
  }, [searchParamsWithoutActiveTab, spaceId])

  const isTeamDetailPage = teamSlug != null && legacySpaceValue == null

  const filteredTeams = useMemo(() => {
    const source = includeSystemTeams ? teams : teams.filter((team) => !team.isBuiltIn)
    const keyword = nameFilter.trim().toLowerCase()
    if (!keyword) return source
    return source.filter((team) => {
      const haystack = `${team.name} ${team.description || ''}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [includeSystemTeams, nameFilter, teams])

  const loadTeams = useCallback(async () => {
    if (!canView) {
      setTeams([])
      return
    }
    try {
      setLoadingTeams(true)
      const result = await getTeams({ spaceId: numericSpaceId })
      const nextTeams = [...(result.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name))
      setTeams(nextTeams)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load teams.')
      setTeams([])
    } finally {
      setLoadingTeams(false)
    }
  }, [canView, numericSpaceId])

  const loadMembers = useCallback(async (teamId: number) => {
    try {
      setLoadingMembers(true)
      const result = await getTeamMembers(teamId)
      setMembers(result.members ?? [])
    } catch (error: any) {
      message.error(error?.message || 'Failed to load team members.')
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  const loadTeamDetail = useCallback(async (teamId: number) => {
    if (!canView) {
      setTeamDetail(null)
      return
    }

    try {
      setLoadingTeamDetail(true)
      const detail = await getTeam(teamId, { spaceId: numericSpaceId })
      setTeamDetail(detail)
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status !== 404 && error?.message !== 'Team not found') {
        message.error(error?.message || 'Failed to load team detail.')
      }
      setTeamDetail(null)
    } finally {
      setLoadingTeamDetail(false)
    }
  }, [canView, numericSpaceId])

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true)
      const result = await getUsers({ pageIndex: 1, pageSize: 1000 })
      const nextUsers = [...(result.users ?? [])].sort((a, b) => {
        const left = `${a.displayName} ${a.userName}`.trim().toLowerCase()
        const right = `${b.displayName} ${b.userName}`.trim().toLowerCase()
        return left.localeCompare(right)
      })
      setUsers(nextUsers)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load users.')
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const loadTeamRoles = useCallback(async (teamId: number) => {
    if (!canView) {
      setTeamRoles([])
      setTeamRoleDrafts([])
      setLoadedTeamRolesTeamId(null)
      return
    }
    try {
      setLoadingTeamRoles(true)
      const result = await getTeamRoles(teamId)
      const nextRoles = result.roles ?? []
      setTeamRoles(nextRoles)
      setTeamRoleDrafts(nextRoles)
      setLoadedTeamRolesTeamId(teamId)
      setNextDraftRoleId(-1)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load team roles.')
      setTeamRoles([])
      setTeamRoleDrafts([])
      setLoadedTeamRolesTeamId(null)
    } finally {
      setLoadingTeamRoles(false)
    }
  }, [canView])

  const loadRoleCatalog = useCallback(async () => {
    if (!canView) {
      setAllUserRoles([])
      return
    }
    try {
      const result = await getUserRoles()
      setAllUserRoles([...(result ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status !== 404) {
        message.error(error?.message || 'Failed to load roles.')
      }
      setAllUserRoles([])
    }
  }, [canView])

  const loadRoleSpaces = useCallback(async () => {
    if (!canView) {
      setSpaces([])
      return
    }
    try {
      const result = await getSpaces()
      setSpaces([...(result ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status !== 404) {
        message.error(error?.message || 'Failed to load spaces.')
      }
      setSpaces([])
    }
  }, [canView])

  const loadScopeOptions = useCallback(async () => {
    if (!canView) {
      setSpaces([])
      setProjects([])
      setEnvironments([])
      setProjectGroups([])
      return
    }

    try {
      setLoadingScopeOptions(true)
      const [spacesResult, projectsResult, environmentsResult, projectGroupsResult] = await Promise.all([
        getSpaces(),
        getProjects({ pageIndex: 1, pageSize: 1000 }),
        getEnvironments({ pageIndex: 1, pageSize: 1000, spaceId: numericSpaceId }),
        getProjectGroups({ pageIndex: 1, pageSize: 1000 }),
      ])

      setSpaces([...(spacesResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      setProjects([...(projectsResult.projects ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      setEnvironments([...(environmentsResult.environments ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      setProjectGroups([...(projectGroupsResult.projectGroups ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error: any) {
      const status = Number(error?.status ?? error?.response?.status ?? 0)
      if (status !== 404) {
        message.error(error?.message || 'Failed to load scope options.')
      }
      setSpaces([])
      setProjects([])
      setEnvironments([])
      setProjectGroups([])
    } finally {
      setLoadingScopeOptions(false)
    }
  }, [canView, numericSpaceId])

  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  useEffect(() => {
    const current = searchParams.get('spaces')?.trim() || ''
    const expected = spaceFilter.trim()
    if (!expected) return
    if (current === expected && !isLegacySpaceSlug(current)) return

    const shouldNormalize = !current || isLegacySpaceSlug(current) || current !== expected
    if (!shouldNormalize) return

    const next = new URLSearchParams(searchParams)
    next.set('spaces', expected)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, spaceFilter])

  useEffect(() => {
    if (!legacySpaceValue) return
    const normalizedLegacySpaceValue = isLegacySpaceSlug(legacySpaceValue)
      ? (space.name || 'Default')
      : legacySpaceValue
    const next = new URLSearchParams(searchParams)
    next.set('spaces', normalizedLegacySpaceValue)
    navigate(`/${spaceId}/settings/teams?${next.toString()}`, { replace: true })
  }, [legacySpaceValue, navigate, searchParams, space.name, spaceId])

  useEffect(() => {
    if (!isTeamDetailPage) return
    if (detailTab !== detailTabFromUrl) setDetailTab(detailTabFromUrl)
  }, [detailTab, detailTabFromUrl, isTeamDetailPage])

  useEffect(() => {
    if (teams.length === 0) {
      setMemberCountByTeamId({})
      return
    }

    let cancelled = false

    const loadCounts = async () => {
      try {
        setLoadingMemberCounts(true)
        const results = await Promise.all(
          teams.map(async (team) => {
            try {
              const memberResult = await getTeamMembers(team.id)
              const count = buildUserIds(memberResult.members ?? []).length
              return [team.id, count] as const
            } catch {
              return [team.id, 0] as const
            }
          }),
        )

        if (cancelled) return
        setMemberCountByTeamId(Object.fromEntries(results))
      } finally {
        if (!cancelled) setLoadingMemberCounts(false)
      }
    }

    void loadCounts()

    return () => {
      cancelled = true
    }
  }, [teams])

  useEffect(() => {
    if (!isTeamDetailPage || selectedTeamId == null) {
      setMembers([])
      setTeamRoles([])
      setTeamRoleDrafts([])
      setLoadedTeamRolesTeamId(null)
      setTeamDetail(null)
      return
    }
    setShowAllMembers(false)
    void loadTeamDetail(selectedTeamId)
    void loadMembers(selectedTeamId)
    if (detailTab === 'userRoles') {
      if (loadedTeamRolesTeamId !== selectedTeamId) void loadTeamRoles(selectedTeamId)
      if (spaces.length === 0) void loadRoleSpaces()
    }
  }, [detailTab, isTeamDetailPage, loadMembers, loadRoleSpaces, loadTeamDetail, loadTeamRoles, loadedTeamRolesTeamId, selectedTeamId, spaces.length])

  useEffect(() => {
    if (!activeTeam) {
      setTeamSettingsForm(EMPTY_FORM)
      return
    }
    setTeamSettingsForm({
      name: activeTeam.name,
      description: activeTeam.description ?? '',
    })
  }, [activeTeam?.id, activeTeam?.name, activeTeam?.description])

  useEffect(() => {
    setTeamSettingsExpanded(DEFAULT_TEAM_SETTINGS_EXPANDED)
  }, [activeTeam?.id])

  const openCreateTeamDialog = () => {
    if (!canCreate) {
      message.warning('Permission denied: TeamCreate')
      return
    }
    setEditingTeam(null)
    setTeamFormState(EMPTY_FORM)
    setTeamDialogVisible(true)
  }

  const openEditTeamDialog = (team: TeamDto) => {
    if (!canEdit || team.isBuiltIn) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    setEditingTeam(team)
    setTeamFormState({ name: team.name, description: team.description ?? '' })
    setTeamDialogVisible(true)
  }

  const handleSaveTeam = async () => {
    const canSave = editingTeam == null ? canCreate : canEdit
    if (!canSave) {
      message.warning(`Permission denied: ${editingTeam == null ? 'TeamCreate' : 'TeamEdit'}`)
      return
    }
    const name = teamFormState.name.trim()
    const description = teamFormState.description.trim()
    if (!name) {
      message.warning('Team name is required.')
      return
    }

    try {
      setSavingTeam(true)
      if (editingTeam == null) {
        const created = await createTeam({ name, description, spaceId: numericSpaceId })
        message.success('Team created.')
        await loadTeams()
        setTeamDetail(created)
        navigate(buildTeamDetailPath(created.id, 'members'))
      } else {
        await updateTeam({ id: editingTeam.id, name, description, spaceId: numericSpaceId })
        message.success('Team updated.')
        await loadTeams()
        await loadTeamDetail(editingTeam.id)
      }
      setTeamDialogVisible(false)
    } catch (error: any) {
      message.error(error?.message || 'Failed to save team.')
    } finally {
      setSavingTeam(false)
    }
  }

  const handleDeleteTeam = (team: TeamDto) => {
    if (!canDelete || team.isBuiltIn) {
      message.warning('Permission denied: TeamDelete')
      return
    }
    Modal.confirm({
      title: `Delete team "${team.name}"?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTeam({ id: team.id })
          message.success('Team deleted.')
          await loadTeams()
          if (activeTeam?.id === team.id) {
            setTeamDetail(null)
            navigate(teamsListPath)
          }
        } catch (error: any) {
          message.error(error?.message || 'Failed to delete team.')
        }
      },
    })
  }

  const openAddMemberDialog = () => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    setSelectedUserIds([])
    setMemberDialogVisible(true)
    if (users.length === 0) void loadUsers()
  }

  const handleAddMember = async () => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    const candidateIds = Array.from(new Set(selectedUserIds)).filter((userId) => Number.isFinite(userId) && userId > 0)
    const targetIds = candidateIds.filter((userId) => !memberIdSet.has(userId))
    if (targetIds.length === 0) {
      message.warning('Select at least one user.')
      return
    }

    try {
      setSubmittingMember(true)
      const addResults = await Promise.allSettled(targetIds.map((userId) => addTeamMember(activeTeam.id, { userId })))
      const successCount = addResults.filter((entry) => entry.status === 'fulfilled').length
      const failedCount = addResults.length - successCount
      if (successCount > 0) {
        await loadMembers(activeTeam.id)
      }
      if (failedCount === 0) {
        setMemberDialogVisible(false)
        message.success(`Added ${successCount} member${successCount === 1 ? '' : 's'}.`)
      } else {
        message.warning(`Added ${successCount} member${successCount === 1 ? '' : 's'}, failed ${failedCount}.`)
      }
    } catch (error: any) {
      message.error(error?.message || 'Failed to add member.')
    } finally {
      setSubmittingMember(false)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }

    try {
      setSubmittingMember(true)
      await removeTeamMember(activeTeam.id, { userId })
      await loadMembers(activeTeam.id)
      message.success('Member removed.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to remove member.')
    } finally {
      setSubmittingMember(false)
    }
  }

  const openAssignRoleDialog = () => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    setAssignRoleUserRoleId(null)
    setAssignRoleSpaceId(numericSpaceId)
    setAssignRoleDialogOpen(true)
    if (allUserRoles.length === 0) void loadRoleCatalog()
  }

  const handleAssignRole = () => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    if (assignRoleUserRoleId == null) {
      message.warning('Select a role.')
      return
    }

    const nextSpaceId = assignRoleSpaceId ?? numericSpaceId
    const duplicateExists = teamRoleDrafts.some((role) => role.userRoleId === assignRoleUserRoleId && (role.spaceId ?? null) === nextSpaceId)
    if (duplicateExists) {
      message.warning('This user role is already included for the selected space.')
      return
    }
    const matchedRole = allUserRoles.find((role) => role.id === assignRoleUserRoleId)
    setTeamRoleDrafts((previous) => [
      ...previous,
      {
        id: nextDraftRoleId,
        teamId: activeTeam.id,
        userRoleId: assignRoleUserRoleId,
        userRoleName: matchedRole?.name || `Role ${assignRoleUserRoleId}`,
        spaceId: nextSpaceId,
        projectIds: [],
        environmentIds: [],
        projectGroupIds: [],
      },
    ])
    setNextDraftRoleId((previous) => previous - 1)
    setAssignRoleDialogOpen(false)
    message.success('User role added. Click Save to apply changes.')
  }

  const handleRemoveAssignedRole = (role: ScopedUserRoleDto) => {
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    Modal.confirm({
      title: `Delete role "${role.userRoleName}" from this team?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setTeamRoleDrafts((previous) => previous.filter((item) => item.id !== role.id))
        message.success('Role removed from draft. Click Save to apply changes.')
      },
    })
  }

  const openScopeDialog = (role: ScopedUserRoleDto) => {
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }
    setEditingScopeRole(role)
    setScopeProjectIds(normalizeScopeIds(role.projectIds ?? []))
    setScopeEnvironmentIds(normalizeScopeIds(role.environmentIds ?? []))
    setScopeProjectGroupIds(normalizeScopeIds(role.projectGroupIds ?? []))
    setScopeDialogOpen(true)
    if (allUserRoles.length === 0) void loadRoleCatalog()
    if (spaces.length === 0 || projects.length === 0 || environments.length === 0 || projectGroups.length === 0) {
      void loadScopeOptions()
    }
  }

  const handleSaveScope = async () => {
    if (!editingScopeRole) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }

    try {
      setScopeSubmitting(true)
      const nextProjectIds = normalizeScopeIds(scopeProjectIds)
      const nextEnvironmentIds = normalizeScopeIds(scopeEnvironmentIds)
      const nextProjectGroupIds = normalizeScopeIds(scopeProjectGroupIds)
      setTeamRoleDrafts((previous) => previous.map((role) => (
        role.id === editingScopeRole.id
          ? {
            ...role,
            projectIds: nextProjectIds,
            environmentIds: nextEnvironmentIds,
            projectGroupIds: nextProjectGroupIds,
          }
          : role
      )))
      setScopeDialogOpen(false)
      setEditingScopeRole(null)
      message.success('User role scope updated. Click Save to apply changes.')
    } finally {
      setScopeSubmitting(false)
    }
  }

  const handleSaveTeamRoles = async () => {
    if (!activeTeam) return
    if (!canEdit) {
      message.warning('Permission denied: TeamEdit')
      return
    }

    const existingById = new Map(teamRoles.map((role) => [role.id, role]))
    const draftById = new Map(teamRoleDrafts.filter((role) => role.id > 0).map((role) => [role.id, role]))
    const rolesToRemove = teamRoles.filter((role) => !draftById.has(role.id))
    const rolesToCreate = teamRoleDrafts.filter((role) => role.id <= 0)
    const rolesToUpdate = teamRoleDrafts.filter((role) => {
      if (role.id <= 0) return false
      const existing = existingById.get(role.id)
      if (!existing) return false
      return hasRoleScopeChanged(role, existing)
    })

    if (rolesToRemove.length === 0 && rolesToCreate.length === 0 && rolesToUpdate.length === 0) {
      message.info('No role changes to save.')
      return
    }

    try {
      setSavingTeamRoles(true)

      for (const role of rolesToRemove) {
        await removeTeamRole(activeTeam.id, { scopedUserRoleId: role.id })
      }

      for (const role of rolesToCreate) {
        const createdRole = await assignTeamRole(activeTeam.id, {
          userRoleId: role.userRoleId,
          spaceId: role.spaceId,
        })
        const hasScopedRestrictions = role.projectGroupIds.length > 0 || role.projectIds.length > 0 || role.environmentIds.length > 0
        const createdRoleId = Number(createdRole?.id ?? 0)
        if (hasScopedRestrictions && createdRoleId > 0) {
          await updateTeamRoleScope(activeTeam.id, createdRoleId, {
            projectIds: normalizeScopeIds(role.projectIds),
            environmentIds: normalizeScopeIds(role.environmentIds),
            projectGroupIds: normalizeScopeIds(role.projectGroupIds),
          })
        }
      }

      for (const role of rolesToUpdate) {
        await updateTeamRoleScope(activeTeam.id, role.id, {
          projectIds: normalizeScopeIds(role.projectIds),
          environmentIds: normalizeScopeIds(role.environmentIds),
          projectGroupIds: normalizeScopeIds(role.projectGroupIds),
        })
      }

      await loadTeamRoles(activeTeam.id)
      message.success('User roles updated.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to save user role changes.')
    } finally {
      setSavingTeamRoles(false)
    }
  }

  const handleSaveCurrentDetail = async () => {
    if (detailTab === 'settings') {
      await handleSaveTeamSettings()
      return
    }
    if (detailTab === 'userRoles') {
      await handleSaveTeamRoles()
    }
  }

  const getRoleSpaceName = useCallback((roleSpaceId: number | null) => {
    if (roleSpaceId == null) return 'System'
    const resolvedSpaceName = spaceById.get(roleSpaceId)?.name || (roleSpaceId === numericSpaceId ? (space.name || 'Default') : '')
    return resolvedSpaceName || 'Unknown'
  }, [numericSpaceId, space.name, spaceById])

  const getRoleSpaceTitle = useCallback((roleSpaceId: number | null) => {
    if (roleSpaceId == null) return 'System'
    const spaceName = getRoleSpaceName(roleSpaceId)
    return spaceName.toLowerCase().endsWith(' space') ? spaceName : `${spaceName} Space`
  }, [getRoleSpaceName])

  const getRoleDescription = useCallback((userRoleId: number) => {
    return allUserRoles.find((role) => role.id === userRoleId)?.description || ''
  }, [allUserRoles])

  const isTeamRolesDirty = useMemo(() => {
    if (teamRoles.length !== teamRoleDrafts.length) return true
    const existingById = new Map(teamRoles.map((role) => [role.id, role]))
    for (const role of teamRoleDrafts) {
      if (role.id <= 0) return true
      const existing = existingById.get(role.id)
      if (!existing) return true
      if (role.userRoleId !== existing.userRoleId) return true
      if ((role.spaceId ?? null) !== (existing.spaceId ?? null)) return true
      if (hasRoleScopeChanged(role, existing)) return true
    }
    return false
  }, [teamRoleDrafts, teamRoles])

  const handleSaveTeamSettings = async () => {
    if (!activeTeam) return
    if (!canEdit || activeTeam.isBuiltIn) {
      message.warning('Permission denied: TeamEdit')
      return
    }

    const name = teamSettingsForm.name.trim()
    const description = teamSettingsForm.description.trim()
    if (!name) {
      message.warning('Team name is required.')
      return
    }

    try {
      setSavingTeamSettings(true)
      const updated = await updateTeam({
        id: activeTeam.id,
        name,
        description,
        spaceId: numericSpaceId,
      })
      setTeamDetail(updated)
      setTeams((previous) =>
        previous
          .map((team) => (team.id === updated.id ? { ...team, ...updated } : team))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setTeamSettingsForm({
        name: updated.name,
        description: updated.description ?? '',
      })
      message.success('Team updated.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to update team.')
    } finally {
      setSavingTeamSettings(false)
    }
  }

  const renderSpaceChip = (name: string) => (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <SpaceScopeIcon className="h-3 w-3 fill-current" />
      </span>
      {name}
    </span>
  )

  const renderMembersPanel = () => (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="px-4 pt-4 pb-3">
        <p className="text-sm text-slate-600 mb-3">Add users and groups to this team. A user can belong to more than one team.</p>

        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
          <Button type="primary" onClick={openAddMemberDialog}>Add member</Button>
          <Button onClick={() => message.info('Add LDAP group is not implemented yet.')}>Add LDAP group</Button>
          {shouldShowMemberToggle ? (
            <Button onClick={() => setShowAllMembers((previous) => !previous)}>{showAllMembers ? 'Show less members' : 'Show all members'}</Button>
          ) : null}
        </div>

        {loadingMembers ? (
          <div className="py-8 flex items-center justify-center"><Spin /></div>
        ) : allMemberUserIds.length === 0 ? (
          <div className="py-5 text-sm text-slate-500">No members yet.</div>
        ) : (
          <ul className="m-0 p-0 list-none border border-slate-200 rounded-lg divide-y divide-slate-100">
            {visibleMembers.map((member) => {
              const userId = Number(member.userId)
              const label = member.displayName?.trim()
                || member.userName?.trim()
                || userById.get(userId)?.displayName?.trim()
                || userById.get(userId)?.userName?.trim()
                || getUserDisplayName(userId)

              return (
                <li key={userId} className="px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    <UserOutlined style={{ fontSize: 12 }} />
                  </span>
                  <span className="truncate text-sm text-slate-700">
                    <Link className="text-squid-blue hover:underline" to={`/${spaceId}/settings/users/Users-${userId}`} target="_self">
                      {label}
                    </Link>
                  </span>
                </div>
                <Button type="text" icon={<CloseOutlined />} aria-label="Remove member" loading={submittingMember} onClick={() => handleRemoveMember(userId)} />
              </li>
              )
            })}
          </ul>
        )}

        {shouldShowBottomMemberActions ? (
          <div className="pt-3 flex flex-wrap items-center justify-end gap-2">
            <Button type="primary" onClick={openAddMemberDialog}>Add member</Button>
            <Button onClick={() => message.info('Add LDAP group is not implemented yet.')}>Add LDAP group</Button>
            {shouldShowMemberToggle ? (
              <Button onClick={() => setShowAllMembers((previous) => !previous)}>{showAllMembers ? 'Show less members' : 'Show all members'}</Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderRolesPanel = () => {
    const groupedRoles = teamRoleDrafts.reduce<Record<string, { title: string; roles: ScopedUserRoleDto[] }>>((acc, role) => {
      const title = getRoleSpaceTitle(role.spaceId)
      const key = role.spaceId == null ? 'system' : `space-${role.spaceId}`
      if (!acc[key]) acc[key] = { title, roles: [] }
      acc[key].roles.push(role)
      return acc
    }, {})

    const orderedGroups = Object.values(groupedRoles).sort((a, b) => a.title.localeCompare(b.title))

    return (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <p className="text-sm text-slate-600 mb-3">
            Assign user roles to this team and optionally restrict access scope by project, environment, and project group.
          </p>

          <div className="flex items-center justify-end gap-2 mb-3">
            <Button type="primary" onClick={openAssignRoleDialog} disabled={!canEdit}>Include User Role</Button>
          </div>

          {loadingTeamRoles ? (
            <div className="py-8 flex items-center justify-center"><Spin /></div>
          ) : teamRoleDrafts.length === 0 ? (
            <div className="py-5 text-sm text-slate-500">No roles assigned yet.</div>
          ) : (
            <div className="space-y-3">
              {orderedGroups.map((group) => (
                <div key={group.title} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <div className="text-sm font-semibold text-slate-900">{group.title}</div>
                  </div>

                  <div className="p-3 space-y-2">
                    {group.roles.map((role) => {
                      const roleMenuItems: MenuProps['items'] = [
                        { key: 'edit', label: 'Edit', disabled: !canEdit },
                        { key: 'delete', label: 'Delete', disabled: !canEdit },
                      ]

                      const handleRoleMenuClick: MenuProps['onClick'] = ({ key }) => {
                        if (key === 'edit') {
                          openScopeDialog(role)
                          return
                        }
                        if (key === 'delete') {
                          handleRemoveAssignedRole(role)
                        }
                      }

                      return (
                        <div key={role.id} className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link className="text-sm font-semibold text-squid-blue hover:underline" to={`/${spaceId}/settings/user-roles?roleId=${role.userRoleId}`} target="_self">
                                {role.userRoleName}
                              </Link>
                              <div className="text-xs text-slate-500 mt-0.5">{describeRoleScoping(role)}</div>
                            </div>

                            <Dropdown menu={{ items: roleMenuItems, onClick: handleRoleMenuClick }} trigger={['click']} placement="bottomRight">
                              <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="OverflowMenu" />
                            </Dropdown>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderSettingsPanel = () => {
    if (!activeTeam) return null
    const canEditSettings = canEdit && !activeTeam.isBuiltIn
    const teamSlug = activeTeam.slug || normalizeTeamSlug(teamSettingsForm.name || activeTeam.name)
    const allExpanded = Object.values(teamSettingsExpanded).every(Boolean)
    const toggleCard = (key: TeamSettingsCardKey) =>
      setTeamSettingsExpanded((previous) => ({ ...previous, [key]: !previous[key] }))
    const setAllExpanded = (expanded: boolean) =>
      setTeamSettingsExpanded({
        name: expanded,
        description: expanded,
      })

    return (
      <div className="space-y-3">
        <div className="flex justify-end px-1">
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
            onClick={() => {
              if (allExpanded) setAllExpanded(false)
              else setAllExpanded(true)
            }}
          >
            {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
          </button>
        </div>

        <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
          <DetailPanel
            title="Name"
            subtitle="Enter a name for your team."
            isOpen={teamSettingsExpanded.name}
            onToggle={() => toggleCard('name')}
          >
            <div className="max-w-[720px] space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <Input
                  value={teamSettingsForm.name}
                  onChange={(event) => setTeamSettingsForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="ACME Project Contributors"
                  disabled={!canEditSettings}
                />
              </div>
              <div className="text-xs text-slate-500">A short, memorable, unique name for this team. eg. ACME Project Contributors.</div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
                <Input value={teamSlug} disabled />
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Description"
            subtitle={teamSettingsForm.description?.trim() || 'No description'}
            subtitlePlaceholder={!teamSettingsForm.description?.trim()}
            isOpen={teamSettingsExpanded.description}
            onToggle={() => toggleCard('description')}
            hasBorder={false}
          >
            <div className="max-w-[720px] space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Team description</label>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  value={teamSettingsForm.description}
                  onChange={(event) => setTeamSettingsForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Team description"
                  disabled={!canEditSettings}
                />
              </div>
              <div className="text-xs text-slate-500">A description of the team.</div>
            </div>
          </DetailPanel>
        </div>
      </div>
    )
  }

  const handleChangeDetailTab = useCallback((nextTab: TeamDetailTab) => {
    setDetailTab(nextTab)
    const next = new URLSearchParams(searchParams)
    next.set('activeTab', nextTab)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const teamOverflowItems: MenuProps['items'] = activeTeam ? [
    { key: 'edit', label: 'Edit team', disabled: !canEdit || Boolean(activeTeam.isBuiltIn) },
    { key: 'delete', label: 'Delete team', disabled: !canDelete || Boolean(activeTeam.isBuiltIn) },
  ] : []

  const isTeamSettingsDirty = useMemo(() => {
    if (!activeTeam) return false
    return activeTeam.name !== teamSettingsForm.name.trim() || (activeTeam.description ?? '') !== teamSettingsForm.description.trim()
  }, [activeTeam, teamSettingsForm.description, teamSettingsForm.name])

  const canSaveTeamSettings = detailTab === 'settings'
    && Boolean(activeTeam)
    && canEdit
    && !Boolean(activeTeam?.isBuiltIn)
    && teamSettingsForm.name.trim().length > 0
    && isTeamSettingsDirty

  const canSaveTeamRoles = detailTab === 'userRoles'
    && Boolean(activeTeam)
    && canEdit
    && isTeamRolesDirty

  const canSaveCurrentDetail = canSaveTeamSettings || canSaveTeamRoles
  const savingCurrentDetail = savingTeamSettings || savingTeamRoles

  const handleTeamOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (!activeTeam) return
    if (key === 'edit') {
      openEditTeamDialog(activeTeam)
      return
    }
    if (key === 'delete') handleDeleteTeam(activeTeam)
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Permission denied: `TeamView` is required to view teams.
      </div>
    )
  }

  if (!isTeamDetailPage) {
    return (
      <>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <h1 className="m-0 text-2xl font-semibold text-slate-900">Teams</h1>
            <Button type="primary" onClick={openCreateTeamDialog} disabled={!canCreate}>Add Team</Button>
          </div>

          <div className="px-6 pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Filter by name..."
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                allowClear
                prefix={<span className="text-slate-400">🔍</span>}
                className="max-w-[380px]"
              />
              <Button type="text" icon={<FilterOutlined />} onClick={() => setShowAdvancedFilters((previous) => !previous)}>
                {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
              </Button>
            </div>

            {showAdvancedFilters ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Switch size="small" checked={includeSystemTeams} onChange={setIncludeSystemTeams} />
                <span>Include system teams</span>
              </div>
            ) : null}

            <div className="mt-3 mb-3 text-sm text-slate-600">
              Filtering by: {renderSpaceChip(spaceFilter)} space and <strong>{includeSystemTeams ? 'includes' : 'excludes'}</strong> system teams
            </div>
          </div>

          <div className="px-6 pb-6">
            {loadingTeams ? (
              <div className="py-10 flex items-center justify-center"><Spin /></div>
            ) : filteredTeams.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No teams found.</div>
            ) : (
              <ul className="m-0 p-0 list-none divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {filteredTeams.map((team) => {
                  const memberCount = memberCountByTeamId[team.id]
                  const memberText = loadingMemberCounts && memberCount == null ? 'loading members...' : getMemberCountLabel(memberCount ?? 0)
                  const detailPath = buildTeamDetailPath(team.id)

                  return (
                    <li key={team.id}>
                      <Link to={detailPath} className="block px-4 py-3 hover:bg-slate-50 transition-colors" target="_self">
                        <div className="text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span className="text-squid-blue">{team.name}</span>
                          {team.isBuiltIn ? (
                            <span className="text-[10px] font-medium rounded-full border border-slate-300 bg-slate-100 text-slate-700 px-2 py-0.5">
                              Built-in
                            </span>
                          ) : null}
                          {renderSpaceChip(spaceFilter)}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          This team has <strong>{memberText}</strong> and permissions for the {renderSpaceChip(spaceFilter)} space
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <Modal
          open={teamDialogVisible}
          title={editingTeam == null ? 'Create Team' : 'Edit Team'}
          onCancel={() => setTeamDialogVisible(false)}
          onOk={() => void handleSaveTeam()}
          okText={editingTeam == null ? 'Create' : 'Save'}
          confirmLoading={savingTeam}
          okButtonProps={{ disabled: editingTeam == null ? !canCreate : !canEdit || Boolean(editingTeam?.isBuiltIn) }}
        >
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <Input value={teamFormState.name} onChange={(event) => setTeamFormState((previous) => ({ ...previous, name: event.target.value }))} placeholder="Ops Team" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={teamFormState.description} onChange={(event) => setTeamFormState((previous) => ({ ...previous, description: event.target.value }))} placeholder="Team description" />
            </div>
          </div>
        </Modal>
      </>
    )
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loadingTeamDetail && activeTeam == null ? (
          <div className="px-6 py-8 flex items-center justify-center">
            <Spin />
          </div>
        ) : activeTeam == null ? (
          <div className="px-6 py-8">
            <div className="text-sm text-slate-600 mb-3">Team not found.</div>
            <Button onClick={() => navigate(teamsListPath)}>Back to Teams</Button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <nav>
                    <ol className="m-0 p-0 list-none flex items-center text-sm">
                      <li><Link className="text-squid-blue hover:underline" to={teamsListPath} target="_self">Teams</Link></li>
                    </ol>
                  </nav>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h1 className="m-0 text-2xl font-semibold text-slate-900">{activeTeam.name}</h1>
                    <span className="text-sm text-slate-500">is exclusive to</span>
                    {renderSpaceChip(spaceFilter)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button type="primary" onClick={() => void handleSaveCurrentDetail()} loading={savingCurrentDetail} disabled={!canSaveCurrentDetail}>Save</Button>
                  <Dropdown menu={{ items: teamOverflowItems, onClick: handleTeamOverflowClick }} trigger={['click']} placement="bottomRight">
                    <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="Overflow Menu Button" />
                  </Dropdown>
                </div>
              </div>
            </div>

            <div className="px-6 pt-3">
              <div className="flex items-center gap-1 border-b border-slate-200">
                <button type="button" className={`px-4 py-2 text-sm border-b-2 ${detailTab === 'members' ? 'border-squid-blue text-squid-blue font-medium' : 'border-transparent text-slate-600'}`} onClick={() => handleChangeDetailTab('members')}>Members</button>
                <button type="button" className={`px-4 py-2 text-sm border-b-2 ${detailTab === 'userRoles' ? 'border-squid-blue text-squid-blue font-medium' : 'border-transparent text-slate-600'}`} onClick={() => handleChangeDetailTab('userRoles')}>User Roles</button>
                <button type="button" className={`px-4 py-2 text-sm border-b-2 ${detailTab === 'settings' ? 'border-squid-blue text-squid-blue font-medium' : 'border-transparent text-slate-600'}`} onClick={() => handleChangeDetailTab('settings')}>Settings</button>
              </div>
            </div>

            <div className="px-6 py-4">
              {detailTab === 'members' ? renderMembersPanel() : null}
              {detailTab === 'userRoles' ? renderRolesPanel() : null}
              {detailTab === 'settings' ? renderSettingsPanel() : null}
            </div>
          </>
        )}
      </section>

      <Modal
        open={teamDialogVisible}
        title={editingTeam == null ? 'Create Team' : 'Edit Team'}
        onCancel={() => setTeamDialogVisible(false)}
        onOk={() => void handleSaveTeam()}
        okText={editingTeam == null ? 'Create' : 'Save'}
        confirmLoading={savingTeam}
        okButtonProps={{ disabled: editingTeam == null ? !canCreate : !canEdit || Boolean(editingTeam?.isBuiltIn) }}
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <Input value={teamFormState.name} onChange={(event) => setTeamFormState((previous) => ({ ...previous, name: event.target.value }))} placeholder="Ops Team" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={teamFormState.description} onChange={(event) => setTeamFormState((previous) => ({ ...previous, description: event.target.value }))} placeholder="Team description" />
          </div>
        </div>
      </Modal>

      <Modal
        open={memberDialogVisible}
        title="Add member"
        onCancel={() => setMemberDialogVisible(false)}
        onOk={() => void handleAddMember()}
        okText="Add"
        confirmLoading={submittingMember}
        okButtonProps={{ disabled: !canEdit }}
      >
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-medium text-slate-600">Select users</label>
          <Select<number[]>
            mode="multiple"
            className="w-full"
            placeholder="Select users"
            showSearch
            optionFilterProp="label"
            value={selectedUserIds}
            loading={usersLoading}
            onChange={(value) => setSelectedUserIds(value)}
            options={addableUsers.map((user) => ({
              value: user.id,
              label: user.displayName && user.displayName !== user.userName ? `${user.displayName} (${user.userName})` : user.displayName || user.userName,
            }))}
            notFoundContent={usersLoading ? <Spin size="small" /> : 'No available users'}
          />
        </div>
      </Modal>

      <Modal
        open={assignRoleDialogOpen}
        title="Include User Role"
        onCancel={() => setAssignRoleDialogOpen(false)}
        footer={(
          <div className="flex items-center justify-between">
            <Button disabled>Define scope</Button>
            <div className="flex items-center gap-2">
              <Button onClick={() => setAssignRoleDialogOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                onClick={() => void handleAssignRole()}
                disabled={!canEdit || assignRoleUserRoleId == null}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Select a user role</label>
            <Select<number>
              className="w-full"
              placeholder="Select a user role"
              value={assignRoleUserRoleId ?? undefined}
              onChange={(value) => setAssignRoleUserRoleId(value)}
              options={allUserRoles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              loading={loadingScopeOptions && allUserRoles.length === 0}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div className="text-xs text-slate-500">
            A user role specifies what actions users in this team will be able to perform.
          </div>
          <div className="text-xs text-slate-500">
            In order to view/assign a user role to a space-scoped team, that user role must contain at least one space-level permission.
          </div>
        </div>
      </Modal>

      <Modal
        open={scopeDialogOpen}
        title="Edit User Role"
        onCancel={() => {
          setScopeDialogOpen(false)
          setEditingScopeRole(null)
        }}
        onOk={() => void handleSaveScope()}
        okText="Apply"
        confirmLoading={scopeSubmitting}
        okButtonProps={{ disabled: !canEdit }}
      >
        <div className="space-y-3 pt-1">
          {editingScopeRole ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <div><span className="font-semibold">User Role</span>: {editingScopeRole.userRoleName}</div>
              <div><span className="font-semibold">Space</span>: {getRoleSpaceName(editingScopeRole.spaceId)}</div>
              {getRoleDescription(editingScopeRole.userRoleId)?.trim() ? (
                <div className="mt-2 text-xs text-slate-600">{getRoleDescription(editingScopeRole.userRoleId)}</div>
              ) : null}
            </div>
          ) : null}
          <h4 className="m-0 text-sm font-semibold text-slate-900">Restrict this user role to one or more project groups, projects and environments.</h4>
          <div className="text-xs text-slate-500">
            Leave empty to grant permissions across all project groups, projects and environments.
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Select project groups</label>
            <Select<number[]>
              mode="multiple"
              className="w-full"
              value={scopeProjectGroupIds}
              onChange={setScopeProjectGroupIds}
              options={projectGroups.map((item) => ({ value: item.id, label: item.name }))}
              loading={loadingScopeOptions}
              optionFilterProp="label"
              showSearch
              placeholder="Unrestricted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Select projects</label>
            <Select<number[]>
              mode="multiple"
              className="w-full"
              value={scopeProjectIds}
              onChange={setScopeProjectIds}
              options={projects.map((item) => ({ value: item.id, label: item.name }))}
              loading={loadingScopeOptions}
              optionFilterProp="label"
              showSearch
              placeholder="Unrestricted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Select environments</label>
            <Select<number[]>
              mode="multiple"
              className="w-full"
              value={scopeEnvironmentIds}
              onChange={setScopeEnvironmentIds}
              options={environments.map((item) => ({ value: item.id, label: item.name }))}
              loading={loadingScopeOptions}
              optionFilterProp="label"
              showSearch
              placeholder="Unrestricted"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
