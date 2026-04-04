import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Input, Spin } from 'antd'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getReleases, type ReleaseDto } from 'pages/apis/release'

const PRIMARY_BTN =
  'inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue bg-squid-blue text-white hover:bg-blue-700 hover:border-blue-700 transition-colors'
const SECONDARY_BTN =
  'inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const PAGE_SIZE_OPTIONS = [30, 50, 100]

const formatAssembled = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  try {
    return date.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'shortOffset',
    })
  } catch {
    return date.toLocaleString()
  }
}

const Releases: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [releases, setReleases] = useState<ReleaseDto[]>([])
  const [currentDeployedReleaseIds, setCurrentDeployedReleaseIds] = useState<number[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [selectedChannelId, setSelectedChannelId] = useState<number | 'all'>('all')
  const [searchVersion, setSearchVersion] = useState('')
  const [pageSize, setPageSize] = useState(30)
  const [pageIndex, setPageIndex] = useState(1)

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 500 })
        const foundProject =
          projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null

        setProject(foundProject)
        setSelectedChannelId('all')
        setPageIndex(1)
        setReleases([])
        setCurrentDeployedReleaseIds([])
        setTotalCount(0)

        if (!foundProject) {
          setChannels([])
          return
        }

        try {
          const channelRes = await getChannels({ projectId: foundProject.id, pageSize: 1000 })
          const projectChannels = channelRes.channels.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1
            if (!a.isDefault && b.isDefault) return 1
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          })
          setChannels(projectChannels)
        } catch {
          setChannels([])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  useEffect(() => {
    if (!project?.id) return
    const isFirstPage = pageIndex === 1

    if (isFirstPage) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    ;(async () => {
      try {
        const query = {
          pageIndex,
          pageSize,
          projectId: project.id,
          ...(selectedChannelId !== 'all' ? { channelId: selectedChannelId } : {}),
        }

        let response = await getReleases(query)
        let fetched = (response.releases ?? []).filter((r) => r.projectId === project.id)

        if (selectedChannelId !== 'all') {
          fetched = fetched.filter((r) => r.channelId === selectedChannelId)
        }

        // Compatibility fallback for backends that require explicit channelId filtering.
        if (selectedChannelId === 'all' && fetched.length === 0 && channels.length > 0) {
          const responses = await Promise.all(
            channels.map((channel) =>
              getReleases({
                pageIndex,
                pageSize,
                projectId: project.id,
                channelId: channel.id,
              }).catch(() => null),
            ),
          )

          const merged: ReleaseDto[] = []
          const uniqueIds = new Set<number>()
          const deployedIds = new Set<number>()
          let mergedCount = 0

          for (const item of responses) {
            if (!item) continue
            mergedCount += item.count ?? 0
            for (const id of item.currentDeployedReleaseIds ?? []) {
              deployedIds.add(id)
            }
            for (const release of item.releases ?? []) {
              if (release.projectId !== project.id) continue
              if (uniqueIds.has(release.id)) continue
              uniqueIds.add(release.id)
              merged.push(release)
            }
          }

          response = {
            count: mergedCount || merged.length,
            releases: merged,
            currentDeployedReleaseIds: Array.from(deployedIds),
          }
          fetched = merged
        }

        fetched.sort((a, b) => new Date(b.assembled).getTime() - new Date(a.assembled).getTime())

        setTotalCount(response.count ?? fetched.length)
        setCurrentDeployedReleaseIds((prev) =>
          isFirstPage
            ? (response.currentDeployedReleaseIds ?? [])
            : Array.from(new Set([...prev, ...(response.currentDeployedReleaseIds ?? [])])),
        )
        setReleases((prev) => {
          if (isFirstPage) return fetched
          const map = new Map(prev.map((r) => [r.id, r]))
          for (const release of fetched) {
            map.set(release.id, release)
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.assembled).getTime() - new Date(a.assembled).getTime(),
          )
        })
      } catch {
        if (isFirstPage) {
          setReleases([])
          setCurrentDeployedReleaseIds([])
          setTotalCount(0)
        }
      } finally {
        if (isFirstPage) {
          setLoading(false)
        } else {
          setLoadingMore(false)
        }
      }
    })()
  }, [project?.id, selectedChannelId, pageSize, pageIndex, channels])

  const channelNameById = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel.name])),
    [channels],
  )

  const filteredReleases = useMemo(() => {
    const keyword = searchVersion.trim().toLowerCase()
    if (!keyword) return releases
    return releases.filter((release) => release.version.toLowerCase().includes(keyword))
  }, [releases, searchVersion])

  const hasMore = releases.length < totalCount

  const releaseBasePath = `/${spaceId}/projects/${projectName}/releases`

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-800 m-0">Releases</h1>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => navigate(`${releaseBasePath}/create`)}
          >
            Create Release
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500 w-full sm:w-[360px]">
              <span>Filter by channel</span>
              <div className="relative">
                <select
                  className="octo-native-select text-sm"
                  value={selectedChannelId === 'all' ? 'all' : String(selectedChannelId)}
                  onChange={(e) => {
                    const nextValue = e.target.value === 'all' ? 'all' : Number(e.target.value)
                    setSelectedChannelId(nextValue)
                    setPageIndex(1)
                  }}
                >
                  <option value="all">Showing all channels</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
                <DownOutlined className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
              </div>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-500 min-w-[120px] sm:ml-auto">
              <span>Page size</span>
              <div className="relative">
                <select
                  className="octo-native-select text-sm"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPageIndex(1)
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <DownOutlined className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
              </div>
            </label>
          </div>

          <div className="w-full sm:w-[360px]">
            <Input
              value={searchVersion}
              onChange={(e) => setSearchVersion(e.target.value)}
              placeholder="Search versions..."
              prefix={<SearchOutlined className="text-slate-400" />}
              allowClear
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Spin spinning={loading}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '44%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="text-left text-xs font-semibold text-slate-600 pl-5 pr-2 py-3">Release</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-3">Channel</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-5 py-3">Release Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredReleases.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-14 text-center text-sm text-slate-400">
                      {project ? 'No releases found.' : 'Project not found.'}
                    </td>
                  </tr>
                ) : (
                  filteredReleases.map((release) => {
                    const releaseNote = release.releaseNote ?? ''

                    return (
                      <tr key={release.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="align-top pl-5 pr-2 py-4">
                          <Link
                            to={`/${spaceId}/projects/${projectName}/releases/${encodeURIComponent(
                              release.version,
                            )}?releaseId=${release.id}`}
                            className="no-underline text-squid-blue hover:text-blue-700"
                          >
                            <h3 className="m-0 text-lg font-semibold break-all inline-flex items-center gap-2">
                              <span>{release.version}</span>
                            </h3>
                            <div className="mt-1 text-xs text-slate-500">{formatAssembled(release.assembled)}</div>
                          </Link>
                        </td>
                        <td className="align-top px-3 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {channelNameById.get(release.channelId) || `Channel #${release.channelId}`}
                          </span>
                        </td>
                        <td className="align-top px-5 py-4">
                          <div className="text-sm text-slate-600 whitespace-pre-wrap break-words">
                            {releaseNote || <span className="text-slate-300">-</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-5 py-4 border-t border-slate-200 flex justify-center">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  className={SECONDARY_BTN}
                  onClick={() => setPageIndex((prev) => prev + 1)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
                <div className="text-xs text-slate-400">Or use filters to narrow the search results</div>
              </div>
            </div>
          )}
        </Spin>
      </div>
    </div>
  )
}

export default Releases
