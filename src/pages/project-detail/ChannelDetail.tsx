import React, { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dropdown, Input, Select, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import { CopyOutlined, DownOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getChannels, updateChannel, type ChannelDto } from 'pages/apis/channel'
import { getLifecycles, type LifecycleDto } from 'pages/apis/lifecycle'

type SectionKey = 'name' | 'description' | 'lifecycle' | 'default'

interface ChannelFormState {
  name: string
  slug: string
  description: string
  lifecycleId: number | null
  isDefault: boolean
}

interface DetailPanelProps {
  title: string
  subtitle?: React.ReactNode
  subtitlePlaceholder?: boolean
  isOpen: boolean
  onToggle: () => void
  children?: React.ReactNode
}

function DetailPanel({
  title,
  subtitle,
  subtitlePlaceholder = false,
  isOpen,
  onToggle,
  children,
}: DetailPanelProps) {
  return (
    <div className="border-b border-gray-200">
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
      {isOpen && (
        <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      )}
    </div>
  )
}

function toFormState(channel: ChannelDto): ChannelFormState {
  return {
    name: channel.name ?? '',
    slug: channel.slug ?? '',
    description: channel.description ?? '',
    lifecycleId: channel.lifecycleId ?? null,
    isDefault: !!channel.isDefault,
  }
}

const ChannelDetail: React.FC = () => {
  const { spaceId, projectName, channelId } = useParams<{ spaceId: string; projectName: string; channelId: string }>()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channel, setChannel] = useState<ChannelDto | null>(null)
  const [lifecycles, setLifecycles] = useState<LifecycleDto[]>([])

  const [form, setForm] = useState<ChannelFormState>({
    name: '',
    slug: '',
    description: '',
    lifecycleId: null,
    isDefault: false,
  })
  const [initialForm, setInitialForm] = useState<ChannelFormState | null>(null)
  const [slugEditable, setSlugEditable] = useState(false)

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    name: true,
    description: false,
    lifecycle: true,
    default: true,
  })

  useEffect(() => {
    if (!projectName || !channelId) return

    const channelNumericId = Number(channelId)
    if (!Number.isFinite(channelNumericId) || channelNumericId <= 0) {
      setProject(null)
      setChannel(null)
      return
    }

    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 1000, keyword: projectName })
        const foundProject =
          projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null
        setProject(foundProject)

        if (!foundProject) {
          setChannel(null)
          setLifecycles([])
          return
        }

        const [channelRes, lifecycleRes] = await Promise.all([
          getChannels({ projectId: foundProject.id, pageSize: 1000 }),
          getLifecycles({ pageSize: 1000 }),
        ])

        const foundChannel = channelRes.channels.find((item) => item.id === channelNumericId) ?? null
        setChannel(foundChannel)
        setLifecycles(lifecycleRes.lifecycles ?? [])

        if (!foundChannel) {
          return
        }

        const nextForm = toFormState(foundChannel)
        setForm(nextForm)
        setInitialForm(nextForm)
        setSlugEditable(false)
        setExpanded({
          name: true,
          description: nextForm.description.trim().length > 0,
          lifecycle: true,
          default: true,
        })
      } catch (error) {
        console.error('Failed to load channel detail', error)
        setChannel(null)
        setLifecycles([])
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName, channelId])

  const channelsPath = `/${spaceId}/projects/${projectName}/deployments/channels`
  const lifecyclePath = `/${spaceId}/lifecycles`

  const overflowMenuItems: MenuProps['items'] = useMemo(
    () => [
      { key: 'disable', label: 'Disable Channel' },
      { key: 'delete', label: 'Delete Channel', danger: true },
      { type: 'divider' },
      { key: 'audit', label: 'Audit Trail' },
    ],
    [],
  )

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'audit') {
      message.info('Audit trail is not available yet.')
      return
    }
    message.info(`${String(key)} is not implemented yet.`)
  }

  const isDirty = useMemo(() => {
    if (!initialForm) return false
    return (
      initialForm.name !== form.name
      || initialForm.slug !== form.slug
      || initialForm.description !== form.description
      || initialForm.lifecycleId !== form.lifecycleId
      || initialForm.isDefault !== form.isDefault
    )
  }, [form, initialForm])

  const handleSave = async () => {
    if (!channel || !project) return

    const nextName = form.name.trim()
    const nextSlug = form.slug.trim()

    if (!nextName) {
      message.warning('Channel name is required')
      return
    }

    if (!nextSlug) {
      message.warning('Channel slug is required')
      return
    }

    setSaving(true)
    try {
      const payload: ChannelDto = {
        ...channel,
        name: nextName,
        slug: nextSlug,
        description: form.description,
        lifecycleId: form.lifecycleId,
        isDefault: form.isDefault,
      }

      const updated = await updateChannel({
        id: channel.id,
        channel: payload,
      })

      const normalized = updated && typeof updated === 'object' ? updated : payload
      const nextForm = toFormState(normalized)
      setChannel(normalized)
      setForm(nextForm)
      setInitialForm(nextForm)
      setSlugEditable(false)
      message.success('Channel saved')
    } catch (error) {
      console.error('Failed to save channel', error)
      message.error('Failed to save channel')
    } finally {
      setSaving(false)
    }
  }

  const handleCopySlug = async () => {
    const value = form.slug.trim()
    if (!value) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      }
      message.success('Slug copied')
    } catch {
      message.warning('Unable to copy slug')
    }
  }

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="flex items-center justify-center py-16">
              <Spin tip="Loading channel..." />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project || !channel) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden px-6 py-14 text-center text-gray-400 text-sm">
            Channel not found.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-4 pb-3 border-b border-gray-200">
            <nav className="mb-2">
              <ol className="flex items-center gap-1 text-sm">
                <li>
                  <Link to={channelsPath} className="text-squid-blue hover:underline">
                    Channels
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">{form.name || channel.name || 'Channel'}</h1>
              <div className="flex items-center gap-2">
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700 disabled:!bg-gray-300 disabled:!border-gray-300 disabled:!text-white"
                  disabled={!isDirty || saving}
                  loading={saving}
                  onClick={handleSave}
                >
                  Save
                </Button>
                <Dropdown menu={{ items: overflowMenuItems, onClick: handleOverflowClick }} trigger={['click']}>
                  <Button icon={<MoreOutlined />} aria-label="Overflow Menu Button" />
                </Dropdown>
              </div>
            </div>
          </div>

          <div className="px-6 pt-2 pb-1">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => setExpanded({ name: true, description: true, lifecycle: true, default: true })}
              >
                Expand All
              </button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => setExpanded({ name: false, description: false, lifecycle: false, default: false })}
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="pt-1">
            <DetailPanel
              title="Name"
              subtitle="Enter a name for your channel."
              isOpen={expanded.name}
              onToggle={() => setExpanded((prev) => ({ ...prev, name: !prev.name }))}
            >
              <div className="space-y-3">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Channel name"
                />

                <div className="text-sm text-gray-500">
                  A short, memorable, unique name for this channel. Example: <em>1.x Normal, 2.x Beta</em>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="Channel slug"
                    disabled={!slugEditable}
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      title="Change slug"
                      onClick={() => setSlugEditable((prev) => !prev)}
                    />
                    <Button type="text" icon={<CopyOutlined />} title="Copy slug" onClick={handleCopySlug} />
                  </div>
                </div>
              </div>
            </DetailPanel>

            <DetailPanel
              title="Description"
              subtitle={form.description.trim() ? form.description : 'No channel description provided'}
              subtitlePlaceholder={!form.description.trim()}
              isOpen={expanded.description}
              onToggle={() => setExpanded((prev) => ({ ...prev, description: !prev.description }))}
            >
              <Input.TextArea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Channel description"
                autoSize={{ minRows: 1, maxRows: 6 }}
              />
            </DetailPanel>

            <DetailPanel
              title="Lifecycle"
              subtitle="Select a lifecycle for your channel."
              isOpen={expanded.lifecycle}
              onToggle={() => setExpanded((prev) => ({ ...prev, lifecycle: !prev.lifecycle }))}
            >
              <div className="space-y-3">
                <Select
                  className="w-full"
                  value={form.lifecycleId ?? -1}
                  onChange={(value) => setForm((prev) => ({ ...prev, lifecycleId: value === -1 ? null : value }))}
                  options={[
                    { value: -1, label: 'Use project default lifecycle' },
                    ...lifecycles.map((lifecycle) => ({ value: lifecycle.id, label: lifecycle.name })),
                  ]}
                />

                <div className="text-sm text-gray-500 leading-relaxed">
                  The lifecycle defines how releases can be promoted between environments. Lifecycles can be defined{' '}
                  <Link to={lifecyclePath} className="text-squid-blue hover:underline">here</Link>. If no lifecycle is selected,
                  the default lifecycle for the project will be used.
                </div>
              </div>
            </DetailPanel>

            <DetailPanel
              title="Is Default Channel"
              subtitle="This channel will be selected by default when creating releases."
              isOpen={expanded.default}
              onToggle={() => setExpanded((prev) => ({ ...prev, default: !prev.default }))}
            >
              <Checkbox
                checked={form.isDefault}
                onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              >
                Default channel
              </Checkbox>
            </DetailPanel>
          </div>

          <div className="px-6 pt-4 pb-0">
            <div className="text-base font-semibold text-gray-900">Package Version Rules</div>
          </div>
          <div className="px-6 pt-3 pb-4">
            <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Use package version rules to restrict which versions of packages can be used on steps when creating releases in this channel.
                </div>
                <Button type="primary">Add rule</Button>
              </div>
            </div>
          </div>

          <div className="px-6 pt-1 pb-0">
            <div className="text-base font-semibold text-gray-900">Git Protection Rules</div>
          </div>
          <div className="px-6 pt-3 pb-6">
            <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Add rules to restrict which branches and tags can be used for steps that source files from a Git repository.
                </div>
                <Button type="primary">Add rule</Button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default ChannelDetail
