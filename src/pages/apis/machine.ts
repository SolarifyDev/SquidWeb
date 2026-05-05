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
export type TentacleOperatingSystem = 'Linux' | 'Windows' | 'macOS'

export interface GenerateTentacleInstallScriptCommand {
  machineName: string
  serverUrl: string
  serverCommsUrl?: string
  environments: string[]
  tags: string[]
  machinePolicyId?: number | null
  spaceId?: number
  operatingSystem?: TentacleOperatingSystem | null
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

export interface TentacleDownloadItem {
  operatingSystem: string
  architecture: string
  libcVariant?: string | null
  rid: string
  downloadUrl: string
  sha256Url: string
  fileName: string
  label: string
  isRecommended?: boolean
}

export interface TentacleCommsProbeInfo {
  reachable: boolean
  skipped: boolean
  observedThumbprint?: string | null
  thumbprintMatches?: boolean | null
  detail?: string | null
}

export interface GenerateTentacleInstallScriptData {
  serverThumbprint?: string | null
  scripts: TentacleInstallScriptItem[]
  downloads?: TentacleDownloadItem[]
  commsUrlProbe?: TentacleCommsProbeInfo | null
}

export interface TentacleDownloadsResponseData {
  latestVersion?: string | null
  downloads: TentacleDownloadItem[]
}

export interface GetTentacleDownloadsRequest {
  // Property names match BE GetTentacleDownloadsRequest (case-insensitive bind).
  // Using `os` here would NOT bind to OperatingSystem on .NET model binder.
  operatingSystem?: TentacleOperatingSystem
  version?: string
}

function normalizeTentacleInstallScriptItem(payload: unknown): TentacleInstallScriptItem | null {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  const id = String(source.id ?? source.Id ?? '').trim()
  const content = String(source.content ?? source.Content ?? '').trim()
  if (!id || !content) return null
  return {
    id,
    label: String(source.label ?? source.Label ?? id),
    operatingSystem: String(source.operatingSystem ?? source.OperatingSystem ?? '').trim() || null,
    installationMethod: String(source.installationMethod ?? source.InstallationMethod ?? '').trim() || null,
    scriptType: String(source.scriptType ?? source.ScriptType ?? '').trim() || null,
    content,
    isRecommended: Boolean(source.isRecommended ?? source.IsRecommended ?? false),
  }
}

function normalizeTentacleDownloadItem(payload: unknown): TentacleDownloadItem | null {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  const downloadUrl = String(source.downloadUrl ?? source.DownloadUrl ?? '').trim()
  if (!downloadUrl) return null
  const operatingSystem = String(source.operatingSystem ?? source.OperatingSystem ?? '').trim()
  const architecture = String(source.architecture ?? source.Architecture ?? '').trim()
  const rid = String(source.rid ?? source.Rid ?? '').trim()
  const sha256Url = String(source.sha256Url ?? source.Sha256Url ?? '').trim()
  return {
    operatingSystem,
    architecture,
    libcVariant: String(source.libcVariant ?? source.LibcVariant ?? '').trim() || null,
    rid,
    downloadUrl,
    sha256Url,
    fileName: String(source.fileName ?? source.FileName ?? '').trim() || downloadUrl.split('/').pop() || 'download',
    label: String(source.label ?? source.Label ?? '').trim() || [operatingSystem, architecture].filter(Boolean).join(' '),
    isRecommended: Boolean(source.isRecommended ?? source.IsRecommended ?? false),
  }
}

function normalizeTentacleCommsProbeInfo(payload: unknown): TentacleCommsProbeInfo | null {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  return {
    reachable: Boolean(source.reachable ?? source.Reachable ?? false),
    skipped: Boolean(source.skipped ?? source.Skipped ?? false),
    observedThumbprint: String(source.observedThumbprint ?? source.ObservedThumbprint ?? '').trim() || null,
    thumbprintMatches: typeof (source.thumbprintMatches ?? source.ThumbprintMatches) === 'boolean'
      ? Boolean(source.thumbprintMatches ?? source.ThumbprintMatches)
      : null,
    detail: String(source.detail ?? source.Detail ?? '').trim() || null,
  }
}

function normalizeGenerateTentacleInstallScriptData(payload: unknown): GenerateTentacleInstallScriptData {
  if (!payload || typeof payload !== 'object') return { serverThumbprint: null, scripts: [], downloads: [], commsUrlProbe: null }
  const source = payload as Record<string, unknown>
  const rawScripts = Array.isArray(source.scripts) ? source.scripts : (Array.isArray(source.Scripts) ? source.Scripts : [])
  const rawDownloads = Array.isArray(source.downloads) ? source.downloads : (Array.isArray(source.Downloads) ? source.Downloads : [])
  const scripts = rawScripts.map(normalizeTentacleInstallScriptItem).filter((item): item is TentacleInstallScriptItem => !!item)
  const downloads = rawDownloads.map(normalizeTentacleDownloadItem).filter((item): item is TentacleDownloadItem => !!item)
  return {
    serverThumbprint: String(source.serverThumbprint ?? source.ServerThumbprint ?? '').trim() || null,
    scripts,
    downloads,
    commsUrlProbe: normalizeTentacleCommsProbeInfo(source.commsUrlProbe ?? source.CommsUrlProbe),
  }
}

function normalizeTentacleDownloadsResponseData(payload: unknown): TentacleDownloadsResponseData {
  if (!payload || typeof payload !== 'object') return { latestVersion: null, downloads: [] }
  const source = payload as Record<string, unknown>
  const rawDownloads = Array.isArray(source.downloads) ? source.downloads : (Array.isArray(source.Downloads) ? source.Downloads : [])
  return {
    latestVersion: String(source.latestVersion ?? source.LatestVersion ?? '').trim() || null,
    downloads: rawDownloads.map(normalizeTentacleDownloadItem).filter((item): item is TentacleDownloadItem => !!item),
  }
}

export async function generateTentacleInstallScript(command: GenerateTentacleInstallScriptCommand) {
  const data = await post<unknown>('/machines/generate-tentacle-install-script', command)
  return normalizeGenerateTentacleInstallScriptData(data)
}

export async function getTentacleDownloads(params?: GetTentacleDownloadsRequest) {
  const data = await get<unknown>('/machines/tentacle-downloads', { params })
  return normalizeTentacleDownloadsResponseData(data)
}

// --- Tentacle Agent Upgrade ---

export interface UpgradeInfoResponseData {
  machineId: number
  currentVersion: string
  latestAvailableVersion: string
  canUpgrade: boolean
  reason: string
}

export enum MachineUpgradeStatus {
  Upgraded = 0,
  AlreadyUpToDate = 1,
  NotSupported = 2,
  Failed = 3,
  Initiated = 4,
}

export interface UpgradeMachineCommand {
  targetVersion?: string | null
  allowDowngrade?: boolean
}

export interface UpgradeMachineResponseData {
  machineId: number
  machineName: string
  currentVersion: string
  targetVersion: string
  status: MachineUpgradeStatus
  detail: string
}

export function getMachineUpgradeInfo(machineId: number) {
  return get<UpgradeInfoResponseData>(`/machines/${machineId}/upgrade-info`)
}

export function upgradeMachine(machineId: number, command: UpgradeMachineCommand = {}, timeoutMs = 5 * 60 * 1000) {
  return post<UpgradeMachineResponseData>(`/machines/${machineId}/upgrade`, command, { timeout: timeoutMs })
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

export interface MachineUpgradeEventItem {
  timestamp: string
  phase: string
  kind: string
  message: string
}

export interface MachineUpgradeEventsData {
  machineId: number
  events: MachineUpgradeEventItem[]
}

export function getMachineUpgradeEvents(machineId: number) {
  return get<MachineUpgradeEventsData>(`/machines/${machineId}/upgrade-events`)
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
