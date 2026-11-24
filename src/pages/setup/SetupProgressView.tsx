import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { Alert, Button, Result, Spin, Steps } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { classifyFailure, getSetupProgress, getSetupStatus, type SetupProgress, type SetupStepStatus } from './api'

export interface PollTimings {
  progressIntervalMs: number
  statusIntervalMs: number
  installTimeoutMs: number
  startupTimeoutMs: number
  redirectDelayMs: number
}

export const DEFAULT_POLL_TIMINGS: PollTimings = {
  progressIntervalMs: 1000,
  statusIntervalMs: 1500,
  installTimeoutMs: 15 * 60 * 1000,
  startupTimeoutMs: 3 * 60 * 1000,
  redirectDelayMs: 3000,
}

// After this many consecutive transient failures (network error, timeout, 5xx) of the progress poll,
// the server may already be swapping to the normal API: ask the status endpoint, which decides.
const TRANSIENT_FAILURES_BEFORE_STATUS_CHECK = 3

type Phase = 'installing' | 'failed' | 'starting' | 'ready' | 'installTimedOut' | 'startupTimedOut'

interface SetupProgressViewProps {
  token: string
  adminUserName: string
  timings: PollTimings
  onBackToEdit: () => void
  onFinished: () => void
  onUnauthorized: () => void
}

interface PhaseControl {
  phase: Phase
  setPhase: (phase: Phase) => void
  completedSeen: MutableRefObject<boolean>
}

const STEP_STATUS: Record<SetupStepStatus, 'wait' | 'process' | 'finish' | 'error'> = {
  Pending: 'wait',
  Running: 'process',
  Succeeded: 'finish',
  Failed: 'error',
  Skipped: 'wait',
}

export function formatDuration(ms: number) {
  if (ms >= 60000 && ms % 60000 === 0) return `${ms / 60000} minute${ms === 60000 ? '' : 's'}`

  const seconds = Math.round(ms / 1000)
  return `${seconds} second${seconds === 1 ? '' : 's'}`
}

function stepDescription(status: SetupStepStatus, message: string | null) {
  if (status === 'Skipped') return message ? `Skipped — ${message}` : 'Skipped'
  return message ?? undefined
}

const ProgressSteps = ({ progress }: { progress: SetupProgress | null }) => {
  if (!progress || progress.steps.length === 0) return <Spin />

  return (
    <Steps
      direction="vertical"
      size="small"
      items={progress.steps.map((step) => ({
        key: step.key,
        title: step.title,
        status: STEP_STATUS[step.status],
        icon: step.status === 'Running' ? <LoadingOutlined /> : undefined,
        description: stepDescription(step.status, step.message),
      }))}
    />
  )
}

/**
 * What a failed progress poll means. 401: the token was rejected. 404: the setup endpoints are gone,
 * so ask the status endpoint. Transient failures only move on after several in a row. Any other answer
 * is not evidence of anything: keep polling.
 */
function progressFailureAction(error: unknown, transientFailures: number): 'unauthorized' | 'checkStatus' | 'retry' {
  const kind = classifyFailure(error)

  if (kind === 'unauthorized') return 'unauthorized'
  if (kind === 'notFound') return 'checkStatus'
  if (kind === 'transient' && transientFailures >= TRANSIENT_FAILURES_BEFORE_STATUS_CHECK) return 'checkStatus'

  return 'retry'
}

// Polls progress while installing. The install deadline spans the whole view (a status check that
// sends the view back here does not reset it), so an install that never finishes still ends.
function useInstallProgress(token: string, timings: PollTimings, control: PhaseControl, onUnauthorized: () => void) {
  const { phase, setPhase, completedSeen } = control
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [installDeadline] = useState(() => Date.now() + timings.installTimeoutMs)

  useEffect(() => {
    if (phase !== 'installing' || !token) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let transientFailures = 0

    const poll = async () => {
      try {
        const next = await getSetupProgress(token)
        if (cancelled) return
        transientFailures = 0
        setProgress(next)
        if (next.state === 'Completed') {
          completedSeen.current = true
          return setPhase('starting')
        }
        if (next.state === 'Failed') return setPhase('failed')
      } catch (error) {
        if (cancelled) return
        if (classifyFailure(error) === 'transient') transientFailures += 1

        const action = progressFailureAction(error, transientFailures)
        if (action === 'unauthorized') return onUnauthorized()
        if (action === 'checkStatus') return setPhase('starting')
      }
      if (Date.now() >= installDeadline) return setPhase('installTimedOut')
      timer = setTimeout(poll, timings.progressIntervalMs)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [completedSeen, installDeadline, onUnauthorized, phase, setPhase, timings.progressIntervalMs, token])

  return progress
}

// While the server swaps from setup mode to the normal API, requests fail (network errors, 502, 404):
// keep asking until the normal API answers `required: false`. `required: true` means the setup host is
// still up and installing, so go back to following its progress.
function useStartupWatch(timings: PollTimings, control: PhaseControl) {
  const { phase, setPhase } = control

  useEffect(() => {
    if (phase !== 'starting') return

    const deadline = Date.now() + timings.startupTimeoutMs
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const poll = async () => {
      try {
        const status = await getSetupStatus()
        if (cancelled) return
        if (status?.required === false) return setPhase('ready')
        if (status?.required === true) return setPhase('installing')
      } catch {
        // tolerated while the server restarts
      }
      if (cancelled) return
      if (Date.now() >= deadline) return setPhase('startupTimedOut')
      timer = setTimeout(poll, timings.statusIntervalMs)
    }

    timer = setTimeout(poll, timings.statusIntervalMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phase, setPhase, timings.startupTimeoutMs, timings.statusIntervalMs])
}

function useRedirectWhenReady(phase: Phase, delayMs: number, onFinished: () => void) {
  useEffect(() => {
    if (phase !== 'ready') return

    const timer = setTimeout(onFinished, delayMs)
    return () => clearTimeout(timer)
  }, [delayMs, onFinished, phase])
}

const CheckLogs = () => <>Check the server logs with <code>docker logs &lt;container&gt;</code>, then reload this page.</>

// "Installation finished" is only claimed when Completed was actually observed.
function timedOutMessage(phase: Phase, timings: PollTimings, completedSeen: boolean) {
  if (phase === 'installTimedOut') return <>The installation did not finish within {formatDuration(timings.installTimeoutMs)}. <CheckLogs /></>
  if (completedSeen) return <>The installation finished, but Squid did not respond within {formatDuration(timings.startupTimeoutMs)}. <CheckLogs /></>

  return <>Squid did not respond within {formatDuration(timings.startupTimeoutMs)}. <CheckLogs /></>
}

const SetupProgressView = ({ token, adminUserName, timings, onBackToEdit, onFinished, onUnauthorized }: SetupProgressViewProps) => {
  const [phase, setPhase] = useState<Phase>('installing')
  const completedSeen = useRef(false)
  const control: PhaseControl = { phase, setPhase, completedSeen }
  const progress = useInstallProgress(token, timings, control, onUnauthorized)

  useStartupWatch(timings, control)
  useRedirectWhenReady(phase, timings.redirectDelayMs, onFinished)

  if (phase === 'ready') {
    return (
      <Result
        status="success"
        title="Squid is ready"
        subTitle={<>Sign in as <strong>{adminUserName}</strong> with the password you just set. Redirecting to sign in…</>}
        extra={<Button type="primary" onClick={onFinished}>Go to sign in</Button>}
      />
    )
  }

  if (phase === 'installTimedOut' || phase === 'startupTimedOut') {
    return (
      <Result
        status="warning"
        title="Squid has not come up yet"
        subTitle={timedOutMessage(phase, timings, completedSeen.current)}
        extra={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    )
  }

  return (
    <div>
      <h3 className="m-0 mb-4 text-lg font-semibold text-slate-900">
        {phase === 'starting' ? 'Starting Squid…' : phase === 'failed' ? 'Installation failed' : 'Installing Squid…'}
      </h3>
      <ProgressSteps progress={progress} />
      {phase === 'starting' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Spin size="small" /> Waiting for the server to restart with the new configuration…
        </div>
      )}
      {phase === 'failed' && (
        <>
          <Alert type="error" showIcon className="mt-4" message={progress?.error || 'Installation failed.'} />
          <Button className="mt-4" onClick={onBackToEdit}>Back to edit</Button>
        </>
      )}
    </div>
  )
}

export default SetupProgressView
