import { useMemo, useState } from 'react'
import { Alert, Input, Spin, Tag } from 'antd'
import { CheckCircleFilled, DownOutlined, FilterOutlined } from '@ant-design/icons'
import { Link, useOutletContext } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import {
  classifyRunbookTask,
  formatRunbookTaskDateTime,
  formatRunbookTaskDuration,
} from './shared'

type RunTab = 'all' | 'running' | 'waiting' | 'needsApproval' | 'completed'

export default function RunbookRunsPage() {
  const { processState, preview } = useOutletContext<RunbookDetailOutletContext>()
  const [activeTab, setActiveTab] = useState<RunTab>('all')
  const [taskState, setTaskState] = useState('all')
  const [advancedFilters, setAdvancedFilters] = useState(false)
  const [query, setQuery] = useState('')
  const [environment, setEnvironment] = useState('all')

  const classifiedTasks = useMemo(() => [
    ...preview.runs.map((run) => ({
      id: `preview-${run.id}`, path: `preview/${run.id}`, title: run.snapshot, description: run.environment,
      environment: run.environment, start: run.scheduledAt ?? run.createdAt, end: null, duration: null,
      status: { category: 'preview', label: 'Preview', tone: 'info' },
    })),
    ...processState.tasks.map((task) => ({
      id: String(task.id), path: String(task.id), title: task.name || `Task #${task.id}`, description: task.description,
      environment: task.environmentId ? `Environment #${task.environmentId}` : '', start: task.startTime ?? task.queueTime,
      end: task.completedTime, duration: task.durationSeconds, status: classifyRunbookTask(task),
    })),
  ], [preview.runs, processState.tasks])
  const environments = [...new Set(classifiedTasks.map((task) => task.environment).filter(Boolean))].sort()

  const tabCounts = useMemo(() => ({
    all: classifiedTasks.length,
    running: classifiedTasks.filter((item) => item.status.category === 'running').length,
    waiting: classifiedTasks.filter((item) => item.status.category === 'waiting').length,
    needsApproval: classifiedTasks.filter((item) => item.status.category === 'needsApproval').length,
  }), [classifiedTasks])

  const visibleTasks = useMemo(() => {
    let list = classifiedTasks
    if (activeTab === 'running') list = list.filter((item) => item.status.category === 'running')
    if (activeTab === 'waiting') list = list.filter((item) => item.status.category === 'waiting')
    if (activeTab === 'needsApproval') list = list.filter((item) => item.status.category === 'needsApproval')
    if (activeTab === 'completed') list = list.filter((item) => item.status.category === 'completed' || item.status.category === 'failed')
    if (taskState !== 'all') list = list.filter((item) => item.status.label.toLowerCase() === taskState.toLowerCase())
    if (environment !== 'all') list = list.filter((item) => item.environment === environment)
    const text = query.trim().toLowerCase()
    if (text) list = list.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(text))
    return list
  }, [activeTab, classifiedTasks, environment, query, taskState])

  if (processState.tasksLoading && preview.runs.length === 0) {
    return <div className="flex min-h-[280px] items-center justify-center"><Spin /></div>
  }

  const tabs: Array<{ key: RunTab; label: string }> = [
    { key: 'all', label: `All` },
    { key: 'running', label: `Running (${tabCounts.running})` },
    { key: 'waiting', label: `Waiting (${tabCounts.waiting})` },
    { key: 'needsApproval', label: `Needs Approval (${tabCounts.needsApproval})` },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-slate-200 px-6 sm:px-8">
        <div className="flex min-w-0 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'relative flex h-12 min-w-[132px] flex-shrink-0 items-center justify-center px-4 text-sm font-medium transition-colors',
                  active ? 'text-squid-blue' : 'text-slate-600 hover:text-squid-blue',
                ].join(' ')}
              >
                {tab.label}
                {active ? <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-squid-blue" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 px-6 py-4 sm:px-8">
        <label className="flex min-w-[220px] max-w-[300px] flex-1 flex-col gap-1 text-xs text-slate-500">
          <span>Filter by task state</span>
          <div className="relative">
            <select
              className="octo-native-select text-sm"
              value={taskState}
              onChange={(event) => setTaskState(event.target.value)}
              aria-label="Filter by task state"
            >
              <option value="all">All task states</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="timed out">Timed out</option>
              <option value="running">Running</option>
              <option value="waiting">Waiting</option>
              <option value="needs approval">Needs approval</option>
              <option value="preview">Preview</option>
            </select>
            <DownOutlined className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
          </div>
        </label>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 text-sm text-squid-blue hover:underline"
          aria-expanded={advancedFilters}
          onClick={() => setAdvancedFilters((open) => !open)}
        >
          <FilterOutlined aria-hidden="true" />
          {advancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
        </button>
      </div>

      {advancedFilters ? (
        <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 px-6 py-4 sm:px-8">
          <label className="flex min-w-[200px] flex-col gap-1 text-xs text-slate-500">
            Environment
            <select className="octo-native-select text-sm" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="all">All environments</option>
              {environments.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-xs text-slate-500">
            Task or snapshot
            <Input value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
          </label>
          <button type="button" className="pb-1 text-sm text-squid-blue hover:underline" onClick={() => {
            setQuery('')
            setEnvironment('all')
            setTaskState('all')
            setActiveTab('all')
          }}>Clear filters</button>
        </div>
      ) : null}

      {processState.tasksUnavailable ? (
        <div className="border-b border-slate-200 px-6 py-3 sm:px-8">
          <Alert type="warning" showIcon message="Runbook task history is currently unavailable." />
        </div>
      ) : null}

      <div className="min-h-[320px] flex-1 overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-white text-slate-700">
            <tr className="border-b border-slate-200">
              <th className="w-[136px] px-6 py-3 font-semibold sm:px-8">State</th>
              <th className="w-[30%] px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Start Time</th>
              <th className="px-4 py-3 font-semibold">Completed Time</th>
              <th className="w-[130px] px-4 py-3 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.length === 0 ? (
              <tr>
                <td className="px-6 py-16 text-center text-sm text-slate-500 sm:px-8" colSpan={5}>
                  {classifiedTasks.length === 0 ? (
                    processState.tasksUnavailable ? 'No preview runs in this tab.' : (
                      <>There are no runs for this Runbook yet. {processState.hasProcess || preview.snapshot ? <Link to="../run" className="text-squid-blue hover:underline">Run now</Link> : null}</>
                    )
                  ) : 'No runs match these filters.'}
                </td>
              </tr>
            ) : visibleTasks.map((task) => (
              <tr key={task.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/70">
                <td className="px-6 py-3 align-top sm:px-8">
                  <span className={[
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    task.status.tone === 'success' ? 'text-emerald-700' : task.status.tone === 'danger' ? 'text-rose-700' : task.status.tone === 'warning' ? 'text-amber-700' : 'text-slate-600',
                  ].join(' ')}>
                    {task.status.tone === 'success' ? <CheckCircleFilled className="text-emerald-600" /> : null}
                    {task.status.category === 'preview' ? <Tag color="blue">Preview</Tag> : task.status.label}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  <Link to={task.path} className="font-semibold text-squid-blue hover:underline">{task.title}</Link>
                  {task.description ? <div className="mt-0.5 text-xs text-slate-500">{task.description}</div> : null}
                </td>
                <td className="px-4 py-3 align-top text-slate-600">{formatRunbookTaskDateTime(task.start)}</td>
                <td className="px-4 py-3 align-top text-slate-600">{formatRunbookTaskDateTime(task.end)}</td>
                <td className="px-4 py-3 align-top text-slate-600">{task.duration === null ? '—' : formatRunbookTaskDuration(task.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
