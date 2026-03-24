import { FormEvent, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { changePassword } from 'pages/apis/account'
import { clearMustChangePasswordRequirement, getAuthUser } from 'utils/auth'

function readRedirect(search: string) {
  const params = new URLSearchParams(search)
  const redirect = params.get('redirect')
  if (!redirect || !redirect.startsWith('/')) return '/Spaces-1/projects'
  if (redirect.startsWith('/users/sign-in')) return '/Spaces-1/projects'
  if (redirect.startsWith('/users/change-password')) return '/Spaces-1/projects'
  return redirect
}

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const authUser = getAuthUser()
  const redirectTo = useMemo(() => readRedirect(location.search), [location.search])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.trim().length >= 6 &&
    confirmPassword.length > 0 &&
    !submitting

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!authUser?.id) {
      setError('Current user is unavailable. Please sign in again.')
      return
    }
    if (!canSubmit) return
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await changePassword({
        userId: authUser.id,
        currentPassword,
        newPassword,
      })
      clearMustChangePasswordRequirement()
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-10 bg-slate-50">
      <div className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] p-7">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold">Security</div>
          <h1 className="m-0 mt-2 text-2xl font-semibold text-slate-900">Change your password</h1>
          <p className="mt-2 mb-0 text-sm text-slate-500">
            You must update your password before continuing into Squid.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-squid-blue focus:ring-2 focus:ring-blue-100"
              placeholder="Re-enter new password"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 rounded-lg border-0 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0d80d8' }}
          >
            {submitting ? 'Updating password...' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
