import { useCallback, useEffect, useState } from 'react'
import { getDeploymentSteps } from 'pages/apis/deploymentProcess'
import { getServerTaskList, type ServerTaskListItemDto } from 'pages/apis/serverTask'
import type { RunbookDto } from 'pages/apis/runbook'

const EMPTY_TASKS: ServerTaskListItemDto[] = []

export function taskBelongsToRunbook(
  task: Pick<ServerTaskListItemDto, 'name' | 'description'>,
  runbook: Pick<RunbookDto, 'id' | 'name'>,
) {
  const haystack = `${task.name} ${task.description}`.toLowerCase()
  const runbookName = runbook.name.trim().toLowerCase()
  return haystack.includes(`runbook:${runbook.id}`)
    || haystack.includes(`runbook ${runbook.id}`)
    || haystack.includes(`runbook-${runbook.id}`)
    || (runbookName.length > 0 && haystack.includes(`${runbookName} snapshot`))
}

export type RunbookProcessState = {
  stepCount: number | null
  processId: number | null
  hasProcess: boolean
  tasks: ServerTaskListItemDto[]
  loading: boolean
  tasksUnavailable: boolean
  reload: () => void
}

export function useRunbookProcessState(
  projectId: number | null,
  runbook: RunbookDto | null,
): RunbookProcessState {
  const [stepCount, setStepCount] = useState<number | null>(null)
  const [tasks, setTasks] = useState<ServerTaskListItemDto[] | null>(null)
  const [tasksUnavailable, setTasksUnavailable] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const runbookId = runbook?.id ?? null
  const runbookName = runbook?.name ?? ''
  const processId = runbook?.processId ?? null

  useEffect(() => {
    if (!projectId || !runbookId || !processId) {
      setStepCount(0)
      return
    }

    let active = true
    setStepCount(null)
    void getDeploymentSteps({
      processId,
      projectId,
      runbookId,
      pageIndex: 1,
      pageSize: 1,
    }).then((response) => {
      if (active) setStepCount(response.count ?? response.steps?.length ?? 0)
    }).catch(() => {
      if (active) setStepCount(null)
    })

    return () => {
      active = false
    }
  }, [processId, projectId, reloadKey, runbookId])

  useEffect(() => {
    if (!projectId || !runbookId) {
      setTasks(EMPTY_TASKS)
      return
    }

    let active = true
    setTasksUnavailable(false)
    setTasks(null)
    void getServerTaskList({ projectId, pageIndex: 1, pageSize: 50 })
      .then((response) => {
        if (!active) return
        setTasks((response.items ?? []).filter((task) => (
          taskBelongsToRunbook(task, { id: runbookId, name: runbookName })
        )))
      })
      .catch(() => {
        if (!active) return
        setTasks(EMPTY_TASKS)
        setTasksUnavailable(true)
      })

    return () => {
      active = false
    }
  }, [projectId, reloadKey, runbookId, runbookName])

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1)
  }, [])

  return {
    stepCount,
    processId,
    hasProcess: stepCount != null && stepCount > 0,
    tasks: tasks ?? EMPTY_TASKS,
    loading: stepCount == null || tasks == null,
    tasksUnavailable,
    reload,
  }
}
