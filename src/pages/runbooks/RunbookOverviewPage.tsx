import { Alert, Spin } from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  FileTextOutlined,
} from '@ant-design/icons'
import { Link, useOutletContext } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import {
  buildRunbookRunsPath,
  classifyRunbookTask,
  formatRunbookTaskDateTime,
} from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'

export default function RunbookOverviewPage() {
  const { runbook, canEdit, processState } = useOutletContext<RunbookDetailOutletContext>()
  const { spaceId, projectName } = useProjectRunbookContext()
  const latestTask = processState.tasks[0] ?? null
  const latestStatus = latestTask ? classifyRunbookTask(latestTask) : null
  const runsPath = buildRunbookRunsPath(spaceId, projectName ?? '', runbook.id)

  if (processState.loading) {
    return <div className="flex min-h-[280px] items-center justify-center"><Spin /></div>
  }

  return (
    <div className="flex min-h-full flex-col px-6 py-6 sm:px-9 sm:py-8">
      {runbook.description ? (
        <section className="mb-5 max-w-[760px]">
          <h2 className="m-0 text-lg font-semibold text-slate-900">Description</h2>
          <p className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{runbook.description}</p>
        </section>
      ) : null}

      {!processState.hasProcess ? (
        <section className="flex flex-1 items-center justify-center py-4">
          <div className="grid w-full max-w-[860px] items-center gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <h2 className="m-0 text-[20px] font-semibold leading-7 text-slate-900">Add steps to your Runbook</h2>
              <p className="mb-0 mt-4 text-sm leading-6 text-slate-700">
                The steps for a Runbook are like a recipe. You define the recipe by adding steps and variables to a Runbook.
              </p>
              <p className="mb-0 mt-1 text-sm leading-6 text-slate-700">
                Each step contains a specific action (or set of actions) that is executed each time your Runbook is run.
              </p>
              <a
                href="https://octopus.com/docs/runbooks"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-squid-blue hover:underline"
              >
                Learn more
                <ArrowRightOutlined className="rotate-[-45deg] text-[11px]" />
              </a>
            </div>

            <div className="relative mx-auto flex h-[210px] w-full max-w-[300px] items-center justify-center">
              <div className="absolute inset-[8%_5%_12%_9%] rotate-[-7deg] rounded-[47%_53%_43%_57%] bg-slate-100" />
              <div className="relative flex h-28 w-28 items-center justify-center text-squid-blue">
                <FileTextOutlined className="text-[56px]" />
              </div>
              <div className="absolute bottom-7 left-4 h-1.5 w-16 rounded-full bg-slate-200" />
              <div className="absolute right-6 top-8 h-1.5 w-10 rounded-full bg-slate-200" />
            </div>
          </div>
        </section>
      ) : latestTask ? (
        <section className="flex flex-1 items-start justify-start pt-0">
          <div className="w-full max-w-[340px]">
            <div className="rounded-md border border-blue-100 bg-blue-50/70 p-4">
              <div className="text-center text-sm font-semibold text-slate-900">{runbook.name}</div>
              <div className="mt-3 flex items-start gap-3">
                <CheckCircleFilled className={[
                  'mt-0.5 text-[18px]',
                  latestStatus?.tone === 'danger' ? 'text-rose-500' : latestStatus?.tone === 'warning' ? 'text-amber-500' : 'text-emerald-500',
                ].join(' ')} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-slate-900">{formatRunbookTaskDateTime(latestTask.startTime ?? latestTask.queueTime)}</div>
                  <div className="mt-0.5 text-xs text-slate-600">Snapshot {latestTask.name || `Task #${latestTask.id}`}</div>
                </div>
                <Link to={runsPath} className="self-center text-sm text-squid-blue hover:underline">Run details</Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-start pt-5 text-center">
          <p className="m-0 text-sm font-semibold text-slate-800">There are no runs for this Runbook yet. Run Now</p>
          <div className="mt-7 flex items-end justify-center text-slate-300" aria-hidden="true">
            <div className="mr-1 h-8 w-2 rounded-t-full bg-slate-300" />
            <div className="-ml-1 h-12 w-20 rounded-[45%_55%_10%_8%] bg-slate-300" />
            <div className="-ml-2 h-5 w-14 rounded-[50%_50%_10%_10%] bg-slate-300" />
            <div className="-ml-1 h-7 w-7 rounded-full border-2 border-slate-400 bg-white" />
          </div>
        </section>
      )}

      {processState.tasksUnavailable ? (
        <Alert className="mt-4" type="warning" showIcon message="Runbook task history is currently unavailable." />
      ) : null}

      {!canEdit ? (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="RunbookEdit is required to change this Runbook."
        />
      ) : null}
    </div>
  )
}
