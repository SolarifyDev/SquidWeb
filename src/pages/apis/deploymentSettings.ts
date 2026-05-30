import { get, post } from 'utils/request'

export type UnavailableDeploymentTargetBehavior = 'SkipAndContinue' | 'FailDeployment'
export type UnhealthyDeploymentTargetBehavior = 'Exclude' | 'DoNotExclude'

export interface TransientDeploymentTargetsDto {
  unavailableDeploymentTargets: UnavailableDeploymentTargetBehavior
  unhealthyDeploymentTargets: UnhealthyDeploymentTargetBehavior
}

export interface DeploymentSettingsDto {
  transientDeploymentTargets: TransientDeploymentTargetsDto
}

export function getDeploymentSettings(projectId: number) {
  return get<DeploymentSettingsDto>(`/projects/${projectId}/deployment-settings`)
}

export function saveDeploymentSettings(projectId: number, deploymentSettings: DeploymentSettingsDto) {
  return post<DeploymentSettingsDto>(`/projects/${projectId}/deployment-settings`, { projectId, deploymentSettings })
}
