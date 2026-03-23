import React, { useEffect, useMemo, useState } from 'react'
import { CheckOutlined, DownOutlined, ExclamationCircleFilled, FilterOutlined, LoadingOutlined } from '@ant-design/icons'
import { Spin } from 'antd'
import { getEnvironments } from 'pages/apis/environment'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getServerTaskList, type ServerTaskListItemDto, type ServerTaskStateValue } from 'pages/apis/serverTask'
import { useParams } from 'react-router-dom'

type TabKey = 'all' | 'running' | 'waiting' | 'needsApproval' | 'completed'

interface ProjectTaskRow extends ServerTaskListItemDto {
  environmentName: string
}

const PAGE_SIZE = 30
const RUNNING_STATES = new Set(['executing', 'cancelling'])
const WAITING_STATES = new Set(['pending'])
const TASK_STATE_OPTIONS: Array<'all' | ServerTaskStateValue> = [
  'all',
  'Pending',
  'Executing',
  'Paused',
  'Cancelling',
  'Success',
  'Failed',
  'Cancelled',
  'TimedOut',
]

function toOrdinal(day: number): string {
  const mod10 = day % 10
  const mod100 = day % 100
  if (mod10 === 1 && mod100 !== 11) return `${day}st`
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`
  return `${day}th`
}

function formatTaskDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  return `${month} ${toOrdinal(date.getDate())} ${date.getFullYear()}`
}

function formatLongDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

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

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  if (safe < 60) return `${safe} seconds`
  const minutes = Math.round(safe / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

function normalizeState(state: string) {
  return state.trim().toLowerCase()
}

function isNeedsApprovalState(state: string, hasPendingInterruptions: boolean) {
  const normalized = normalizeState(state)
  return hasPendingInterruptions || normalized.includes('approval') || normalized.includes('manual') || normalized === 'paused'
}

function matchesTab(row: ProjectTaskRow, tab: Exclude<TabKey, 'all'>) {
  const normalized = normalizeState(row.state)
  if (tab === 'running') return RUNNING_STATES.has(normalized)
  if (tab === 'waiting') return WAITING_STATES.has(normalized)
  if (tab === 'needsApproval') return isNeedsApprovalState(row.state, row.hasPendingInterruptions)
  return Boolean(row.isCompleted)
}

function getStatusStyles(state: string, hasWarningsOrErrors: boolean) {
  const normalized = normalizeState(state)

  if (normalized === 'success') {
    if (hasWarningsOrErrors) {
      return {
        text: 'Success',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    }
    return {
      text: 'Success',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  if (RUNNING_STATES.has(normalized)) {
    return {
      text: 'Running',
      dotClass: 'bg-blue-500',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    }
  }

  if (WAITING_STATES.has(normalized) || normalized === 'paused') {
    return {
      text: state,
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    }
  }

  return {
    text: state,
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  }
}

const ProjectTasks: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>()

  const [project, setProject] = useState<ProjectDto | null>(null)
  const [environmentNameById, setEnvironmentNameById] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ProjectTaskRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selectedState, setSelectedState] = useState<'all' | ServerTaskStateValue>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedEnvironment, setSelectedEnvironment] = useState<'all' | number>('all')
  const [warningsOnly, setWarningsOnly] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!projectName) {
      setProject(null)
      setRows([])
      setTotalCount(0)
      setEnvironmentNameById(new Map())
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const projectsRes = await getProjects({ pageSize: 1000, keyword: projectName })
        const foundProject = projectsRes.projects.find((item) => item.slug === projectName || item.name === projectName) ?? null
        if (cancelled) return

        setProject(foundProject)
        setRows([])
        setTotalCount(0)
        setPage(1)

        if (!foundProject) {
          setEnvironmentNameById(new Map())
          return
        }

        const environmentsRes = await getEnvironments({ pageSize: 1000, spaceId: foundProject.spaceId }).catch(() => ({ environments: [] }))
        if (cancelled) return

        const nextEnvironmentNameById = new Map(
          (environmentsRes.environments ?? []).map((environment) => [environment.id, environment.name]),
        )
        setEnvironmentNameById(nextEnvironmentNameById)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectName])

  useEffect(() => {
    if (!project) return

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const response = await getServerTaskList({
          projectId: project.id,
          state: selectedState === 'all' ? undefined : selectedState,
          pageIndex: page,
          pageSize: PAGE_SIZE,
        })
        if (cancelled) return

        const mappedRows = (response.items ?? [])
          .map((item) => ({
            ...item,
            environmentName: environmentNameById.get(item.environmentId) ?? `Environment ${item.environmentId}`,
          }))
          .sort((left, right) => Date.parse(right.queueTime) - Date.parse(left.queueTime))

        setRows(mappedRows)
        setTotalCount(Number.isFinite(response.totalCount) ? response.totalCount : mappedRows.length)
      } catch {
        if (!cancelled) {
          setRows([])
          setTotalCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [project, selectedState, page, environmentNameById])

  const environmentOptions = useMemo(
    () => [{
      label: 'All environments',
      value: 'all' as const,
    }, ...Array.from(environmentNameById.entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([id, name]) => ({ label: name, value: id }))],
    [environmentNameById],
  )

  const rowsAfterLocalFilters = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return rows.filter((row) => {
      if (selectedEnvironment !== 'all' && row.environmentId !== selectedEnvironment) return false
      if (warningsOnly && !row.hasWarningsOrErrors) return false
      if (keyword && !row.description.toLowerCase().includes(keyword) && !row.name.toLowerCase().includes(keyword)) return false
      return true
    })
  }, [rows, searchText, selectedEnvironment, warningsOnly])

  const tabCounts = useMemo(() => ({
    all: rowsAfterLocalFilters.length,
    running: rowsAfterLocalFilters.filter((row) => matchesTab(row, 'running')).length,
    waiting: rowsAfterLocalFilters.filter((row) => matchesTab(row, 'waiting')).length,
    needsApproval: rowsAfterLocalFilters.filter((row) => matchesTab(row, 'needsApproval')).length,
    completed: rowsAfterLocalFilters.filter((row) => matchesTab(row, 'completed')).length,
  }), [rowsAfterLocalFilters])

  const filteredRows = useMemo(() => {
    if (activeTab === 'all') return rowsAfterLocalFilters
    return rowsAfterLocalFilters.filter((row) => matchesTab(row, activeTab))
  }, [activeTab, rowsAfterLocalFilters])

  useEffect(() => {
    setPage(1)
  }, [selectedState])

  const hasLocalFilter = activeTab !== 'all' || selectedEnvironment !== 'all' || warningsOnly || searchText.trim().length > 0
  const totalPages = hasLocalFilter ? 1 : Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filteredRows

  const pageNumbers = useMemo(() => {
    if (totalPages <= 8) return Array.from({ length: totalPages }, (_, index) => index + 1)
    if (currentPage <= 5) return [1, 2, 3, 4, 5, 6, 7, 8]
    if (currentPage >= totalPages - 4) return Array.from({ length: 8 }, (_, index) => totalPages - 7 + index)
    return Array.from({ length: 8 }, (_, index) => currentPage - 3 + index)
  }, [currentPage, totalPages])

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'running', label: `Running (${tabCounts.running})` },
    { key: 'waiting', label: `Waiting (${tabCounts.waiting})` },
    { key: 'needsApproval', label: `Needs Approval (${tabCounts.needsApproval})` },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4 bg-white">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-semibold text-slate-800 m-0">Tasks</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-3">
        <div className="flex items-center overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'relative min-w-[7.23rem] px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'text-squid-blue' : 'text-slate-700 hover:text-squid-blue',
                ].join(' ')}
              >
                {tab.label}
                {active ? <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-squid-blue" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 min-w-[260px]">
            <span>Filter by task state</span>
            <div className="relative">
              <select
                className="octo-native-select text-sm"
                value={selectedState}
                onChange={(event) => setSelectedState(event.target.value as 'all' | ServerTaskStateValue)}
              >
                {TASK_STATE_OPTIONS.map((state) => (
                  <option key={state} value={state}>
                    {state === 'all' ? 'All task states' : state}
                  </option>
                ))}
              </select>
              <DownOutlined className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
            </div>
          </label>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-squid-blue hover:text-blue-800 transition-colors"
            onClick={() => setShowAdvancedFilters((open) => !open)}
          >
            <FilterOutlined />
            {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
          </button>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              <span>By environment</span>
              <div className="relative">
                <select
                  className="octo-native-select text-sm"
                  value={selectedEnvironment === 'all' ? 'all' : String(selectedEnvironment)}
                  onChange={(event) => setSelectedEnvironment(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                >
                  {environmentOptions.map((option) => (
                    <option key={String(option.value)} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <DownOutlined className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
              </div>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-500 md:col-span-2">
              <span>Search</span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="By task name or description"
                className="h-[38px] px-0 text-sm text-slate-700"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={warningsOnly} onChange={(event) => setWarningsOnly(event.target.checked)} />
              Has warnings or errors
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex-1 min-h-[520px]">
        <Spin spinning={loading}>
          <div className="flex flex-col min-h-[520px]">
            <div className="overflow-auto">
              <table aria-label="Tasks" className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold border-b border-slate-200">State</th>
                    <th className="px-3 py-2 font-semibold border-b border-slate-200">Task</th>
                    <th className="px-3 py-2 font-semibold border-b border-slate-200">Start Time</th>
                    <th className="px-3 py-2 font-semibold border-b border-slate-200">Completed Time</th>
                    <th className="px-3 py-2 font-semibold border-b border-slate-200">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-slate-400" colSpan={5}>
                        No tasks found.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => {
                      const stateStyles = getStatusStyles(row.state, row.hasWarningsOrErrors)
                      return (
                        <tr key={row.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                          <td className="px-3 py-2 align-middle">
                            <span className={['inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', stateStyles.badgeClass].join(' ')}>
                              <span className={['inline-block h-2 w-2 rounded-full', stateStyles.dotClass].join(' ')} />
                              <span>{stateStyles.text}</span>
                              {row.hasWarningsOrErrors ? (
                                <span className="inline-flex items-center text-amber-600" aria-label="Has warnings">
                                  <ExclamationCircleFilled />
                                </span>
                              ) : row.state.toLowerCase() === 'success' ? (
                                <span className="inline-flex items-center text-emerald-600" aria-label="Success">
                                  <CheckOutlined />
                                </span>
                              ) : RUNNING_STATES.has(normalizeState(row.state)) ? (
                                <span className="inline-flex items-center text-blue-600" aria-label="Running">
                                  <LoadingOutlined />
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm text-slate-800 leading-snug">{row.description}</span>
                              <span className="text-xs text-slate-500">{formatTaskDate(row.queueTime)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700">{formatLongDateTime(row.startTime ?? row.queueTime)}</td>
                          <td className="px-3 py-2 align-top text-slate-700">{formatLongDateTime(row.completedTime)}</td>
                          <td className="px-3 py-2 align-top text-slate-700">{formatDuration(row.durationSeconds)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-auto border-t border-slate-200 px-3 py-2">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  className="h-7 min-w-7 px-2 rounded border border-slate-300 text-xs text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1 || hasLocalFilter}
                  title="<<"
                >
                  {'<<'}
                </button>

                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={[
                      'h-7 min-w-7 px-2 rounded border text-xs',
                      pageNumber === currentPage
                        ? 'border-squid-blue bg-squid-blue text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                    onClick={() => setPage(pageNumber)}
                    title={String(pageNumber)}
                    disabled={hasLocalFilter}
                  >
                    {pageNumber}
                  </button>
                ))}

                {totalPages > pageNumbers[pageNumbers.length - 1] ? (
                  <button type="button" className="h-7 min-w-7 px-2 rounded border border-slate-300 text-xs text-slate-700 cursor-default" title="...">
                    ...
                  </button>
                ) : null}

                <button
                  type="button"
                  className="h-7 min-w-7 px-2 rounded border border-slate-300 text-xs text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages || hasLocalFilter}
                  title=">>"
                >
                  {'>>'}
                </button>
              </div>
            </div>
          </div>
        </Spin>
      </div>
    </div>
  )
}

export default ProjectTasks
