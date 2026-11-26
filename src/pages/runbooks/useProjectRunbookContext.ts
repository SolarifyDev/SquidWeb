import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ProjectDto } from 'pages/apis/project'
import { resolveProjectByRouteName } from './shared'

export function useProjectRunbookContext() {
  const { spaceId = 'Spaces-1', projectName } = useParams<{ spaceId: string; projectName: string }>()
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [loading, setLoading] = useState(!projectName ? false : true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectName) {
      setProject(null)
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(!project || project.slug !== projectName && project.name !== projectName)
    setError(null)

    void resolveProjectByRouteName(projectName)
      .then((resolved) => {
        if (!active) return
        setProject(resolved)
        if (!resolved) setError('Project not found.')
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setProject(null)
        setError('Failed to load project.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [projectName, spaceId])

  return {
    spaceId,
    projectName,
    project,
    loading,
    error,
  }
}
