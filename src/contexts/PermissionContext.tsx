import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMyPermissions } from 'pages/apis/permission'
import { isAuthenticated } from 'utils/auth'

interface PermissionContextValue {
  loading: boolean
  error: string | null
  permissions: string[]
  isAdmin: boolean
  hasPermission: (permission: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextValue>({
  loading: false,
  error: null,
  permissions: [],
  isAdmin: false,
  hasPermission: () => false,
  refreshPermissions: async () => {},
})

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated()) {
      setPermissions([])
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await getMyPermissions()
      const nextPermissions = Array.isArray(result.permissions)
        ? result.permissions.filter((item) => typeof item === 'string')
        : []
      setPermissions(Array.from(new Set(nextPermissions)))
    } catch (err: any) {
      setPermissions([])
      setError(err?.message || 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshPermissions()
  }, [refreshPermissions])

  const value = useMemo(() => {
    const isAdmin = permissions.includes('AdministerSystem')
    const hasPermission = (permission: string) => isAdmin || permissions.includes(permission)
    return {
      loading,
      error,
      permissions,
      isAdmin,
      hasPermission,
      refreshPermissions,
    }
  }, [error, loading, permissions, refreshPermissions])

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
  return useContext(PermissionContext)
}
