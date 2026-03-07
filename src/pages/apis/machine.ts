import { get, post } from 'utils/request'

export interface MachineDto {
  id: number
  name: string
  isDisabled: boolean
  roles: string[]
  environmentIds: number[]
  json: string
  machinePolicyId: number | null
  thumbprint: string
  uri: string
  hasLatestCalamari: boolean
  endpoint: string
  spaceId: number
  operatingSystem: string
  shellName: string
  shellVersion: string
  slug: string
  agentVersion: string | null
}

export interface GetMachinesRequest {
  pageIndex?: number
  pageSize?: number
  spaceId?: number
}

export interface GetMachinesResponseData {
  count: number
  machines: MachineDto[]
}

export interface DeleteMachinesCommand {
  ids: number[]
}

export interface DeleteMachinesResponseData {
  failIds: number[]
}

export function getMachines(params?: GetMachinesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
    ...(params?.spaceId ? { spaceId: params.spaceId } : {}),
  }

  return get<GetMachinesResponseData>('/machines/list', { params: query })
}

export function deleteMachines(command: DeleteMachinesCommand) {
  return post<DeleteMachinesResponseData>('/machines/delete', command)
}

// --- Latest Agent Version ---

export interface GetLatestKubernetesAgentVersionData {
  latestVersion: string | null
}

export function getLatestKubernetesAgentVersion() {
  return get<GetLatestKubernetesAgentVersionData>('/machines/latest-agent-version')
}

// --- Kubernetes Agent Upgrade Script ---

export interface GenerateKubernetesAgentUpgradeScriptCommand {
  machineId: number
}

export interface GenerateKubernetesAgentUpgradeScriptData {
  machineId: number
  currentVersion: string
  latestVersion: string
  needsUpgrade: boolean
  releaseName: string
  helmNamespace: string
  chartRef: string
  upgradeScript: string
}

export function generateKubernetesAgentUpgradeScript(command: GenerateKubernetesAgentUpgradeScriptCommand) {
  return post<GenerateKubernetesAgentUpgradeScriptData>('/machines/generate-kubernetes-agent-upgrade-script', command)
}

// --- Kubernetes Agent Install Script ---

export interface GenerateKubernetesAgentInstallScriptCommand {
  agentName: string
  serverUrl: string
  serverCommsUrl: string
  environments: string[]
  tags: string[]
  spaceId?: number
  defaultNamespace?: string
}

export interface GenerateKubernetesAgentInstallScriptData {
  nfsCsiDriverScript: string
  agentInstallScript: string
  subscriptionId: string
}

export function generateKubernetesAgentInstallScript(command: GenerateKubernetesAgentInstallScriptCommand) {
  return post<GenerateKubernetesAgentInstallScriptData>('/machines/generate-kubernetes-agent-install-script', command)
}

// --- Register Kubernetes API ---

export interface RegisterKubernetesApiCommand {
  machineName: string
  spaceId: number
  roles: string[]
  environmentIds: number[]
  clusterUrl: string
  namespace: string
  skipTlsVerification: boolean
  resourceReferences: EndpointResourceReference[]
}

export interface EndpointResourceReference {
  type: EndpointResourceType
  resourceId: number
}

export enum EndpointResourceType {
  AuthenticationAccount = 1,
  ClientCertificate = 2,
  ClusterCertificate = 3,
}

export interface RegisterMachineResponseData {
  machineId: number
}

export function registerKubernetesApi(command: RegisterKubernetesApiCommand) {
  return post<RegisterMachineResponseData>('/machines/register/kubernetes-api', command)
}

// --- Connection Status ---

export interface ConnectionStatusData {
  connected: boolean
}

export function getConnectionStatus(subscriptionId: string) {
  return get<ConnectionStatusData>('/machines/connection-status', { params: { subscriptionId } })
}
