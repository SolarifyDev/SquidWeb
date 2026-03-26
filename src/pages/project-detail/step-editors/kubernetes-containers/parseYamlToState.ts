import { load, loadAll } from 'js-yaml'
import type { ContainersEditorState, ContainerSpec, ProbeConfig, VolumeSpec, ServicePort, IngressRule, IngressTls } from './types'
import type { KeyValueItem } from '../shared/KeyValueListEditor'

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return (v as unknown[]).map((item) => str(item)).filter((item) => item.trim())
  if (typeof v === 'string') return v.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  return []
}

function mapToKv(obj: unknown): KeyValueItem[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.entries(obj as Record<string, unknown>).map(([key, value]) => ({ key, value: str(value) }))
}

function parseResourceMap(value: unknown): Record<string, string | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const map = value as Record<string, unknown>
  const out: Record<string, string | undefined> = {}
  for (const [key, raw] of Object.entries(map)) {
    const text = str(raw).trim()
    if (!text) continue
    if (key === 'ephemeral-storage') out.ephemeralStorage = text
    else if (key === 'nvidia.com/gpu') out.nvidiaGpu = text
    else if (key === 'amd.com/gpu') out.amdGpu = text
    else out[key] = text
  }
  return out
}

function parseProbe(p: Record<string, unknown>): ProbeConfig {
  const probe: ProbeConfig = {
    type: '',
    initialDelaySeconds: str(p.initialDelaySeconds),
    periodSeconds: str(p.periodSeconds),
    timeoutSeconds: str(p.timeoutSeconds),
    successThreshold: str(p.successThreshold),
    failureThreshold: str(p.failureThreshold),
  }

  if (p.httpGet && typeof p.httpGet === 'object') {
    const hg = p.httpGet as Record<string, unknown>
    probe.type = 'httpGet'
    probe.httpGet = {
      path: str(hg.path),
      port: str(hg.port),
      scheme: str(hg.scheme) || 'HTTP',
      host: str(hg.host),
      httpHeaders: Array.isArray(hg.httpHeaders)
        ? (hg.httpHeaders as Record<string, unknown>[]).map((header) => ({ name: str(header.name), value: str(header.value) }))
        : [],
    }
  } else if (p.tcpSocket && typeof p.tcpSocket === 'object') {
    const ts = p.tcpSocket as Record<string, unknown>
    probe.type = 'tcpSocket'
    probe.tcpSocket = { host: str(ts.host), port: str(ts.port) }
  } else if (p.exec && typeof p.exec === 'object') {
    const ex = p.exec as Record<string, unknown>
    probe.type = 'exec'
    const cmd = toStringArray(ex.command).join(' ')
    probe.exec = { command: cmd }
  }

  return probe
}

function parseLifecycleHandler(value: unknown): { type: string; command?: string; httpGet?: { path: string; port: string; scheme: string; host?: string; httpHeaders?: { name: string; value: string }[] }; tcpSocket?: { host?: string; port: string } } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const handler = value as Record<string, unknown>
  if (handler.exec && typeof handler.exec === 'object') {
    const exec = handler.exec as Record<string, unknown>
    return { type: 'exec', command: toStringArray(exec.command).join(' ') }
  }
  if (handler.httpGet && typeof handler.httpGet === 'object') {
    const httpGet = handler.httpGet as Record<string, unknown>
    return {
      type: 'httpGet',
      httpGet: {
        path: str(httpGet.path),
        port: str(httpGet.port),
        scheme: str(httpGet.scheme) || 'HTTP',
        host: str(httpGet.host),
        httpHeaders: Array.isArray(httpGet.httpHeaders)
          ? (httpGet.httpHeaders as Record<string, unknown>[]).map((header) => ({ name: str(header.name), value: str(header.value) }))
          : [],
      },
    }
  }
  if (handler.tcpSocket && typeof handler.tcpSocket === 'object') {
    const tcpSocket = handler.tcpSocket as Record<string, unknown>
    return {
      type: 'tcpSocket',
      tcpSocket: {
        host: str(tcpSocket.host),
        port: str(tcpSocket.port),
      },
    }
  }
  return undefined
}

function parseContainer(c: Record<string, unknown>, isInitContainer = false): ContainerSpec {
  const ports = Array.isArray(c.ports)
    ? (c.ports as Record<string, unknown>[]).map((p) => ({
        key: str(p.name),
        value: str(p.containerPort),
        option: str(p.protocol) || 'TCP',
      }))
    : []

  const res = (c.resources ?? {}) as Record<string, unknown>

  const mounts = Array.isArray(c.volumeMounts)
    ? (c.volumeMounts as Record<string, unknown>[]).map((m) => ({
        key: str(m.name),
        value: str(m.mountPath),
        option: str(m.subPath),
      }))
    : []

  const configMapEnvFrom = Array.isArray(c.envFrom)
    ? (c.envFrom as Record<string, unknown>[])
        .filter((e) => e.configMapRef && typeof e.configMapRef === 'object')
        .map((e) => {
          const configMapRef = e.configMapRef as Record<string, unknown>
          const optional = configMapRef.optional === true ? 'True' : configMapRef.optional === false ? 'False' : ''
          return { key: str(configMapRef.name), value: str(e.prefix), option: optional }
        })
    : []

  const secretEnvFrom = Array.isArray(c.envFrom)
    ? (c.envFrom as Record<string, unknown>[])
        .filter((e) => e.secretRef && typeof e.secretRef === 'object')
        .map((e) => {
          const secretRef = e.secretRef as Record<string, unknown>
          const optional = secretRef.optional === true ? 'True' : secretRef.optional === false ? 'False' : ''
          return { key: str(secretRef.name), value: str(e.prefix), option: optional }
        })
    : []

  const configMapEnvVars = Array.isArray(c.env)
    ? (c.env as Record<string, unknown>[])
        .filter((e) => e.valueFrom && typeof e.valueFrom === 'object' && (e.valueFrom as Record<string, unknown>).configMapKeyRef && typeof (e.valueFrom as Record<string, unknown>).configMapKeyRef === 'object')
        .map((e) => {
          const valueFrom = e.valueFrom as Record<string, unknown>
          const keyRef = valueFrom.configMapKeyRef as Record<string, unknown>
          const optional = keyRef.optional === true ? 'True' : keyRef.optional === false ? 'False' : ''
          return { key: str(e.name), value: str(keyRef.name), option: str(keyRef.key), optional }
        })
    : []

  const envVars = Array.isArray(c.env)
    ? (c.env as Record<string, unknown>[])
        .filter((e) => (!e.valueFrom || typeof e.valueFrom !== 'object') && e.name != null)
        .map((e) => ({ key: str(e.name), value: str(e.value) }))
    : []

  const fieldRefEnvVars = Array.isArray(c.env)
    ? (c.env as Record<string, unknown>[])
        .filter((e) => e.valueFrom && typeof e.valueFrom === 'object' && (e.valueFrom as Record<string, unknown>).fieldRef && typeof (e.valueFrom as Record<string, unknown>).fieldRef === 'object')
        .map((e) => {
          const valueFrom = e.valueFrom as Record<string, unknown>
          const fieldRef = valueFrom.fieldRef as Record<string, unknown>
          return { key: str(e.name), value: str(fieldRef.fieldPath) }
        })
    : []

  const secretEnvVars = Array.isArray(c.env)
    ? (c.env as Record<string, unknown>[])
        .filter((e) => e.valueFrom && typeof e.valueFrom === 'object' && (e.valueFrom as Record<string, unknown>).secretKeyRef && typeof (e.valueFrom as Record<string, unknown>).secretKeyRef === 'object')
        .map((e) => {
          const valueFrom = e.valueFrom as Record<string, unknown>
          const keyRef = valueFrom.secretKeyRef as Record<string, unknown>
          const optional = keyRef.optional === true ? 'True' : keyRef.optional === false ? 'False' : ''
          return { key: str(e.name), value: str(keyRef.name), option: str(keyRef.key), optional }
        })
    : []

  const sc = (c.securityContext ?? {}) as Record<string, unknown>
  const capabilities = (sc.capabilities ?? {}) as Record<string, unknown>
  const seLinuxOptions = (sc.seLinuxOptions ?? {}) as Record<string, unknown>
  const parseCapabilities = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.map((cap) => str(cap).trim()).filter((cap) => cap.length > 0)
  }

  const lc = (c.lifecycle ?? {}) as Record<string, unknown>
  const command = toStringArray(c.command)
  const args = toStringArray(c.args)

  return {
    Name: str(c.name),
    Image: str(c.image),
    ImagePullPolicy: ['IfNotPresent', 'Always', 'Never'].includes(str(c.imagePullPolicy)) ? (str(c.imagePullPolicy) as 'IfNotPresent' | 'Always' | 'Never') : '',
    PackageId: '',
    FeedId: null,
    CreateFeedSecrets: 'False',
    IsInitContainer: isInitContainer ? 'True' : 'False',
    Command: command,
    Args: args,
    Ports: ports,
    Resources: {
      requests: parseResourceMap(res.requests),
      limits: parseResourceMap(res.limits),
    },
    VolumeMounts: mounts,
    EnvironmentVariables: envVars,
    FieldRefEnvironmentVariables: fieldRefEnvVars,
    ConfigMapEnvFromSource: configMapEnvFrom,
    ConfigMapEnvironmentVariables: configMapEnvVars,
    SecretEnvFromSource: secretEnvFrom,
    SecretEnvironmentVariables: secretEnvVars,
    LivenessProbe: c.livenessProbe ? parseProbe(c.livenessProbe as Record<string, unknown>) : { type: '', initialDelaySeconds: '', periodSeconds: '', timeoutSeconds: '', successThreshold: '', failureThreshold: '' },
    ReadinessProbe: c.readinessProbe ? parseProbe(c.readinessProbe as Record<string, unknown>) : { type: '', initialDelaySeconds: '', periodSeconds: '', timeoutSeconds: '', successThreshold: '', failureThreshold: '' },
    StartupProbe: c.startupProbe ? parseProbe(c.startupProbe as Record<string, unknown>) : { type: '', initialDelaySeconds: '', periodSeconds: '', timeoutSeconds: '', successThreshold: '', failureThreshold: '' },
    SecurityContext: {
      runAsUser: sc.runAsUser != null ? str(sc.runAsUser) : undefined,
      runAsGroup: sc.runAsGroup != null ? str(sc.runAsGroup) : undefined,
      runAsNonRoot: sc.runAsNonRoot === true ? 'True' : sc.runAsNonRoot === false ? 'False' : undefined,
      readOnlyRootFilesystem: sc.readOnlyRootFilesystem === true ? 'True' : sc.readOnlyRootFilesystem === false ? 'False' : undefined,
      allowPrivilegeEscalation: sc.allowPrivilegeEscalation === true ? 'True' : sc.allowPrivilegeEscalation === false ? 'False' : undefined,
      privileged: sc.privileged === true ? 'True' : sc.privileged === false ? 'False' : undefined,
      addCapabilities: parseCapabilities(capabilities.add),
      dropCapabilities: parseCapabilities(capabilities.drop),
      seLinuxLevel: seLinuxOptions.level != null ? str(seLinuxOptions.level) : undefined,
      seLinuxRole: seLinuxOptions.role != null ? str(seLinuxOptions.role) : undefined,
      seLinuxType: seLinuxOptions.type != null ? str(seLinuxOptions.type) : undefined,
      seLinuxUser: seLinuxOptions.user != null ? str(seLinuxOptions.user) : undefined,
    },
    Lifecycle: {
      postStart: parseLifecycleHandler(lc.postStart),
      preStop: parseLifecycleHandler(lc.preStop),
    },
    TerminationMessagePath: str(c.terminationMessagePath),
    TerminationMessagePolicy: str(c.terminationMessagePolicy) === 'FallbackToLogsOnError' ? 'FallbackToLogsOnError' : 'File',
  }
}

function parseDeployment(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  const spec = (doc.spec ?? {}) as Record<string, unknown>
  const template = (spec.template ?? {}) as Record<string, unknown>
  const tmplMeta = (template.metadata ?? {}) as Record<string, unknown>
  const tmplSpec = (template.spec ?? {}) as Record<string, unknown>
  const strategy = (spec.strategy ?? {}) as Record<string, unknown>
  const rollingUpdate = (strategy.rollingUpdate ?? {}) as Record<string, unknown>

  const containers: ContainerSpec[] = Array.isArray(tmplSpec.containers)
    ? (tmplSpec.containers as Record<string, unknown>[]).map((container) => parseContainer(container, false))
    : []
  const initContainers: ContainerSpec[] = Array.isArray(tmplSpec.initContainers)
    ? (tmplSpec.initContainers as Record<string, unknown>[]).map((container) => parseContainer(container, true))
    : []

  const volumes: VolumeSpec[] = Array.isArray(tmplSpec.volumes)
    ? (tmplSpec.volumes as Record<string, unknown>[]).map((v) => {
        let type = 'EmptyDir'
        let ref = ''
        let resourceNameMode: VolumeSpec['ResourceNameMode'] | undefined
        let items: VolumeSpec['Items'] = []
        if (v.configMap) {
          type = 'ConfigMap'
          const configMap = v.configMap as Record<string, unknown>
          ref = str(configMap.name)
          resourceNameMode = 'CustomResource'
          items = Array.isArray(configMap.items)
            ? (configMap.items as Record<string, unknown>[]).map((item) => ({ key: str(item.key), path: str(item.path) }))
            : []
        }
        else if (v.secret) {
          type = 'Secret'
          const secret = v.secret as Record<string, unknown>
          ref = str(secret.secretName)
          items = Array.isArray(secret.items)
            ? (secret.items as Record<string, unknown>[]).map((item) => ({ key: str(item.key), path: str(item.path) }))
            : []
        }
        else if (v.persistentVolumeClaim) { type = 'PVC'; ref = str((v.persistentVolumeClaim as Record<string, unknown>).claimName) }
        else if (v.hostPath) { type = 'HostPath'; ref = str((v.hostPath as Record<string, unknown>).path) }
        return { Name: str(v.name), Type: type, ReferenceName: ref, ResourceNameMode: resourceNameMode, Items: items }
      })
    : []

  const tolerations = Array.isArray(tmplSpec.tolerations)
    ? (tmplSpec.tolerations as Record<string, unknown>[]).map((t) => {
        const operator = str(t.operator) || 'Equal'
        const isExistsOperator = operator.trim().toLowerCase() === 'exists'
        return {
          key: str(t.key),
          operator,
          value: isExistsOperator ? '' : str(t.value),
          effect: str(t.effect),
        }
      })
    : []

  const imagePullSecrets = Array.isArray(tmplSpec.imagePullSecrets)
    ? (tmplSpec.imagePullSecrets as Record<string, unknown>[]).map((s) => ({ name: str(s.name) }))
    : []
  const hostAliases = Array.isArray(tmplSpec.hostAliases)
    ? (tmplSpec.hostAliases as Record<string, unknown>[]).map((alias) => ({
        ip: str(alias.ip),
        hostnames: Array.isArray(alias.hostnames)
          ? (alias.hostnames as unknown[]).map((hostname) => str(hostname)).filter((hostname) => hostname.trim()).join(' ')
          : '',
      }))
    : []

  const podSc = (tmplSpec.securityContext ?? {}) as Record<string, unknown>
  const seLinux = (podSc.seLinuxOptions ?? {}) as Record<string, unknown>
  const sysctls = Array.isArray(podSc.sysctls)
    ? (podSc.sysctls as Record<string, unknown>[]).map((s) => ({ name: str(s.name), value: str(s.value) }))
    : []
  const supplementalGroups = Array.isArray(podSc.supplementalGroups)
    ? (podSc.supplementalGroups as unknown[]).map((g) => str(g)).filter((v) => v.trim()).join(', ')
    : ''

  const dnsConfig = (tmplSpec.dnsConfig ?? {}) as Record<string, unknown>
  const dnsNameservers = Array.isArray(dnsConfig.nameservers)
    ? (dnsConfig.nameservers as unknown[]).map((item) => str(item)).filter((v) => v.trim()).join('\n')
    : ''
  const dnsSearches = Array.isArray(dnsConfig.searches)
    ? (dnsConfig.searches as unknown[]).map((item) => str(item)).filter((v) => v.trim()).join('\n')
    : ''
  const dnsConfigOptions = Array.isArray(dnsConfig.options)
    ? (dnsConfig.options as Record<string, unknown>[]).map((o) => ({ name: str(o.name), value: str(o.value) }))
    : []
  const podReadinessGates = Array.isArray(tmplSpec.readinessGates)
    ? (tmplSpec.readinessGates as Record<string, unknown>[])
        .map((gate) => str(gate.conditionType))
        .filter((v) => v.trim())
        .join('\n')
    : ''

  const strategyType = str(strategy.type)
  const affinity = (tmplSpec.affinity ?? {}) as Record<string, unknown>
  const nodeAffinity = affinity.nodeAffinity ? JSON.stringify(affinity.nodeAffinity) : ''
  const podAffinity = affinity.podAffinity ? JSON.stringify(affinity.podAffinity) : ''
  const podAntiAffinity = affinity.podAntiAffinity ? JSON.stringify(affinity.podAntiAffinity) : ''

  return {
    resourceType: str(doc.kind) || 'Deployment',
    deploymentName: str(meta.name),
    namespace: str(meta.namespace) || 'default',
    replicas: spec.replicas != null ? str(spec.replicas) : '1',
    revisionHistoryLimit: spec.revisionHistoryLimit != null ? str(spec.revisionHistoryLimit) : '',
    progressDeadlineSeconds: spec.progressDeadlineSeconds != null ? str(spec.progressDeadlineSeconds) : '',
    podTerminationGracePeriodSeconds: tmplSpec.terminationGracePeriodSeconds != null ? str(tmplSpec.terminationGracePeriodSeconds) : '',
    podPriorityClassName: tmplSpec.priorityClassName != null ? str(tmplSpec.priorityClassName) : '',
    podRestartPolicy: tmplSpec.restartPolicy != null ? str(tmplSpec.restartPolicy) : 'Always',
    podDnsPolicy: tmplSpec.dnsPolicy != null ? str(tmplSpec.dnsPolicy) : 'ClusterFirst',
    podDnsNameservers: dnsNameservers,
    podDnsSearches: dnsSearches,
    podReadinessGates,
    serviceAccountName: tmplSpec.serviceAccountName != null ? str(tmplSpec.serviceAccountName) : '',
    podHostNetworking: tmplSpec.hostNetwork === true ? 'True' : 'False',
    podSecurityFsGroup: podSc.fsGroup != null ? str(podSc.fsGroup) : '',
    podSecurityRunAsGroup: podSc.runAsGroup != null ? str(podSc.runAsGroup) : '',
    podSecurityRunAsUser: podSc.runAsUser != null ? str(podSc.runAsUser) : '',
    podSecuritySupplementalGroups: supplementalGroups,
    podSecurityRunAsNonRoot: podSc.runAsNonRoot === true ? 'True' : podSc.runAsNonRoot === false ? 'False' : '',
    podSecuritySeLinuxLevel: seLinux.level != null ? str(seLinux.level) : '',
    podSecuritySeLinuxRole: seLinux.role != null ? str(seLinux.role) : '',
    podSecuritySeLinuxType: seLinux.type != null ? str(seLinux.type) : '',
    podSecuritySeLinuxUser: seLinux.user != null ? str(seLinux.user) : '',
    deploymentLabels: mapToKv(meta.labels),
    deploymentAnnotations: mapToKv(meta.annotations),
    podAnnotations: mapToKv(tmplMeta.annotations),
    deploymentStyle: strategyType || 'RollingUpdate',
    maxUnavailable: rollingUpdate.maxUnavailable != null ? str(rollingUpdate.maxUnavailable) : '',
    maxSurge: rollingUpdate.maxSurge != null ? str(rollingUpdate.maxSurge) : '',
    containers: [...initContainers, ...containers],
    volumes,
    tolerations,
    hostAliases,
    nodeAffinity,
    podAffinity,
    podAntiAffinity,
    imagePullSecrets,
    sysctls,
    dnsConfigOptions,
  }
}

function parseService(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  const spec = (doc.spec ?? {}) as Record<string, unknown>

  const servicePorts: ServicePort[] = Array.isArray(spec.ports)
    ? (spec.ports as Record<string, unknown>[]).map((p) => ({
        name: str(p.name),
        port: str(p.port),
        targetPort: str(p.targetPort),
        nodePort: str(p.nodePort),
        protocol: str(p.protocol) || 'TCP',
      }))
    : []

  return {
    namespace: str(meta.namespace),
    serviceName: str(meta.name),
    serviceType: str(spec.type) || 'ClusterIP',
    serviceClusterIp: str(spec.clusterIP),
    serviceAnnotations: mapToKv(meta.annotations),
    servicePorts,
  }
}

function parseIngress(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  const spec = (doc.spec ?? {}) as Record<string, unknown>

  const ingressRules: IngressRule[] = Array.isArray(spec.rules)
    ? (spec.rules as Record<string, unknown>[]).map((rule) => {
        const http = (rule.http ?? {}) as Record<string, unknown>
        const paths = Array.isArray(http.paths)
          ? (http.paths as Record<string, unknown>[]).map((path) => {
              const backend = (path.backend ?? {}) as Record<string, unknown>
              const service = (backend.service ?? {}) as Record<string, unknown>
              const port = (service.port ?? {}) as Record<string, unknown>
              return {
                path: str(path.path) || '/',
                pathType: str(path.pathType) || 'Prefix',
                backend: {
                  serviceName: str(service.name),
                  servicePort: str(port.number || port.name),
                },
              }
            })
          : []
        return {
          host: str(rule.host),
          paths,
        }
      })
    : []

  const ingressTls: IngressTls[] = Array.isArray(spec.tls)
    ? (spec.tls as Record<string, unknown>[]).map((tls) => ({
        hosts: Array.isArray(tls.hosts) ? (tls.hosts as unknown[]).map((host) => str(host)).filter((host) => host.trim()) : [],
        secretName: str(tls.secretName),
      }))
    : []

  return {
    namespace: str(meta.namespace),
    ingressName: str(meta.name),
    ingressClassName: str(spec.ingressClassName),
    ingressAnnotations: mapToKv(meta.annotations),
    ingressRules,
    ingressTls,
  }
}

function parseConfigMap(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  return {
    namespace: str(meta.namespace),
    configMapName: str(meta.name),
    configMapValues: mapToKv(doc.data),
  }
}

function parseSecret(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  return {
    namespace: str(meta.namespace),
    secretName: str(meta.name),
    secretValues: mapToKv(doc.stringData ?? doc.data),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseYamlToState(yamlText: string): Partial<ContainersEditorState> {
  const docs: Record<string, unknown>[] = []

  loadAll(yamlText, (doc) => {
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      docs.push(doc as Record<string, unknown>)
    }
  })

  let result: Partial<ContainersEditorState> = {}

  for (const doc of docs) {
    const kind = str(doc.kind)
    if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet' || kind === 'Job') {
      result = { ...result, ...parseDeployment(doc) }
    } else if (kind === 'Service') {
      result = { ...result, ...parseService(doc) }
    } else if (kind === 'Ingress') {
      result = { ...result, ...parseIngress(doc) }
    } else if (kind === 'ConfigMap') {
      result = { ...result, ...parseConfigMap(doc) }
    } else if (kind === 'Secret') {
      result = { ...result, ...parseSecret(doc) }
    }
  }

  if (Array.isArray(result.volumes)) {
    const configMapName = (result.configMapName ?? '').trim()
    result.volumes = result.volumes.map((volume) => {
      if (volume.Type !== 'ConfigMap') return volume
      if (volume.ResourceNameMode) return volume
      const referenceName = (volume.ReferenceName ?? '').trim()
      const inferredMode: VolumeSpec['ResourceNameMode'] =
        configMapName && referenceName === configMapName ? 'LinkedResource' : 'CustomResource'
      return { ...volume, ResourceNameMode: inferredMode }
    })
  }

  return result
}
