import { get, post } from 'utils/request'

export type HealthCheckScheduleType = 'Interval' | 'Never' | 'Cron'
export type PolicyHealthCheckType = 'RunScript' | 'OnlyConnectivity'
export type ScriptPolicyRunType = 'InheritFromDefault' | 'CustomScript'
export type MachineConnectivityBehavior = 'ExpectedToBeOnline' | 'MayBeOfflineAndCanBeSkipped'
export type DeleteMachinesBehavior = 'DoNotDelete' | 'DeleteUnavailableMachines'
export type CalamariUpdateBehavior = 'UpdateOnDeployment' | 'UpdateOnNewMachine' | 'UpdateAlways'
export type AgentUpdateBehavior = 'NeverUpdate' | 'Update'

export interface ScriptPolicyDto {
  runType: ScriptPolicyRunType
  scriptBody?: string | null
}

export interface MachineHealthCheckPolicyDto {
  healthCheckScheduleType: HealthCheckScheduleType
  healthCheckIntervalSeconds?: number | null
  healthCheckCronExpression?: string | null
  healthCheckType: PolicyHealthCheckType
  scriptPolicies?: Record<string, ScriptPolicyDto>
}

export interface MachineConnectivityPolicyDto {
  machineConnectivityBehavior: MachineConnectivityBehavior
  connectTimeoutSeconds: number
  retryAttempts: number
  retryWaitIntervalSeconds: number
  retryTimeLimitSeconds: number
  pollingRequestQueueTimeoutSeconds: number
}

export interface MachineCleanupPolicyDto {
  deleteMachinesBehavior: DeleteMachinesBehavior
  deleteMachinesAfterSeconds: number
}

export interface MachineUpdatePolicyDto {
  calamariUpdateBehavior: CalamariUpdateBehavior
  tentacleUpdateBehavior: AgentUpdateBehavior
  kubernetesAgentUpdateBehavior: AgentUpdateBehavior
  tentacleUpdateAccountId?: number | null
}

export interface MachineRpcCallRetryPolicyDto {
  enabled: boolean
  deploymentRetryDurationSeconds: number
  healthCheckRetryDurationSeconds: number
}

export interface MachinePolicyDto {
  id?: number
  spaceId: number
  name: string
  description?: string | null
  isDefault?: boolean
  machineHealthCheckPolicy: MachineHealthCheckPolicyDto
  machineConnectivityPolicy: MachineConnectivityPolicyDto
  machineCleanupPolicy: MachineCleanupPolicyDto
  machineUpdatePolicy: MachineUpdatePolicyDto
  machineRpcCallRetryPolicy: MachineRpcCallRetryPolicyDto
}

export interface GetMachinePoliciesResponseData {
  machinePolicies: MachinePolicyDto[]
}

export interface SaveMachinePolicyCommand {
  machinePolicy: MachinePolicyDto
}

export interface DeleteMachinePolicyCommand {
  id: number
  spaceId?: number
}

export function getMachinePolicies() {
  return get<GetMachinePoliciesResponseData>('/machine-policies/list')
}

export function getMachinePolicy(id: number) {
  return get<MachinePolicyDto>(`/machine-policies/${id}`)
}

export function saveMachinePolicy(command: SaveMachinePolicyCommand) {
  return post<MachinePolicyDto>('/machine-policies/save', command)
}

export function deleteMachinePolicy(command: DeleteMachinePolicyCommand) {
  return post<void>('/machine-policies/delete', command)
}
