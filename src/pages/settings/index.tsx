import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'
import { usePermissions } from 'contexts/PermissionContext'
import { SpacesSettings } from './SpacesSettings'
import { TeamsSettings } from './TeamsSettings'
import { UsersSettings } from './UsersSettings'
import { UserRolesSettings } from './UserRolesSettings'
import { PackageStorageSettings } from './PackageStorageSettings'

type SettingsSection = {
  key: string
  label: string
  description: string
  requiredPermission: string
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'spaces', label: 'Spaces', description: 'Manage spaces and space-level configuration.', requiredPermission: 'SpaceView' },
  { key: 'teams', label: 'Teams', description: 'Manage team membership and access scope.', requiredPermission: 'TeamView' },
  { key: 'users', label: 'Users', description: 'Manage local users and identity details.', requiredPermission: 'UserView' },
  { key: 'user-roles', label: 'User Roles', description: 'Manage role definitions and granted permissions.', requiredPermission: 'UserRoleView' },
  { key: 'package-storage', label: 'Built-in feed storage', description: 'Choose where the built-in feed stores pushed packages.', requiredPermission: 'AdministerSystem' },
]

function getSectionKey(pathname: string, spaceId: string) {
  const prefix = `/${spaceId}/settings`
  if (!pathname.startsWith(prefix)) return ''
  const suffix = pathname.slice(prefix.length).replace(/^\/+/, '')
  const section = suffix.split('/')[0] ?? ''
  return section
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId = 'Spaces-1' } = useParams()
  const { space } = useSpace()
  const { loading: loadingPermissions, error: permissionError, hasPermission, permissions } = usePermissions()

  const sectionKey = getSectionKey(location.pathname, spaceId)
  const visibleSections = useMemo(
    () => SETTINGS_SECTIONS.filter((section) => hasPermission(section.requiredPermission)),
    [hasPermission],
  )

  const firstVisibleSection = visibleSections[0] ?? null
  const activeSection = useMemo(
    () => visibleSections.find((section) => section.key === sectionKey) ?? firstVisibleSection,
    [firstVisibleSection, sectionKey, visibleSections],
  )

  useEffect(() => {
    if (loadingPermissions) return
    if (visibleSections.length === 0) return
    if (!activeSection) {
      navigate(buildSectionPath(firstVisibleSection!.key), { replace: true })
    }
  }, [activeSection, firstVisibleSection, loadingPermissions, navigate, visibleSections])

  const buildSectionPath = (sectionKeyToOpen: string) => {
    if (sectionKeyToOpen !== 'teams') return `/${spaceId}/settings/${sectionKeyToOpen}`
    const teamSpace = encodeURIComponent(space.name || 'Default')
    return `/${spaceId}/settings/teams?spaces=${teamSpace}`
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="h-16 px-6 flex items-center border-b border-slate-200 bg-white">
        <h1 className="m-0 text-[30px] leading-[1.2] font-semibold text-slate-900">Settings</h1>
      </div>

      <div className="flex min-h-[calc(100vh-160px)]">
        <aside className="w-[240px] border-r border-slate-200 bg-white px-3 py-4">
          <div className="px-2 pb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400 font-semibold">Configuration</div>
          <nav className="space-y-1">
            {visibleSections.map((section) => {
              const active = section.key === activeSection?.key
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(buildSectionPath(section.key))}
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

        <main className="min-w-0 flex-1 p-6">
          {loadingPermissions ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-600">Loading permissions...</div>
            </div>
          ) : permissionError ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="m-0 text-xl font-semibold text-slate-900">Settings</h2>
              <p className="mt-2 mb-0 text-sm text-slate-600">{permissionError}</p>
            </div>
          ) : visibleSections.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h2 className="m-0 text-xl font-semibold text-amber-900">Access denied</h2>
              <p className="mt-2 mb-0 text-sm text-amber-800">You do not have permission to view any Settings section.</p>
            </div>
          ) : activeSection?.key === 'spaces' ? (
            <SpacesSettings
              currentSpaceId={spaceId}
              canView={hasPermission('SpaceView')}
              canCreate={hasPermission('SpaceCreate')}
              canEdit={hasPermission('SpaceEdit')}
              canDelete={hasPermission('SpaceDelete')}
              canManageManagers={hasPermission('TeamView') && hasPermission('TeamEdit') && hasPermission('UserRoleView')}
            />
          ) : activeSection?.key === 'teams' ? (
            <TeamsSettings
              spaceId={spaceId}
              canView={hasPermission('TeamView')}
              canCreate={hasPermission('TeamCreate')}
              canEdit={hasPermission('TeamEdit')}
              canDelete={hasPermission('TeamDelete')}
            />
          ) : activeSection?.key === 'users' ? (
            <UsersSettings
              spaceId={spaceId}
              canView={hasPermission('UserView')}
              canEdit={hasPermission('UserEdit')}
              canResetPassword={permissions.includes('UserEdit')}
            />
          ) : activeSection?.key === 'user-roles' ? (
            <UserRolesSettings
              canView={hasPermission('UserRoleView')}
              canEdit={hasPermission('UserRoleEdit')}
            />
          ) : activeSection?.key === 'package-storage' ? (
            <PackageStorageSettings />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="m-0 text-xl font-semibold text-slate-900">{activeSection?.label}</h2>
              <p className="mt-2 mb-0 text-sm text-slate-600">{activeSection?.description}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
