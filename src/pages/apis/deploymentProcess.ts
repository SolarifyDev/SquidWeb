import { get } from 'utils/request';

// 对应后端 DeploymentProcess 相关 DTO，只保留目前前端需要的字段

export interface DeploymentStepPropertyDto {
  id: number;
  stepId: number;
  propertyName: string;
  propertyValue: string;
}

export interface DeploymentActionPropertyDto {
  id: number;
  actionId: number;
  propertyName: string;
  propertyValue: string;
}

export interface DeploymentActionDto {
  id: number;
  stepId: number;
  actionOrder: number;
  name: string;
  actionType: string;
  workerPoolId: number;
  feedId: number;
  packageId: string;
  isDisabled: boolean;
  isRequired: boolean;
  canBeUsedForProjectVersioning: boolean;
  createdAt: string;
  properties: DeploymentActionPropertyDto[];
}

export interface DeploymentStepDto {
  id: number;
  processId: number;
  stepOrder: number;
  name: string;
  stepType: string;
  condition: string;
  startTrigger: string;
  packageRequirement: string;
  isDisabled: boolean;
  isRequired: boolean;
  createdAt: string;
  properties: DeploymentStepPropertyDto[];
  actions: DeploymentActionDto[];
}

export interface DeploymentProcessDto {
  id: number;
  version: number;
  spaceId: number;
  lastModified: string;
  lastModifiedBy: string;
  steps: DeploymentStepDto[];
}

export interface GetDeploymentProcessResponseData {
  deploymentProcess: DeploymentProcessDto;
}

// 调用后端 /api/DeploymentProcess/{id}
export function GetDeploymentProcess(id: number) {
  return get<GetDeploymentProcessResponseData>(`/DeploymentProcess/${id}`);
}
