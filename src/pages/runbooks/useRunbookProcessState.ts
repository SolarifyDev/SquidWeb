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
  const idMatch = [...haystack.matchAll(/\brunbook[: -](\d+)\b/g)].map((match) => Number(match[1]))
  return idMatch.length > 0
    ? idMatch.includes(runbook.id)
    : runbookName.length > 0 && haystack.includes(`${runbookName} snapshot`)
}

export type RunbookProcessState = {
  stepCount: number | null
  steps: string[]
  processId: number | null
  hasProcess: boolean
  tasks: ServerTaskListItemDto[]
  loading: boolean
  processLoading: boolean
  processUnavailable: boolean
  tasksLoading: boolean
  tasksUnavailable: boolean
  reload: () => void
}

export function useRunbookProcessState(
  projectId: number | null,
  runbook: RunbookDto | null,
): RunbookProcessState {
  const [stepCount, setStepCount] = useState<number | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [processLoading, setProcessLoading] = useState(true)
  const [processUnavailable, setProcessUnavailable] = useState(false)
  const [tasks, setTasks] = useState<ServerTaskListItemDto[] | null>(null)
  const [tasksUnavailable, setTasksUnavailable] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const runbookId = runbook?.id ?? null
  const runbookName = runbook?.name ?? ''
  const processId = runbook?.processId ?? null

  useEffect(() => {
    if (!projectId || !runbookId || !processId) {
      setStepCount(0)
      setSteps([])
      setProcessLoading(false)
      setProcessUnavailable(false)
      return
    }

    let active = true
    setProcessLoading(true)
    setProcessUnavailable(false)
    setStepCount(null)
    setSteps([])
    void getDeploymentSteps({
      processId,
      projectId,
      runbookId,
      pageIndex: 1,
      pageSize: 500,
    }).then((response) => {
      if (!active) return
      setStepCount(response.count ?? response.steps?.length ?? 0)
      setSteps([...(response.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder).map((step) => step.name))
    }).catch(() => {
      if (active) setProcessUnavailable(true)
    }).finally(() => {
      if (active) setProcessLoading(false)
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
        setTasks((response.items ?? [])
          .filter((task) => taskBelongsToRunbook(task, { id: runbookId, name: runbookName }))
          .sort((a, b) => b.queueTime.localeCompare(a.queueTime)))
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
    steps,
    processId,
    hasProcess: stepCount != null && stepCount > 0,
    tasks: tasks ?? EMPTY_TASKS,
    loading: processLoading || tasks == null,
    processLoading,
    processUnavailable,
    tasksLoading: tasks == null,
    tasksUnavailable,
    reload,
  }
}
