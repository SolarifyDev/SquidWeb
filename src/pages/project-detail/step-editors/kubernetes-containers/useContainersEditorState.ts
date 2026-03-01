import { useState, useCallback } from 'react'
import type { DeploymentStepDto, DeploymentActionDto, DeploymentActionPropertyDto } from 'pages/apis/deploymentProcess'
import { KEYS } from './propertyKeys'
import { type ContainersEditorState, defaultEditorState } from './types'
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

function kvFromJson(value: string | undefined): KeyValueItem[] {
  const arr = safeJsonParse<{ Key: string; Value: string }[]>(value, [])
  return arr.map((item) => ({ key: item.Key, value: item.Value }))
}

function kvToJson(items: KeyValueItem[]): string {
  return JSON.stringify(items.filter((i) => i.key).map((i) => ({ Key: i.key, Value: i.value })))
}

function deserializeState(step: DeploymentStepDto): ContainersEditorState {
  const action = step.actions[0]
  if (!action) return { ...defaultEditorState(), stepName: step.name }

  const get = (key: string) => getActionProp(action, key)

  const targetRoles = step.properties.find((p) => p.propertyName === 'Squid.Action.TargetRoles')?.propertyValue ?? ''

  return {
    stepName: step.name,
    targetRoles,
    resourceType: get(KEYS.DeploymentResourceType) ?? 'Deployment',
    deploymentName: get(KEYS.DeploymentName) ?? '',
    namespace: get(KEYS.Namespace) ?? 'default',
    replicas: get(KEYS.Replicas) ?? '1',
    revisionHistoryLimit: get(KEYS.RevisionHistoryLimit) ?? '',
    progressDeadlineSeconds: get(KEYS.ProgressDeadlineSeconds) ?? '',
    podTerminationGracePeriodSeconds: get(KEYS.PodTerminationGracePeriodSeconds) ?? '',
    podPriorityClassName: get(KEYS.PodPriorityClassName) ?? '',
    podRestartPolicy: get(KEYS.PodRestartPolicy) ?? 'Always',
    podDnsPolicy: get(KEYS.PodDnsPolicy) ?? 'ClusterFirst',
    podDnsNameservers: get(KEYS.PodDnsNameservers) ?? '',
    podDnsSearches: get(KEYS.PodDnsSearches) ?? '',
    podReadinessGates: get(KEYS.PodReadinessGates) ?? '',
    serviceAccountName: get(KEYS.ServiceAccountName) ?? '',
    podHostNetworking: get(KEYS.PodHostNetworking) ?? 'False',
    podSecurityFsGroup: get(KEYS.PodSecurityFsGroup) ?? '',
    podSecurityRunAsGroup: get(KEYS.PodSecurityRunAsGroup) ?? '',
    podSecurityRunAsUser: get(KEYS.PodSecurityRunAsUser) ?? '',
    podSecuritySupplementalGroups: get(KEYS.PodSecuritySupplementalGroups) ?? '',
    podSecurityRunAsNonRoot: get(KEYS.PodSecurityRunAsNonRoot) ?? '',
    podSecuritySeLinuxLevel: get(KEYS.PodSecuritySeLinuxLevel) ?? '',
    podSecuritySeLinuxRole: get(KEYS.PodSecuritySeLinuxRole) ?? '',
    podSecuritySeLinuxType: get(KEYS.PodSecuritySeLinuxType) ?? '',
    podSecuritySeLinuxUser: get(KEYS.PodSecuritySeLinuxUser) ?? '',
    deploymentStyle: get(KEYS.DeploymentStyle) ?? 'RollingUpdate',
    maxUnavailable: get(KEYS.MaxUnavailable) ?? '',
    maxSurge: get(KEYS.MaxSurge) ?? '',
    deploymentLabels: kvFromJson(get(KEYS.DeploymentLabels)),
    deploymentAnnotations: kvFromJson(get(KEYS.DeploymentAnnotations)),
    podAnnotations: kvFromJson(get(KEYS.PodAnnotations)),
    feedId: action.feedId ?? null,
    packageId: action.packageId ?? '',
    containers: safeJsonParse(get(KEYS.Containers), []),
    volumes: safeJsonParse(get(KEYS.CombinedVolumes), []),
    serviceName: get(KEYS.ServiceName) ?? '',
    serviceType: get(KEYS.ServiceType) ?? 'ClusterIP',
    serviceClusterIp: get(KEYS.ServiceClusterIp) ?? '',
    serviceAnnotations: kvFromJson(get(KEYS.ServiceAnnotations)),
    servicePorts: safeJsonParse(get(KEYS.ServicePorts), []),
    ingressName: get(KEYS.IngressName) ?? '',
    ingressClassName: get(KEYS.IngressClassName) ?? '',
    ingressAnnotations: kvFromJson(get(KEYS.IngressAnnotations)),
    ingressRules: safeJsonParse(get(KEYS.IngressRules), []),
    ingressTls: safeJsonParse(get(KEYS.IngressTlsCertificates), []),
    configMapName: get(KEYS.ConfigMapName) ?? '',
    configMapValues: kvFromJson(get(KEYS.ConfigMapValues)),
    secretName: get(KEYS.SecretName) ?? '',
    secretValues: kvFromJson(get(KEYS.SecretValues)),
    objectStatusCheck: get(KEYS.ObjectStatusCheck) ?? 'disabled',
    hostAliases: safeJsonParse(get(KEYS.HostAliases), []),
    tolerations: safeJsonParse(get(KEYS.Tolerations), []),
    nodeAffinity: get(KEYS.NodeAffinity) ?? '',
    podAffinity: get(KEYS.PodAffinity) ?? '',
    podAntiAffinity: get(KEYS.PodAntiAffinity) ?? '',
    imagePullSecrets: safeJsonParse(get(KEYS.PodSecurityImagePullSecrets), []),
    sysctls: safeJsonParse(get(KEYS.PodSecuritySysctls), []),
    dnsConfigOptions: safeJsonParse(get(KEYS.DnsConfigOptions), []),
    condition: step.condition || 'Success',
    startTrigger: step.startTrigger || 'StartAfterPrevious',
  }
}

function buildActionProperties(state: ContainersEditorState): DeploymentActionPropertyDto[] {
  const props: DeploymentActionPropertyDto[] = []
  const add = (name: string, value: string) => {
    if (value !== undefined && value !== '') {
      props.push({ id: 0, actionId: 0, propertyName: name, propertyValue: value })
    }
  }

  add(KEYS.DeploymentResourceType, state.resourceType)
  add(KEYS.DeploymentName, state.deploymentName)
  add(KEYS.Namespace, state.namespace)
  add(KEYS.Replicas, state.replicas)
  add(KEYS.RevisionHistoryLimit, state.revisionHistoryLimit)
  add(KEYS.ProgressDeadlineSeconds, state.progressDeadlineSeconds)
  add(KEYS.PodTerminationGracePeriodSeconds, state.podTerminationGracePeriodSeconds)
  add(KEYS.PodPriorityClassName, state.podPriorityClassName)
  add(KEYS.PodRestartPolicy, state.podRestartPolicy)
  add(KEYS.PodDnsPolicy, state.podDnsPolicy)
  add(KEYS.PodDnsNameservers, state.podDnsNameservers)
  add(KEYS.PodDnsSearches, state.podDnsSearches)
  add(KEYS.PodReadinessGates, state.podReadinessGates)
  add(KEYS.ServiceAccountName, state.serviceAccountName)
  add(KEYS.PodHostNetworking, state.podHostNetworking)
  add(KEYS.PodSecurityFsGroup, state.podSecurityFsGroup)
  add(KEYS.PodSecurityRunAsGroup, state.podSecurityRunAsGroup)
  add(KEYS.PodSecurityRunAsUser, state.podSecurityRunAsUser)
  add(KEYS.PodSecuritySupplementalGroups, state.podSecuritySupplementalGroups)
  add(KEYS.PodSecurityRunAsNonRoot, state.podSecurityRunAsNonRoot)
  add(KEYS.PodSecuritySeLinuxLevel, state.podSecuritySeLinuxLevel)
  add(KEYS.PodSecuritySeLinuxRole, state.podSecuritySeLinuxRole)
  add(KEYS.PodSecuritySeLinuxType, state.podSecuritySeLinuxType)
  add(KEYS.PodSecuritySeLinuxUser, state.podSecuritySeLinuxUser)
  add(KEYS.DeploymentStyle, state.deploymentStyle)
  add(KEYS.MaxUnavailable, state.maxUnavailable)
  add(KEYS.MaxSurge, state.maxSurge)
  add(KEYS.DeploymentLabels, kvToJson(state.deploymentLabels))
  add(KEYS.DeploymentAnnotations, kvToJson(state.deploymentAnnotations))
  add(KEYS.PodAnnotations, kvToJson(state.podAnnotations))
  add(KEYS.Containers, JSON.stringify(state.containers))
  add(KEYS.CombinedVolumes, JSON.stringify(state.volumes))
  add(KEYS.ServiceName, state.serviceName)
  add(KEYS.ServiceType, state.serviceType)
  add(KEYS.ServiceClusterIp, state.serviceClusterIp)
  add(KEYS.ServiceAnnotations, kvToJson(state.serviceAnnotations))
  add(KEYS.ServicePorts, JSON.stringify(state.servicePorts))
  add(KEYS.ConfigMapName, state.configMapName)
  add(KEYS.ConfigMapValues, kvToJson(state.configMapValues))
  add(KEYS.IngressName, state.ingressName)
  add(KEYS.IngressClassName, state.ingressClassName)
  add(KEYS.IngressAnnotations, kvToJson(state.ingressAnnotations))
  add(KEYS.IngressRules, JSON.stringify(state.ingressRules))
  add(KEYS.IngressTlsCertificates, JSON.stringify(state.ingressTls))
  add(KEYS.SecretName, state.secretName)
  add(KEYS.SecretValues, kvToJson(state.secretValues))
  add(KEYS.ObjectStatusCheck, state.objectStatusCheck)
  add(KEYS.HostAliases, JSON.stringify(state.hostAliases))
  add(KEYS.Tolerations, JSON.stringify(state.tolerations))
  if (state.nodeAffinity) add(KEYS.NodeAffinity, state.nodeAffinity)
  if (state.podAffinity) add(KEYS.PodAffinity, state.podAffinity)
  if (state.podAntiAffinity) add(KEYS.PodAntiAffinity, state.podAntiAffinity)
  add(KEYS.PodSecurityImagePullSecrets, JSON.stringify(state.imagePullSecrets))
  add(KEYS.PodSecuritySysctls, JSON.stringify(state.sysctls))
  add(KEYS.DnsConfigOptions, JSON.stringify(state.dnsConfigOptions))

  return props
}

export function serializeToStep(state: ContainersEditorState, processId: number, existingStep?: DeploymentStepDto, actionType?: string): DeploymentStepDto {
  const actionProperties = buildActionProperties(state)
  const resolvedActionType = actionType ?? 'Squid.KubernetesDeployContainers'

  const action: DeploymentActionDto = {
    id: existingStep?.actions[0]?.id ?? 0,
    stepId: existingStep?.id ?? 0,
    actionOrder: 0,
    name: state.stepName || 'Deploy Kubernetes Containers',
    actionType: resolvedActionType,
    workerPoolId: null,
    feedId: state.feedId,
    packageId: state.packageId,
    isDisabled: false,
    isRequired: false,
    canBeUsedForProjectVersioning: false,
    createdAt: existingStep?.actions[0]?.createdAt ?? new Date().toISOString(),
    properties: actionProperties,
    environments: existingStep?.actions[0]?.environments ?? [],
    excludedEnvironments: existingStep?.actions[0]?.excludedEnvironments ?? [],
    channels: existingStep?.actions[0]?.channels ?? [],
  }

  const stepProperties = [
    { id: 0, stepId: existingStep?.id ?? 0, propertyName: 'Squid.Action.TargetRoles', propertyValue: state.targetRoles },
  ]

  return {
    id: existingStep?.id ?? 0,
    processId,
    stepOrder: existingStep?.stepOrder ?? 0,
    name: state.stepName || 'Deploy Kubernetes Containers',
    stepType: 'Action',
    condition: state.condition,
    startTrigger: state.startTrigger,
    packageRequirement: 'LetSquidDecide',
    isDisabled: false,
    isRequired: false,
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
