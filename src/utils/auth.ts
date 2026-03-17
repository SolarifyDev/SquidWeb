export const AUTH_TOKEN_KEY = 'AUTH_TOKEN'
export const AUTH_USER_KEY = 'AUTH_USER'

export interface AuthUser {
  id: number
  userName: string
  displayName: string
}

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken())
}

export function setAuthSession(token: string, user?: AuthUser | null) {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    }
  } catch {
    // ignore storage failures
  }
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(AUTH_USER_KEY)
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
