import { useState, useCallback } from 'react'
import type { DeploymentStepDto, DeploymentActionDto, DeploymentActionPropertyDto } from 'pages/apis/deploymentProcess'
import { KubernetesProperties } from './KubernetesProperties'
import { type ContainersEditorState, type ContainerSpec, defaultContainer, defaultEditorState, defaultProbe } from './types'
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

function normalizeVolumes(value: string | undefined): ContainersEditorState['volumes'] {
  const parsed = safeJsonParse<unknown[]>(value, [])
  if (!Array.isArray(parsed)) return []

  return parsed.map((item) => {
    const volume = asObject(item)
    const rawMode = String(volume.ResourceNameMode ?? '')
    const resourceNameMode: 'LinkedResource' | 'CustomResource' | undefined =
      rawMode === 'LinkedResource' || rawMode === 'CustomResource' ? rawMode : undefined
    const items = asArray(volume.Items).map((entry) => {
      const itemValue = asObject(entry)
      return {
        key: String(itemValue.key ?? ''),
        path: String(itemValue.path ?? ''),
      }
    })

    return {
      Name: String(volume.Name ?? ''),
      Type: String(volume.Type ?? ''),
      ReferenceName: String(volume.ReferenceName ?? ''),
      ResourceNameMode: resourceNameMode,
      Items: items,
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

function normalizeTolerationOperator(operator: string): string {
  if (operator.trim().toLowerCase() === 'exists') return 'Exists'
  if (operator.trim().toLowerCase() === 'equal') return 'Equal'
  return operator.trim()
}

function normalizeTolerations(values: ContainersEditorState['tolerations']): ContainersEditorState['tolerations'] {
  return (values ?? []).map((item) => {
    const key = String(item?.key ?? '').trim()
    const operator = normalizeTolerationOperator(String(item?.operator ?? ''))
    const isExists = operator.toLowerCase() === 'exists'
    return {
      key,
      operator,
      value: isExists ? '' : String(item?.value ?? '').trim(),
      effect: String(item?.effect ?? '').trim(),
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter((item) => item.trim())
  if (typeof value === 'string') return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  return []
}

function toTrueFalseString(value: unknown): string | undefined {
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (lowered === 'true') return 'True'
    if (lowered === 'false') return 'False'
  }
  return undefined
}

function normalizeImagePullPolicy(value: unknown): ContainerSpec['ImagePullPolicy'] {
  const stringValue = String(value ?? '')
  return stringValue === 'Always' || stringValue === 'IfNotPresent' || stringValue === 'Never' ? stringValue : ''
}

function normalizeResourceMap(value: unknown): Record<string, string | undefined> {
  const input = asObject(value)
  const output: Record<string, string | undefined> = {}
  for (const [key, raw] of Object.entries(input)) {
    const text = raw == null ? '' : String(raw).trim()
    if (!text) continue
    if (key === 'ephemeral-storage') output.ephemeralStorage = text
    else if (key === 'nvidia.com/gpu') output.nvidiaGpu = text
    else if (key === 'amd.com/gpu') output.amdGpu = text
    else output[key] = text
  }
  return output
}

function serializeResourceMap(value: Record<string, string | undefined>): Record<string, string> {
  const output: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value ?? {})) {
    const text = raw == null ? '' : String(raw).trim()
    if (!text) continue
    if (key === 'ephemeralStorage') output['ephemeral-storage'] = text
    else if (key === 'nvidiaGpu') output['nvidia.com/gpu'] = text
    else if (key === 'amdGpu') output['amd.com/gpu'] = text
    else output[key] = text
  }
  return output
}

function normalizeNamedKeyValueList(value: unknown): { key: string; value: string }[] {
  return asArray(value)
    .map((item) => asObject(item))
    .map((item) => ({ key: String(item.key ?? ''), value: String(item.value ?? '') }))
}

function normalizeNamedKeyValueOptionList(value: unknown): { key: string; value: string; option: string; optional?: string }[] {
  return asArray(value)
    .map((item) => asObject(item))
    .map((item) => {
      const optional = toTrueFalseString(item.optional)
      return {
        key: String(item.key ?? ''),
        value: String(item.value ?? ''),
        option: String(item.option ?? ''),
        optional,
      }
    })
}

function normalizeNamedOptionalSourceList(value: unknown): { key: string; value?: string; option?: string }[] {
  return asArray(value)
    .map((item) => asObject(item))
    .map((item) => ({
      key: String(item.key ?? ''),
      value: String(item.value ?? ''),
      option: toTrueFalseString(item.option) ?? String(item.option ?? ''),
    }))
}

function normalizeProbe(value: unknown): ContainerSpec['LivenessProbe'] {
  const probe = { ...defaultProbe() }
  const input = asObject(value)
  const typeValue = String(input.type ?? '')
  if (typeValue === 'exec' || typeValue === 'httpGet' || typeValue === 'tcpSocket') probe.type = typeValue
  probe.initialDelaySeconds = String(input.initialDelaySeconds ?? '')
  probe.periodSeconds = String(input.periodSeconds ?? '')
  probe.timeoutSeconds = String(input.timeoutSeconds ?? '')
  probe.failureThreshold = String(input.failureThreshold ?? '')
  probe.successThreshold = String(input.successThreshold ?? '')

  const httpGet = asObject(input.httpGet)
  if (Object.keys(httpGet).length > 0) {
    probe.httpGet = {
      path: String(httpGet.path ?? ''),
      port: String(httpGet.port ?? ''),
      scheme: String(httpGet.scheme ?? 'HTTP'),
      host: String(httpGet.host ?? ''),
      httpHeaders: asArray(httpGet.httpHeaders).map((header) => {
        const item = asObject(header)
        return { name: String(item.name ?? ''), value: String(item.value ?? '') }
      }),
    }
  }

  const tcpSocket = asObject(input.tcpSocket)
  if (Object.keys(tcpSocket).length > 0) {
    probe.tcpSocket = {
      host: String(tcpSocket.host ?? ''),
      port: String(tcpSocket.port ?? ''),
    }
  }

  const exec = asObject(input.exec)
  if (Object.keys(exec).length > 0) {
    probe.exec = { command: toStringArray(exec.command).join(' ') || String(exec.command ?? '') }
  }

  return probe
}

function normalizeLifecycleHandler(value: unknown): { type: 'exec' | 'httpGet' | 'tcpSocket' | string; command?: string; httpGet?: { path: string; port: string; scheme: string; host?: string; httpHeaders?: { name: string; value: string }[] }; tcpSocket?: { host?: string; port: string } } | undefined {
  const input = asObject(value)
  if (Object.keys(input).length === 0) return undefined

  const explicitType = String(input.type ?? '')
  const type = explicitType === 'exec' || explicitType === 'httpGet' || explicitType === 'tcpSocket'
    ? explicitType
    : input.exec
      ? 'exec'
      : input.httpGet
        ? 'httpGet'
        : input.tcpSocket
          ? 'tcpSocket'
          : ''

  const handler: { type: 'exec' | 'httpGet' | 'tcpSocket' | string; command?: string; httpGet?: { path: string; port: string; scheme: string; host?: string; httpHeaders?: { name: string; value: string }[] }; tcpSocket?: { host?: string; port: string } } = { type }
  if (type === 'exec') {
    if (input.command != null) handler.command = toStringArray(input.command).join(' ') || String(input.command)
    else {
      const exec = asObject(input.exec)
      if (exec.command != null) handler.command = toStringArray(exec.command).join(' ') || String(exec.command)
    }
  } else if (type === 'httpGet') {
    const httpGet = asObject(input.httpGet)
    handler.httpGet = {
      path: String(httpGet.path ?? ''),
      port: String(httpGet.port ?? ''),
      scheme: String(httpGet.scheme ?? 'HTTP'),
      host: String(httpGet.host ?? ''),
      httpHeaders: asArray(httpGet.httpHeaders).map((header) => {
        const item = asObject(header)
        return { name: String(item.name ?? ''), value: String(item.value ?? '') }
      }),
    }
  } else if (type === 'tcpSocket') {
    const tcpSocket = asObject(input.tcpSocket)
    handler.tcpSocket = { host: String(tcpSocket.host ?? ''), port: String(tcpSocket.port ?? '') }
  }
  return handler
}

function normalizeContainer(raw: unknown, packageId: string, feedId: number | null): ContainerSpec {
  const defaults = defaultContainer()
  const input = asObject(raw)
  if (Object.keys(input).length === 0) return { ...defaults, PackageId: packageId, FeedId: feedId }

  const securityContextRaw = asObject(input.SecurityContext)
  const capabilitiesRaw = asObject(securityContextRaw.capabilities)
  const seLinuxOptionsRaw = asObject(securityContextRaw.seLinuxOptions)

  const rawFeedId = input.FeedId
  const parsedFeedId = rawFeedId == null || String(rawFeedId).trim() === ''
    ? null
    : Number.isFinite(Number(rawFeedId))
      ? Number(rawFeedId)
      : null

  const command = toStringArray(input.Command)
  const args = toStringArray(input.Args)

  const fieldRefEnvironmentVariables = normalizeNamedKeyValueList(input.FieldRefEnvironmentVariables ?? input.FieldRefEnvVariables)
  const configMapEnvironmentVariables = normalizeNamedKeyValueOptionList(input.ConfigMapEnvironmentVariables ?? input.ConfigMapEnvVariables)
  const secretEnvironmentVariables = normalizeNamedKeyValueOptionList(input.SecretEnvironmentVariables ?? input.SecretEnvVariables)

  return {
    ...defaults,
    ...input as Partial<ContainerSpec>,
    Name: String(input.Name ?? defaults.Name),
    Image: String(input.Image ?? defaults.Image),
    ImagePullPolicy: normalizeImagePullPolicy(input.ImagePullPolicy),
    PackageId: String(input.PackageId ?? packageId ?? ''),
    FeedId: parsedFeedId ?? feedId,
    CreateFeedSecrets: toTrueFalseString(input.CreateFeedSecrets) ?? 'False',
    IsInitContainer: toTrueFalseString(input.IsInitContainer) ?? 'False',
    Command: command,
    Args: args,
    Ports: asArray(input.Ports).map((item) => {
      const port = asObject(item)
      return {
        key: String(port.key ?? ''),
        value: String(port.value ?? ''),
        option: String(port.option ?? 'TCP'),
      }
    }),
    Resources: {
      requests: normalizeResourceMap(asObject(input.Resources).requests),
      limits: normalizeResourceMap(asObject(input.Resources).limits),
    },
    VolumeMounts: asArray(input.VolumeMounts).map((item) => {
      const mount = asObject(item)
      return {
        key: String(mount.key ?? ''),
        value: String(mount.value ?? ''),
        option: String(mount.option ?? ''),
      }
    }),
    EnvironmentVariables: normalizeNamedKeyValueList(input.EnvironmentVariables),
    FieldRefEnvironmentVariables: fieldRefEnvironmentVariables,
    ConfigMapEnvFromSource: normalizeNamedOptionalSourceList(input.ConfigMapEnvFromSource),
    ConfigMapEnvironmentVariables: configMapEnvironmentVariables,
    SecretEnvFromSource: normalizeNamedOptionalSourceList(input.SecretEnvFromSource),
    SecretEnvironmentVariables: secretEnvironmentVariables,
    LivenessProbe: normalizeProbe(input.LivenessProbe),
    ReadinessProbe: normalizeProbe(input.ReadinessProbe),
    StartupProbe: normalizeProbe(input.StartupProbe),
    SecurityContext: {
      runAsUser: securityContextRaw.runAsUser == null ? undefined : String(securityContextRaw.runAsUser),
      runAsGroup: securityContextRaw.runAsGroup == null ? undefined : String(securityContextRaw.runAsGroup),
      runAsNonRoot: toTrueFalseString(securityContextRaw.runAsNonRoot),
      readOnlyRootFilesystem: toTrueFalseString(securityContextRaw.readOnlyRootFilesystem),
      allowPrivilegeEscalation: toTrueFalseString(securityContextRaw.allowPrivilegeEscalation),
      privileged: toTrueFalseString(securityContextRaw.privileged),
      addCapabilities: toStringArray(securityContextRaw.addCapabilities ?? capabilitiesRaw.add),
      dropCapabilities: toStringArray(securityContextRaw.dropCapabilities ?? capabilitiesRaw.drop),
      seLinuxLevel: String((securityContextRaw.seLinuxLevel ?? seLinuxOptionsRaw.level) ?? ''),
      seLinuxRole: String((securityContextRaw.seLinuxRole ?? seLinuxOptionsRaw.role) ?? ''),
      seLinuxType: String((securityContextRaw.seLinuxType ?? seLinuxOptionsRaw.type) ?? ''),
      seLinuxUser: String((securityContextRaw.seLinuxUser ?? seLinuxOptionsRaw.user) ?? ''),
    },
    Lifecycle: {
      postStart: normalizeLifecycleHandler(asObject(input.Lifecycle).postStart),
      preStop: normalizeLifecycleHandler(asObject(input.Lifecycle).preStop),
    },
    TerminationMessagePath: String(input.TerminationMessagePath ?? ''),
    TerminationMessagePolicy: String(input.TerminationMessagePolicy) === 'FallbackToLogsOnError' ? 'FallbackToLogsOnError' : 'File',
  }
}

function serializeProbe(probe: ContainerSpec['LivenessProbe']): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: probe.type,
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
    timeoutSeconds: probe.timeoutSeconds,
    failureThreshold: probe.failureThreshold,
    successThreshold: probe.successThreshold,
  }
  if (probe.type === 'exec' && probe.exec?.command) payload.exec = { command: probe.exec.command }
  if (probe.type === 'httpGet' && probe.httpGet) {
    payload.httpGet = {
      path: probe.httpGet.path,
      port: probe.httpGet.port,
      scheme: probe.httpGet.scheme,
      host: probe.httpGet.host ?? '',
      httpHeaders: probe.httpGet.httpHeaders ?? [],
    }
  }
  if (probe.type === 'tcpSocket' && probe.tcpSocket) {
    payload.tcpSocket = { host: probe.tcpSocket.host ?? '', port: probe.tcpSocket.port }
  }
  return payload
}

function serializeLifecycleHandler(handler: ContainerSpec['Lifecycle']['postStart']): Record<string, unknown> | undefined {
  if (!handler) return undefined
  if (handler.type === 'exec') {
    return { type: 'exec', command: handler.command ?? '' }
  }
  if (handler.type === 'httpGet') {
    return {
      type: 'httpGet',
      httpGet: {
        path: handler.httpGet?.path ?? '',
        port: handler.httpGet?.port ?? '',
        scheme: handler.httpGet?.scheme ?? 'HTTP',
        host: handler.httpGet?.host ?? '',
        httpHeaders: handler.httpGet?.httpHeaders ?? [],
      },
    }
  }
  if (handler.type === 'tcpSocket') {
    return {
      type: 'tcpSocket',
      tcpSocket: {
        host: handler.tcpSocket?.host ?? '',
        port: handler.tcpSocket?.port ?? '',
      },
    }
  }
  return undefined
}

function serializeContainers(containers: ContainersEditorState['containers'], packageId: string, feedId: number | null): string {
  const mapped = containers.map((container) => {
    const resolvedFeedId = container.FeedId ?? feedId
    const securityContext: Record<string, unknown> = {}
    if ((container.SecurityContext.runAsUser ?? '').trim()) securityContext.runAsUser = container.SecurityContext.runAsUser
    if ((container.SecurityContext.runAsGroup ?? '').trim()) securityContext.runAsGroup = container.SecurityContext.runAsGroup
    if (container.SecurityContext.runAsNonRoot === 'True' || container.SecurityContext.runAsNonRoot === 'False') securityContext.runAsNonRoot = container.SecurityContext.runAsNonRoot
    if (container.SecurityContext.readOnlyRootFilesystem === 'True' || container.SecurityContext.readOnlyRootFilesystem === 'False') securityContext.readOnlyRootFilesystem = container.SecurityContext.readOnlyRootFilesystem
    if (container.SecurityContext.allowPrivilegeEscalation === 'True' || container.SecurityContext.allowPrivilegeEscalation === 'False') securityContext.allowPrivilegeEscalation = container.SecurityContext.allowPrivilegeEscalation
    if (container.SecurityContext.privileged === 'True' || container.SecurityContext.privileged === 'False') securityContext.privileged = container.SecurityContext.privileged
    if ((container.SecurityContext.addCapabilities ?? []).length > 0 || (container.SecurityContext.dropCapabilities ?? []).length > 0) {
      securityContext.capabilities = {
        add: container.SecurityContext.addCapabilities ?? [],
        drop: container.SecurityContext.dropCapabilities ?? [],
      }
    }
    if (
      (container.SecurityContext.seLinuxLevel ?? '').trim() ||
      (container.SecurityContext.seLinuxRole ?? '').trim() ||
      (container.SecurityContext.seLinuxType ?? '').trim() ||
      (container.SecurityContext.seLinuxUser ?? '').trim()
    ) {
      securityContext.seLinuxOptions = {
        level: container.SecurityContext.seLinuxLevel ?? '',
        role: container.SecurityContext.seLinuxRole ?? '',
        type: container.SecurityContext.seLinuxType ?? '',
        user: container.SecurityContext.seLinuxUser ?? '',
      }
    }

    return {
      Name: container.Name,
      Image: container.Image,
      PackageId: container.PackageId || packageId,
      FeedId: resolvedFeedId != null ? String(resolvedFeedId) : '',
      CreateFeedSecrets: container.CreateFeedSecrets === 'True' ? 'True' : 'False',
      IsInitContainer: container.IsInitContainer === 'True' ? 'True' : 'False',
      ImagePullPolicy: container.ImagePullPolicy ?? '',
      TerminationMessagePath: container.TerminationMessagePath ?? '',
      TerminationMessagePolicy: container.TerminationMessagePolicy ?? 'File',
      Command: container.Command ?? [],
      Args: container.Args ?? [],
      Ports: container.Ports ?? [],
      Resources: {
        requests: serializeResourceMap(container.Resources.requests),
        limits: serializeResourceMap(container.Resources.limits),
      },
      VolumeMounts: container.VolumeMounts ?? [],
      EnvironmentVariables: container.EnvironmentVariables ?? [],
      ConfigMapEnvironmentVariables: container.ConfigMapEnvironmentVariables ?? [],
      SecretEnvironmentVariables: container.SecretEnvironmentVariables ?? [],
      FieldRefEnvironmentVariables: container.FieldRefEnvironmentVariables ?? [],
      ConfigMapEnvFromSource: container.ConfigMapEnvFromSource ?? [],
      SecretEnvFromSource: container.SecretEnvFromSource ?? [],
      LivenessProbe: serializeProbe(container.LivenessProbe),
      ReadinessProbe: serializeProbe(container.ReadinessProbe),
      StartupProbe: serializeProbe(container.StartupProbe),
      Lifecycle: {
        postStart: serializeLifecycleHandler(container.Lifecycle.postStart),
        preStop: serializeLifecycleHandler(container.Lifecycle.preStop),
      },
      SecurityContext: securityContext,
    }
  })
  return JSON.stringify(mapped)
}

function deserializeState(step: DeploymentStepDto): ContainersEditorState {
  const action = step.actions[0]
  if (!action) return { ...defaultEditorState(), stepName: step.name }

  const get = (key: string) => getActionProp(action, key)

  const targetRoles = getStepProp(step, [KubernetesProperties.TargetRoles, KubernetesProperties.TargetRolesLegacy])
  const conditionExpression = getStepProp(step, [KubernetesProperties.StepConditionExpression])
  const rawContainers = safeJsonParse<unknown[]>(get(KubernetesProperties.Containers), [])
  const containers = rawContainers.map((container) => normalizeContainer(container, '', null))
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
    volumes: normalizeVolumes(get(KubernetesProperties.CombinedVolumes)),
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
    tolerations: normalizeTolerations(safeJsonParse(get(KubernetesProperties.Tolerations), [])),
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
  add(KubernetesProperties.Tolerations, JSON.stringify(normalizeTolerations(state.tolerations)))
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
    isDisabled: state.isDisabled,
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
