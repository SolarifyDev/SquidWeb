import { post } from 'utils/request'

export interface DeploymentDto {
  id: number
  name: string | null
  taskId: number | null
  spaceId: number
  channelId: number
  projectId: number
  releaseId: number
  machineId: number
  environmentId: number
  json: string | null
  deployedBy: number
  deployedToMachineIds: string | null
  processSnapshotId: number | null
  variableSnapshotId: number | null
  created: string
}

export interface CreateDeploymentCommand {
  releaseId: number
  environmentId: number
  name: string | null
  deployedBy: number
  comments: string | null
  forcePackageDownload: boolean
  useGuidedFailure: boolean
  formValues: Record<string, string | null> | null
  specificMachineIds: string[] | null
  excludedMachineIds: string[] | null
}

export interface CreateDeploymentResponseData {
  deployment: DeploymentDto
  taskId: number
}

export function CreateDeployment(command: CreateDeploymentCommand) {
  return post<CreateDeploymentResponseData, CreateDeploymentCommand>('/Deployment', command)
}

export interface ValidateDeploymentEnvironmentRequest {
  releaseId: number
  environmentId: number
}

export function ValidateDeploymentEnvironment(body: ValidateDeploymentEnvironmentRequest) {
  return post<boolean, ValidateDeploymentEnvironmentRequest>('/Deployment/validate', body)
}
