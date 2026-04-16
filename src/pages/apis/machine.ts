import { get, post } from 'utils/request'

export type MachineHealthStatus = 'Unknown' | 'Healthy' | 'HasWarnings' | 'Unhealthy' | 'Unavailable'

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
  pollingSubscriptionId?: string | null
  healthStatus?: MachineHealthStatus | string | null
  healthDetail?: string | null
  healthLastChecked?: string | null
  HealthStatus?: MachineHealthStatus | string | null
  HealthDetail?: string | null
  HealthLastChecked?: string | null
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
  spaceId?: number
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

export interface UpdateMachineCommand {
  machineId: number
  spaceId?: number
  name?: string | null
  isDisabled?: boolean | null
  roles?: string[] | null
  environmentIds?: number[] | null
  machinePolicyId?: number | null
  clusterUrl?: string | null
  namespace?: string | null
  skipTlsVerification?: boolean | null
  providerType?: number | null
  providerConfig?: string | null
  baseUrl?: string | null
  defaultSessionKey?: string | null
  healthCheckTool?: string | null
  inlineGatewayToken?: string | null
  inlineHooksToken?: string | null
  resourceReferences?: EndpointResourceReference[] | null
}

export function updateMachine(command: UpdateMachineCommand) {
  return post<MachineDto>('/machines/update', command)
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
  serverThumbprint?: string
  storageType: KubernetesAgentStorageType
  nfsServer?: string
  nfsPath?: string
  storageClassName?: string
  environments: string[]
  tags: string[]
  spaceId?: number
  defaultNamespace?: string
  chartRef?: string
}

export type KubernetesAgentStorageType = 'builtin-nfs' | 'external-nfs' | 'custom' | 'nfs'

export interface GenerateKubernetesAgentInstallScriptData {
  nfsCsiDriverScript: string | null
  nfsCsiDriverRequired?: boolean
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
  clusterUrl?: string
  namespace: string
  skipTlsVerification: boolean
  providerType?: number
  providerConfig?: string
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
  serverThumbprint?: string | null
  subscriptionUri?: string | null
}

export function registerKubernetesApi(command: RegisterKubernetesApiCommand) {
  return post<RegisterMachineResponseData>('/machines/register/kubernetes-api', command)
}

export interface RegisterKubernetesAgentCommand {
  machineName: string
  thumbprint: string
  subscriptionId: string
  spaceId: number
  roles: string
  environments: string
  namespace?: string
  agentVersion?: string
  releaseName?: string
  helmNamespace?: string
  chartRef?: string
}

export function registerKubernetesAgent(command: RegisterKubernetesAgentCommand) {
  return post<RegisterMachineResponseData>('/machines/register/kubernetes-agent', command)
}

// --- Register OpenClaw ---

export interface RegisterOpenClawCommand {
  machineName: string
  spaceId: number
  roles: string[]
  environmentIds: number[]
  baseUrl: string
  defaultSessionKey?: string
  healthCheckTool?: string
  inlineGatewayToken?: string
  inlineHooksToken?: string
  resourceReferences?: EndpointResourceReference[]
}

export function registerOpenClaw(command: RegisterOpenClawCommand) {
  return post<RegisterMachineResponseData>('/machines/register/openclaw', command)
}

export interface RegisterSshConnectionCommand {
  machineName: string
  spaceId: number
  roles: string[]
  environmentIds: number[]
  host: string
  port: number
  fingerprint?: string
  remoteWorkingDirectory?: string
  resourceReferences: EndpointResourceReference[]
}

export function registerSshConnection(command: RegisterSshConnectionCommand) {
  return post<RegisterMachineResponseData>('/machines/register/ssh', command)
}

export interface RegisterTentacleListeningCommand {
  machineName: string
  spaceId: number
  roles: string
  environments: string
  machinePolicyId?: number | null
  uri: string
  thumbprint: string
  agentVersion?: string
}

export function registerTentacleListening(command: RegisterTentacleListeningCommand) {
  return post<RegisterMachineResponseData>('/machines/register/tentacle-listening', command)
}

export interface RegisterTentaclePollingCommand {
  machineName: string
  spaceId: number
  roles: string
  environments: string
  machinePolicyId?: number | null
  thumbprint: string
  subscriptionUri?: string
  subscriptionId?: string
  agentVersion?: string
}

export function registerTentaclePolling(command: RegisterTentaclePollingCommand) {
  return post<RegisterMachineResponseData>('/machines/register/tentacle-polling', command)
}

export type TentacleCommunicationMode = 'Listening' | 'Polling'

export interface GenerateTentacleInstallScriptCommand {
  machineName: string
  serverUrl: string
  serverCommsUrl?: string
  environments: string[]
  tags: string[]
  machinePolicyId?: number | null
  spaceId?: number
  operatingSystem?: 'Linux' | 'Windows' | 'macOS' | null
  communicationMode: TentacleCommunicationMode
  listeningHostName?: string
  listeningPort?: number
}

export interface TentacleInstallScriptItem {
  id: string
  label: string
  operatingSystem?: string | null
  installationMethod?: string | null
  scriptType?: string | null
  content: string
  isRecommended?: boolean
}

export interface GenerateTentacleInstallScriptData {
  serverThumbprint?: string | null
  scripts: TentacleInstallScriptItem[]
}

export function generateTentacleInstallScript(command: GenerateTentacleInstallScriptCommand) {
  return post<GenerateTentacleInstallScriptData>('/machines/generate-tentacle-install-script', command)
}

// --- Connection Status ---

export interface ConnectionStatusData {
  connected: boolean
}

export function getConnectionStatus(subscriptionId: string) {
  return get<ConnectionStatusData>('/machines/connection-status', { params: { subscriptionId } })
}

// --- Machine Health Check ---

export interface MachineHealthCheckData {
  HealthStatus?: string | null
  HealthDetail?: string | null
  HealthLastChecked?: string | null
  [key: string]: unknown
}

function shouldTryNextHealthRoute(error: unknown): boolean {
  const status = (error as any)?.response?.status ?? (error as any)?.status
  return status === 400 || status === 404 || status === 405 || status === 415 || status === 422
}

export async function checkMachineHealth(machineId: number) {
  const candidates: Array<() => Promise<MachineHealthCheckData>> = [
    () => post<MachineHealthCheckData>(`/machines/${machineId}/health-check`),
    () => get<MachineHealthCheckData>(`/machines/${machineId}/health-check`),
    () => post<MachineHealthCheckData>(`/machine/${machineId}/health-check`),
    () => get<MachineHealthCheckData>(`/machine/${machineId}/health-check`),
    () => post<MachineHealthCheckData>(`/machines/health-check`, { machineId }),
    () => get<MachineHealthCheckData>(`/machines/health-check`, { params: { machineId } }),
    () => post<MachineHealthCheckData>(`/machine/health-check`, { machineId }),
    () => get<MachineHealthCheckData>(`/machine/health-check`, { params: { machineId } }),
  ]

  let lastError: unknown = null
  for (const attempt of candidates) {
    try {
      return await attempt()
    } catch (error) {
      lastError = error
      if (!shouldTryNextHealthRoute(error)) {
        throw error
      }
    }
  }

  throw lastError ?? new Error('Health check endpoint not found')
}
