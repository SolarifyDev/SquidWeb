import { Alert } from 'antd'
import { ArrowRightOutlined, FileTextOutlined } from '@ant-design/icons'
import { useOutletContext } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'

export default function RunbookOverviewPage() {
  const { runbook, canEdit } = useOutletContext<RunbookDetailOutletContext>()

  return (
    <div className="flex min-h-full flex-col px-6 py-6 sm:px-9 sm:py-8">
      {runbook.description ? (
        <section className="mb-5 max-w-[760px]">
          <h2 className="m-0 text-lg font-semibold text-slate-900">Description</h2>
          <p className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{runbook.description}</p>
        </section>
      ) : null}

      <section className="flex flex-1 items-center justify-center py-7">
        <div className="grid w-full max-w-[980px] items-center gap-7 md:grid-cols-[minmax(0,1fr)_300px]">
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

          <div className="relative mx-auto flex h-[230px] w-full max-w-[300px] items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-2/3 -translate-y-1/2 rounded-[42%_58%_50%_45%] bg-slate-100" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-blue-100 bg-white text-squid-blue shadow-card">
              <FileTextOutlined className="text-4xl" />
            </div>
            <div className="absolute bottom-6 left-2 h-12 w-12 rounded-full border border-slate-200 bg-white" />
            <div className="absolute right-4 top-6 h-8 w-8 rounded-full border border-slate-200 bg-white" />
          </div>
        </div>
      </section>

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
