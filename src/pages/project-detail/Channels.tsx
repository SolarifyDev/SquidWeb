import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Input, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getLifecycles, type LifecycleDto } from 'pages/apis/lifecycle'

const ACTION_BTN =
  'inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue/40 text-squid-blue hover:border-squid-blue hover:bg-squid-blue/[0.04] transition-colors no-underline cursor-pointer select-none'

const Channels: React.FC = () => {
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [lifecycles, setLifecycles] = useState<LifecycleDto[]>([])
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 500 })
        const foundProject =
          projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null
        setProject(foundProject)

        if (!foundProject) {
          setChannels([])
          setLifecycles([])
          return
        }

        const [channelRes, lifecycleRes] = await Promise.all([
          getChannels({ pageSize: 500, projectId: foundProject.id }),
          getLifecycles({ pageSize: 1000 }),
        ])

        // Server-side filter by projectId is preferred; keep local filter as a safety net.
        const projectChannels = channelRes.channels.filter((ch) => ch.projectId === foundProject.id)

        projectChannels.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1
          if (!a.isDefault && b.isDefault) return 1
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        })

        setChannels(projectChannels)
        setLifecycles(lifecycleRes.lifecycles)
      } catch {
        setChannels([])
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  const lifecycleNameById = useMemo(
    () => new Map(lifecycles.map((lifecycle) => [lifecycle.id, lifecycle.name])),
    [lifecycles],
  )

  const filteredChannels = useMemo(() => {
    const keyword = filterText.trim().toLowerCase()
    if (!keyword) return channels
    return channels.filter((channel) => channel.name.toLowerCase().includes(keyword))
  }, [channels, filterText])

  const getChannelLifecycleName = (channel: ChannelDto) => {
    const effectiveLifecycleId = channel.lifecycleId ?? project?.lifecycleId ?? null
    if (effectiveLifecycleId == null) return 'Default'
    return lifecycleNameById.get(effectiveLifecycleId) || `Lifecycle #${effectiveLifecycleId}`
  }

  const basePath = `/${spaceId}/projects/${projectName}/deployments/channels`

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-800 m-0">Channels</h1>
          <Link
            to={`${basePath}/create`}
            className={ACTION_BTN}
          >
            Add Channel
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter by name..."
          prefix={<SearchOutlined className="text-slate-400" />}
          allowClear
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Spin spinning={loading}>
          {filteredChannels.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {project ? 'No channels found.' : 'Project not found.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 m-0 p-0 list-none">
              {filteredChannels.map((channel) => (
                <li key={channel.id}>
                  <Link
                    to={`${basePath}/edit/${channel.id}`}
                    className="block px-5 py-4 hover:bg-slate-50 transition-colors"
                    aria-label={channel.name}
                  >
                    <h3 className="m-0 text-base font-semibold text-slate-800 flex items-center gap-2">
                      <span>{channel.name}</span>
                      {channel.isDefault && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Default
                        </span>
                      )}
                    </h3>
                    <div className="mt-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Lifecycle</span>
                      <span className="mx-1">:</span>
                      <span>{getChannelLifecycleName(channel)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Spin>
      </div>
    </div>
  )
}

export default Channels
