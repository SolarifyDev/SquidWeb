import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Input, Modal, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import { CloseOutlined, MoreOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  changePassword,
  createApiKey,
  deleteApiKey,
  getApiKeys,
  getCurrentUser,
  type ApiKeyDto,
  type CurrentUserDto,
} from 'pages/apis/account'
import { SettingsDetailPanel as DetailPanel } from 'pages/settings/components/DetailFormTemplate'
import { clearMustChangePasswordRequirement, getAuthUser } from 'utils/auth'

type AccountSectionKey = 'profile' | 'logins' | 'api-keys' | 'recent-activity'
type ProfileCardKey = 'displayName' | 'emailAddress'
type LoginCardKey = 'ldap'

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const ACCOUNT_SECTIONS: Array<{ key: AccountSectionKey; label: string }> = [
  { key: 'profile', label: 'My Profile' },
  { key: 'logins', label: 'My Logins' },
  { key: 'api-keys', label: 'My API Keys' },
  { key: 'recent-activity', label: 'My Recent Activity' },
]

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const INITIAL_PROFILE_CARDS: Record<ProfileCardKey, boolean> = {
  displayName: false,
  emailAddress: false,
}

const INITIAL_LOGIN_CARDS: Record<LoginCardKey, boolean> = {
  ldap: false,
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value || '-'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed))
}

function formatRelativeTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value || '-'

  const diffMs = parsed - Date.now()
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 24 * 365],
    ['month', 60 * 24 * 30],
    ['week', 60 * 24 * 7],
    ['day', 60 * 24],
    ['hour', 60],
    ['minute', 1],
  ]

  for (const [unit, minutesPerUnit] of units) {
    if (Math.abs(diffMinutes) >= minutesPerUnit || unit === 'minute') {
      return rtf.format(Math.round(diffMinutes / minutesPerUnit), unit)
    }
  }

  return value || '-'
}

function readSection(search: string): AccountSectionKey {
  const params = new URLSearchParams(search)
  const value = params.get('tab')
  return ACCOUNT_SECTIONS.some((section) => section.key === value)
    ? (value as AccountSectionKey)
    : 'profile'
}

export default function PersonalSettingsPage() {
  const authUser = getAuthUser()
  const location = useLocation()
  const navigate = useNavigate()
  const activeSection = useMemo(() => readSection(location.search), [location.search])

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUserDto | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([])
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [apiKeyDescription, setApiKeyDescription] = useState('')
  const [creatingApiKey, setCreatingApiKey] = useState(false)
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null)
  const [profileCards, setProfileCards] = useState<Record<ProfileCardKey, boolean>>(INITIAL_PROFILE_CARDS)
  const [loginCards, setLoginCards] = useState<Record<LoginCardKey, boolean>>(INITIAL_LOGIN_CARDS)

  const profileName = useMemo(
    () => currentUser?.displayName || authUser?.displayName || authUser?.userName || 'My Profile',
    [authUser?.displayName, authUser?.userName, currentUser?.displayName],
  )
  const emailAddress = currentUser?.emailAddress?.trim() || ''
  const userName = currentUser?.userName || authUser?.userName || '-'
  const avatarInitial = profileName.trim().charAt(0).toUpperCase() || 'U'
  const allProfileCardsExpanded = Object.values(profileCards).every(Boolean)
  const allLoginCardsExpanded = Object.values(loginCards).every(Boolean)

  const loadData = async () => {
    try {
      setLoading(true)
      const [userResult, apiKeysResult] = await Promise.all([
        getCurrentUser(),
        getApiKeys(),
      ])
      setCurrentUser(userResult)
      setApiKeys(apiKeysResult)
    } catch (error: any) {
      message.error(error?.message || 'Failed to load your profile.')
      setApiKeys([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const openSection = (section: AccountSectionKey) => {
    const params = new URLSearchParams(location.search)
    if (section === 'profile') params.delete('tab')
    else params.set('tab', section)
    const nextSearch = params.toString()
    navigate(`/users/me${nextSearch ? `?${nextSearch}` : ''}`)
  }

  const toggleProfileCard = (card: ProfileCardKey) => {
    setProfileCards((previous) => ({ ...previous, [card]: !previous[card] }))
  }

  const toggleAllProfileCards = () => {
    const nextValue = !allProfileCardsExpanded
    setProfileCards({
      displayName: nextValue,
      emailAddress: nextValue,
    })
  }

  const toggleLoginCard = (card: LoginCardKey) => {
    setLoginCards((previous) => ({ ...previous, [card]: !previous[card] }))
  }

  const toggleAllLoginCards = () => {
    const nextValue = !allLoginCardsExpanded
    setLoginCards({
      ldap: nextValue,
    })
  }

  const openPasswordDialog = () => {
    setPasswordDialogOpen(true)
  }

  const closePasswordDialog = () => {
    if (savingPassword) return
    setPasswordDialogOpen(false)
    setPasswordForm(EMPTY_PASSWORD_FORM)
  }

  const handleChangePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()
    const userId = currentUser?.id ?? authUser?.id

    if (!userId) {
      message.error('Current user is unavailable.')
      return
    }
    if (!currentPassword) {
      message.warning('Current password is required.')
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
      await changePassword({ userId, currentPassword, newPassword })
      clearMustChangePasswordRequirement()
      setPasswordDialogOpen(false)
      setPasswordForm(EMPTY_PASSWORD_FORM)
      message.success('Password updated.')
    } catch (error: any) {
      message.error(error?.message || 'Failed to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleCreateApiKey = async () => {
    try {
      setCreatingApiKey(true)
      const result = await createApiKey({ description: apiKeyDescription.trim() || undefined })
      setCreateDialogOpen(false)
      setApiKeyDescription('')
      if (result.plainTextKey) setRevealedApiKey(result.plainTextKey)
      message.success('API key created.')
      await loadData()
    } catch (error: any) {
      message.error(error?.message || 'Failed to create API key.')
    } finally {
      setCreatingApiKey(false)
    }
  }

  const handleDeleteApiKey = (apiKey: ApiKeyDto) => {
    Modal.confirm({
      title: 'Delete API key?',
      content: apiKey.description || apiKey.maskedKey,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteApiKey(apiKey.id)
          message.success('API key deleted.')
          await loadData()
        } catch (error: any) {
          message.error(error?.message || 'Failed to delete API key.')
        }
      },
    })
  }

  const headerMenuItems: MenuProps['items'] = [
    { key: 'refresh', label: 'Refresh' },
  ]

  const handleHeaderMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'refresh') void loadData()
  }

  const renderProfileSection = () => (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={toggleAllProfileCards}
          className="border-0 bg-transparent px-0 text-xs font-semibold tracking-[0.12em] text-squid-blue cursor-pointer"
        >
          {allProfileCardsExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-5">
          <div className="grid items-start gap-4" style={{ gridTemplateColumns: '260px 1fr' }}>
            <div className="text-base font-bold text-slate-900">Profile Picture</div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
                {avatarInitial}
              </div>
              <span>
                You can change your picture at{' '}
                <a href="https://oc.to/Gravatar" target="_blank" rel="noopener noreferrer" className="text-squid-blue hover:underline">
                  Gravatar.com
                </a>
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <DetailPanel
            title="Display Name"
            subtitle={profileName}
            subtitlePlaceholder={!profileName}
            isOpen={profileCards.displayName}
            onToggle={() => toggleProfileCard('displayName')}
            hasBorder={false}
          >
            <div className="space-y-3 max-w-[560px]">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Display Name</label>
                <Input value={profileName} readOnly />
              </div>
              <div className="text-xs text-slate-500">
                Profile editing is not available in this portal yet.
              </div>
            </div>
          </DetailPanel>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <DetailPanel
            title="Email Address"
            subtitle={emailAddress || 'No email address set'}
            subtitlePlaceholder={!emailAddress}
            isOpen={profileCards.emailAddress}
            onToggle={() => toggleProfileCard('emailAddress')}
            hasBorder={false}
          >
            <div className="space-y-3 max-w-[560px]">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                <Input value={emailAddress} readOnly placeholder="No email address set" />
              </div>
              <div className="text-xs text-slate-500">
                Email address is read-only here and comes from your account record.
              </div>
            </div>
          </DetailPanel>
        </div>
      </div>
    </>
  )

  const renderLoginsSection = () => (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={toggleAllLoginCards}
          className="border-0 bg-transparent px-0 text-xs font-semibold tracking-[0.12em] text-squid-blue cursor-pointer"
        >
          {allLoginCardsExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <DetailPanel
            title="LDAP"
            subtitle="No logins are associated"
            subtitlePlaceholder
            isOpen={loginCards.ldap}
            onToggle={() => toggleLoginCard('ldap')}
            hasBorder={false}
          >
            <div className="space-y-3 max-w-[560px]">
              <div className="text-sm text-slate-600">
                No LDAP logins are currently associated with this account.
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Username: {userName}
              </div>
            </div>
          </DetailPanel>
        </div>
      </div>
    </>
  )

  const renderApiKeysSection = () => (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-5">
        <div className="text-sm leading-6 text-slate-600">
          You can use an API key to connect{' '}
          <a
            href="https://oc.to/ExternalToolOctoTools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-squid-blue hover:underline"
          >
            automated tools
          </a>{' '}
          to Squid, in place of a username and password. API keys are useful because they avoid the need to record
          your personal password in configuration files and scripts. A unique API key can be created for each use,
          and then individually revoked when no longer needed.
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-5">
        <div className="flex justify-end">
          <Button type="primary" onClick={() => setCreateDialogOpen(true)}>
            New API Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No API keys created yet.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {apiKeys.map((apiKey) => {
              const entryTitle = apiKey.description?.trim() || apiKey.maskedKey || `API Key ${apiKey.id}`
              return (
                <li key={apiKey.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="m-0 truncate text-base font-semibold text-slate-900">{entryTitle}</h3>
                        <span className="inline-flex items-center rounded-full px-0 text-sm font-medium text-emerald-700">
                          Does not expire
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        Created{' '}
                        <abbr title={formatDateTime(apiKey.createdAtUtc)} className="cursor-help no-underline">
                          {formatRelativeTime(apiKey.createdAtUtc)}
                        </abbr>
                      </div>
                    </div>

                    <Button
                      type="text"
                      danger
                      icon={<CloseOutlined />}
                      aria-label={`Delete ${entryTitle}`}
                      onClick={() => handleDeleteApiKey(apiKey)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="primary" onClick={() => setCreateDialogOpen(true)}>
            New API Key
          </Button>
        </div>
      </section>
    </div>
  )

  const showHeaderMenu = activeSection !== 'api-keys'

  const renderHeaderActions = () => {
    if (activeSection === 'profile') {
      return (
        <>
          <Button type="primary" onClick={openPasswordDialog}>
            Change password
          </Button>
          <Button type="primary" disabled>
            Save
          </Button>
          <Dropdown menu={{ items: headerMenuItems, onClick: handleHeaderMenuClick }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="Overflow Menu Button" />
          </Dropdown>
        </>
      )
    }

    if (activeSection === 'logins') {
      return (
        <>
          <Button type="primary" disabled>
            Save
          </Button>
          <Dropdown menu={{ items: headerMenuItems, onClick: handleHeaderMenuClick }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="Overflow Menu Button" />
          </Dropdown>
        </>
      )
    }

    if (showHeaderMenu) {
      return (
        <Dropdown menu={{ items: headerMenuItems, onClick: handleHeaderMenuClick }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} aria-label="Overflow Menu Button" />
        </Dropdown>
      )
    }

    return null
  }

  const renderRecentActivitySection = () => (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-5">
      <div className="text-base font-bold text-slate-900">Recent Activity</div>
      <div className="mt-1 text-sm text-slate-500">Recent activity is not available in this portal yet.</div>
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        When personal activity events are exposed by the backend, they will appear here.
      </div>
    </div>
  )

  const pageTitle = ACCOUNT_SECTIONS.find((section) => section.key === activeSection)?.label || 'My Profile'

  return (
    <div className="min-h-full bg-slate-50">
      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="w-[240px] border-r border-slate-200 bg-white px-3 py-4">
          <div className="px-2 pb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400 font-semibold">Account</div>
          <nav className="space-y-1">
            {ACCOUNT_SECTIONS.map((section) => {
              const active = section.key === activeSection
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => openSection(section.key)}
                  className={[
                    'w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all',
                    active
                      ? 'bg-blue-50 text-squid-blue font-semibold ring-1 ring-blue-100'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {section.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm flex items-center justify-center">
              <Spin />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="m-0 text-[30px] leading-[1.2] font-semibold text-slate-900">{pageTitle}</h1>
                    <p className="mt-2 mb-0 text-sm text-slate-500">
                      {activeSection === 'profile'
                        ? 'Review your account details and profile information.'
                        : activeSection === 'logins'
                          ? 'Manage how you sign in to Squid.'
                          : activeSection === 'api-keys'
                            ? 'Create and revoke personal API keys.'
                            : 'Review the recent activity available for your account.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">{renderHeaderActions()}</div>
                </div>
              </div>

              {activeSection === 'profile'
                ? renderProfileSection()
                : activeSection === 'logins'
                  ? renderLoginsSection()
                  : activeSection === 'api-keys'
                    ? renderApiKeysSection()
                    : renderRecentActivitySection()}
            </div>
          )}
        </main>
      </div>

      <Modal
        open={passwordDialogOpen}
        title="Change Your Password"
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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
            <Input.Password
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
              autoComplete="current-password"
              placeholder="Enter current password"
            />
          </div>

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

      <Modal
        open={createDialogOpen}
        title="Create API Key"
        onCancel={() => setCreateDialogOpen(false)}
        onOk={() => void handleCreateApiKey()}
        okText="Create"
        confirmLoading={creatingApiKey}
      >
        <div className="pt-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <Input
            value={apiKeyDescription}
            onChange={(event) => setApiKeyDescription(event.target.value)}
            placeholder="Optional description"
          />
        </div>
      </Modal>

      <Modal
        open={revealedApiKey != null}
        title="API Key Created"
        footer={[
          <Button key="close" type="primary" onClick={() => setRevealedApiKey(null)}>
            Close
          </Button>,
        ]}
        onCancel={() => setRevealedApiKey(null)}
      >
        <div className="space-y-3">
          <p className="m-0 text-sm text-slate-600">
            Copy this API key now. You will not be able to see the full key again.
          </p>
          <Input.TextArea value={revealedApiKey || ''} autoSize={{ minRows: 3, maxRows: 6 }} readOnly />
        </div>
      </Modal>
    </div>
  )
}
