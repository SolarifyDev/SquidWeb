export const AUTH_TOKEN_KEY = 'AUTH_TOKEN'
export const AUTH_USER_KEY = 'AUTH_USER'
export const AUTH_EXPIRES_AT_KEY = 'AUTH_EXPIRES_AT_UTC'
export const AUTH_MUST_CHANGE_PASSWORD_KEY = 'AUTH_MUST_CHANGE_PASSWORD'

const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000

export interface AuthUser {
  id: number
  userName: string
  displayName: string
}

interface SetAuthSessionOptions {
  expiresAtUtc?: string | null
  mustChangePassword?: boolean
}

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAuthExpiresAt(): string | null {
  try {
    return window.localStorage.getItem(AUTH_EXPIRES_AT_KEY)
  } catch {
    return null
  }
}

function parseUtcTimestamp(value: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isAuthTokenExpired(now = Date.now()): boolean {
  const expiresAt = parseUtcTimestamp(getAuthExpiresAt())
  if (expiresAt == null) return false
  return now >= expiresAt
}

export function isAuthTokenExpiringSoon(thresholdMs = TOKEN_EXPIRY_SKEW_MS, now = Date.now()): boolean {
  const expiresAt = parseUtcTimestamp(getAuthExpiresAt())
  if (expiresAt == null) return false
  return now >= expiresAt - Math.max(thresholdMs, 0)
}

export function isAuthenticated(): boolean {
  const token = getAuthToken()
  if (!token) return false
  if (isAuthTokenExpired()) {
    clearAuthSession()
    return false
  }
  return true
}

export function setAuthSession(token: string, user?: AuthUser | null, options?: SetAuthSessionOptions) {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    }
    if (options?.expiresAtUtc) {
      window.localStorage.setItem(AUTH_EXPIRES_AT_KEY, options.expiresAtUtc)
    } else {
      window.localStorage.removeItem(AUTH_EXPIRES_AT_KEY)
    }
    if (typeof options?.mustChangePassword === 'boolean') {
      window.localStorage.setItem(AUTH_MUST_CHANGE_PASSWORD_KEY, options.mustChangePassword ? 'true' : 'false')
    } else {
      window.localStorage.removeItem(AUTH_MUST_CHANGE_PASSWORD_KEY)
    }
  } catch {
    // ignore storage failures
  }
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(AUTH_USER_KEY)
    window.localStorage.removeItem(AUTH_EXPIRES_AT_KEY)
    window.localStorage.removeItem(AUTH_MUST_CHANGE_PASSWORD_KEY)
  } catch {
    // ignore storage failures
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function getMustChangePassword(): boolean {
  try {
    return window.localStorage.getItem(AUTH_MUST_CHANGE_PASSWORD_KEY) === 'true'
  } catch {
    return false
  }
}

export function clearMustChangePasswordRequirement() {
  try {
    window.localStorage.removeItem(AUTH_MUST_CHANGE_PASSWORD_KEY)
  } catch {
    // ignore storage failures
  }
}

export function redirectToSignIn(redirectPath?: string | null) {
  try {
    const currentPath = redirectPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (window.location.pathname.startsWith('/users/sign-in')) return
    const redirect = encodeURIComponent(currentPath)
    window.location.assign(`/users/sign-in?redirect=${redirect}`)
  } catch {
    // ignore navigation failures in non-browser contexts
  }
}

export function handleUnauthorizedSession(redirectPath?: string | null) {
  clearAuthSession()
  redirectToSignIn(redirectPath)
}
