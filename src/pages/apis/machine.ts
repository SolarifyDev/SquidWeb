import { get, post } from 'utils/request'

export interface MachineDto {
  id: number
  name: string
  isDisabled: boolean
  roles: string
  environmentIds: string
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

export function getMachines(params?: GetMachinesRequest) {
  const query = {
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 1000,
  }

  return get<GetMachinesResponseData>('/machines/list', { params: query })
}

// --- Kubernetes Agent Install Script ---

export interface GenerateKubernetesAgentInstallScriptCommand {
  agentName: string
  serverUrl: string
  serverCommsUrl: string
  environmentIds: number[]
  tags: string[]
  spaceId?: number
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
  roles: string
  environmentIds: string
  clusterUrl: string
  clusterCertificate?: string
  namespace: string
  skipTlsVerification: boolean
  accountType: number
  token?: string
  username?: string
  password?: string
  clientCertificateData?: string
  clientCertificateKeyData?: string
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
