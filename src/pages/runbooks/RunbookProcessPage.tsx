import { useOutletContext } from 'react-router-dom'
import Process from 'pages/project-detail/DeploymentProcess'
import { RunbookProcessContextProvider } from 'pages/project-detail/step-editors/shared/RunbookProcessContext'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { useProjectRunbookContext } from './useProjectRunbookContext'

export default function RunbookProcessPage() {
  const { runbook } = useOutletContext<RunbookDetailOutletContext>()
  const { project } = useProjectRunbookContext()
  const projectId = project?.id ?? runbook.projectId

  return (
    <RunbookProcessContextProvider
      value={{
        runbookId: runbook.id,
        projectId,
        processId: runbook.processId,
        runbookName: runbook.name,
      }}
    >
      <Process
        embedded
        runbookContext={{
          runbookId: runbook.id,
          projectId,
          processId: runbook.processId,
          runbookName: runbook.name,
        }}
      />
    </RunbookProcessContextProvider>
  )
}
