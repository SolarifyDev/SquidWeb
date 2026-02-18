import { get, post, put, del } from 'utils/request'

// --- DTOs ---

export interface DeploymentStepPropertyDto {
  id: number
  stepId: number
  propertyName: string
  propertyValue: string
}

export interface DeploymentActionPropertyDto {
  id: number
  actionId: number
  propertyName: string
  propertyValue: string
}

export interface DeploymentActionDto {
  id: number
  stepId: number
  actionOrder: number
  name: string
  actionType: string
  workerPoolId: number | null
  feedId: number | null
  packageId: string
  isDisabled: boolean
  isRequired: boolean
  canBeUsedForProjectVersioning: boolean
  createdAt: string
  properties: DeploymentActionPropertyDto[]
  environments: number[]
  excludedEnvironments: number[]
  channels: number[]
}

export interface DeploymentStepDto {
  id: number
  processId: number
  stepOrder: number
  name: string
  stepType: string
  condition: string
  startTrigger: string
  packageRequirement: string
  isDisabled: boolean
  isRequired: boolean
  createdAt: string
  properties: DeploymentStepPropertyDto[]
  actions: DeploymentActionDto[]
}

export interface DeploymentProcessDto {
  id: number
  version: number
  spaceId: number
  lastModified: string
  lastModifiedBy: string
  steps: DeploymentStepDto[]
}

// --- Property helpers ---

export function getStepProperty(
  step: DeploymentStepDto,
  name: string,
): string | undefined {
  return step.properties.find((p) => p.propertyName === name)?.propertyValue
}

export function setStepProperty(
  step: DeploymentStepDto,
  name: string,
  value: string,
): DeploymentStepDto {
  const existing = step.properties.find((p) => p.propertyName === name)
  if (existing) {
    return {
      ...step,
      properties: step.properties.map((p) =>
        p.propertyName === name ? { ...p, propertyValue: value } : p,
      ),
    }
  }
  return {
    ...step,
    properties: [
      ...step.properties,
      { id: 0, stepId: step.id, propertyName: name, propertyValue: value },
    ],
  }
}

export function getTargetRoles(step: DeploymentStepDto): string[] {
  const value = getStepProperty(step, 'Squid.Action.TargetRoles')
  return value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
}

// --- Request / Response types ---

export interface GetDeploymentStepsRequest {
  processId: number
  pageIndex?: number
  pageSize?: number
  keyword?: string
}

export interface GetDeploymentStepsResponseData {
  count: number
  steps: DeploymentStepDto[]
}

export interface CreateDeploymentStepCommand {
  processId: number
  step: DeploymentStepDto
}

export interface UpdateDeploymentStepCommand {
  id: number
  step: DeploymentStepDto
}

export interface DeleteDeploymentStepResponseData {
  failIds: number[]
}

// --- API functions ---

export function getDeploymentProcess(id: number) {
  return get<DeploymentProcessDto>(`/deploymentprocess/${id}`)
}

export function getDeploymentSteps(params: GetDeploymentStepsRequest) {
  return get<GetDeploymentStepsResponseData>('/deploymentstep', { params })
}

export function getDeploymentStep(id: number) {
  return get<DeploymentStepDto>(`/deploymentstep/${id}`)
}

export function createDeploymentStep(command: CreateDeploymentStepCommand) {
  return post<DeploymentStepDto>('/deploymentstep', command)
}

export function updateDeploymentStep(command: UpdateDeploymentStepCommand) {
  return put<DeploymentStepDto>('/deploymentstep', command)
}

export function deleteDeploymentSteps(ids: number[]) {
  return del<DeleteDeploymentStepResponseData>('/deploymentstep', {
    data: { ids },
  })
}
