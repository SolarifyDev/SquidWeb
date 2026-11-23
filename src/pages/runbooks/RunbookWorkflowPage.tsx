import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Checkbox, Input, Radio, Select, Spin, Tag } from 'antd'
import { ArrowLeftOutlined, DownOutlined } from '@ant-design/icons'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { OUTLINE_BLUE_CLASS, PRIMARY_GREEN_CLASS } from './RunbookPageShell'
import { FAILURE_MODES, PREVIEW_ENVIRONMENTS, type FailureMode, type PreviewRun } from './runbookPreview'
import { formatRunbookTaskDateTime } from './shared'

export function WorkflowHeader({ title, backTo, backLabel, actions }: {
  title: string
  backTo: string
  backLabel: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-7">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-squid-blue hover:underline">
          <ArrowLeftOutlined aria-hidden="true" /> {backLabel}
        </Link>
        <h2 className="mb-0 mt-2 text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {actions}
    </header>
  )
}

function WorkflowSection({ title, children, collapsible = false }: {
  title: string
  children: ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(!collapsible)
  return (
    <section className="grid gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-[185px_minmax(0,1fr)] sm:gap-8 sm:px-7">
      <h3 className="m-0 text-sm font-semibold text-slate-900">
        {collapsible ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 text-left hover:text-squid-blue">
            <DownOutlined aria-hidden="true" className={open ? 'text-xs' : '-rotate-90 text-xs'} /> {title}
          </button>
        ) : title}
      </h3>
      {open ? <div className="max-w-2xl space-y-3 text-sm text-slate-700">{children}</div> : null}
    </section>
  )
}

function WorkflowActions({ backTo, action, disabled }: { backTo: string; action: string; disabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Link className={OUTLINE_BLUE_CLASS} to={backTo}>Cancel</Link>
      <Button className={PRIMARY_GREEN_CLASS} htmlType="submit" disabled={disabled}>{action}</Button>
    </div>
  )
}

function ProcessGate({ publishing = false }: { publishing?: boolean }) {
  const { processState, canEdit, preview } = useOutletContext<RunbookDetailOutletContext>()
  const hasSnapshot = !publishing && Boolean(preview.snapshot)
  if (publishing && !canEdit) {
    return <Alert className="m-5" type="warning" showIcon message="RunbookEdit is required to publish a preview snapshot." />
  }
  if (hasSnapshot) return null
  if (processState.processLoading) return <div className="flex min-h-[160px] items-center justify-center"><Spin /></div>
  if (processState.processUnavailable) {
    return (
      <Alert className="m-5" type="error" showIcon message="Unable to load the Runbook process."
        action={<Button size="small" onClick={processState.reload}>Retry</Button>} />
    )
  }
  if (!processState.hasProcess) {
    return (
      <Alert className="m-5" type="info" showIcon message="Add at least one step before using this Runbook."
        action={<Link to="../process" className={OUTLINE_BLUE_CLASS}>Go to Process</Link>} />
    )
  }
  return null
}

export function RunbookPublishPage() {
  const { processState, preview, setPreview, canEdit } = useOutletContext<RunbookDetailOutletContext>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const canPublish = canEdit && processState.hasProcess && !processState.processLoading

  const publish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canPublish) return
    const snapshotName = name.trim()
    if (!snapshotName) {
      setError('Enter a snapshot name.')
      return
    }
    const snapshot = { name: snapshotName, publishedAt: new Date().toISOString(), steps: processState.steps }
    setPreview({ ...preview, snapshot, publishedSnapshots: [snapshot, ...preview.publishedSnapshots] })
    navigate('../process', { replace: true })
  }

  return (
    <form onSubmit={publish}>
      <WorkflowHeader title="Publish Runbook" backTo="../process" backLabel="Process"
        actions={<WorkflowActions backTo="../process" action="Publish" disabled={!canPublish} />} />
      {!canPublish ? <ProcessGate publishing /> : (
        <>
          <Alert className="mx-5 my-4 sm:mx-7" type="info" showIcon message="Publishing here saves a preview snapshot in this tab." />
          {error ? <Alert className="mx-5 my-4 sm:mx-7" type="error" showIcon message={error} /> : null}
          <WorkflowSection title="Snapshot">
            <label htmlFor="runbook-snapshot-name" className="block font-medium">Snapshot name</label>
            <Input id="runbook-snapshot-name" value={name} maxLength={100} placeholder="e.g. Backup database v1"
              onChange={(event) => { setName(event.target.value); setError('') }} />
            {preview.snapshot ? (
              <p className="text-slate-500">Replaces the current preview snapshot <strong>{preview.snapshot.name}</strong>.</p>
            ) : null}
          </WorkflowSection>
          <WorkflowSection title="Process">
            <p className="m-0">{processState.stepCount} {processState.stepCount === 1 ? 'step' : 'steps'} from the current draft</p>
            <ol className="mb-0 list-decimal space-y-1 pl-5">
              {processState.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
            </ol>
          </WorkflowSection>
        </>
      )}
    </form>
  )
}

export function RunbookRunPage() {
  const { processState, preview, setPreview } = useOutletContext<RunbookDetailOutletContext>()
  const navigate = useNavigate()
  const [environments, setEnvironments] = useState<string[]>([])
  const [source, setSource] = useState(preview.snapshot ? 'published' : 'draft')
  const [packageVersion, setPackageVersion] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [when, setWhen] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [failureMode, setFailureMode] = useState<FailureMode>(preview.settings.failureMode)
  const [targetMode, setTargetMode] = useState('all')
  const [targetTags, setTargetTags] = useState<string[]>([])
  const [excludedSteps, setExcludedSteps] = useState<string[]>([])
  const [error, setError] = useState('')

  const published = source === 'published' ? preview.snapshot : null
  const options = preview.settings.scope === 'specific' ? preview.settings.environments : PREVIEW_ENVIRONMENTS
  const steps = published?.steps ?? processState.steps
  const canRun = Boolean(published) || (processState.hasProcess && !processState.processLoading)

  const run = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canRun) return
    if (!environments.length) {
      setError('Select at least one environment.')
      return
    }
    const scheduled = when === 'later' ? new Date(scheduledAt) : undefined
    if (scheduled && !(scheduled.getTime() > Date.now())) {
      setError('Choose a time in the future.')
      return
    }
    if (targetMode !== 'all' && !targetTags.length) {
      setError('Choose at least one target tag.')
      return
    }
    const now = new Date().toISOString()
    const runs: PreviewRun[] = environments.map((environment) => ({
      id: crypto.randomUUID(),
      snapshot: published?.name ?? 'Current draft',
      environment,
      createdAt: now,
      scheduledAt: scheduled?.toISOString(),
      packageVersion: published ? undefined : packageVersion.trim() || undefined,
      failureMode,
      excludedSteps,
      targetMode,
      targetTags: targetMode === 'all' ? [] : targetTags,
    }))
    setPreview({ ...preview, runs: [...runs, ...preview.runs] })
    navigate(runs.length === 1 ? `../runs/preview/${runs[0].id}` : '../runs', { replace: true })
  }

  return (
    <form onSubmit={run}>
      <WorkflowHeader title="Run Runbook" backTo="../runs" backLabel="Runs"
        actions={<WorkflowActions backTo="../runs" action={when === 'later' ? 'Schedule' : 'Run'} disabled={!canRun} />} />
      {!processState.hasProcess && !preview.snapshot ? <ProcessGate /> : (
        <>
          <Alert className="mx-5 my-4 sm:mx-7" type="info" showIcon
            message="UI preview with sample environments and targets. Submitting saves a preview run in this tab." />
          {error ? <Alert className="mx-5 my-4 sm:mx-7" type="error" showIcon message={error} /> : null}
          <WorkflowSection title="Environments">
            <label htmlFor="runbook-environments" className="block font-medium">Select one or more environments</label>
            <Select id="runbook-environments" className="w-full" mode="multiple" virtual={false} value={environments}
              options={options.map((environment) => ({ value: environment, label: environment }))}
              onChange={(values) => { setEnvironments(values); setError('') }} placeholder="Select environments" />
          </WorkflowSection>
          <WorkflowSection title="Snapshot">
            <Radio.Group value={source} onChange={(event) => { setSource(event.target.value); setExcludedSteps([]) }}>
              <div className="grid gap-2">
                <Radio value="published" disabled={!preview.snapshot}>Published snapshot</Radio>
                <div className="pl-6 text-xs text-slate-500">
                  {preview.snapshot ? `${preview.snapshot.name} · ${formatRunbookTaskDateTime(preview.snapshot.publishedAt)}` : 'No preview snapshot has been published.'}
                </div>
                <Radio value="draft" disabled={!processState.hasProcess || processState.processLoading}>Current draft</Radio>
              </div>
            </Radio.Group>
          </WorkflowSection>
          {!published ? (
            <WorkflowSection title="Packages">
              <label htmlFor="runbook-package-version" className="block font-medium">Package version (optional)</label>
              <Input id="runbook-package-version" value={packageVersion} onChange={(event) => setPackageVersion(event.target.value)}
                placeholder="Latest available" maxLength={100} />
            </WorkflowSection>
          ) : null}
          <div className="border-b border-slate-200 px-5 py-3 sm:px-7">
            <Button className={OUTLINE_BLUE_CLASS} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
              {advanced ? 'Hide advanced' : 'Show advanced'}
            </Button>
          </div>
          {advanced ? (
            <>
              <WorkflowSection title="When" collapsible>
                <Radio.Group value={when} onChange={(event) => setWhen(event.target.value)}>
                  <Radio value="now">Now</Radio>
                  <Radio value="later">Later</Radio>
                </Radio.Group>
                {when === 'later' ? (
                  <label className="block">
                    Scheduled run time (local)
                    <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
                  </label>
                ) : null}
              </WorkflowSection>
              <WorkflowSection title="Excluded steps" collapsible>
                <Checkbox.Group className="flex flex-col gap-2" value={excludedSteps} onChange={setExcludedSteps}
                  options={steps.map((step, index) => ({ label: step, value: `${index + 1}. ${step}` }))} />
                {!steps.length ? <p>No steps available.</p> : null}
              </WorkflowSection>
              <WorkflowSection title="Failure mode" collapsible>
                <Radio.Group className="grid gap-2" value={failureMode} onChange={(event) => setFailureMode(event.target.value)}
                  options={[...FAILURE_MODES]} />
              </WorkflowSection>
              <WorkflowSection title="Preview and customize" collapsible>
                <Select aria-label="Target selection" className="w-full" value={targetMode} onChange={setTargetMode} options={[
                  { value: 'all', label: 'All applicable targets' },
                  { value: 'include', label: 'Include specific target tags' },
                  { value: 'exclude', label: 'Exclude specific target tags' },
                ]} />
                {targetMode !== 'all' ? (
                  <Select aria-label="Target tags" className="w-full" mode="tags" value={targetTags}
                    onChange={setTargetTags} placeholder="Enter sample target tags" />
                ) : null}
                <div className="flex flex-wrap gap-1.5" aria-label="Selected environments">
                  {environments.map((environment) => <Tag key={environment}>{environment}</Tag>)}
                </div>
              </WorkflowSection>
            </>
          ) : null}
        </>
      )}
    </form>
  )
}
