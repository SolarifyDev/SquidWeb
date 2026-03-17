import type { DeploymentStepDto } from 'pages/apis/deploymentProcess'

export interface StepEditorHandle {
  save: () => Promise<void>
}

export interface StepEditorProps {
  step: DeploymentStepDto | null
  processId: number
  projectId?: number | null
  spaceId: string
  stepIndex: number | null
  onSave: (savedStep: DeploymentStepDto) => void
  onStepNameChange?: (name: string) => void
}
