import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Dropdown, Input, Modal, Select, Spin, Switch, message, type MenuProps } from 'antd'
import { MoreOutlined, SearchOutlined } from '@ant-design/icons'
import { getTeams, type TeamDto } from 'pages/apis/team'
import { getUsers, type UserDto } from 'pages/apis/user'
import {
  createSpace,
  deleteSpace,
  getSpace,
  getSpaceManagers,
  getSpaces,
  updateSpace,
  type SpaceDto,
  type SpaceManagerTeamDto,
  type SpaceManagerUserDto,
} from 'pages/apis/space'
import { SettingsDetailPanel as DetailPanel } from './components/DetailFormTemplate'

interface SpacesSettingsProps {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canManageManagers: boolean
  currentSpaceId: string
}

interface CreateSpaceFormState {
  name: string
  slug: string
  description: string
  isPrivate: boolean
  ownerTeamIds: number[]
  ownerUserIds: number[]
}

interface EditSpaceFormState {
  name: string
  slug: string
  description: string
  isPrivate: boolean
  taskQueueStopped: boolean
}

type DetailSectionKey = 'name' | 'managers' | 'description' | 'logo' | 'taskStatus'

const EMPTY_CREATE_FORM: CreateSpaceFormState = {
  name: '',
  slug: '',
  description: '',
  isPrivate: false,
  ownerTeamIds: [],
  ownerUserIds: [],
}

const EMPTY_EDIT_FORM: EditSpaceFormState = {
  name: '',
  slug: '',
  description: '',
  isPrivate: false,
  taskQueueStopped: false,
}

const DEFAULT_DETAIL_EXPANDED: Record<DetailSectionKey, boolean> = {
  name: false,
  managers: true,
  description: true,
  logo: false,
  taskStatus: false,
}

function SpaceListLogo({ spaceId, name }: { spaceId: number; name: string }) {
  const [broken, setBroken] = useState(false)
  const label = (name?.trim()?.charAt(0) || 'S').toUpperCase()
  if (broken) {
    return (
      <div className="h-10 w-10 rounded-md border border-slate-200 bg-slate-100 text-slate-500 text-sm font-semibold flex items-center justify-center">
        {label}
      </div>
    )
  }
  return (
    <img
      src={`/api/spaces/Spaces-${spaceId}/logo`}
      alt="Logo"
      className="h-10 w-10 rounded-md border border-slate-200 bg-white object-cover"
      onError={() => setBroken(true)}
    />
  )
}

function normalizeSpaceSlug(name: string) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
}

function normalizeIdList(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)
}

function areIdListsEqual(left: number[], right: number[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function isAutoSpaceOwnersTeamName(name: string | undefined) {
  return (name || '').trim().startsWith('Space Owners (')
}

function parseSpaceNumericId(spaceId: string): number {
  const match = spaceId.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(spaceId)
  return Number.isFinite(numeric) ? numeric : 1
}

function extractSpaceSlug(pathname: string, spaceId: string): string | null {
  const prefix = `/${spaceId}/settings/spaces/`
  if (!pathname.startsWith(prefix)) return null
  const segment = pathname.slice(prefix.length).split('/')[0] ?? ''
  return segment ? decodeURIComponent(segment) : null
}

function parseSpaceIdFromSlug(spaceSlug: string | null): number | null {
  if (!spaceSlug) return null
  const match = spaceSlug.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(spaceSlug)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function toEditForm(space: SpaceDto): EditSpaceFormState {
  return {
    name: space.name,
    slug: space.slug,
    description: space.description ?? '',
    isPrivate: Boolean(space.isPrivate),
    taskQueueStopped: Boolean(space.taskQueueStopped),
  }
}

function DetailChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">
      {children}
    </span>
  )
}

function formatUserLabel(displayName: string | undefined, userName: string | undefined, userId: number) {
  const normalizedDisplayName = displayName?.trim() || ''
  const normalizedUserName = userName?.trim() || ''
  if (normalizedDisplayName && normalizedUserName && normalizedDisplayName !== normalizedUserName) {
    return `${normalizedDisplayName} (${normalizedUserName})`
  }
  if (normalizedDisplayName) return normalizedDisplayName
  if (normalizedUserName) return normalizedUserName
  return `User ${userId}`
}

export function SpacesSettings({
  canView,
  canCreate,
  canEdit,
  canDelete,
  canManageManagers,
  currentSpaceId,
}: SpacesSettingsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [spaces, setSpaces] = useState<SpaceDto[]>([])
  const [nameFilter, setNameFilter] = useState('')

  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false)
  const [createFormState, setCreateFormState] = useState<CreateSpaceFormState>(EMPTY_CREATE_FORM)
  const [creating, setCreating] = useState(false)

  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [managersLoaded, setManagersLoaded] = useState(false)
  const [loadingManagerUsers, setLoadingManagerUsers] = useState(false)
  const [spaceDetail, setSpaceDetail] = useState<SpaceDto | null>(null)
  const [spaceManagerTeams, setSpaceManagerTeams] = useState<SpaceManagerTeamDto[]>([])
  const [spaceManagerUsers, setSpaceManagerUsers] = useState<SpaceManagerUserDto[]>([])
  const [selectedManagerTeamIds, setSelectedManagerTeamIds] = useState<number[]>([])
  const [selectedManagerUserIds, setSelectedManagerUserIds] = useState<number[]>([])
  const [users, setUsers] = useState<UserDto[]>([])
  const [loadingManagerDialogData, setLoadingManagerDialogData] = useState(false)
  const [availableTeams, setAvailableTeams] = useState<TeamDto[]>([])
  const [editFormState, setEditFormState] = useState<EditSpaceFormState>(EMPTY_EDIT_FORM)
  const [expandedSections, setExpandedSections] = useState<Record<DetailSectionKey, boolean>>(DEFAULT_DETAIL_EXPANDED)
  const [saving, setSaving] = useState(false)

  const currentSpaceNumericId = useMemo(() => parseSpaceNumericId(currentSpaceId), [currentSpaceId])
  const spaceSlug = useMemo(() => extractSpaceSlug(location.pathname, currentSpaceId), [location.pathname, currentSpaceId])
  const selectedSpaceId = useMemo(() => parseSpaceIdFromSlug(spaceSlug), [spaceSlug])
  const isDetailPage = selectedSpaceId != null
  const spacesListPath = `/${currentSpaceId}/settings/spaces`

  const filteredSpaces = useMemo(() => {
    const keyword = nameFilter.trim().toLowerCase()
    if (!keyword) return spaces
    return spaces.filter((space) =>
      `${space.name} ${space.slug} ${space.description ?? ''}`.toLowerCase().includes(keyword),
    )
  }, [nameFilter, spaces])

  const selectedSpaceFromList = useMemo(() => {
    if (selectedSpaceId == null) return null
    return spaces.find((space) => space.id === selectedSpaceId) ?? null
  }, [selectedSpaceId, spaces])
  const managerUserOptions = useMemo(() => {
    const optionMap = new Map<number, string>()
    for (const user of users) optionMap.set(user.id, formatUserLabel(user.displayName, user.userName, user.id))
    for (const member of spaceManagerUsers) {
      const userId = Number(member.userId)
      if (!Number.isFinite(userId) || userId <= 0) continue
      if (!optionMap.has(userId)) optionMap.set(userId, formatUserLabel(member.displayName, member.userName, userId))
    }
    return [...optionMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [spaceManagerUsers, users])
  const managerTeamOptions = useMemo(() => {
    const optionMap = new Map<number, string>()
    for (const team of availableTeams) optionMap.set(team.id, team.name)
    for (const manager of spaceManagerTeams) {
      if (!optionMap.has(manager.teamId)) optionMap.set(manager.teamId, manager.teamName || `Team ${manager.teamId}`)
    }
    return [...optionMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [availableTeams, spaceManagerTeams])
  const loadedManagerTeamIds = useMemo(() => normalizeIdList(spaceManagerTeams.map((manager) => Number(manager.teamId))), [spaceManagerTeams])
  const loadedManagerUserIds = useMemo(() => normalizeIdList(spaceManagerUsers.map((manager) => Number(manager.userId))), [spaceManagerUsers])
  const loadSpaces = useCallback(async () => {
    if (!canView) {
      setSpaces([])
      return
    }
    try {
      setLoading(true)
      const list = await getSpaces()
      setSpaces([...list].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error: any) {
      message.error(error?.message || 'Failed to load spaces.')
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }, [canView])

  const loadSpaceManagers = useCallback(async (spaceId: number) => {
    try {
      setLoadingManagers(true)
      setManagersLoaded(false)
      const managers = await getSpaceManagers(spaceId)
      const nextTeams = managers.teams ?? []
      const nextUsers = managers.users ?? []
      setSpaceManagerTeams(nextTeams)
      setSpaceManagerUsers(nextUsers)
      setSelectedManagerTeamIds(normalizeIdList(nextTeams.map((manager) => Number(manager.teamId))))
      setSelectedManagerUserIds(normalizeIdList(nextUsers.map((manager) => Number(manager.userId))))
      setManagersLoaded(true)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load space managers.')
      setSpaceManagerTeams([])
      setSpaceManagerUsers([])
      setSelectedManagerTeamIds([])
      setSelectedManagerUserIds([])
      setManagersLoaded(false)
    } finally {
      setLoadingManagers(false)
    }
  }, [])

  const loadSpaceDetail = useCallback(async (spaceId: number) => {
    try {
      setLoadingDetail(true)
      const detail = await getSpace(spaceId)
      setSpaceDetail(detail)
      setEditFormState(toEditForm(detail))
    } catch (error: any) {
      message.error(error?.message || 'Failed to load space detail.')
      setSpaceDetail(null)
      setEditFormState(EMPTY_EDIT_FORM)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const loadManagerDialogData = useCallback(async () => {
    if (!canManageManagers) {
      setAvailableTeams([])
      return
    }

    try {
      setLoadingManagerDialogData(true)
      const systemTeamsResult = await getTeams({ spaceId: 0 })
      const mergedTeams = (systemTeamsResult.teams ?? [])
        .filter((team) => !isAutoSpaceOwnersTeamName(team.name))
        .sort((a, b) => a.name.localeCompare(b.name))
      setAvailableTeams(mergedTeams)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load manager options.')
      setAvailableTeams([])
    } finally {
      setLoadingManagerDialogData(false)
    }
  }, [canManageManagers])

  const loadUsers = useCallback(async () => {
    if (!canManageManagers) {
      setUsers([])
      return
    }
    try {
      setLoadingManagerUsers(true)
      const result = await getUsers({ pageIndex: 1, pageSize: 1000 })
      const nextUsers = [...(result.users ?? [])].sort((a, b) => {
        const left = formatUserLabel(a.displayName, a.userName, a.id).toLowerCase()
        const right = formatUserLabel(b.displayName, b.userName, b.id).toLowerCase()
        return left.localeCompare(right)
      })
      setUsers(nextUsers)
    } catch (error: any) {
      setUsers([])
    } finally {
      setLoadingManagerUsers(false)
    }
  }, [canManageManagers])

  useEffect(() => {
    void loadSpaces()
  }, [loadSpaces])

  useEffect(() => {
    if (selectedSpaceId == null) {
      setSpaceDetail(null)
      setSpaceManagerTeams([])
      setSpaceManagerUsers([])
      setSelectedManagerTeamIds([])
      setSelectedManagerUserIds([])
      setManagersLoaded(false)
      setEditFormState(EMPTY_EDIT_FORM)
      return
    }

    if (selectedSpaceFromList) {
      setSpaceDetail(selectedSpaceFromList)
      setEditFormState(toEditForm(selectedSpaceFromList))
    }

    void loadSpaceDetail(selectedSpaceId)
    void loadSpaceManagers(selectedSpaceId)
  }, [loadSpaceDetail, loadSpaceManagers, selectedSpaceFromList, selectedSpaceId])

  useEffect(() => {
    if (!canManageManagers || (!isDetailPage && !spaceDialogOpen)) return
    void loadManagerDialogData()
    void loadUsers()
  }, [canManageManagers, isDetailPage, loadManagerDialogData, loadUsers, selectedSpaceId, spaceDialogOpen])

  useEffect(() => {
    setExpandedSections(DEFAULT_DETAIL_EXPANDED)
  }, [selectedSpaceId])

  const openCreateDialog = () => {
    setCreateFormState(EMPTY_CREATE_FORM)
    setSpaceDialogOpen(true)
  }

  const openSpaceDetail = (spaceId: number) => {
    navigate(`/${currentSpaceId}/settings/spaces/Spaces-${spaceId}`)
  }

  const handleManagerTeamSelectionChange = (nextTeamIds: number[]) => {
    setSelectedManagerTeamIds(normalizeIdList(nextTeamIds))
  }

  const handleManagerMemberSelectionChange = (nextUserIds: number[]) => {
    setSelectedManagerUserIds(normalizeIdList(nextUserIds))
  }

  const handleCreateSpace = async () => {
    const name = createFormState.name.trim()
    const slug = createFormState.slug.trim() || normalizeSpaceSlug(name)
    if (!name) {
      message.warning('New space name is required.')
      return
    }

    try {
      setCreating(true)
      const createdSpace = await createSpace({
        name,
        slug: slug || undefined,
        description: createFormState.description.trim(),
        isPrivate: createFormState.isPrivate,
        ownerTeamIds: canManageManagers ? normalizeIdList(createFormState.ownerTeamIds) : undefined,
        ownerUserIds: canManageManagers ? normalizeIdList(createFormState.ownerUserIds) : undefined,
      })
      message.success('Space created.')
      setSpaceDialogOpen(false)
      await loadSpaces()
      if (createdSpace?.id > 0) openSpaceDetail(createdSpace.id)
    } catch (error: any) {
      message.error(error?.message || 'Failed to create space.')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateSpace = async () => {
    if (!spaceDetail) return
    const name = editFormState.name.trim()
    const slug = editFormState.slug.trim() || normalizeSpaceSlug(name)
    if (!name) {
      message.warning('Space name is required.')
      return
    }

    try {
      setSaving(true)
      const updatedSpace = await updateSpace({
        id: spaceDetail.id,
        name,
        slug: slug || undefined,
        description: editFormState.description.trim(),
        isPrivate: editFormState.isPrivate,
        taskQueueStopped: editFormState.taskQueueStopped,
        ownerTeamIds: canManageManagers && managersLoaded ? selectedManagerTeamIds : undefined,
        ownerUserIds: canManageManagers && managersLoaded ? selectedManagerUserIds : undefined,
      })
      setSpaceDetail(updatedSpace)
      setEditFormState(toEditForm(updatedSpace))
      setSpaces((previous) =>
        previous
          .map((space) => (space.id === updatedSpace.id ? { ...space, ...updatedSpace } : space))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      message.success('Space updated.')
      void loadSpaceManagers(updatedSpace.id)
    } catch (error: any) {
      message.error(error?.message || 'Failed to update space.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSpace = (space: SpaceDto) => {
    Modal.confirm({
      title: `Delete space "${space.name}"?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSpace({ id: space.id })
          message.success('Space deleted.')
          if (selectedSpaceId === space.id) {
            navigate(spacesListPath)
          }
          await loadSpaces()
        } catch (error: any) {
          message.error(error?.message || 'Failed to delete space.')
        }
      },
    })
  }

  const isDirty = useMemo(() => {
    if (!spaceDetail) return false
    const normalizedSlug = editFormState.slug.trim() || normalizeSpaceSlug(editFormState.name)
    const managerChanged = canManageManagers && managersLoaded && (
      !areIdListsEqual(selectedManagerTeamIds, loadedManagerTeamIds) ||
      !areIdListsEqual(selectedManagerUserIds, loadedManagerUserIds)
    )
    return (
      spaceDetail.name !== editFormState.name.trim() ||
      spaceDetail.slug !== normalizedSlug ||
      (spaceDetail.description ?? '') !== editFormState.description.trim() ||
      Boolean(spaceDetail.isPrivate) !== editFormState.isPrivate ||
      Boolean(spaceDetail.taskQueueStopped) !== editFormState.taskQueueStopped ||
      managerChanged
    )
  }, [canManageManagers, editFormState, loadedManagerTeamIds, loadedManagerUserIds, managersLoaded, selectedManagerTeamIds, selectedManagerUserIds, spaceDetail])

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Permission denied: `SpaceView` is required to view spaces.
      </div>
    )
  }

  if (isDetailPage) {
    if (loadingDetail && !spaceDetail) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm flex items-center justify-center">
          <Spin />
        </div>
      )
    }

    if (!spaceDetail) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="text-sm text-slate-600">Space not found.</div>
          <Button className="mt-4" onClick={() => navigate(spacesListPath)}>Back to spaces</Button>
        </div>
      )
    }

    const canDeleteThis = canDelete && !spaceDetail.isDefault && spaceDetail.id !== currentSpaceNumericId
    const teamsSettingsPath = `/${currentSpaceId}/settings/teams`
    const normalizedSlug = editFormState.slug.trim() || normalizeSpaceSlug(editFormState.name)
    const managersLoading = loadingManagers
    const taskStatusText = editFormState.taskQueueStopped ? 'Stopped' : 'Running'
    const taskStatusClass = editFormState.taskQueueStopped ? 'text-red-600' : 'text-emerald-700'
    const setAllExpanded = (expanded: boolean) =>
      setExpandedSections({
        name: expanded,
        managers: expanded,
        description: expanded,
        logo: expanded,
        taskStatus: expanded,
      })
    const toggleSection = (key: DetailSectionKey) =>
      setExpandedSections((previous) => ({ ...previous, [key]: !previous[key] }))
    const overflowItems: MenuProps['items'] = [
      {
        key: 'delete',
        label: 'Delete',
        danger: true,
        disabled: !canDeleteThis,
      },
    ]
    const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
      if (key === 'delete') handleDeleteSpace(spaceDetail)
    }

    return (
      <>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <nav className="mb-2 text-sm">
              <Link to={spacesListPath} className="text-squid-blue hover:underline">Spaces</Link>
            </nav>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="m-0 text-2xl font-semibold text-slate-900">{spaceDetail.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {spaceDetail.isDefault ? <DetailChip>Default</DetailChip> : null}
                  {spaceDetail.id === currentSpaceNumericId ? <DetailChip>Current</DetailChip> : null}
                  {editFormState.isPrivate ? <DetailChip>Private</DetailChip> : <DetailChip>Public</DetailChip>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button type="primary" onClick={() => void handleUpdateSpace()} loading={saving} disabled={!canEdit || !isDirty}>
                  Save
                </Button>
                <Dropdown menu={{ items: overflowItems, onClick: handleOverflowClick }} trigger={['click']} placement="bottomRight">
                  <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="Overflow Menu Button" />
                </Dropdown>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-1">
          <button
            type="button"
            className="text-xs uppercase tracking-[0.08em] font-semibold text-slate-500 hover:text-slate-700 border-0 bg-transparent cursor-pointer p-0"
            onClick={() => setAllExpanded(true)}
          >
            Expand all
          </button>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.08em] font-semibold text-slate-500 hover:text-slate-700 border-0 bg-transparent cursor-pointer p-0"
            onClick={() => setAllExpanded(false)}
          >
            Collapse all
          </button>
        </div>

        <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
          <DetailPanel
            title="Name"
            subtitle={(
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-700">{spaceDetail.name}</span>
                <span className="text-slate-400">{normalizedSlug}</span>
              </span>
            )}
            isOpen={expandedSections.name}
            onToggle={() => toggleSection('name')}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 max-w-[720px]">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <Input
                  value={editFormState.name}
                  onChange={(event) => {
                    const nextName = event.target.value
                    setEditFormState((previous) => ({
                      ...previous,
                      name: nextName,
                      slug: previous.slug || normalizeSpaceSlug(nextName),
                    }))
                  }}
                  disabled={!canEdit}
                  placeholder="Default"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
                <Input
                  value={editFormState.slug}
                  onChange={(event) => setEditFormState((previous) => ({ ...previous, slug: event.target.value }))}
                  disabled={!canEdit}
                  placeholder="default-space"
                />
              </div>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 px-3 py-2.5 flex items-center justify-between gap-4 max-w-[720px]">
              <div>
                <div className="text-sm font-medium text-slate-900">Private Space</div>
                <div className="text-xs text-slate-500">Only explicitly granted users and teams can access this space.</div>
              </div>
              <Switch
                checked={editFormState.isPrivate}
                onChange={(checked) => setEditFormState((previous) => ({ ...previous, isPrivate: checked }))}
                disabled={!canEdit}
              />
            </div>
          </DetailPanel>

          <DetailPanel
            title="Space Managers"
            subtitle="Select members and teams to be managers of this space."
            isOpen={expandedSections.managers}
            onToggle={() => toggleSection('managers')}
          >
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-semibold text-amber-900">Space Managers are responsible for which users can access this space.</div>
              <div className="mt-2 text-xs text-amber-800">
                <strong>How to give users access:</strong>
                <ol className="mt-1 mb-0 pl-5 list-decimal space-y-1">
                  <li>Create a new <Link to={teamsSettingsPath} className="text-squid-blue hover:underline">team</Link> or edit an existing team.</li>
                  <li>Include user roles (for example `Space Owner`) and scope them to this space.</li>
                  <li>Add or modify the members of the team.</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">Select space managers (members)</div>
                {managersLoading ? (
                  <div className="py-3 flex items-center justify-center"><Spin size="small" /></div>
                ) : (
                  <Select<number[]>
                    mode="multiple"
                    className="w-full max-w-[720px]"
                    value={selectedManagerUserIds}
                    onChange={handleManagerMemberSelectionChange}
                    options={managerUserOptions}
                    loading={loadingManagerUsers}
                    disabled={!canManageManagers}
                    placeholder="Select space managers (members)"
                    showSearch
                    optionFilterProp="label"
                    notFoundContent={loadingManagerUsers ? <Spin size="small" /> : 'No available users'}
                  />
                )}
                <div className="text-xs text-slate-500 mt-2">Changes are applied when you click Save.</div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">Select space managers (teams)</div>
                {loadingManagers && selectedManagerTeamIds.length === 0 ? (
                  <div className="py-3 flex items-center justify-center"><Spin size="small" /></div>
                ) : (
                  <Select<number[]>
                    mode="multiple"
                    className="w-full max-w-[720px]"
                    placeholder="Select space managers (teams)"
                    value={selectedManagerTeamIds}
                    onChange={handleManagerTeamSelectionChange}
                    options={managerTeamOptions}
                    loading={loadingManagerDialogData}
                    disabled={!canManageManagers}
                    showSearch
                    optionFilterProp="label"
                    notFoundContent={loadingManagerDialogData ? <Spin size="small" /> : 'No available teams'}
                  />
                )}
                <div className="text-xs text-slate-500 mt-2">Changes are applied when you click Save.</div>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Description"
            subtitle="Enter a short description for this space."
            isOpen={expandedSections.description}
            onToggle={() => toggleSection('description')}
          >
            <Input.TextArea
              value={editFormState.description}
              onChange={(event) => setEditFormState((previous) => ({ ...previous, description: event.target.value }))}
              disabled={!canEdit}
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="The default space"
              className="max-w-[720px]"
            />
          </DetailPanel>

          <DetailPanel
            title="Logo"
            subtitle={<SpaceListLogo spaceId={spaceDetail.id} name={spaceDetail.name} />}
            isOpen={expandedSections.logo}
            onToggle={() => toggleSection('logo')}
          >
            <div className="text-sm text-slate-600">Logo upload is not enabled in this screen yet.</div>
          </DetailPanel>

          <DetailPanel
            title="Task Processing Status"
            subtitle={(
              <span>
                Task processing is <span className={taskStatusClass}>{taskStatusText}</span>
              </span>
            )}
            isOpen={expandedSections.taskStatus}
            onToggle={() => toggleSection('taskStatus')}
            hasBorder={false}
          >
            <div className="rounded-md border border-slate-200 px-3 py-2.5 flex items-center justify-between gap-4 max-w-[720px]">
              <div>
                <div className="text-sm font-medium text-slate-900">Stop Task Queue</div>
                <div className="text-xs text-slate-500">Pause background task execution for this space.</div>
              </div>
              <Switch
                checked={editFormState.taskQueueStopped}
                onChange={(checked) => setEditFormState((previous) => ({ ...previous, taskQueueStopped: checked }))}
                disabled={!canEdit}
              />
            </div>
          </DetailPanel>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-semibold text-slate-900">Spaces</h1>
          <Button type="primary" onClick={openCreateDialog} disabled={!canCreate}>
            Add Space
          </Button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <Input
            placeholder="Filter by name..."
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            className="max-w-[420px]"
          />
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="py-10 flex items-center justify-center"><Spin /></div>
          ) : filteredSpaces.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No spaces found.</div>
          ) : (
            <ul className="m-0 p-0 list-none divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {filteredSpaces.map((space) => {
                const isCurrentSpace = space.id === currentSpaceNumericId
                return (
                  <li key={space.id}>
                    <button type="button" className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-0 bg-transparent cursor-pointer" onClick={() => openSpaceDetail(space.id)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          <SpaceListLogo spaceId={space.id} name={space.name} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="m-0 text-[15px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{space.name}</span>
                            {space.isDefault ? (
                              <span className="text-[10px] font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5">
                                Default
                              </span>
                            ) : null}
                            {isCurrentSpace ? (
                              <span className="text-[10px] font-medium rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5">
                                Current
                              </span>
                            ) : null}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5">{space.description || ''}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={spaceDialogOpen}
        title="Add New Space"
        onCancel={() => setSpaceDialogOpen(false)}
        onOk={() => void handleCreateSpace()}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={creating}
        okButtonProps={{ disabled: createFormState.name.trim().length === 0 || creating }}
        maskClosable={false}
        keyboard={false}
        closable={false}
        destroyOnHidden
        width={640}
      >
        <div className="pt-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New space name</label>
            <Input
              value={createFormState.name}
              onChange={(event) => {
                const nextName = event.target.value
                setCreateFormState((previous) => ({
                  ...previous,
                  name: nextName,
                  slug: previous.slug || normalizeSpaceSlug(nextName),
                }))
              }}
              placeholder="Default"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New space slug</label>
            <Input
              value={createFormState.slug}
              onChange={(event) => setCreateFormState((previous) => ({ ...previous, slug: event.target.value }))}
              placeholder="default-space"
            />
            <div className="mt-1 text-xs text-slate-500">Will be generated on save if left blank.</div>
          </div>

          <div className="pt-1">
            <h4 className="m-0 text-sm font-semibold text-slate-800">Select members and teams to be managers of this space</h4>
            <p className="mt-2 mb-0 text-xs text-slate-600 leading-relaxed">
              The members and teams selected will be added to the Space Manager team and will have management permissions and access to everything in this space.
            </p>
          </div>

          {canManageManagers ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select space managers (members)</label>
                <Select<number[]>
                  mode="multiple"
                  className="w-full"
                  value={createFormState.ownerUserIds}
                  onChange={(value) => setCreateFormState((previous) => ({ ...previous, ownerUserIds: normalizeIdList(value) }))}
                  options={managerUserOptions}
                  loading={loadingManagerUsers}
                  placeholder="Select space managers (members)"
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={loadingManagerUsers ? <Spin size="small" /> : 'No available users'}
                  getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select space managers (teams)</label>
                <Select<number[]>
                  mode="multiple"
                  className="w-full"
                  value={createFormState.ownerTeamIds}
                  onChange={(value) => setCreateFormState((previous) => ({ ...previous, ownerTeamIds: normalizeIdList(value) }))}
                  options={managerTeamOptions}
                  loading={loadingManagerDialogData}
                  placeholder="Select space managers (teams)"
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={loadingManagerDialogData ? <Spin size="small" /> : 'No available teams'}
                  getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
                />
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
