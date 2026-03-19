import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dropdown, Input, Modal, Spin, Tooltip, message, type MenuProps } from 'antd'
import { MoreOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { getAllPermissions, type PermissionDefinitionDto } from 'pages/apis/permission'
import {
  createUserRole,
  deleteUserRole,
  getUserRoles,
  updateUserRole,
  type UserRoleDto,
} from 'pages/apis/userRole'
import { SettingsDetailPanel as DetailPanel } from './components/DetailFormTemplate'

interface UserRolesSettingsProps {
  canView: boolean
  canEdit: boolean
}

interface RoleFormState {
  name: string
  description: string
  permissions: string[]
}

type DetailSectionKey = 'name' | 'description'
type PermissionTabKey = 'system' | 'space'

const EMPTY_ROLE_FORM: RoleFormState = {
  name: '',
  description: '',
  permissions: [],
}

const DEFAULT_DETAIL_EXPANDED: Record<DetailSectionKey, boolean> = {
  name: false,
  description: false,
}

const CREATE_DETAIL_EXPANDED: Record<DetailSectionKey, boolean> = {
  name: true,
  description: true,
}

const PERMISSION_DESCRIPTION_OVERRIDES: Record<string, string> = {
  AdministerSystem: 'Administer the system.',
  InterruptionViewSubmitResponsible: 'View and submit responsible interruptions.',
  ExportPrivateKey: 'Export private keys.',
}

const VIEW_DEPENDENCY_RULES: Array<{ suffix: string; requiredViewSuffix: string }> = [
  { suffix: 'ViewSubmitResponsible', requiredViewSuffix: 'View' },
  { suffix: 'ExportPrivateKey', requiredViewSuffix: 'View' },
  { suffix: 'EditUnscoped', requiredViewSuffix: 'ViewUnscoped' },
  { suffix: 'Administer', requiredViewSuffix: 'View' },
  { suffix: 'Download', requiredViewSuffix: 'View' },
  { suffix: 'Create', requiredViewSuffix: 'View' },
  { suffix: 'Delete', requiredViewSuffix: 'View' },
  { suffix: 'Cancel', requiredViewSuffix: 'View' },
  { suffix: 'Submit', requiredViewSuffix: 'View' },
  { suffix: 'Resolve', requiredViewSuffix: 'View' },
  { suffix: 'Report', requiredViewSuffix: 'View' },
  { suffix: 'Edit', requiredViewSuffix: 'View' },
  { suffix: 'Push', requiredViewSuffix: 'View' },
]

function permissionCategory(name: string) {
  const direct = ['AdministerSystem']
  if (direct.includes(name)) return 'System'
  const match = name.match(/^(.*?)(View|Create|Edit|Delete)$/)
  if (!match) return 'Other'
  return match[1] || 'Other'
}

function scopeBadgeClass(scope: string) {
  if (scope === 'SystemOnly') return 'border-purple-200 bg-purple-50 text-purple-700'
  if (scope === 'SpaceOnly') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (scope === 'Mixed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function splitCamelCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function pluralizePhrase(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return normalized
  if (normalized.endsWith('s')) return normalized
  if (normalized.endsWith('y') && !/[aeiou]y$/i.test(normalized)) return `${normalized.slice(0, -1)}ies`
  return `${normalized}s`
}

function describePermission(permissionName: string) {
  if (PERMISSION_DESCRIPTION_OVERRIDES[permissionName]) return PERMISSION_DESCRIPTION_OVERRIDES[permissionName]

  const suffixes: Array<{ suffix: string; action: string }> = [
    { suffix: 'ExportPrivateKey', action: 'Export private keys from' },
    { suffix: 'ViewSubmitResponsible', action: 'View and submit responsible' },
    { suffix: 'Administer', action: 'Administer' },
    { suffix: 'Download', action: 'Download' },
    { suffix: 'Create', action: 'Create' },
    { suffix: 'Delete', action: 'Delete' },
    { suffix: 'Cancel', action: 'Cancel' },
    { suffix: 'Submit', action: 'Submit' },
    { suffix: 'Resolve', action: 'Resolve' },
    { suffix: 'Report', action: 'Report' },
    { suffix: 'Edit', action: 'Edit' },
    { suffix: 'View', action: 'View' },
    { suffix: 'Push', action: 'Push' },
  ]

  for (const { suffix, action } of suffixes) {
    if (!permissionName.endsWith(suffix)) continue
    const subject = permissionName.slice(0, -suffix.length)
    if (!subject) break
    const normalizedSubject = pluralizePhrase(splitCamelCase(subject))
    return `${action} ${normalizedSubject}.`
  }

  return `${splitCamelCase(permissionName)}.`
}

function normalizePermissions(permissions: string[]) {
  return [...new Set(permissions)].sort((left, right) => left.localeCompare(right))
}

function arePermissionsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function findRequiredViewPermission(permissionName: string, availablePermissions: Set<string>) {
  for (const rule of VIEW_DEPENDENCY_RULES) {
    if (!permissionName.endsWith(rule.suffix)) continue
    const subject = permissionName.slice(0, -rule.suffix.length)
    if (!subject) return null
    const requiredViewPermission = `${subject}${rule.requiredViewSuffix}`
    if (requiredViewPermission !== permissionName && availablePermissions.has(requiredViewPermission)) return requiredViewPermission
  }
  return null
}

function buildPermissionDependencyState(rawPermissions: string[], permissionDefinitions: PermissionDefinitionDto[]) {
  const availablePermissions = new Set(permissionDefinitions.map((definition) => definition.name))
  const effectivePermissions = new Set(rawPermissions)
  const lockedViewPermissions = new Set<string>()
  const lockedViewReasons = new Map<string, string[]>()

  for (const permissionName of rawPermissions) {
    const requiredViewPermission = findRequiredViewPermission(permissionName, availablePermissions)
    if (!requiredViewPermission) continue
    effectivePermissions.add(requiredViewPermission)
    lockedViewPermissions.add(requiredViewPermission)
    const reasons = lockedViewReasons.get(requiredViewPermission) ?? []
    reasons.push(permissionName)
    lockedViewReasons.set(requiredViewPermission, reasons)
  }

  return {
    effectivePermissions: Array.from(effectivePermissions).sort((left, right) => left.localeCompare(right)),
    lockedViewPermissions,
    lockedViewReasons,
  }
}

function LockedPermissionCheck({ title }: { title: string }) {
  return (
    <Tooltip title={title}>
      <span className="inline-flex h-4 w-4 items-center justify-center text-slate-900">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      </span>
    </Tooltip>
  )
}

export function UserRolesSettings({ canView, canEdit }: UserRolesSettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<UserRoleDto[]>([])
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinitionDto[]>([])
  const [keyword, setKeyword] = useState('')

  const [formState, setFormState] = useState<RoleFormState>(EMPTY_ROLE_FORM)
  const [saving, setSaving] = useState(false)

  const [detailFormState, setDetailFormState] = useState<RoleFormState>(EMPTY_ROLE_FORM)
  const [createExpanded, setCreateExpanded] = useState<Record<DetailSectionKey, boolean>>(CREATE_DETAIL_EXPANDED)
  const [detailExpanded, setDetailExpanded] = useState<Record<DetailSectionKey, boolean>>(DEFAULT_DETAIL_EXPANDED)
  const [permissionTab, setPermissionTab] = useState<PermissionTabKey>('space')
  const [permissionFilter, setPermissionFilter] = useState('')
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false)
  const isCreateMode = searchParams.get('mode') === 'create'

  const selectedRoleId = useMemo(() => {
    const raw = searchParams.get('roleId')
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])

  const filteredRoles = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((role) => `${role.name} ${role.description}`.toLowerCase().includes(q))
  }, [keyword, roles])

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  )

  const createPermissionState = useMemo(
    () => buildPermissionDependencyState(formState.permissions, permissionDefinitions),
    [formState.permissions, permissionDefinitions],
  )
  const detailPermissionState = useMemo(
    () => buildPermissionDependencyState(detailFormState.permissions, permissionDefinitions),
    [detailFormState.permissions, permissionDefinitions],
  )
  const selectedRolePermissionState = useMemo(
    () => buildPermissionDependencyState(selectedRole?.permissions ?? [], permissionDefinitions),
    [permissionDefinitions, selectedRole],
  )

  const permissionRows = useMemo(() => {
    const activePermissions = new Set(
      isCreateMode ? createPermissionState.effectivePermissions : detailPermissionState.effectivePermissions,
    )
    const keywordValue = permissionFilter.trim().toLowerCase()
    return permissionDefinitions
      .filter((definition) => {
        if (permissionTab === 'system') return definition.scope === 'SystemOnly'
        return definition.scope !== 'SystemOnly'
      })
      .filter((definition) => !viewSelectedOnly || activePermissions.has(definition.name))
      .filter((definition) => {
        if (!keywordValue) return true
        const description = describePermission(definition.name).toLowerCase()
        return definition.name.toLowerCase().includes(keywordValue) || description.includes(keywordValue)
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [createPermissionState.effectivePermissions, detailPermissionState.effectivePermissions, isCreateMode, permissionDefinitions, permissionFilter, permissionTab, viewSelectedOnly])

  const isDetailDirty = useMemo(() => {
    if (selectedRole == null) return false
    return (
      selectedRole.name !== detailFormState.name.trim() ||
      (selectedRole.description ?? '') !== detailFormState.description.trim() ||
      !arePermissionsEqual(
        selectedRolePermissionState.effectivePermissions,
        detailPermissionState.effectivePermissions,
      )
    )
  }, [detailFormState, detailPermissionState.effectivePermissions, selectedRole, selectedRolePermissionState.effectivePermissions])

  useEffect(() => {
    if (!canView) {
      setRoles([])
      setPermissionDefinitions([])
      return
    }

    let cancelled = false
    const loadData = async () => {
      try {
        setLoading(true)
        const [rolesResult, permissionResult] = await Promise.all([
          getUserRoles(),
          getAllPermissions(),
        ])
        if (cancelled) return
        setRoles([...(rolesResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
        setPermissionDefinitions([...(permissionResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error: any) {
        if (cancelled) return
        message.error(error?.message || 'Failed to load user roles.')
        setRoles([])
        setPermissionDefinitions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [canView])

  useEffect(() => {
    if (selectedRole == null) {
      setDetailFormState(EMPTY_ROLE_FORM)
      return
    }

    setDetailFormState({
      name: selectedRole.name,
      description: selectedRole.description ?? '',
      permissions: normalizePermissions(selectedRole.permissions ?? []),
    })
    setPermissionFilter('')
    setViewSelectedOnly(false)
    setPermissionTab('space')
    setDetailExpanded(DEFAULT_DETAIL_EXPANDED)
  }, [selectedRole])

  useEffect(() => {
    if (!isCreateMode) return
    setFormState(EMPTY_ROLE_FORM)
    setCreateExpanded(CREATE_DETAIL_EXPANDED)
    setPermissionFilter('')
    setViewSelectedOnly(false)
    setPermissionTab('space')
  }, [isCreateMode])

  useEffect(() => {
    if (selectedRoleId == null) return
    if (roles.some((role) => role.id === selectedRoleId)) return
    const next = new URLSearchParams(searchParams)
    next.delete('roleId')
    setSearchParams(next, { replace: true })
  }, [roles, searchParams, selectedRoleId, setSearchParams])

  const openRoleDetail = (roleId: number) => {
    const next = new URLSearchParams(searchParams)
    next.delete('mode')
    next.set('roleId', String(roleId))
    setSearchParams(next)
  }

  const closeRoleEditor = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('mode')
    next.delete('roleId')
    setSearchParams(next)
  }

  const openCreateRole = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('roleId')
    next.set('mode', 'create')
    setSearchParams(next)
  }

  const toggleCreatePermission = (permissionName: string, checked: boolean) => {
    setFormState((previous) => {
      const nextSet = new Set(previous.permissions)
      if (checked) nextSet.add(permissionName)
      else nextSet.delete(permissionName)
      return {
        ...previous,
        permissions: Array.from(nextSet).sort(),
      }
    })
  }

  const toggleDetailPermission = (permissionName: string, checked: boolean) => {
    setDetailFormState((previous) => {
      const nextSet = new Set(previous.permissions)
      if (checked) nextSet.add(permissionName)
      else nextSet.delete(permissionName)
      return {
        ...previous,
        permissions: Array.from(nextSet).sort(),
      }
    })
  }

  const handleCreateRole = async () => {
    const name = formState.name.trim()
    const description = formState.description.trim()
    if (!name) {
      message.warning('Role name is required.')
      return
    }

    try {
      setSaving(true)
      const saved = await createUserRole({
        name,
        description,
        permissions: createPermissionState.effectivePermissions,
      })
      message.success('User role created.')
      const rolesResult = await getUserRoles()
      setRoles([...(rolesResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      openRoleDetail(saved.id)
    } catch (error: any) {
      message.error(error?.message || 'Failed to save user role.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDetail = async () => {
    if (selectedRole == null) return
    const name = detailFormState.name.trim()
    if (!name) {
      message.warning('Role name is required.')
      return
    }

    try {
      setSaving(true)
      const saved = await updateUserRole({
        id: selectedRole.id,
        name,
        description: detailFormState.description.trim(),
        permissions: detailPermissionState.effectivePermissions,
      })
      message.success('User role updated.')
      const rolesResult = await getUserRoles()
      setRoles([...(rolesResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      setDetailFormState({
        name: saved.name,
        description: saved.description ?? '',
        permissions: normalizePermissions(saved.permissions ?? []),
      })
    } catch (error: any) {
      message.error(error?.message || 'Failed to update user role.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = (role: UserRoleDto) => {
    Modal.confirm({
      title: `Delete role "${role.name}"?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteUserRole({ id: role.id })
          message.success('User role deleted.')
          const rolesResult = await getUserRoles()
          setRoles([...(rolesResult ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
          if (selectedRoleId === role.id) closeRoleEditor()
        } catch (error: any) {
          message.error(error?.message || 'Failed to delete user role.')
        }
      },
    })
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Permission denied: `UserRoleView` is required to view user roles.
      </div>
    )
  }

  if (isCreateMode || selectedRole != null) {
    const canMutate = isCreateMode ? canEdit : canEdit && !selectedRole!.isBuiltIn
    const expandedSections = isCreateMode ? createExpanded : detailExpanded
    const allExpanded = Object.values(expandedSections).every(Boolean)
    const title = isCreateMode ? 'New Role' : selectedRole!.name
    const formTitle = isCreateMode ? 'A short, memorable, unique name for this role. Example: Project Support.' : detailFormState.name || selectedRole!.name
    const descriptionTitle = isCreateMode
      ? 'Briefly describe what this role grants.'
      : detailFormState.description || selectedRole!.description || 'No description'
    const overflowItems: MenuProps['items'] = isCreateMode
      ? []
      : [
          {
            key: 'delete',
            label: 'Delete',
            danger: true,
            disabled: !canMutate,
          },
        ]
    const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
      if (!isCreateMode && key === 'delete') handleDeleteRole(selectedRole!)
    }
    const toggleSection = (key: DetailSectionKey) => {
      if (isCreateMode) {
        setCreateExpanded((previous) => ({ ...previous, [key]: !previous[key] }))
        return
      }
      setDetailExpanded((previous) => ({ ...previous, [key]: !previous[key] }))
    }
    const toggleAllSections = () => {
      const nextValue = !allExpanded
      const nextState = { name: nextValue, description: nextValue }
      if (isCreateMode) {
        setCreateExpanded(nextState)
        return
      }
      setDetailExpanded(nextState)
    }
    const activeName = isCreateMode ? formState.name : detailFormState.name
    const activeDescription = isCreateMode ? formState.description : detailFormState.description
    const saveDisabled = isCreateMode ? !canEdit || !formState.name.trim() : !canMutate || !isDetailDirty
    const activePermissionState = isCreateMode ? createPermissionState : detailPermissionState

    return (
      <div className="bg-white min-h-full">
        <div className="max-w-[1600px] mx-auto pt-4 pb-6">
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="px-6 pt-4 pb-3 border-b border-gray-200">
              <nav className="mb-2 text-sm">
                <button type="button" className="border-0 bg-transparent p-0 text-squid-blue cursor-pointer hover:underline" onClick={closeRoleEditor}>
                  User Roles
                </button>
              </nav>

              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-semibold text-gray-900 m-0 min-w-0">{title}</h1>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="primary" onClick={() => void (isCreateMode ? handleCreateRole() : handleSaveDetail())} loading={saving} disabled={saveDisabled}>
                    Save
                  </Button>
                  {!isCreateMode ? (
                    <Dropdown menu={{ items: overflowItems, onClick: handleOverflowClick }} trigger={['click']} placement="bottomRight">
                      <Button icon={<MoreOutlined />} aria-label="Overflow Menu Button" />
                    </Dropdown>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                  onClick={toggleAllSections}
                >
                  {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
                </button>
              </div>
            </div>

            {isCreateMode ? (
              <div className="px-6 py-4 border-b border-gray-200 bg-amber-50 text-sm text-amber-900">
                <div className="font-semibold mb-1">Possible problems ahead!</div>
                <div className="leading-6">
                  Most pages in the portal require a combination of several permissions. There are currently <strong>{permissionDefinitions.length}</strong> permissions in the system,
                  so custom user roles can be difficult to keep stable over time. Prefer built-in roles where possible.
                </div>
              </div>
            ) : null}

            <DetailPanel
              title="Name"
              subtitle={formTitle}
              subtitlePlaceholder={isCreateMode && !activeName}
              isOpen={expandedSections.name}
              onToggle={() => toggleSection('name')}
            >
              <Input
                value={activeName}
                onChange={(event) => {
                  const value = event.target.value
                  if (isCreateMode) {
                    setFormState((previous) => ({ ...previous, name: value }))
                    return
                  }
                  setDetailFormState((previous) => ({ ...previous, name: value }))
                }}
                disabled={!canMutate}
                className="max-w-[720px]"
              />
            </DetailPanel>

            <DetailPanel
              title="Description"
              subtitle={descriptionTitle}
              subtitlePlaceholder={isCreateMode ? !activeDescription : !detailFormState.description && !selectedRole!.description}
              isOpen={expandedSections.description}
              onToggle={() => toggleSection('description')}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                value={activeDescription}
                onChange={(event) => {
                  const value = event.target.value
                  if (isCreateMode) {
                    setFormState((previous) => ({ ...previous, description: value }))
                    return
                  }
                  setDetailFormState((previous) => ({ ...previous, description: value }))
                }}
                disabled={!canMutate}
                className="max-w-[720px]"
              />
            </DetailPanel>

            <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
              Permissions
            </div>

            <div className="border-b border-slate-200 px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={[
                    'border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-medium cursor-pointer',
                    permissionTab === 'system' ? 'border-squid-blue text-squid-blue' : 'border-transparent text-slate-600',
                  ].join(' ')}
                  onClick={() => setPermissionTab('system')}
                >
                  System Permissions
                </button>
                <button
                  type="button"
                  className={[
                    'border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-medium cursor-pointer',
                    permissionTab === 'space' ? 'border-squid-blue text-squid-blue' : 'border-transparent text-slate-600',
                  ].join(' ')}
                  onClick={() => setPermissionTab('space')}
                >
                  Space Permissions
                </button>
              </div>
            </div>

            <div className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
              {permissionTab === 'system'
                ? 'System level permissions apply to system-wide resources and administration.'
                : 'Space level permissions apply to resources within spaces.'}
            </div>

            <div className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100">
              <Input
                placeholder="Filter by permission..."
                value={permissionFilter}
                onChange={(event) => setPermissionFilter(event.target.value)}
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                className="max-w-[360px]"
              />
              <Checkbox checked={viewSelectedOnly} onChange={(event) => setViewSelectedOnly(event.target.checked)}>
                View selected only
              </Checkbox>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Permission</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-sm text-slate-500">No permissions match this filter.</td>
                    </tr>
                  ) : (
                    permissionRows.map((definition) => {
                      const checked = activePermissionState.effectivePermissions.includes(definition.name)
                      const isLockedViewPermission = activePermissionState.lockedViewPermissions.has(definition.name)
                      const lockReasons = activePermissionState.lockedViewReasons.get(definition.name) ?? []
                      const lockTooltipTitle = lockReasons.length > 0
                        ? `Required while ${lockReasons.join(', ')} ${lockReasons.length > 1 ? 'are' : 'is'} selected.`
                        : 'Required by another selected permission.'
                      return (
                        <tr key={definition.name} className="border-b border-slate-100 align-top last:border-b-0">
                          <td className="px-4 py-2.5">
                            <label className="flex items-center gap-2 text-sm text-slate-800">
                              {isLockedViewPermission ? (
                                <LockedPermissionCheck title={lockTooltipTitle} />
                              ) : (
                                <Checkbox
                                  checked={checked}
                                  disabled={!canMutate}
                                  onChange={(event) => {
                                    if (isCreateMode) {
                                      toggleCreatePermission(definition.name, event.target.checked)
                                      return
                                    }
                                    toggleDetailPermission(definition.name, event.target.checked)
                                  }}
                                />
                              )}
                              <span>{definition.name}</span>
                              <span className={`text-[10px] font-medium rounded-full border px-2 py-0.5 ${scopeBadgeClass(definition.scope || '')}`}>
                                {definition.scope}
                              </span>
                            </label>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-slate-600">{describePermission(definition.name)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-semibold text-slate-900">User Roles</h1>
          <Button type="primary" onClick={openCreateRole} disabled={!canEdit}>
            Add custom role
          </Button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <Input
            placeholder="Filter..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            className="max-w-[380px]"
          />
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center"><Spin /></div>
        ) : (
          <div className="p-4">
            {filteredRoles.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No user roles found.</div>
            ) : (
              <ul className="m-0 p-0 list-none divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {filteredRoles.map((role) => (
                  <li key={role.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button type="button" className="w-full border-0 bg-transparent p-0 text-left cursor-pointer" onClick={() => openRoleDetail(role.id)}>
                      <div className="text-[15px] font-semibold text-squid-blue flex items-center gap-2 flex-wrap">
                        <span>{role.name}</span>
                        {role.isBuiltIn ? (
                          <span className="text-[10px] font-medium rounded-full border border-slate-300 bg-slate-100 text-slate-700 px-2 py-0.5">
                            Built-in
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{role.description || ''}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  )
}
