import { get, post, put, del } from 'utils/request'
import type { DeploymentStepDto } from './deploymentProcess'

export interface CreateDeploymentStepCommand {
  processId: number
  step: DeploymentStepDto
}

export interface CreateDeploymentStepResponseData {
  step: DeploymentStepDto
}

export function CreateDeploymentStep(command: CreateDeploymentStepCommand) {
  return post<CreateDeploymentStepResponseData, CreateDeploymentStepCommand>('/DeploymentStep', command)
}

export interface UpdateDeploymentStepCommand {
  id: number
  step: DeploymentStepDto
}

export interface UpdateDeploymentStepResponseData {
  step: DeploymentStepDto
}

export function UpdateDeploymentStep(command: UpdateDeploymentStepCommand) {
  return put<UpdateDeploymentStepResponseData, UpdateDeploymentStepCommand>('/DeploymentStep', command)
}

export interface DeleteDeploymentStepCommand {
  ids: number[]
}

export interface DeleteDeploymentStepResponseData {
  failIds: number[]
}

export function DeleteDeploymentStep(command: DeleteDeploymentStepCommand) {
  return del<DeleteDeploymentStepResponseData>('/DeploymentStep', { data: command })
}

export interface GetDeploymentStepsRequest {
  processId?: number
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export interface GetDeploymentStepsResponseData {
  count: number
  steps: DeploymentStepDto[]
}

export function GetDeploymentSteps(params?: GetDeploymentStepsRequest) {
  return get<GetDeploymentStepsResponseData>('/DeploymentStep', { params })
}

export function GetDeploymentStep(id: number) {
  return get<DeploymentStepDto>(`/DeploymentStep/${id}`)
}
