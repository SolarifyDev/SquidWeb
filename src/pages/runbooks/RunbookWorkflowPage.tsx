import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Input, Spin } from 'antd'
import { ArrowLeftOutlined, DownOutlined } from '@ant-design/icons'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { getRunbookApiErrorDetails, getRunbookEligibleEnvironments, runRunbook } from 'pages/apis/runbook'
import { OUTLINE_BLUE_CLASS, PRIMARY_GREEN_CLASS } from './RunbookPageShell'
import { hasPublishedRunbookVersion } from './shared'

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

function WorkflowSection({ title, children }: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-[185px_minmax(0,1fr)] sm:gap-8 sm:px-7">
      <h3 className="m-0 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="max-w-2xl space-y-3 text-sm text-slate-700">{children}</div>
    </section>
  )
}

function WorkflowActions({ backTo, action, disabled, loading }: { backTo: string; action: string; disabled: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Link className={OUTLINE_BLUE_CLASS} to={backTo}>Cancel</Link>
      <Button className={PRIMARY_GREEN_CLASS} htmlType="submit" disabled={disabled} loading={loading} aria-label={action}>{action}</Button>
    </div>
  )
}

function ProcessGate() {
  const { processState, canEdit } = useOutletContext<RunbookDetailOutletContext>()
  if (!canEdit) {
    return <Alert className="m-5" type="warning" showIcon message="RunbookEdit is required to publish a preview snapshot." />
  }
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
      {!canPublish ? <ProcessGate /> : (
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
  const { runbook, canRun } = useOutletContext<RunbookDetailOutletContext>()
  const navigate = useNavigate()
  const [environments, setEnvironments] = useState<Array<{ id: number; name: string }>>([])
  const [environmentsLoading, setEnvironmentsLoading] = useState(true)
  const [environmentError, setEnvironmentError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const snapshotId = runbook.publishedSnapshotId ?? runbook.publishedSnapshot?.id
  const hasPublishedVersion = hasPublishedRunbookVersion(runbook)
  const selectedEnvironment = environments.find(({ id }) => String(id) === selectedEnvironmentId)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!canRun || !snapshotId) return
    let active = true
    setEnvironmentsLoading(true)
    setEnvironmentError('')
    setSelectedEnvironmentId('')
    void getRunbookEligibleEnvironments(runbook.id, runbook.projectId, runbook.spaceId)
      .then((response) => {
        if (!active) return
        setEnvironments(response.environments ?? [])
      })
      .catch((caught) => {
        if (active) setEnvironmentError(getRunbookApiErrorDetails(caught).message)
      })
      .finally(() => {
        if (active) setEnvironmentsLoading(false)
      })

    return () => { active = false }
  }, [canRun, snapshotId, runbook.id, runbook.projectId, runbook.spaceId, loadAttempt])

  const canSubmit = canRun && hasPublishedVersion && !environmentsLoading && !environmentError && Boolean(selectedEnvironment)

  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !selectedEnvironment || inFlight.current) return

    inFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      const acceptedRun = await runRunbook({
        id: runbook.id,
        projectId: runbook.projectId,
        spaceId: runbook.spaceId,
        environmentId: selectedEnvironment.id,
      })
      if (!mounted.current) return
      navigate(`../runs/${acceptedRun.taskId}`, {
        replace: true,
        state: { runbookRun: acceptedRun, environmentName: selectedEnvironment.name },
      })
    } catch (caught) {
      if (mounted.current) setError(getRunbookApiErrorDetails(caught).message)
    } finally {
      inFlight.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  return (
    <form onSubmit={run}>
      <WorkflowHeader title="Run Runbook" backTo="../runs" backLabel="Runs"
        actions={<WorkflowActions backTo="../runs" action="Run Now" disabled={!canSubmit || submitting} loading={submitting} />} />
      {!hasPublishedVersion ? (
        <Alert className="m-5 sm:m-7" type="warning" showIcon message="Publish this Runbook before it can be run." />
      ) : !canRun ? (
        <Alert className="m-5 sm:m-7" type="warning" showIcon message="RunbookRun permission is required to run this Runbook." />
      ) : (
        <>
          {error ? <Alert className="mx-5 my-4 sm:mx-7" type="error" showIcon message={error} /> : null}
          <WorkflowSection title="Environment">
            {environmentsLoading ? <Spin size="small" /> : environmentError ? (
              <Alert type="error" showIcon message={environmentError}
                action={<Button size="small" onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>} />
            ) : environments.length ? (
              <div className="relative">
                <select
                  aria-label="Environment"
                  className="octo-native-select"
                  value={selectedEnvironmentId}
                  onChange={(event) => { setSelectedEnvironmentId(event.target.value); setError('') }}
                  disabled={submitting}
                >
                  <option value="" disabled>Select an eligible environment</option>
                  {environments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
                <DownOutlined aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500" />
              </div>
            ) : <p className="m-0 text-slate-500">No eligible environments are available for the published version.</p>}
          </WorkflowSection>
          <WorkflowSection title="Published version">
            <p className="m-0">{runbook.publishedSnapshot ? `Version ${runbook.publishedSnapshot.version}` : 'Current published version'}</p>
          </WorkflowSection>
        </>
      )}
    </form>
  )
}
