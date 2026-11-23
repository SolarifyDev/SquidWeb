import type { ReactNode } from 'react'
import { Alert, Descriptions, Spin, Tag } from 'antd'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { FAILURE_MODES } from './runbookPreview'
import { classifyRunbookTask, formatRunbookTaskDateTime, formatRunbookTaskDuration, parsePositiveId } from './shared'
import { WorkflowHeader } from './RunbookWorkflowPage'

export function RunbookRunDetailPage() {
  const { taskId, previewId } = useParams()
  const { preview, processState } = useOutletContext<RunbookDetailOutletContext>()
  const run = preview.runs.find((item) => item.id === previewId)
  const task = processState.tasks.find((item) => item.id === parsePositiveId(taskId))
  const status = task ? classifyRunbookTask(task) : null
  const title = run ? `Run preview · ${run.environment}` : task?.name || 'Run details'
  const row = (label: string, value: ReactNode) => ({ key: label, label, children: value })
  const items = run ? [
    row('State', <Tag color="blue">Preview</Tag>),
    row('Snapshot', run.snapshot),
    row('Environment', run.environment),
    row('Created', formatRunbookTaskDateTime(run.createdAt)),
    row('When', run.scheduledAt ? formatRunbookTaskDateTime(run.scheduledAt) : 'Now'),
    ...(run.packageVersion ? [row('Package version', run.packageVersion)] : []),
    row('Failure mode', FAILURE_MODES.find((mode) => mode.value === run.failureMode)?.label),
    row('Excluded steps', run.excludedSteps.join(', ') || 'None'),
    row('Targets', run.targetMode === 'all' ? 'All applicable targets' : `${run.targetMode === 'include' ? 'Include' : 'Exclude'}: ${run.targetTags.join(', ')}`),
  ] : task ? [
    row('State', status?.label),
    row('Task ID', task.id),
    row('Description', task.description || '—'),
    row('Environment', task.environmentId ? `Environment #${task.environmentId}` : '—'),
    row('Queued', formatRunbookTaskDateTime(task.queueTime)),
    row('Started', formatRunbookTaskDateTime(task.startTime)),
    row('Completed', formatRunbookTaskDateTime(task.completedTime)),
    row('Duration', formatRunbookTaskDuration(task.durationSeconds)),
    ...(task.errorMessage ? [row('Error', task.errorMessage)] : []),
  ] : []

  return (
    <>
      <WorkflowHeader title={title} backTo="../runs" backLabel="Runs" />
      <div className="space-y-4 px-5 py-4 sm:px-7">
        {run ? <Alert type="info" showIcon message="This preview records your configuration. It does not execute a task." /> : null}
        {items.length ? <Descriptions bordered size="small" column={1} items={items} /> : (
          !previewId && processState.tasksLoading ? <Spin /> : (
            <Alert type="warning" showIcon message={processState.tasksUnavailable && !previewId
              ? 'Runbook task history is currently unavailable.'
              : 'This run is not available in the current history.'} />
          )
        )}
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
