import { FormEvent, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login, register } from 'pages/apis/account'
import { setAuthSession } from 'utils/auth'

function readRedirect(search: string): string {
  const params = new URLSearchParams(search)
  const redirect = params.get('redirect')
  if (!redirect || !redirect.startsWith('/')) return '/Spaces-1/projects'
  if (redirect.startsWith('/users/sign-in')) return '/Spaces-1/projects'
  return redirect
}

const SignInPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = useMemo(() => readRedirect(location.search), [location.search])

  const canSubmit =
    userName.trim().length > 0 &&
    password.length > 0 &&
    (mode === 'signin' || displayName.trim().length > 0) &&
    !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'register') {
        await register({
          userName: userName.trim(),
          password,
          displayName: displayName.trim(),
        })
      }

      const result = await login({
        userName: userName.trim(),
        password,
      })

      setAuthSession(result.accessToken, {
        id: result.userAccount.id,
        userName: result.userAccount.userName,
        displayName: result.userAccount.displayName,
      })

      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex"
      style={{
        background:
          'radial-gradient(circle at 12% 10%, #f7fbff 0%, #eef3f9 38%, #e8edf4 100%)',
      }}
    >
      <div className="hidden lg:flex w-[46%] p-8">
        <div
          className="w-full rounded-3xl p-10 flex flex-col justify-between text-white overflow-hidden relative"
          style={{
            background:
              'linear-gradient(165deg, #0f2535 0%, #10334b 38%, #0d80d8 130%)',
            boxShadow: '0 20px 45px rgba(15,23,42,0.18)',
          }}
        >
          <div className="absolute -right-16 -top-16 w-52 h-52 rounded-full bg-white/10" />
          <div className="absolute right-10 bottom-12 w-28 h-28 rounded-full bg-white/10" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center">
                <img src="/squid-logo.svg" alt="Squid" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-white/75">Squid Deploy</div>
                <div className="text-sm font-semibold">Sign in</div>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="m-0 text-4xl leading-tight font-semibold">
              Welcome back
            </h1>
            <p className="mt-4 mb-0 text-white/80 leading-relaxed max-w-md">
              Sign in to manage projects, lifecycles, environments, and deployment targets.
            </p>
          </div>

          <div className="relative z-10 text-sm text-white/70">
            Secure access to your deployment workspace.
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
              <img src="/squid-logo.svg" alt="Squid" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-[0.12em]">Squid Deploy</div>
              <div className="text-sm font-semibold text-slate-800">Sign in</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-6 sm:p-7">
            <div className="mb-6">
              <h2 className="m-0 text-2xl font-semibold text-slate-900">
                {mode === 'signin' ? 'Sign in to Squid' : 'Create your account'}
              </h2>
              <p className="mt-2 mb-0 text-sm text-slate-500">
                {mode === 'signin'
                  ? 'Use your Squid account credentials.'
                  : 'Register a local account, then we will sign you in automatically.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter display name"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoComplete="username"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter password"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-11 rounded-lg border-0 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#0d80d8' }}
              >
                {submitting
                  ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'signin' ? 'Sign in' : 'Register and sign in')}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 flex items-center justify-between gap-3">
              <span>
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMode((prev) => (prev === 'signin' ? 'register' : 'signin'))
                }}
                className="border-0 bg-transparent p-0 text-squid-blue font-medium cursor-pointer hover:underline"
              >
                {mode === 'signin' ? 'Register' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignInPage
