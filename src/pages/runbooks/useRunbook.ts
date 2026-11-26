import { useCallback, useEffect, useState } from 'react'
import type { ProjectDto } from 'pages/apis/project'
import { getRunbook, getRunbookApiErrorDetails, type RunbookDto } from 'pages/apis/runbook'
import { usePermissions } from 'contexts/PermissionContext'

export function useRunbook(project: ProjectDto | null, runbookId: number | null) {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [runbook, setRunbook] = useState<RunbookDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!project || !runbookId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setRunbook(await getRunbook(runbookId, project.id, project.spaceId))
    } catch (caught) {
      setRunbook(null)
      setError(getRunbookApiErrorDetails(caught).message)
    } finally {
      setLoading(false)
    }
  }, [project, runbookId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    runbook,
    setRunbook,
    loading,
    error,
    reload,
    canEdit: !permissionsLoading && hasPermission('RunbookEdit'),
    permissionsLoading,
  }
}
