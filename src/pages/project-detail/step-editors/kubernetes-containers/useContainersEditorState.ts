import { useState, useCallback } from 'react'
import type { DeploymentStepDto, DeploymentActionDto, DeploymentActionPropertyDto } from 'pages/apis/deploymentProcess'
import { KubernetesProperties } from './KubernetesProperties'
import { type ContainersEditorState, type ContainerSpec, defaultEditorState } from './types'
import type { KeyValueItem } from '../shared/KeyValueListEditor'

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function getActionProp(action: DeploymentActionDto, name: string): string | undefined {
  return action.properties.find((p) => p.propertyName === name)?.propertyValue
}

function getStepProp(step: DeploymentStepDto, names: string[]): string {
  for (const name of names) {
    const value = step.properties.find((p) => p.propertyName === name)?.propertyValue
    if (value != null) return value
  }
  return ''
}

function kvFromJson(value: string | undefined): KeyValueItem[] {
  const arr = safeJsonParse<{ Key: string; Value: string }[]>(value, [])
  return arr.map((item) => ({ key: item.Key, value: item.Value }))
}

function kvToJson(items: KeyValueItem[]): string {
  return JSON.stringify(items.filter((i) => i.key).map((i) => ({ Key: i.key, Value: i.value })))
}

function normalizeServicePorts(value: string | undefined): ContainersEditorState['servicePorts'] {
  const parsed = safeJsonParse<unknown[]>(value, [])
  if (!Array.isArray(parsed)) return []
  return parsed.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>
    return {
      name: obj.name == null ? '' : String(obj.name),
      port: obj.port == null ? '' : String(obj.port),
      targetPort: obj.targetPort == null ? '' : String(obj.targetPort),
      nodePort: obj.nodePort == null ? '' : String(obj.nodePort),
      protocol: obj.protocol == null ? 'TCP' : String(obj.protocol),
    }
  })
}

function normalizeIngressRules(value: string | undefined): ContainersEditorState['ingressRules'] {
  const parsed = safeJsonParse<unknown[]>(value, [])
  if (!Array.isArray(parsed)) return []

  return parsed.map((rule) => {
    const ruleObj = (rule ?? {}) as Record<string, unknown>
    const pathsRaw = Array.isArray(ruleObj.paths) ? ruleObj.paths : []
    return {
      host: ruleObj.host == null ? '' : String(ruleObj.host),
      paths: pathsRaw.map((path) => {
        const pathObj = (path ?? {}) as Record<string, unknown>
        const backendObj = (pathObj.backend ?? {}) as Record<string, unknown>

        // Backward/forward compatible: support both flat and nested backend shapes.
        const serviceName = backendObj.serviceName ?? pathObj.serviceName
        const servicePort = backendObj.servicePort ?? pathObj.servicePort

        return {
          path: pathObj.path == null ? '' : String(pathObj.path),
          pathType: pathObj.pathType == null ? 'Prefix' : String(pathObj.pathType),
          backend: {
            serviceName: serviceName == null ? '' : String(serviceName),
            servicePort: servicePort == null ? '' : String(servicePort),
          },
        }
      }),
    }
  })
}

function toNumericIfPossible(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value
}

function serializeServicePorts(ports: ContainersEditorState['servicePorts']): string {
  const mapped = ports
    .filter((p) => p.port.trim())
    .map((p) => {
      const item: Record<string, string | number> = {
        port: toNumericIfPossible(p.port.trim()),
      }

      if (p.name.trim()) item.name = p.name.trim()
      if (p.targetPort.trim()) item.targetPort = toNumericIfPossible(p.targetPort.trim())
      if (p.nodePort.trim()) item.nodePort = Number(p.nodePort.trim())
      if (p.protocol.trim()) item.protocol = p.protocol.trim()

      return item
    })

  return JSON.stringify(mapped)
}

function serializeIngressRules(rules: ContainersEditorState['ingressRules']): string {
  const mapped = rules.map((rule) => ({
    host: rule.host,
    paths: rule.paths.map((path) => ({
      path: path.path,
      pathType: path.pathType,
      serviceName: path.backend.serviceName,
      servicePort: path.backend.servicePort.trim()
        ? toNumericIfPossible(path.backend.servicePort.trim())
        : '',
    })),
  }))
  return JSON.stringify(mapped)
}

function serializeContainers(containers: ContainersEditorState['containers'], packageId: string, feedId: number | null): string {
  const mapped = containers.map((container) => ({
    ...container,
    PackageId: container.PackageId || packageId,
    FeedId: container.FeedId ?? feedId,
  }))
  return JSON.stringify(mapped)
}

function deserializeState(step: DeploymentStepDto): ContainersEditorState {
  const action = step.actions[0]
  if (!action) return { ...defaultEditorState(), stepName: step.name }

  const get = (key: string) => getActionProp(action, key)

  const targetRoles = getStepProp(step, [KubernetesProperties.TargetRoles, KubernetesProperties.TargetRolesLegacy])
  const conditionExpression = getStepProp(step, [KubernetesProperties.StepConditionExpression])
  const containers = safeJsonParse<ContainerSpec[]>(get(KubernetesProperties.Containers), [])
  const firstContainer = containers[0]

  const includeEnvironments = action.environments ?? []
  const excludeEnvironments = action.excludedEnvironments ?? []
  const environmentMode = excludeEnvironments.length > 0 ? 'exclude' : includeEnvironments.length > 0 ? 'include' : 'all'
  const environmentIds = environmentMode === 'exclude' ? excludeEnvironments : includeEnvironments

  return {
    stepName: step.name,
    targetRoles,
    resourceType: get(KubernetesProperties.DeploymentResourceType) ?? 'Deployment',
    deploymentName: get(KubernetesProperties.DeploymentName) ?? '',
    namespace: get(KubernetesProperties.Namespace) ?? 'default',
    replicas: get(KubernetesProperties.Replicas) ?? '1',
    revisionHistoryLimit: get(KubernetesProperties.RevisionHistoryLimit) ?? '',
    progressDeadlineSeconds: get(KubernetesProperties.ProgressDeadlineSeconds) ?? '',
    podTerminationGracePeriodSeconds: get(KubernetesProperties.PodTerminationGracePeriodSeconds) ?? '',
    podPriorityClassName: get(KubernetesProperties.PodPriorityClassName) ?? '',
    podRestartPolicy: get(KubernetesProperties.PodRestartPolicy) ?? 'Always',
    podDnsPolicy: get(KubernetesProperties.PodDnsPolicy) ?? 'ClusterFirst',
    podDnsNameservers: get(KubernetesProperties.PodDnsNameservers) ?? '',
    podDnsSearches: get(KubernetesProperties.PodDnsSearches) ?? '',
    podReadinessGates: get(KubernetesProperties.PodReadinessGates) ?? '',
    serviceAccountName: get(KubernetesProperties.ServiceAccountName) ?? '',
    podHostNetworking: get(KubernetesProperties.PodHostNetworking) ?? 'False',
    podSecurityFsGroup: get(KubernetesProperties.PodSecurityFsGroup) ?? '',
    podSecurityRunAsGroup: get(KubernetesProperties.PodSecurityRunAsGroup) ?? '',
    podSecurityRunAsUser: get(KubernetesProperties.PodSecurityRunAsUser) ?? '',
    podSecuritySupplementalGroups: get(KubernetesProperties.PodSecuritySupplementalGroups) ?? '',
    podSecurityRunAsNonRoot: get(KubernetesProperties.PodSecurityRunAsNonRoot) ?? '',
    podSecuritySeLinuxLevel: get(KubernetesProperties.PodSecuritySeLinuxLevel) ?? '',
    podSecuritySeLinuxRole: get(KubernetesProperties.PodSecuritySeLinuxRole) ?? '',
    podSecuritySeLinuxType: get(KubernetesProperties.PodSecuritySeLinuxType) ?? '',
    podSecuritySeLinuxUser: get(KubernetesProperties.PodSecuritySeLinuxUser) ?? '',
    deploymentStyle: get(KubernetesProperties.DeploymentStyle) ?? 'RollingUpdate',
    maxUnavailable: get(KubernetesProperties.MaxUnavailable) ?? '',
    maxSurge: get(KubernetesProperties.MaxSurge) ?? '',
    deploymentLabels: kvFromJson(get(KubernetesProperties.DeploymentLabels)),
    deploymentAnnotations: kvFromJson(get(KubernetesProperties.DeploymentAnnotations)),
    podAnnotations: kvFromJson(get(KubernetesProperties.PodAnnotations)),
    feedId: firstContainer?.FeedId ?? null,
    packageId: firstContainer?.PackageId ?? '',
    containers,
    volumes: safeJsonParse(get(KubernetesProperties.CombinedVolumes), []),
    serviceName: get(KubernetesProperties.ServiceName) ?? '',
    serviceType: get(KubernetesProperties.ServiceType) ?? 'ClusterIP',
    serviceClusterIp: get(KubernetesProperties.ServiceClusterIp) ?? '',
    serviceAnnotations: kvFromJson(get(KubernetesProperties.ServiceAnnotations)),
    servicePorts: normalizeServicePorts(get(KubernetesProperties.ServicePorts)),
    ingressName: get(KubernetesProperties.IngressName) ?? '',
    ingressClassName: get(KubernetesProperties.IngressClassName) ?? '',
    ingressAnnotations: kvFromJson(get(KubernetesProperties.IngressAnnotations)),
    ingressRules: normalizeIngressRules(get(KubernetesProperties.IngressRules)),
    ingressTls: safeJsonParse(get(KubernetesProperties.IngressTlsCertificates), []),
    configMapName: get(KubernetesProperties.ConfigMapName) ?? '',
    configMapValues: kvFromJson(get(KubernetesProperties.ConfigMapValues)),
    secretName: get(KubernetesProperties.SecretName) ?? '',
    secretValues: kvFromJson(get(KubernetesProperties.SecretValues)),
    objectStatusCheck: get(KubernetesProperties.ObjectStatusCheck) ?? 'disabled',
    hostAliases: safeJsonParse(get(KubernetesProperties.HostAliases), []),
    tolerations: safeJsonParse(get(KubernetesProperties.Tolerations), []),
    nodeAffinity: get(KubernetesProperties.NodeAffinity) ?? '',
    podAffinity: get(KubernetesProperties.PodAffinity) ?? '',
    podAntiAffinity: get(KubernetesProperties.PodAntiAffinity) ?? '',
    imagePullSecrets: safeJsonParse(get(KubernetesProperties.PodSecurityImagePullSecrets), []),
    sysctls: safeJsonParse(get(KubernetesProperties.PodSecuritySysctls), []),
    dnsConfigOptions: safeJsonParse(get(KubernetesProperties.DnsConfigOptions), []),
    condition: step.condition || 'Success',
    conditionExpression,
    startTrigger: step.startTrigger || 'StartAfterPrevious',
    environmentMode,
    environmentIds,
    channelIds: action.channels ?? [],
    packageRequirement: step.packageRequirement || 'LetSquidDecide',
    isRequired: step.isRequired ?? false,
    isDisabled: step.isDisabled ?? false,
  }
}

function buildActionProperties(state: ContainersEditorState): DeploymentActionPropertyDto[] {
  const props: DeploymentActionPropertyDto[] = []
  const add = (name: string, value: string) => {
    if (value !== undefined && value !== '') {
      props.push({ id: 0, actionId: 0, propertyName: name, propertyValue: value })
    }
  }

  add(KubernetesProperties.DeploymentResourceType, state.resourceType)
  add(KubernetesProperties.DeploymentName, state.deploymentName)
  add(KubernetesProperties.Namespace, state.namespace)
  add(KubernetesProperties.Replicas, state.replicas)
  add(KubernetesProperties.RevisionHistoryLimit, state.revisionHistoryLimit)
  add(KubernetesProperties.ProgressDeadlineSeconds, state.progressDeadlineSeconds)
  add(KubernetesProperties.PodTerminationGracePeriodSeconds, state.podTerminationGracePeriodSeconds)
  add(KubernetesProperties.PodPriorityClassName, state.podPriorityClassName)
  add(KubernetesProperties.PodRestartPolicy, state.podRestartPolicy)
  add(KubernetesProperties.PodDnsPolicy, state.podDnsPolicy)
  add(KubernetesProperties.PodDnsNameservers, state.podDnsNameservers)
  add(KubernetesProperties.PodDnsSearches, state.podDnsSearches)
  add(KubernetesProperties.PodReadinessGates, state.podReadinessGates)
  add(KubernetesProperties.ServiceAccountName, state.serviceAccountName)
  add(KubernetesProperties.PodHostNetworking, state.podHostNetworking)
  add(KubernetesProperties.PodSecurityFsGroup, state.podSecurityFsGroup)
  add(KubernetesProperties.PodSecurityRunAsGroup, state.podSecurityRunAsGroup)
  add(KubernetesProperties.PodSecurityRunAsUser, state.podSecurityRunAsUser)
  add(KubernetesProperties.PodSecuritySupplementalGroups, state.podSecuritySupplementalGroups)
  add(KubernetesProperties.PodSecurityRunAsNonRoot, state.podSecurityRunAsNonRoot)
  add(KubernetesProperties.PodSecuritySeLinuxLevel, state.podSecuritySeLinuxLevel)
  add(KubernetesProperties.PodSecuritySeLinuxRole, state.podSecuritySeLinuxRole)
  add(KubernetesProperties.PodSecuritySeLinuxType, state.podSecuritySeLinuxType)
  add(KubernetesProperties.PodSecuritySeLinuxUser, state.podSecuritySeLinuxUser)
  add(KubernetesProperties.DeploymentStyle, state.deploymentStyle)
  add(KubernetesProperties.MaxUnavailable, state.maxUnavailable)
  add(KubernetesProperties.MaxSurge, state.maxSurge)
  add(KubernetesProperties.DeploymentLabels, kvToJson(state.deploymentLabels))
  add(KubernetesProperties.DeploymentAnnotations, kvToJson(state.deploymentAnnotations))
  add(KubernetesProperties.PodAnnotations, kvToJson(state.podAnnotations))
  add(KubernetesProperties.Containers, serializeContainers(state.containers, state.packageId, state.feedId))
  add(KubernetesProperties.CombinedVolumes, JSON.stringify(state.volumes))
  add(KubernetesProperties.ServiceName, state.serviceName)
  add(KubernetesProperties.ServiceType, state.serviceType)
  add(KubernetesProperties.ServiceClusterIp, state.serviceClusterIp)
  add(KubernetesProperties.ServiceAnnotations, kvToJson(state.serviceAnnotations))
  add(KubernetesProperties.ServicePorts, serializeServicePorts(state.servicePorts))
  add(KubernetesProperties.ConfigMapName, state.configMapName)
  add(KubernetesProperties.ConfigMapValues, kvToJson(state.configMapValues))
  add(KubernetesProperties.IngressName, state.ingressName)
  add(KubernetesProperties.IngressClassName, state.ingressClassName)
  add(KubernetesProperties.IngressAnnotations, kvToJson(state.ingressAnnotations))
  add(KubernetesProperties.IngressRules, serializeIngressRules(state.ingressRules))
  add(KubernetesProperties.IngressTlsCertificates, JSON.stringify(state.ingressTls))
  add(KubernetesProperties.SecretName, state.secretName)
  add(KubernetesProperties.SecretValues, kvToJson(state.secretValues))
  add(KubernetesProperties.ObjectStatusCheck, state.objectStatusCheck)
  add(KubernetesProperties.HostAliases, JSON.stringify(state.hostAliases))
  add(KubernetesProperties.Tolerations, JSON.stringify(state.tolerations))
  if (state.nodeAffinity) add(KubernetesProperties.NodeAffinity, state.nodeAffinity)
  if (state.podAffinity) add(KubernetesProperties.PodAffinity, state.podAffinity)
  if (state.podAntiAffinity) add(KubernetesProperties.PodAntiAffinity, state.podAntiAffinity)
  add(KubernetesProperties.PodSecurityImagePullSecrets, JSON.stringify(state.imagePullSecrets))
  add(KubernetesProperties.PodSecuritySysctls, JSON.stringify(state.sysctls))
  add(KubernetesProperties.DnsConfigOptions, JSON.stringify(state.dnsConfigOptions))

  return props
}

export function serializeToStep(state: ContainersEditorState, processId: number, existingStep?: DeploymentStepDto, actionType?: string): DeploymentStepDto {
  const actionProperties = buildActionProperties(state)
  const resolvedActionType = actionType ?? 'Squid.KubernetesDeployContainers'

  const actionEnvironments = state.environmentMode === 'include' ? state.environmentIds : []
  const actionExcludedEnvironments = state.environmentMode === 'exclude' ? state.environmentIds : []

  const action: DeploymentActionDto = {
    id: existingStep?.actions[0]?.id ?? 0,
    stepId: existingStep?.id ?? 0,
    actionOrder: 0,
    name: state.stepName || 'Deploy Kubernetes Containers',
    actionType: resolvedActionType,
    workerPoolId: null,
    isDisabled: existingStep?.actions[0]?.isDisabled ?? false,
    isRequired: existingStep?.actions[0]?.isRequired ?? false,
    canBeUsedForProjectVersioning: false,
    createdAt: existingStep?.actions[0]?.createdAt ?? new Date().toISOString(),
    properties: actionProperties,
    environments: actionEnvironments,
    excludedEnvironments: actionExcludedEnvironments,
    channels: state.channelIds,
  }

  const managedStepPropertyNames = new Set([
    KubernetesProperties.TargetRoles,
    KubernetesProperties.TargetRolesLegacy,
    KubernetesProperties.StepConditionExpression,
  ])

  const preservedStepProperties = (existingStep?.properties ?? []).filter(
    (property) => !managedStepPropertyNames.has(property.propertyName),
  )

  const stepProperties = [
    ...preservedStepProperties,
    ...(state.targetRoles.trim()
      ? [{ id: 0, stepId: existingStep?.id ?? 0, propertyName: KubernetesProperties.TargetRoles, propertyValue: state.targetRoles.trim() }]
      : []),
    ...(state.condition === 'Variable' && state.conditionExpression.trim()
      ? [{ id: 0, stepId: existingStep?.id ?? 0, propertyName: KubernetesProperties.StepConditionExpression, propertyValue: state.conditionExpression.trim() }]
      : []),
  ]

  return {
    id: existingStep?.id ?? 0,
    processId,
    stepOrder: existingStep?.stepOrder ?? 0,
    name: state.stepName || 'Deploy Kubernetes Containers',
    stepType: 'Action',
    condition: state.condition,
    startTrigger: state.startTrigger,
    packageRequirement: state.packageRequirement || 'LetSquidDecide',
    isDisabled: state.isDisabled,
    isRequired: state.isRequired,
    createdAt: existingStep?.createdAt ?? new Date().toISOString(),
    properties: stepProperties,
    actions: [action],
  }
}

export function useContainersEditorState(existingStep?: DeploymentStepDto | null) {
  const [state, setState] = useState<ContainersEditorState>(() =>
    existingStep ? deserializeState(existingStep) : defaultEditorState()
  )

  const updateField = useCallback(<K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => {
    setState((prev) => ({ ...prev, [field]: value }))
  }, [])

  return { state, setState, updateField }
}
