import { useCallback, useEffect, useState } from 'react'
import { getRunbookApiErrorDetails, getRunbooks } from 'pages/apis/runbook'
import { usePermissions } from 'contexts/PermissionContext'
import { isRunbookPermissionError } from './shared'

export function useRunbookAccess(projectId: number | null, spaceId: number | null) {
  const { hasPermission, loading: permissionsLoading, error: permissionsError } = usePermissions()
  const [probeLoading, setProbeLoading] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probeDenied, setProbeDenied] = useState(false)
  const [viewProbePassed, setViewProbePassed] = useState(false)

  const hasViewPermission = hasPermission('RunbookView')
  const hasEditPermission = hasPermission('RunbookEdit')

  const probeViewAccess = useCallback(async () => {
    if (!projectId || !spaceId) return
    setProbeLoading(true)
    setProbeError(null)
    setProbeDenied(false)
    try {
      await getRunbooks({ projectId, spaceId, pageIndex: 1, pageSize: 1 })
      setViewProbePassed(true)
    } catch (caught) {
      setViewProbePassed(false)
      const details = getRunbookApiErrorDetails(caught)
      setProbeDenied(isRunbookPermissionError(details))
      setProbeError(details.message)
    } finally {
      setProbeLoading(false)
    }
  }, [projectId, spaceId])

  useEffect(() => {
    setViewProbePassed(false)
    setProbeDenied(false)
    setProbeError(null)
  }, [projectId, spaceId])

  const permissionsKnown = !permissionsLoading && !permissionsError
  const canView = hasViewPermission || (!permissionsKnown && (viewProbePassed || !probeDenied))
  const canEdit = permissionsKnown ? hasEditPermission : false

  return {
    permissionsLoading,
    permissionsError,
    probeLoading,
    probeError,
    probeDenied,
    permissionsKnown,
    canView,
    canEdit,
    probeViewAccess,
  }
}
