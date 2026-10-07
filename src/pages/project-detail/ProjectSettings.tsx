import React, { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Input, Modal, Radio, Select, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  AimOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  MehOutlined,
  CalendarOutlined,
  CloudOutlined,
  CodeOutlined,
  CoffeeOutlined,
  CommentOutlined,
  CopyOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DownOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FundOutlined,
  GiftOutlined,
  GlobalOutlined,
  RocketOutlined,
  SafetyOutlined,
  SearchOutlined,
  ShoppingOutlined,
  ToolOutlined,
  ReloadOutlined,
  WarningOutlined,
  BarChartOutlined,
  ApiOutlined,
  ExperimentOutlined,
  DeploymentUnitOutlined,
  MoreOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { useSpace } from 'contexts/SpaceContext'
import { deleteProjects, getProject, getProjects, updateProject, type ProjectDto } from 'pages/apis/project'
import { getProjectGroups, type ProjectGroupDto } from 'pages/apis/projectGroup'
import { getLifecycles, type LifecycleDto } from 'pages/apis/lifecycle'

type SectionKey =
  | 'name'
  | 'enabled'
  | 'logo'
  | 'description'
  | 'projectGroup'
  | 'lifecycle'
  | 'discreteChannels'
  | 'ignoreChannelRules'

interface DetailPanelProps {
  title: string
  subtitle?: React.ReactNode
  subtitlePlaceholder?: boolean
  isOpen: boolean
  onToggle: () => void
  children?: React.ReactNode
  hasBorder?: boolean
}

interface ProjectSettingsFormState {
  name: string
  slug: string
  enabled: boolean
  description: string
  projectGroupId: number | null
  lifecycleId: number | null
  discreteChannelRelease: boolean
  allowIgnoreChannelRules: boolean
  iconSearch: string
  iconCategory: string
  iconColor: string
  selectedIcon: string
  customImageUrl: string
}

interface IconOption {
  key: string
  label: string
  category: string
  icon: React.ReactNode
}

const DEFAULT_EXPANDED: Record<SectionKey, boolean> = {
  name: false,
  enabled: false,
  logo: true,
  description: false,
  projectGroup: false,
  lifecycle: false,
  discreteChannels: false,
  ignoreChannelRules: false,
}

const ICON_CHOICES: IconOption[] = [
  { key: 'bar', label: 'Bar Chart', category: 'analytics', icon: <BarChartOutlined /> },
  { key: 'switch', label: 'Deployment Unit', category: 'devops', icon: <DeploymentUnitOutlined /> },
  { key: 'code', label: 'Code', category: 'devops', icon: <CodeOutlined /> },
  { key: 'rocket', label: 'Rocket', category: 'devops', icon: <RocketOutlined /> },
  { key: 'eye', label: 'Eye', category: 'general', icon: <EyeOutlined /> },
  { key: 'coffee', label: 'Coffee', category: 'general', icon: <CoffeeOutlined /> },
  { key: 'anchor', label: 'Anchor', category: 'general', icon: <ApartmentOutlined /> },
  { key: 'dashboard', label: 'Dashboard', category: 'analytics', icon: <DashboardOutlined /> },
  { key: 'ski', label: 'Experiment', category: 'general', icon: <ExperimentOutlined /> },
  { key: 'tools', label: 'Tools', category: 'devops', icon: <ToolOutlined /> },
  { key: 'warning', label: 'Warning', category: 'general', icon: <WarningOutlined /> },
  { key: 'globe', label: 'Global', category: 'general', icon: <GlobalOutlined /> },
  { key: 'card', label: 'Credit Card', category: 'business', icon: <CreditCardOutlined /> },
  { key: 'basket', label: 'Shopping', category: 'business', icon: <ShoppingOutlined /> },
  { key: 'football', label: 'Football', category: 'general', icon: <FundOutlined /> },
  { key: 'wheelchair', label: 'Accessibility', category: 'general', icon: <MehOutlined /> },
  { key: 'gift', label: 'Gift', category: 'general', icon: <GiftOutlined /> },
  { key: 'message', label: 'Comment', category: 'general', icon: <CommentOutlined /> },
  { key: 'gamepad', label: 'API', category: 'devops', icon: <ApiOutlined /> },
  { key: 'crosshair', label: 'Aim', category: 'general', icon: <AimOutlined /> },
  { key: 'shield', label: 'Safety', category: 'security', icon: <SafetyOutlined /> },
  { key: 'binoculars', label: 'Search', category: 'general', icon: <SearchOutlined /> },
  { key: 'calendar', label: 'Calendar', category: 'business', icon: <CalendarOutlined /> },
  { key: 'map', label: 'Environment', category: 'general', icon: <EnvironmentOutlined /> },
]

const ICON_COLORS = [
  '#3CA4F3',
  '#145586',
  '#25D284',
  '#027744',
  '#AED0EB',
  '#173B56',
  '#C39AF8',
  '#5E2EA2',
  '#FFB867',
  '#EF6F1F',
  '#FFADA5',
  '#CA1E1E',
]

function parseProjectDescription(project: ProjectDto): string {
  if (!project.json) return ''
  try {
    const parsed = JSON.parse(project.json) as Record<string, unknown>
    const description = parsed.description
    if (typeof description === 'string') return description
  } catch {
    return ''
  }
  return ''
}

function toProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function DetailPanel({
  title,
  subtitle,
  subtitlePlaceholder = false,
  isOpen,
  onToggle,
  children,
  hasBorder = true,
}: DetailPanelProps) {
  return (
    <div className={hasBorder ? 'border-b border-gray-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '260px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className={subtitlePlaceholder ? 'text-sm text-gray-400 pt-0.5' : 'text-sm text-gray-500 pt-0.5'}>{subtitle}</div>
        <button
          type="button"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <DownOutlined className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
        </button>
      </div>
      {isOpen ? (
        <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

const ProjectSettings: React.FC = () => {
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()
  const { space } = useSpace()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [projectGroups, setProjectGroups] = useState<ProjectGroupDto[]>([])
  const [lifecycles, setLifecycles] = useState<LifecycleDto[]>([])
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>(DEFAULT_EXPANDED)
  const [logoTab, setLogoTab] = useState<'icon' | 'customImage'>('icon')
  const [slugEditable, setSlugEditable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false)
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] = useState('')

  const [form, setForm] = useState<ProjectSettingsFormState>({
    name: '',
    slug: '',
    enabled: true,
    description: '',
    projectGroupId: null,
    lifecycleId: null,
    discreteChannelRelease: false,
    allowIgnoreChannelRules: false,
    iconSearch: '',
    iconCategory: '',
    iconColor: '#3CA4F3',
    selectedIcon: 'rocket',
    customImageUrl: '',
  })

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 1000, keyword: projectName })
        const foundProject = projectRes.projects.find((item) => item.slug === projectName || item.name === projectName) ?? null
        if (!foundProject) {
          setProject(null)
          return
        }

        const [projectDetail, projectGroupRes, lifecycleRes] = await Promise.all([
          getProject(foundProject.id),
          getProjectGroups({ pageSize: 1000 }),
          getLifecycles({ pageSize: 1000 }),
        ])

        setProject(projectDetail)
        setProjectGroups(projectGroupRes.projectGroups ?? [])
        setLifecycles(lifecycleRes.lifecycles ?? [])
        setSlugEditable(false)
        setForm((previous) => ({
          ...previous,
          name: projectDetail.name ?? '',
          slug: projectDetail.slug ?? '',
          enabled: !projectDetail.isDisabled,
          description: parseProjectDescription(projectDetail),
          projectGroupId: projectDetail.projectGroupId ?? null,
          lifecycleId: projectDetail.lifecycleId ?? null,
          discreteChannelRelease: !!projectDetail.discreteChannelRelease,
          allowIgnoreChannelRules: !!projectDetail.allowIgnoreChannelRules,
        }))
      } catch (error) {
        console.error('Failed to load project settings', error)
        setProject(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  const lifecycleListPath = `/${spaceId}/lifecycles`

  const projectGroupName = useMemo(() => {
    if (form.projectGroupId == null) return 'Unknown'
    return projectGroups.find((item) => item.id === form.projectGroupId)?.name ?? 'Unknown'
  }, [form.projectGroupId, projectGroups])

  const lifecycleName = useMemo(() => {
    if (form.lifecycleId == null) return 'Unknown'
    return lifecycles.find((item) => item.id === form.lifecycleId)?.name ?? 'Unknown'
  }, [form.lifecycleId, lifecycles])

  const projectDescription = useMemo(() => (project ? parseProjectDescription(project) : ''), [project])

  const isDirty = useMemo(() => {
    if (!project) return false
    return (
      form.name !== (project.name ?? '') ||
      form.slug !== (project.slug ?? '') ||
      form.enabled !== !project.isDisabled ||
      form.description !== projectDescription ||
      form.projectGroupId !== (project.projectGroupId ?? null) ||
      form.lifecycleId !== (project.lifecycleId ?? null) ||
      form.discreteChannelRelease !== !!project.discreteChannelRelease ||
      form.allowIgnoreChannelRules !== !!project.allowIgnoreChannelRules
    )
  }, [
    form.allowIgnoreChannelRules,
    form.description,
    form.discreteChannelRelease,
    form.enabled,
    form.lifecycleId,
    form.name,
    form.projectGroupId,
    form.slug,
    project,
    projectDescription,
  ])

  const overflowMenuItems: MenuProps['items'] = [
    { key: 'copy', label: 'Copy project' },
    { key: 'audit', label: 'Audit trail' },
    { type: 'divider' },
    { key: 'delete', label: 'Delete project', danger: true },
  ]

  const projectDisplayName = project?.name || form.name || 'this project'
  const canConfirmProjectDeletion = deleteProjectConfirmation === projectDisplayName

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') {
      setDeleteProjectConfirmation('')
      setShowDeleteProjectModal(true)
      return
    }
    if (key === 'audit') {
      message.info('Audit Trail is not available yet.')
    }
  }

  const handleCancelProjectDeletion = () => {
    if (deletingProject) return
    setShowDeleteProjectModal(false)
    setDeleteProjectConfirmation('')
  }

  const handleConfirmProjectDeletion = async () => {
    if (!project || !canConfirmProjectDeletion || deletingProject) return

    setDeletingProject(true)
    try {
      const result = await deleteProjects({ ids: [project.id], spaceId: space.id })
      if ((result?.failIds ?? []).includes(project.id)) {
        message.error('Failed to delete project')
        return
      }

      setShowDeleteProjectModal(false)
      setDeleteProjectConfirmation('')
      message.success('Project deleted')
      navigate(`/${space.slug}/projects`)
    } catch (error) {
      console.error('Failed to delete project', error)
      message.error('Failed to delete project')
    } finally {
      setDeletingProject(false)
    }
  }

  const allExpanded = Object.values(expanded).every(Boolean)

  const iconCategoryOptions = useMemo(() => {
    const categories = [...new Set(ICON_CHOICES.map((item) => item.category))]
    return categories.map((category) => ({
      value: category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
    }))
  }, [])

  const filteredIcons = useMemo(() => {
    const keyword = form.iconSearch.trim().toLowerCase()
    return ICON_CHOICES.filter((item) => {
      const keywordMatched = keyword.length === 0 || item.label.toLowerCase().includes(keyword)
      const categoryMatched = !form.iconCategory || item.category === form.iconCategory
      return keywordMatched && categoryMatched
    })
  }, [form.iconCategory, form.iconSearch])

  const handleUpdateSlugToMatchName = () => {
    setForm((previous) => ({ ...previous, slug: toProjectSlug(previous.name) }))
  }

  const handleCopyProjectSlug = async () => {
    const value = form.slug.trim()
    if (!value) {
      message.warning('Project slug is empty')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      message.success('Project slug copied')
    } catch (error) {
      console.error('Failed to copy project slug', error)
      message.error('Unable to copy project slug')
    }
  }

  const handleSave = async () => {
    if (!project) return
    if (!form.name.trim()) {
      message.warning('Project name is required')
      return
    }
    if (!form.slug.trim()) {
      message.warning('Project slug is required')
      return
    }
    if (form.projectGroupId == null) {
      message.warning('Project group is required')
      return
    }
    if (form.lifecycleId == null) {
      message.warning('Lifecycle is required')
      return
    }

    let parsedJson: Record<string, unknown> = {}
    if (project.json) {
      try {
        parsedJson = JSON.parse(project.json) as Record<string, unknown>
      } catch {
        parsedJson = {}
      }
    }

    const commandProject: ProjectDto = {
      ...project,
      name: form.name.trim(),
      slug: form.slug.trim(),
      isDisabled: !form.enabled,
      projectGroupId: form.projectGroupId,
      lifecycleId: form.lifecycleId,
      discreteChannelRelease: form.discreteChannelRelease,
      allowIgnoreChannelRules: form.allowIgnoreChannelRules,
      json: JSON.stringify({
        ...parsedJson,
        description: form.description,
      }),
      lastModified: new Date().toISOString(),
    }

    setSaving(true)
    try {
      const updated = await updateProject({ id: project.id, project: commandProject })
      setProject(updated)
      setSlugEditable(false)
      setForm((previous) => ({
        ...previous,
        name: updated.name ?? '',
        slug: updated.slug ?? '',
        enabled: !updated.isDisabled,
        description: parseProjectDescription(updated),
        projectGroupId: updated.projectGroupId ?? null,
        lifecycleId: updated.lifecycleId ?? null,
        discreteChannelRelease: !!updated.discreteChannelRelease,
        allowIgnoreChannelRules: !!updated.allowIgnoreChannelRules,
      }))
      message.success('Project settings saved')
    } catch (error) {
      console.error('Failed to save project settings', error)
      message.error('Failed to save project settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Spin />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-sm text-slate-600">Project not found.</div>
      </div>
    )
  }

  return (
    <PageContainer>
      <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 pt-4 pb-3 border-b border-gray-200">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0 min-w-0">Project Settings</h1>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="primary"
                  disabled={!isDirty || saving}
                  loading={saving}
                  title="Save"
                  onClick={handleSave}
                >
                  Save
                </Button>
                <Dropdown
                  menu={{ items: overflowMenuItems, onClick: handleOverflowClick }}
                  trigger={['click']}
                  placement="bottomRight"
                  disabled={deletingProject}
                >
                  <Button icon={<MoreOutlined />} aria-label="Overflow Menu Button" disabled={deletingProject} />
                </Dropdown>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const next = !allExpanded
                  setExpanded({
                    name: next,
                    enabled: next,
                    logo: next,
                    description: next,
                    projectGroup: next,
                    lifecycle: next,
                    discreteChannels: next,
                    ignoreChannelRules: next,
                  })
                }}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <DetailPanel
            title="Name"
            subtitle={(
              <span className="inline-flex flex-col leading-5">
                <span className="text-slate-700">{form.name}</span>
                <span className="text-xs text-slate-500">{form.slug}</span>
              </span>
            )}
            isOpen={expanded.name}
            onToggle={() => setExpanded((previous) => ({ ...previous, name: !previous.name }))}
          >
            <div className="max-w-[900px] grid gap-3">
              <div className="max-w-[720px]">
                <Input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} />
              </div>

              <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'minmax(0, 720px) auto' }}>
                <div>
                  <label className="block text-[13px] leading-none font-medium text-slate-500 mb-2">Project slug</label>
                  <Input
                    value={form.slug}
                    disabled={!slugEditable}
                    onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-1 pt-7">
                  <Button
                    type="text"
                    size="small"
                    aria-label="Change slug"
                    title="Change slug"
                    icon={<EditOutlined />}
                    onClick={() => setSlugEditable((previous) => !previous)}
                  />
                  <Button
                    type="text"
                    size="small"
                    aria-label="Update slug to match name"
                    title="Update slug to match name"
                    icon={<ReloadOutlined />}
                    onClick={handleUpdateSlugToMatchName}
                  />
                  <Button
                    type="text"
                    size="small"
                    aria-label="Copy slug"
                    title="Copy slug"
                    icon={<CopyOutlined />}
                    onClick={handleCopyProjectSlug}
                  />
                </div>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Enabled"
            subtitle={form.enabled ? 'Yes' : 'No'}
            isOpen={expanded.enabled}
            onToggle={() => setExpanded((previous) => ({ ...previous, enabled: !previous.enabled }))}
          >
            <div className="flex items-center gap-3">
              <Button type={form.enabled ? 'primary' : 'default'} size="small" onClick={() => setForm((previous) => ({ ...previous, enabled: true }))}>
                Enabled
              </Button>
              <Button type={!form.enabled ? 'primary' : 'default'} size="small" onClick={() => setForm((previous) => ({ ...previous, enabled: false }))}>
                Disabled
              </Button>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Logo"
            subtitle="Choose an icon or upload a custom image."
            isOpen={expanded.logo}
            onToggle={() => setExpanded((previous) => ({ ...previous, logo: !previous.logo }))}
          >
            <div className="max-w-[900px]">
              <div className="flex items-end border-b border-slate-200 mb-3">
                <button
                  type="button"
                  className={[
                    'w-32 text-center pb-2 pt-0.5 text-[16px] font-semibold border-0 bg-transparent cursor-pointer transition-colors',
                    logoTab === 'icon' ? 'text-squid-blue border-b-4 border-squid-blue' : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                  onClick={() => setLogoTab('icon')}
                >
                  Icon
                </button>
                <button
                  type="button"
                  className={[
                    'w-32 text-center pb-2 pt-0.5 text-[16px] font-semibold border-0 bg-transparent cursor-pointer transition-colors',
                    logoTab === 'customImage' ? 'text-squid-blue border-b-4 border-squid-blue' : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                  onClick={() => setLogoTab('customImage')}
                >
                  Custom Image
                </button>
              </div>

              {logoTab === 'icon' ? (
                <div>
                  <div className="mb-3">
                    <div className="relative border-b border-slate-300">
                      <SearchOutlined className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]" />
                      <input
                        value={form.iconSearch}
                        onChange={(event) => setForm((previous) => ({ ...previous, iconSearch: event.target.value }))}
                        placeholder="Icon search"
                        className="w-full h-9 border-0 bg-transparent pl-5 text-[15px] leading-none text-slate-600 placeholder:text-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[13px] leading-none font-medium text-slate-500 mb-2">Icon category</label>
                    <div className="relative">
                      <select
                        value={form.iconCategory}
                        onChange={(event) => setForm((previous) => ({ ...previous, iconCategory: event.target.value }))}
                        className="w-full h-9 appearance-none border-0 border-b border-slate-300 bg-transparent pr-8 text-[15px] leading-none text-slate-600 outline-none"
                      >
                        <option value="">All categories...</option>
                        {iconCategoryOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <DownOutlined className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-squid-blue" />
                    </div>
                  </div>

                  <div className="grid grid-cols-8 gap-2">
                    {filteredIcons.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-label={item.label}
                        className={[
                          'h-[50px] rounded-lg border text-[20px] flex items-center justify-center transition-colors',
                          form.selectedIcon === item.key
                            ? 'border-squid-blue text-squid-blue bg-blue-50'
                            : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-squid-blue hover:border-squid-blue',
                        ].join(' ')}
                        onClick={() => setForm((previous) => ({ ...previous, selectedIcon: item.key }))}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-5">
                    {ICON_COLORS.map((color) => {
                      const active = form.iconColor === color
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-label={color}
                          className="relative h-7 w-7 rounded-full border-0 bg-transparent p-0 cursor-pointer"
                          onClick={() => setForm((previous) => ({ ...previous, iconColor: color }))}
                        >
                          <span
                            className={[
                              'absolute inset-0 rounded-full transition-all',
                              active ? 'ring-2 ring-squid-blue ring-offset-2 ring-offset-white' : '',
                            ].join(' ')}
                          />
                          <span
                            className="absolute inset-[2px] rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
                  <div className="text-sm text-slate-700 mb-2">Upload a custom project logo</div>
                  <div className="text-xs text-slate-500 mb-3">Recommended square PNG with transparent background.</div>
                  <Button icon={<UploadOutlined />} disabled>
                    Upload image
                  </Button>
                </div>
              )}
            </div>
          </DetailPanel>

          <DetailPanel
            title="Description"
            subtitle={form.description || 'No project description provided'}
            subtitlePlaceholder={!form.description}
            isOpen={expanded.description}
            onToggle={() => setExpanded((previous) => ({ ...previous, description: !previous.description }))}
          >
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Project description"
              className="max-w-[720px]"
            />
          </DetailPanel>

          <DetailPanel
            title="Project Group"
            subtitle={projectGroupName}
            isOpen={expanded.projectGroup}
            onToggle={() => setExpanded((previous) => ({ ...previous, projectGroup: !previous.projectGroup }))}
          >
            <Select
              value={form.projectGroupId ?? undefined}
              onChange={(value) => setForm((previous) => ({ ...previous, projectGroupId: value }))}
              options={projectGroups.map((item) => ({ value: item.id, label: item.name }))}
              style={{ width: 360 }}
            />
          </DetailPanel>

          <DetailPanel
            title="Lifecycle"
            subtitle={lifecycleName}
            isOpen={expanded.lifecycle}
            onToggle={() => setExpanded((previous) => ({ ...previous, lifecycle: !previous.lifecycle }))}
          >
            <Select
              value={form.lifecycleId ?? undefined}
              onChange={(value) => setForm((previous) => ({ ...previous, lifecycleId: value }))}
              options={lifecycles.map((item) => ({ value: item.id, label: item.name }))}
              style={{ width: 360 }}
            />
            <div className="text-xs text-slate-500 mt-2">
              Manage available lifecycles in{' '}
              <Link to={lifecycleListPath} className="text-squid-blue hover:underline">
                Lifecycle list
              </Link>
              .
            </div>
          </DetailPanel>

          <DetailPanel
            title="Discrete Channel Releases"
            subtitle="Choose if channel release are treated independently or for the entire project."
            isOpen={expanded.discreteChannels}
            onToggle={() => setExpanded((previous) => ({ ...previous, discreteChannels: !previous.discreteChannels }))}
          >
            <div className="max-w-[900px]">
              <div className="text-sm font-semibold text-slate-800 mb-2">Discrete channel releases</div>

              <Radio.Group
                value={form.discreteChannelRelease ? 'true' : 'false'}
                onChange={(event) => setForm((previous) => ({ ...previous, discreteChannelRelease: event.target.value === 'true' }))}
                className="grid gap-3"
              >
                <div>
                  <Radio value="false">
                    Considered for the entire project <span className="text-slate-400">(default)</span>
                  </Radio>
                  <div className="text-sm text-slate-600 mt-1 pl-6">
                    Any channel release will supersede existing channel releases.
                    <a
                      href="https://oc.to/WalkthroughChannelHotfix"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-squid-blue hover:underline ml-1"
                    >
                      Learn more about hotfix deployments
                    </a>
                  </div>
                </div>

                <div>
                  <Radio value="true">Treat independently from other channels</Radio>
                  <div className="text-sm text-slate-600 mt-1 pl-6">
                    Releases from different channels will be treated independently when displayed on the dashboard and when applying retention policies.
                  </div>
                </div>
              </Radio.Group>

              <div className="text-sm text-slate-600 mt-4">
                Selecting <code className="px-1 rounded bg-slate-100">Treat independently from other channels</code> will cause the latest releases from each channel to be displayed on the dashboard.
                <br />
                See the{' '}
                <a
                  href="https://oc.to/DiscreteChannelReleases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-squid-blue hover:underline"
                >
                  documentation
                </a>{' '}
                for more information.
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            title="Allow Ignore Channel Rules"
            subtitle="Choose whether channel rules can be ignored when creating releases."
            isOpen={expanded.ignoreChannelRules}
            onToggle={() => setExpanded((previous) => ({ ...previous, ignoreChannelRules: !previous.ignoreChannelRules }))}
            hasBorder={false}
          >
            <div className="max-w-[900px]">
              <div className="text-sm font-semibold text-slate-800 mb-2">Allow Ignore Channel Rules</div>

              <Radio.Group
                value={form.allowIgnoreChannelRules ? 'true' : 'false'}
                onChange={(event) => setForm((previous) => ({ ...previous, allowIgnoreChannelRules: event.target.value === 'true' }))}
                className="grid gap-3"
              >
                <div>
                  <Radio value="false">
                    Channel rules cannot be ignored <span className="text-slate-400">(default)</span>
                  </Radio>
                  <div className="text-sm text-slate-600 mt-1 pl-6">
                    Channel rules cannot be ignored when creating releases.
                  </div>
                </div>

                <div>
                  <Radio value="true">Channel rules can be ignored</Radio>
                  <div className="text-sm text-slate-600 mt-1 pl-6">
                    Channel rules can be ignored when creating releases.
                  </div>
                </div>
              </Radio.Group>

              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <WarningOutlined className="text-amber-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-amber-900">Not recommended</div>
                    <div className="text-sm text-amber-800 mt-1 leading-6">
                      Allowing channel rules to be ignored when creating releases is not recommended.
                      This can allow releases containing pre-release packages or Git resources to be deployed
                      to protected environments such as Production.
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-600 mt-3">
                <a
                  href="https://oc.to/ChannelRules"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-squid-blue hover:underline"
                >
                  Learn more about channel rules
                </a>
              </div>
            </div>
          </DetailPanel>
        </div>

        <Modal
          open={showDeleteProjectModal}
          onCancel={handleCancelProjectDeletion}
          title="Are you sure you want to delete this project?"
          width={720}
          footer={[
            <Button
              key="cancel"
              onClick={handleCancelProjectDeletion}
              disabled={deletingProject}
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              Cancel
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              loading={deletingProject}
              disabled={!canConfirmProjectDeletion || deletingProject}
              onClick={handleConfirmProjectDeletion}
            >
              Delete
            </Button>,
          ]}
        >
          <div className="mb-5 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <WarningOutlined className="text-red-500" />
              <span>This is a destructive action</span>
            </div>
            <div>
              This action cannot be undone. This will permanently delete the {projectDisplayName} project
              and all of its contents, including releases and deployment history.
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-800">
            Please type in the name of the project ({projectDisplayName}) to confirm.
          </label>
          <Input
            autoFocus
            value={deleteProjectConfirmation}
            onChange={(event) => setDeleteProjectConfirmation(event.target.value)}
            placeholder={projectDisplayName}
          />
        </Modal>
    </PageContainer>
  )
}

export default ProjectSettings
