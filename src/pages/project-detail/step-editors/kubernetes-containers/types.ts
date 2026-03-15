import type { KeyValueItem } from '../shared/KeyValueListEditor'

// ── Container types ──────────────────────────────────────────────────────────

export interface ContainerPort {
  key: string   // port name
  value: string // container port number
  option: string // protocol (TCP/UDP)
}

export interface ContainerResources {
  requests: { cpu?: string; memory?: string }
  limits: { cpu?: string; memory?: string }
}

export interface VolumeMount {
  key: string   // volume name
  value: string // mount path
  option: string // sub path
}

export interface ProbeConfig {
  type: 'httpGet' | 'tcpSocket' | 'exec' | ''
  httpGet?: { path: string; port: string; scheme: string }
  tcpSocket?: { port: string }
  exec?: { command: string }
  initialDelaySeconds: string
  periodSeconds: string
  timeoutSeconds: string
  successThreshold: string
  failureThreshold: string
}

export interface ContainerSecurityContext {
  runAsUser?: string
  runAsGroup?: string
  runAsNonRoot?: string
  readOnlyRootFilesystem?: string
  allowPrivilegeEscalation?: string
  privileged?: string
}

export interface ContainerLifecycle {
  postStart?: { type: string; command?: string }
  preStop?: { type: string; command?: string }
}

export interface ContainerSpec {
  Name: string
  Image: string
  PackageId: string
  FeedId: number | null
  CreateFeedSecrets: string
  IsInitContainer: string  // 'False' = regular, 'True' = init container
  Ports: ContainerPort[]
  Resources: ContainerResources
  VolumeMounts: VolumeMount[]
  ConfigMapEnvFromSource: { key: string }[]
  LivenessProbe: ProbeConfig
  ReadinessProbe: ProbeConfig
  StartupProbe: ProbeConfig
  SecurityContext: ContainerSecurityContext
  Lifecycle: ContainerLifecycle
}

// ── Volume types ─────────────────────────────────────────────────────────────

export interface VolumeSpec {
  Name: string
  Type: string // ConfigMap | Secret | EmptyDir | PVC | HostPath
  ReferenceName: string
}

// ── Service types ────────────────────────────────────────────────────────────

export interface ServicePort {
  name: string
  port: string
  targetPort: string
  nodePort: string
  protocol: string
}

// ── Ingress types ────────────────────────────────────────────────────────────

export interface IngressPath {
  path: string
  pathType: string
  backend: { serviceName: string; servicePort: string }
}

export interface IngressRule {
  host: string
  paths: IngressPath[]
}

export interface IngressTls {
  hosts: string[]
  secretName: string
}

// ── Pod scheduling types ─────────────────────────────────────────────────────

export interface Toleration {
  key: string
  operator: string
  value: string
  effect: string
}

export interface ImagePullSecret {
  name: string
}

export interface SysctlEntry {
  name: string
  value: string
}

export interface HostAlias {
  ip: string
  hostnames: string
}

export interface DnsOption {
  name: string
  value: string
}

// ── Editor state ─────────────────────────────────────────────────────────────

export interface ContainersEditorState {
  stepName: string
  targetRoles: string

  // Deployment
  resourceType: string
  deploymentName: string
  namespace: string
  replicas: string
  revisionHistoryLimit: string
  progressDeadlineSeconds: string
  podTerminationGracePeriodSeconds: string
  podPriorityClassName: string
  podRestartPolicy: string
  podDnsPolicy: string
  podDnsNameservers: string
  podDnsSearches: string
  podReadinessGates: string
  serviceAccountName: string
  podHostNetworking: string
  podSecurityFsGroup: string
  podSecurityRunAsGroup: string
  podSecurityRunAsUser: string
  podSecuritySupplementalGroups: string
  podSecurityRunAsNonRoot: string
  podSecuritySeLinuxLevel: string
  podSecuritySeLinuxRole: string
  podSecuritySeLinuxType: string
  podSecuritySeLinuxUser: string
  deploymentStyle: string
  maxUnavailable: string
  maxSurge: string
  deploymentLabels: KeyValueItem[]
  deploymentAnnotations: KeyValueItem[]
  podAnnotations: KeyValueItem[]

  // Container image package
  feedId: number | null
  packageId: string

  // Containers
  containers: ContainerSpec[]

  // Volumes
  volumes: VolumeSpec[]

  // Service
  serviceName: string
  serviceType: string
  serviceClusterIp: string
  serviceAnnotations: KeyValueItem[]
  servicePorts: ServicePort[]

  // Ingress
  ingressName: string
  ingressClassName: string
  ingressAnnotations: KeyValueItem[]
  ingressRules: IngressRule[]
  ingressTls: IngressTls[]

  // ConfigMap
  configMapName: string
  configMapValues: KeyValueItem[]

  // Secret
  secretName: string
  secretValues: KeyValueItem[]

  // Object status check
  objectStatusCheck: string

  // Host aliases
  hostAliases: HostAlias[]

  // Pod scheduling
  tolerations: Toleration[]
  nodeAffinity: string
  podAffinity: string
  podAntiAffinity: string
  imagePullSecrets: ImagePullSecret[]
  sysctls: SysctlEntry[]
  dnsConfigOptions: DnsOption[]

  // Conditions
  condition: string
  conditionExpression: string
  startTrigger: string
  environmentMode: 'all' | 'include' | 'exclude'
  environmentIds: number[]
  channelIds: number[]
  packageRequirement: string
  isRequired: boolean
  isDisabled: boolean
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultProbe(): ProbeConfig {
  return {
    type: '',
    initialDelaySeconds: '',
    periodSeconds: '',
    timeoutSeconds: '',
    successThreshold: '',
    failureThreshold: '',
  }
}

export function defaultContainer(): ContainerSpec {
  return {
    Name: '',
    Image: '',
    PackageId: '',
    FeedId: null,
    CreateFeedSecrets: 'False',
    IsInitContainer: 'False',
    Ports: [],
    Resources: { requests: {}, limits: {} },
    VolumeMounts: [],
    ConfigMapEnvFromSource: [],
    LivenessProbe: defaultProbe(),
    ReadinessProbe: defaultProbe(),
    StartupProbe: defaultProbe(),
    SecurityContext: {},
    Lifecycle: {},
  }
}

export function defaultEditorState(): ContainersEditorState {
  return {
    stepName: '',
    targetRoles: '',
    resourceType: 'Deployment',
    deploymentName: '',
    namespace: 'default',
    replicas: '1',
    revisionHistoryLimit: '',
    progressDeadlineSeconds: '',
    podTerminationGracePeriodSeconds: '',
    podPriorityClassName: '',
    podRestartPolicy: 'Always',
    podDnsPolicy: 'ClusterFirst',
    podDnsNameservers: '',
    podDnsSearches: '',
    podReadinessGates: '',
    serviceAccountName: '',
    podHostNetworking: 'False',
    podSecurityFsGroup: '',
    podSecurityRunAsGroup: '',
    podSecurityRunAsUser: '',
    podSecuritySupplementalGroups: '',
    podSecurityRunAsNonRoot: '',
    podSecuritySeLinuxLevel: '',
    podSecuritySeLinuxRole: '',
    podSecuritySeLinuxType: '',
    podSecuritySeLinuxUser: '',
    deploymentStyle: 'RollingUpdate',
    maxUnavailable: '',
    maxSurge: '',
    deploymentLabels: [],
    deploymentAnnotations: [],
    podAnnotations: [],
    feedId: null,
    packageId: '',
    containers: [],
    volumes: [],
    serviceName: '',
    serviceType: 'ClusterIP',
    serviceClusterIp: '',
    serviceAnnotations: [],
    servicePorts: [],
    ingressName: '',
    ingressClassName: '',
    ingressAnnotations: [],
    ingressRules: [],
    ingressTls: [],
    configMapName: '',
    configMapValues: [],
    secretName: '',
    secretValues: [],
    objectStatusCheck: 'disabled',
    hostAliases: [],
    tolerations: [],
    nodeAffinity: '',
    podAffinity: '',
    podAntiAffinity: '',
    imagePullSecrets: [],
    sysctls: [],
    dnsConfigOptions: [],
    condition: 'Success',
    conditionExpression: '',
    startTrigger: 'StartAfterPrevious',
    environmentMode: 'all',
    environmentIds: [],
    channelIds: [],
    packageRequirement: 'LetSquidDecide',
    isRequired: false,
    isDisabled: false,
  }
}
