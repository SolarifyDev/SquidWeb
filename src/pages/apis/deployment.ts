import { ApiError, axiosInstance, get, post, type RequestConfig } from 'utils/request'
import type { ServerTaskDetailsDto } from './serverTask'

export interface CreateDeploymentCommand {
  releaseId: number
  environmentId: number
  name: string
  comments?: string
  forcePackageDownload?: boolean
  forcePackageRedeployment?: boolean
  useGuidedFailure?: boolean
  queueTime?: string
  queueTimeExpiry?: string
  formValues?: Record<string, string>
  specificMachineIds?: string[]
  excludedMachineIds?: string[]
  skipActionIds?: number[]
}

export interface DeploymentRequestPayload {
  releaseId: number
  environmentId: number
  name?: string
  comments?: string
  forcePackageDownload?: boolean
  forcePackageRedeployment?: boolean
  useGuidedFailure?: boolean
  queueTime?: string
  queueTimeExpiry?: string
  formValues?: Record<string, string>
  specificMachineIds?: number[]
  excludedMachineIds?: number[]
  skipActionIds?: number[]
}

export interface PreviewDeploymentRequest {
  deploymentRequestPayload: DeploymentRequestPayload
}

export interface DeploymentPreviewTargetResult {
  machineId: number
  machineName: string
  roles: string[]
  /** Machine health at preview time (e.g. Healthy / Unavailable / Unhealthy). */
  healthStatus?: string
}

export interface DeploymentPreviewStepResult {
  stepId: number
  stepOrder: number
  stepName: string
  isDisabled: boolean
  isApplicable: boolean
  reason?: string
  runnableActionIds: number[]
  requiredRoles: string[]
  matchedTargets: DeploymentPreviewTargetResult[]
}

export interface DeploymentPreviewResult {
  canDeploy: boolean
  blockingReasons: string[]
  availableMachineCount: number
  lifecycleId?: number | null
  allowedEnvironmentIds: number[]
  candidateTargets: DeploymentPreviewTargetResult[]
  /** Targets matched by environment but excluded by the transient-target health policy (unavailable/unhealthy). */
  excludedTargets?: DeploymentPreviewTargetResult[]
  steps: DeploymentPreviewStepResult[]
  message: string
}

export interface CreateDeploymentResponseData {
  deployment: {
    id: number
    releaseId: number
    environmentId: number
    name: string
    created: string
  }
  taskId: number
}

export interface DeploymentDto {
  id: number
  name: string
  taskId: number | null
  spaceId: number
  channelId: number
  projectId: number
  releaseId: number
  machineId: number
  environmentId: number
  json: string
  deployedBy: number
  deployedToMachineIds: string | null
  processSnapshotId: number | null
  variableSnapshotId: number | null
  created: string
}

export interface GetDeploymentResponseData {
  deployment: DeploymentDto
  taskDetails: ServerTaskDetailsDto | null
}

export interface GetDeploymentRequest {
  verbose?: boolean
  tail?: number
}

export function createDeployment(command: CreateDeploymentCommand, config?: RequestConfig<CreateDeploymentCommand>) {
  return post<CreateDeploymentResponseData, CreateDeploymentCommand>('/deployments/create', command, config)
}

export function getDeployment(id: number, params?: GetDeploymentRequest) {
  return get<GetDeploymentResponseData>(`/deployments/${id}`, { params })
}

export function previewDeployment(
  request: PreviewDeploymentRequest,
  config?: RequestConfig<PreviewDeploymentRequest>,
) {
  return axiosInstance
    .post('/deployments/preview', request, config)
    .then((res) => {
      const body = res.data as any

      // Standard wrapped contract: { code, msg, data }
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && 'data' in body) {
        if (body.code !== 200) {
          throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
        }
        return body.data as DeploymentPreviewResult
      }

      // GlobalExceptionFilter fallback shape: { code, msg }
      if (body && typeof body === 'object' && 'code' in body && 'msg' in body && !('data' in body)) {
        throw new ApiError(body.msg || 'Request failed', Number(body.code) || 400, res.status, body)
      }

      // Raw model shape: { canDeploy, blockingReasons, ... }
      if (body && typeof body === 'object' && 'canDeploy' in body) {
        return body as DeploymentPreviewResult
      }

      throw new Error('Unexpected deployment preview response format.')
    })
}
