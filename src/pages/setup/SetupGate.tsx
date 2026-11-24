import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import { getSetupStatus, type SetupStatus } from './api'
import SetupWizard from './SetupWizard'

export const SETUP_PATH = '/setup'
export const SIGN_IN_PATH = '/users/sign-in'

type GateState = { kind: 'loading' } | { kind: 'normal' } | { kind: 'setup'; status: SetupStatus }

const STATUS_ATTEMPTS = 2

async function fetchStatusWithRetry(): Promise<SetupStatus> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getSetupStatus()
    } catch (error) {
      if (attempt >= STATUS_ATTEMPTS) throw error
    }
  }
}

// A server that predates the setup endpoint (404), cannot be reached, or answers with anything but
// the setup contract (an HTML page, an enveloped body) must not block the app: only an explicit
// `required: true` means "run the wizard".
async function loadGateState(): Promise<GateState> {
  try {
    const status = await fetchStatusWithRetry()
    return status?.required === true ? { kind: 'setup', status } : { kind: 'normal' }
  } catch {
    return { kind: 'normal' }
  }
}

/** Decides, before any auth redirect, whether this server still needs first-run setup. */
const SetupGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<GateState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadGateState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSetupFinished = useCallback(() => {
    setState({ kind: 'normal' })
    navigate(SIGN_IN_PATH, { replace: true })
  }, [navigate])

  const isSetupPath = location.pathname === SETUP_PATH

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (state.kind === 'setup') {
    if (!isSetupPath) return <Navigate to={`${SETUP_PATH}${location.search}`} replace />
    return <SetupWizard status={state.status} onFinished={handleSetupFinished} />
  }

  if (isSetupPath) return <Navigate to={SIGN_IN_PATH} replace />

  return <>{children}</>
}

export default SetupGate
