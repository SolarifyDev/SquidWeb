import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Dropdown, Input, Modal, Spin, Switch, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { changePassword, updateUserStatus } from 'pages/apis/account'
import { getTeamMembers, getTeams, type TeamDto, type TeamMemberDto } from 'pages/apis/team'
import { createUser, getUsers, type UserDto } from 'pages/apis/user'
import { clearMustChangePasswordRequirement, getAuthUser } from 'utils/auth'
import PageContainer from 'components/PageContainer'
import { SettingsDetailPanel as DetailPanel } from './components/DetailFormTemplate'

interface UsersSettingsProps {
  canView: boolean
  canEdit: boolean
  canResetPassword: boolean
  spaceId: string
}

interface UserFormState {
  userName: string
  displayName: string
  password: string
}

interface UserDetailFormState {
  displayName: string
  emailAddress: string
  isActive: boolean
}

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type PasswordDialogMode = 'self' | 'reset'

type UserCardKey = 'username' | 'displayName' | 'emailAddress' | 'isActive' | 'apiKeys' | 'ldap' | 'teams'

const EMPTY_USER_FORM: UserFormState = {
  userName: '',
  displayName: '',
  password: '',
}

const EMPTY_DETAIL_FORM: UserDetailFormState = {
  displayName: '',
  emailAddress: '',
  isActive: true,
}

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const DEFAULT_EXPANDED_CARDS: Record<UserCardKey, boolean> = {
  username: true,
  displayName: true,
  emailAddress: true,
  isActive: true,
  apiKeys: false,
  ldap: false,
  teams: true,
}

function parseSpaceNumericId(spaceId: string): number {
  const match = spaceId.match(/^Spaces-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(spaceId)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

function extractUserSlug(pathname: string, spaceId: string): string | null {
  const prefix = `/${spaceId}/settings/users/`
  if (!pathname.startsWith(prefix)) return null
  const segment = pathname.slice(prefix.length).split('/')[0] ?? ''
  return segment ? decodeURIComponent(segment) : null
}

function parseUserIdFromSlug(userSlug: string | null): number | null {
  if (!userSlug) return null
  const match = userSlug.match(/^Users-(\d+)$/i)
  if (match) return Number(match[1])
  const numeric = Number(userSlug)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

export function UsersSettings({ canView, canEdit, canResetPassword, spaceId }: UsersSettingsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const numericSpaceId = useMemo(() => parseSpaceNumericId(spaceId), [spaceId])
  const authUser = useMemo(() => getAuthUser(), [])

  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserDto[]>([])
  const [keyword, setKeyword] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formState, setFormState] = useState<UserFormState>(EMPTY_USER_FORM)
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingUserStatus, setSavingUserStatus] = useState(false)
  const [passwordDialogMode, setPasswordDialogMode] = useState<PasswordDialogMode>('self')
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserDto | null>(null)
  const [detailForm, setDetailForm] = useState<UserDetailFormState>(EMPTY_DETAIL_FORM)
  const [loadingUserTeams, setLoadingUserTeams] = useState(false)
  const [userTeams, setUserTeams] = useState<TeamDto[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<UserCardKey, boolean>>(DEFAULT_EXPANDED_CARDS)

  const userSlug = useMemo(() => extractUserSlug(location.pathname, spaceId), [location.pathname, spaceId])
  const selectedUserId = useMemo(() => parseUserIdFromSlug(userSlug), [userSlug])
  const selectedUser = useMemo(() => {
    if (selectedUserId == null) return null
    return users.find((user) => user.id === selectedUserId) ?? null
  }, [selectedUserId, users])
  const isDetailPage = userSlug != null
  const usersListPath = `/${spaceId}/settings/users`
  const currentUserId = authUser?.id ?? null

  const canShowResetPassword = useCallback((targetUser: UserDto | null) => {
    if (!targetUser) return false
    if (!canResetPassword) return false
    if (currentUserId == null) return false
    if (targetUser.id === currentUserId) return false
    if (targetUser.isSystem) return false
    return true
  }, [canResetPassword, currentUserId])

  const filteredUsers = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) => {
      const text = `${user.displayName ?? ''} ${user.userName ?? ''} ${user.emailAddress ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [keyword, users])

  const loadUsers = useCallback(async () => {
    if (!canView) {
      setUsers([])
      return
    }
    try {
      setLoading(true)
      const result = await getUsers({ pageIndex: 1, pageSize: 1000 })
      const nextUsers = [...(result.users ?? [])].sort((a, b) => {
        const left = `${a.displayName || ''} ${a.userName || ''}`.trim().toLowerCase()
        const right = `${b.displayName || ''} ${b.userName || ''}`.trim().toLowerCase()
        return left.localeCompare(right)
      })
      setUsers(nextUsers)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load users.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [canView])

  const loadUserTeams = useCallback(async (userId: number) => {
    try {
      setLoadingUserTeams(true)
      const teamsResult = await getTeams({ spaceId: numericSpaceId })
      const sourceTeams = teamsResult.teams ?? []
      const results = await Promise.all(
        sourceTeams.map(async (team) => {
          try {
            const membersResult = await getTeamMembers(team.id)
            const members: TeamMemberDto[] = membersResult.members ?? []
            const isMember = members.some((item) => Number(item.userId) === userId)
            return isMember ? team : null
          } catch {
            return null
          }
        }),
      )
      const teamsForUser = results
        .filter((team): team is TeamDto => team != null)
        .sort((a, b) => a.name.localeCompare(b.name))
      setUserTeams(teamsForUser)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load user teams.')
      setUserTeams([])
    } finally {
      setLoadingUserTeams(false)
    }
  }, [numericSpaceId])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!selectedUser) {
      setDetailForm(EMPTY_DETAIL_FORM)
      return
    }
    setDetailForm({
      displayName: selectedUser.displayName || selectedUser.userName,
      emailAddress: selectedUser.emailAddress ?? '',
      isActive: selectedUser.isDisabled === true ? false : selectedUser.isActive !== false,
    })
  }, [selectedUser])

  useEffect(() => {
    if (selectedUserId == null) {
      setUserTeams([])
      return
    }
    void loadUserTeams(selectedUserId)
  }, [loadUserTeams, selectedUserId])

  const openCreateDialog = () => {
    setFormState(EMPTY_USER_FORM)
    setCreateDialogOpen(true)
  }

  const handleCreateUser = async () => {
    const userName = formState.userName.trim()
    const displayName = formState.displayName.trim()
    const password = formState.password

    if (!userName) {
      message.warning('Username is required.')
      return
    }
    if (!password) {
      message.warning('Password is required.')
      return
    }

    try {
      setSaving(true)
      await createUser({
        userName,
        password,
        displayName: displayName || userName,
      })
      message.success('User created.')
      setCreateDialogOpen(false)
      await loadUsers()
    } catch (error: any) {
      message.error(error?.message || 'Failed to create user.')
    } finally {
      setSaving(false)
    }
  }

  const openUserDetail = (userId: number) => {
    navigate(`/${spaceId}/settings/users/Users-${userId}`)
  }

  const handleToggleCard = (key: UserCardKey) => {
    setExpandedCards((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const handleExpandAll = () => {
    setExpandedCards({
      username: true,
      displayName: true,
      emailAddress: true,
      isActive: true,
      apiKeys: true,
      ldap: true,
      teams: true,
    })
  }

  const handleCollapseAll = () => {
    setExpandedCards({
      username: false,
      displayName: false,
      emailAddress: false,
      isActive: false,
      apiKeys: false,
      ldap: false,
      teams: false,
    })
  }

  const openSelfPasswordDialog = () => {
    if (!selectedUser) return
    setPasswordDialogMode('self')
    setPasswordTargetUser(selectedUser)
    setPasswordForm(EMPTY_PASSWORD_FORM)
    setPasswordDialogOpen(true)
  }

  const openResetPasswordDialog = (targetUser?: UserDto | null) => {
    const resolvedTarget = targetUser ?? selectedUser
    if (!resolvedTarget) return
    setPasswordDialogMode('reset')
    setPasswordTargetUser(resolvedTarget)
    setPasswordForm(EMPTY_PASSWORD_FORM)
    setPasswordDialogOpen(true)
  }

  const closePasswordDialog = () => {
    if (savingPassword) return
    setPasswordDialogOpen(false)
    setPasswordForm(EMPTY_PASSWORD_FORM)
    setPasswordTargetUser(null)
  }

  const handleChangePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()
    const targetUser = passwordTargetUser ?? selectedUser
    const userId = targetUser?.id
    const isSelfMode = passwordDialogMode === 'self'
    const isResetMode = passwordDialogMode === 'reset'

    if (!userId) {
      message.error('Current user is unavailable.')
      return
    }
    if (isSelfMode && !currentPassword) {
      message.warning('Current password is required.')
      return
    }
    if (isResetMode && !canShowResetPassword(targetUser)) {
      message.error('权限不足')
      return
    }
    if (!newPassword) {
      message.warning('New password is required.')
      return
    }
    if (newPassword.length < 6) {
      message.warning('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      message.warning('Passwords do not match.')
      return
    }

    try {
      setSavingPassword(true)
      await changePassword({
        userId,
        currentPassword: isSelfMode ? currentPassword : null,
        newPassword,
      })
      if (isSelfMode) clearMustChangePasswordRequirement()
      setPasswordDialogOpen(false)
      setPasswordForm(EMPTY_PASSWORD_FORM)
      if (isResetMode) {
        message.success('密码已重置，该用户下次登录时需修改密码')
      } else {
        message.success('Password updated.')
      }
    } catch (error: any) {
      const errorMessage = String(error?.message || '')
      if (errorMessage.includes('Permission denied: UserEdit') || error?.status === 403) {
        message.error('权限不足')
      } else {
        message.error(errorMessage || 'Failed to change password.')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  const showStatusToggle = useMemo(() => canShowResetPassword(selectedUser), [canShowResetPassword, selectedUser])

  const handleToggleUserActive = async (nextIsActive: boolean) => {
    if (!selectedUser || !showStatusToggle || savingUserStatus) return
    const previousIsActive = detailForm.isActive
    setDetailForm((previous) => ({ ...previous, isActive: nextIsActive }))

    try {
      setSavingUserStatus(true)
      await updateUserStatus(selectedUser.id, { isDisabled: !nextIsActive })
      setUsers((previous) =>
        previous.map((user) =>
          user.id === selectedUser.id
            ? { ...user, isActive: nextIsActive, isDisabled: !nextIsActive }
            : user,
        ),
      )
      message.success(nextIsActive ? 'User enabled.' : 'User disabled.')
    } catch (error: any) {
      setDetailForm((previous) => ({ ...previous, isActive: previousIsActive }))
      const errorMessage = String(error?.message || '')
      if (errorMessage.includes('Cannot disable your own account')) {
        message.error('Cannot disable your own account.')
      } else if (errorMessage.includes('Cannot disable a system user')) {
        message.error('Cannot disable a system user.')
      } else if (errorMessage.includes('Permission denied: UserEdit') || error?.status === 403) {
        message.error('权限不足')
      } else {
        message.error(errorMessage || 'Failed to update user status.')
      }
    } finally {
      setSavingUserStatus(false)
    }
  }

  const overflowMenuItems: MenuProps['items'] = [
    { key: 'disable', label: 'Disable' },
    { key: 'delete', label: 'Delete' },
    { type: 'divider' },
    { key: 'audit', label: 'Audit Trail' },
  ]

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'audit') {
      message.info('Audit Trail is not available yet.')
      return
    }
    message.info(`${String(key)} is not implemented yet.`)
  }

  const allExpanded = Object.values(expandedCards).every(Boolean)
  const passwordModal = (
    <Modal
      open={passwordDialogOpen}
      title={passwordDialogMode === 'reset' ? 'Reset Password' : 'Change Your Password'}
      onCancel={closePasswordDialog}
      footer={[
        <Button key="cancel" onClick={closePasswordDialog} disabled={savingPassword}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={() => void handleChangePassword()} loading={savingPassword}>
          Save
        </Button>,
      ]}
    >
      <div className="space-y-4 pt-2">
        {passwordDialogMode === 'self' ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
            <Input.Password
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
              autoComplete="current-password"
              placeholder="Enter current password"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <Input.Password
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
          <Input.Password
            value={passwordForm.confirmPassword}
            onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            placeholder="Re-enter new password"
          />
        </div>
      </div>
    </Modal>
  )

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Permission denied: `UserView` is required to view users.
      </div>
    )
  }

  if (isDetailPage) {
    if (selectedUserId == null) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="text-sm text-slate-600">Invalid user id in url.</div>
          <Button className="mt-4" onClick={() => navigate(usersListPath)}>Back to users</Button>
        </div>
      )
    }

    if (loading && users.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-10 flex items-center justify-center">
          <Spin />
        </div>
      )
    }

    if (!selectedUser) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="text-sm text-slate-600">User not found.</div>
          <Button className="mt-4" onClick={() => navigate(usersListPath)}>Back to users</Button>
        </div>
      )
    }

    const isSelfSelectedUser = currentUserId != null && selectedUser.id === currentUserId
    const showResetButton = canShowResetPassword(selectedUser)

    return (
      <>
        <PageContainer>
            <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
              <div className="px-6 pt-4 pb-3 border-b border-gray-200">
                <nav className="mb-2">
                  <ol className="flex items-center gap-1 text-sm">
                    <li>
                      <Link to={usersListPath} className="text-squid-blue hover:underline">Users</Link>
                    </li>
                  </ol>
                </nav>

                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl font-semibold text-gray-900 m-0">{selectedUser.displayName || selectedUser.userName}</h1>
                  <div className="flex items-center gap-2">
                    {isSelfSelectedUser ? (
                      <Button onClick={openSelfPasswordDialog} title="Change your password">
                        Change password
                      </Button>
                    ) : null}
                    {showResetButton ? (
                      <Button onClick={() => openResetPasswordDialog(selectedUser)} title="Reset user password">
                        Reset password
                      </Button>
                    ) : null}
                    <Button
                      type="primary"
                      className="!bg-green-700 hover:!bg-green-800 !border-green-700 disabled:!bg-gray-300 disabled:!border-gray-300 disabled:!text-white"
                      disabled
                      title="User update API is not available yet"
                    >
                      Save
                    </Button>
                    <Dropdown menu={{ items: overflowMenuItems, onClick: handleOverflowClick }} trigger={['click']}>
                      <Button icon={<MoreOutlined />} aria-label="Overflow Menu Button" />
                    </Dropdown>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                    onClick={() => {
                      if (allExpanded) handleCollapseAll()
                      else handleExpandAll()
                    }}
                  >
                    {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
                  </button>
                </div>
              </div>

              <DetailPanel
                title="Username"
                subtitle="The username that the user authenticates with."
                isOpen={expandedCards.username}
                onToggle={() => handleToggleCard('username')}
              >
                <div className="max-w-[600px]">
                  <Input value={selectedUser.userName} disabled />
                </div>
              </DetailPanel>

              <DetailPanel
                title="Display Name"
                subtitle={detailForm.displayName || 'No display name set'}
                subtitlePlaceholder={!detailForm.displayName}
                isOpen={expandedCards.displayName}
                onToggle={() => handleToggleCard('displayName')}
              >
                <div className="max-w-[600px]">
                  <Input
                    value={detailForm.displayName}
                    onChange={(event) => setDetailForm((previous) => ({ ...previous, displayName: event.target.value }))}
                    disabled={!canEdit}
                    placeholder="Display name"
                  />
                </div>
              </DetailPanel>

              <DetailPanel
                title="Email Address"
                subtitle={detailForm.emailAddress || 'No email address set'}
                subtitlePlaceholder={!detailForm.emailAddress}
                isOpen={expandedCards.emailAddress}
                onToggle={() => handleToggleCard('emailAddress')}
              >
                <div className="max-w-[600px]">
                  <Input
                    value={detailForm.emailAddress}
                    onChange={(event) => setDetailForm((previous) => ({ ...previous, emailAddress: event.target.value }))}
                    disabled={!canEdit}
                    placeholder="Email address"
                  />
                </div>
              </DetailPanel>

              <DetailPanel
                title="Is Active"
                subtitle={detailForm.isActive ? 'Active' : 'Inactive'}
                isOpen={expandedCards.isActive}
                onToggle={() => handleToggleCard('isActive')}
              >
                {showStatusToggle ? (
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={detailForm.isActive}
                      loading={savingUserStatus}
                      onChange={(checked) => void handleToggleUserActive(checked)}
                    />
                    <span className="text-sm text-slate-700">
                      {detailForm.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-600">
                    {detailForm.isActive ? 'Active' : 'Disabled'}
                  </span>
                )}
              </DetailPanel>

              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Logins
              </div>

              <DetailPanel
                title="Api Keys"
                subtitle="No API keys available."
                isOpen={expandedCards.apiKeys}
                onToggle={() => handleToggleCard('apiKeys')}
              >
                <div className="text-sm text-gray-600">No API keys available.</div>
              </DetailPanel>

              <DetailPanel
                title="LDAP"
                subtitle={`User principal name: ${selectedUser.userName.toUpperCase()}@local`}
                isOpen={expandedCards.ldap}
                onToggle={() => handleToggleCard('ldap')}
              >
                <div className="text-sm text-gray-600">LDAP details are read-only.</div>
              </DetailPanel>

              <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
                Teams
              </div>

              <DetailPanel
                title="Teams"
                subtitle={
                  userTeams.length > 0
                    ? userTeams.map((team) => team.name).join(', ')
                    : 'No teams found for this user.'
                }
                subtitlePlaceholder={userTeams.length === 0}
                isOpen={expandedCards.teams}
                onToggle={() => handleToggleCard('teams')}
                hasBorder={false}
              >
                <div className="text-xs text-gray-500 mb-3">
                  User permissions are governed by <Link to={`/${spaceId}/settings/teams`} className="text-squid-blue hover:underline">team membership</Link>.
                </div>

                {loadingUserTeams ? (
                  <div className="py-4 flex items-center justify-center"><Spin size="small" /></div>
                ) : userTeams.length === 0 ? (
                  <div className="text-sm text-gray-600">No teams found for this user.</div>
                ) : (
                  <ul className="m-0 p-0 list-none divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
                    {userTeams.map((team) => (
                      <li key={team.id} className="px-3 py-2.5">
                        <Link className="text-sm text-gray-800 hover:text-squid-blue" to={`/${spaceId}/settings/teams/Teams-${team.id}`}>
                          {team.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailPanel>
            </div>
        </PageContainer>

        {passwordModal}

      </>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-semibold text-slate-900">Users</h1>
          <Button type="primary" onClick={openCreateDialog} disabled={!canEdit}>
            Add User
          </Button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <Input
            placeholder="Filter by username/display name..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            allowClear
            className="max-w-[380px]"
          />
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="py-10 flex items-center justify-center"><Spin /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No users found.</div>
          ) : (
            <ul className="m-0 p-0 list-none divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {filteredUsers.map((user) => (
                <li key={user.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <button
                    type="button"
                    onClick={() => openUserDetail(user.id)}
                    className="flex-1 min-w-0 text-left border-0 bg-transparent p-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>{user.displayName || user.userName}</span>
                        <span className={user.isDisabled ? 'text-[10px] font-medium rounded-full px-2 py-0.5 bg-rose-100 text-rose-700' : 'text-[10px] font-medium rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700'}>
                          {user.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{user.userName}</div>
                      {user.emailAddress ? <div className="text-xs text-slate-500">{user.emailAddress}</div> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={createDialogOpen}
        title="Add User"
        onCancel={() => setCreateDialogOpen(false)}
        onOk={() => void handleCreateUser()}
        okText="Create"
        confirmLoading={saving}
        okButtonProps={{ disabled: !canEdit }}
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <Input
              value={formState.userName}
              onChange={(event) => setFormState((previous) => ({ ...previous, userName: event.target.value }))}
              placeholder="new.user"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
            <Input
              value={formState.displayName}
              onChange={(event) => setFormState((previous) => ({ ...previous, displayName: event.target.value }))}
              placeholder="New User"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <Input.Password
              value={formState.password}
              onChange={(event) => setFormState((previous) => ({ ...previous, password: event.target.value }))}
              placeholder="••••••••"
            />
          </div>
        </div>
      </Modal>
      {passwordModal}
    </>
  )
}
