import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Descriptions, Spin, Tag } from 'antd'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { getRunbookApiErrorDetails, type RunbookRunDto } from 'pages/apis/runbook'
import { getServerTask, getServerTaskLogs, type ServerTaskLogElementDto, type ServerTaskSummaryDto } from 'pages/apis/serverTask'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { FAILURE_MODES } from './runbookPreview'
import { classifyRunbookTask, formatRunbookTaskDateTime, formatRunbookTaskDuration, parsePositiveId } from './shared'
import { taskBelongsToRunbook } from './useRunbookProcessState'
import { WorkflowHeader } from './RunbookWorkflowPage'

function isTaskActive(state: string) {
  return ['pending', 'executing', 'cancelling'].includes(state.trim().toLowerCase())
}

const STATUS_COLORS = { success: 'green', danger: 'red', warning: 'gold', info: 'blue', neutral: 'default' }
const row = (label: string, value: ReactNode) => ({ key: label, label, children: value })

export function RunbookRunDetailPage() {
  const { taskId, previewId } = useParams()
  const { preview } = useOutletContext<RunbookDetailOutletContext>()
  const run = preview.runs.find((item) => item.id === previewId)
  const parsedTaskId = parsePositiveId(taskId)
  if (parsedTaskId) return <RunbookTaskDetails key={parsedTaskId} taskId={parsedTaskId} />

  return (
    <>
      <WorkflowHeader title={run ? `Run preview · ${run.environment}` : 'Run details'} backTo="../runs" backLabel="Runs" />
      <div className="space-y-4 px-5 py-4 sm:px-7">
        {run ? (
          <>
            <Alert type="info" showIcon message="This preview records your configuration. It does not execute a task." />
            <Descriptions bordered size="small" column={1} items={[
              row('State', <Tag color="blue">Preview</Tag>),
              row('Snapshot', run.snapshot),
              row('Environment', run.environment),
              row('Created', formatRunbookTaskDateTime(run.createdAt)),
              row('When', run.scheduledAt ? formatRunbookTaskDateTime(run.scheduledAt) : 'Now'),
              ...(run.packageVersion ? [row('Package version', run.packageVersion)] : []),
              row('Failure mode', FAILURE_MODES.find((mode) => mode.value === run.failureMode)?.label),
              row('Excluded steps', run.excludedSteps.join(', ') || 'None'),
              row('Targets', run.targetMode === 'all' ? 'All applicable targets' : `${run.targetMode === 'include' ? 'Include' : 'Exclude'}: ${run.targetTags.join(', ')}`),
            ]} />
          </>
        ) : <Alert type="warning" showIcon message="This run is not available." />}
      </div>
    </>
  )
}

function RunbookTaskDetails({ taskId }: { taskId: number }) {
  const { state } = useLocation()
  const { runbook } = useOutletContext<RunbookDetailOutletContext>()
  const { id: runbookId, name: runbookName, projectId, spaceId } = runbook
  const navigation = state as { runbookRun?: RunbookRunDto; environmentName?: string } | null
  const accepted = navigation?.runbookRun
  const acceptedRun = accepted?.taskId === taskId && accepted.runbookId === runbookId
    && accepted.projectId === projectId && accepted.spaceId === spaceId ? accepted : null
  const [task, setTask] = useState<ServerTaskSummaryDto | null>(null)
  const [logs, setLogs] = useState<ServerTaskLogElementDto[]>([])
  const cursor = useRef<number>()
  const [hasMoreLogs, setHasMoreLogs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    let refreshTimer: number | undefined
    setLoading(true)
    setError(null)
    const load = async () => {
      try {
        const next = await getServerTask(taskId, { silentLoading: true })
        if (!active) return
        const descriptionPrefix = `Run Runbook ${runbookName} version `
        const matchesRunbook = next?.name === 'Runbook'
          ? Boolean(acceptedRun) || (next.description.startsWith(descriptionPrefix)
            && /^\d+$/.test(next.description.slice(descriptionPrefix.length)))
          : next && taskBelongsToRunbook(next, { id: runbookId, name: runbookName })
        if (!next || next.id !== taskId || next.projectId !== projectId || next.spaceId !== spaceId || !matchesRunbook) {
          throw new Error('This Runbook task is not available.')
        }
        setTask(next)

        const page = await getServerTaskLogs(taskId, { afterSequenceNumber: cursor.current }, { silentLoading: true })
        if (!active) return
        if (page.items.length) {
          cursor.current = page.nextAfterSequenceNumber ?? page.items[page.items.length - 1].sequenceNumber
          setLogs((current) => [...current, ...page.items])
        }
        setHasMoreLogs(page.hasMore)
        if (isTaskActive(next.state)) {
          refreshTimer = window.setTimeout(() => { void load() }, 3000)
        }
      } catch (caught) {
        if (active) {
          setTask(null)
          setLogs([])
          cursor.current = undefined
          setHasMoreLogs(false)
          setError(getRunbookApiErrorDetails(caught).message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    }
  }, [taskId, projectId, spaceId, runbookId, runbookName, acceptedRun, reloadKey])

  const terminal = task ? !isTaskActive(task.state) : false
  const status = task ? classifyRunbookTask({
    state: task.state,
    hasPendingInterruptions: task.hasPendingInterruptions ?? task.HasPendingInterruptions ?? false,
    isCompleted: terminal,
  }) : null
  const items = task ? [
    row('State', <Tag color={status && STATUS_COLORS[status.tone] || 'default'}>{status?.label}</Tag>),
    row('Task ID', task.id),
    row('Description', task.description || '—'),
    row('Environment', (acceptedRun?.environmentId === task.environmentId ? navigation?.environmentName : null)
      ?? (task.environmentId ? `Environment #${task.environmentId}` : '—')),
    row('Queued', formatRunbookTaskDateTime(task.queueTime)),
    row('Started', formatRunbookTaskDateTime(task.startTime)),
    row('Completed', formatRunbookTaskDateTime(task.completedTime)),
    row('Duration', formatRunbookTaskDuration(task.durationSeconds ?? 0)),
    ...(acceptedRun ? [row('Runbook version', acceptedRun.snapshotVersion), row('Run ID', acceptedRun.id)] : []),
    ...(task.errorMessage ? [row('Error', task.errorMessage)] : []),
  ] : []

  return (
    <>
      <WorkflowHeader title="Run details" backTo="../runs" backLabel="Runs" />
      <div className="space-y-4 px-5 py-4 sm:px-7">
        {loading && !task ? <div className="flex min-h-[120px] items-center justify-center"><Spin /></div> : null}
        {error ? <Alert type="error" showIcon message="Unable to refresh Runbook task status or logs." description={error}
          action={<Button size="small" onClick={() => setReloadKey((value) => value + 1)}>Retry</Button>} /> : null}
        {task ? <>
          <Descriptions bordered size="small" column={1} items={items} />
          <section aria-labelledby="runbook-task-logs" className="space-y-2">
            <h3 id="runbook-task-logs" className="m-0 text-sm font-semibold text-slate-900">Task logs</h3>
            {logs.length ? (
              <ol className="m-0 max-h-[50vh] list-none overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-sm">
                {logs.map((log) => (
                  <li key={log.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 py-1">
                    <span className="text-right text-xs text-slate-500">{log.sequenceNumber}</span>
                    <div className="whitespace-pre-wrap break-words">
                      {log.messageText}
                      {log.detail ? <div className="text-xs text-slate-600">{log.detail}</div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : !error && !loading ? <p className="m-0 text-sm text-slate-500">No task logs yet.</p> : null}
            {hasMoreLogs && terminal && !error ? (
              <Button size="small" loading={loading} onClick={() => setReloadKey((value) => value + 1)}>Load more logs</Button>
            ) : null}
          </section>
        </> : null}
      </div>
    </>
  )
}

export function RunbookAuditPage() {
  const { preview } = useOutletContext<RunbookDetailOutletContext>()
  const entries = [
    ...preview.publishedSnapshots.map((snapshot) => ({
      id: `publish-${snapshot.publishedAt}`,
      date: snapshot.publishedAt,
      text: `Published preview snapshot ${snapshot.name}`,
    })),
    ...preview.runs.map((run) => ({
      id: run.id,
      date: run.createdAt,
      text: `Created run preview for ${run.environment}`,
      to: `../runs/preview/${run.id}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <WorkflowHeader title="Audit Trail" backTo=".." backLabel="Overview" />
      <div className="space-y-4 px-5 py-4 sm:px-7">
        <Alert type="info" showIcon message="Showing preview activity saved in this tab." />
        {entries.length ? (
          <ul className="m-0 list-none divide-y divide-slate-200 rounded border border-slate-200 p-0">
            {entries.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                {'to' in event && event.to ? <Link to={event.to} className="text-squid-blue hover:underline">{event.text}</Link> : <span>{event.text}</span>}
                <span className="text-slate-500">{formatRunbookTaskDateTime(event.date)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="m-0 py-6 text-center text-sm text-slate-500">No preview activity yet.</p>}
      </div>
    </>
  )
}
