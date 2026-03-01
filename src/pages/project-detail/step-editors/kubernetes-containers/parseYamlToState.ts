import { load, loadAll } from 'js-yaml'
import type { ContainersEditorState, ContainerSpec, ProbeConfig, VolumeSpec, ServicePort } from './types'
import type { KeyValueItem } from '../shared/KeyValueListEditor'

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function mapToKv(obj: unknown): KeyValueItem[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.entries(obj as Record<string, unknown>).map(([key, value]) => ({ key, value: str(value) }))
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
    probe.httpGet = { path: str(hg.path), port: str(hg.port), scheme: str(hg.scheme) || 'HTTP' }
  } else if (p.tcpSocket && typeof p.tcpSocket === 'object') {
    const ts = p.tcpSocket as Record<string, unknown>
    probe.type = 'tcpSocket'
    probe.tcpSocket = { port: str(ts.port) }
  } else if (p.exec && typeof p.exec === 'object') {
    const ex = p.exec as Record<string, unknown>
    probe.type = 'exec'
    const cmd = Array.isArray(ex.command) ? (ex.command as unknown[]).join(' ') : str(ex.command)
    probe.exec = { command: cmd }
  }

  return probe
}

function parseContainer(c: Record<string, unknown>): ContainerSpec {
  const ports = Array.isArray(c.ports)
    ? (c.ports as Record<string, unknown>[]).map((p) => ({
        key: str(p.name),
        value: str(p.containerPort),
        option: str(p.protocol) || 'TCP',
      }))
    : []

  const res = (c.resources ?? {}) as Record<string, unknown>
  const req = (res.requests ?? {}) as Record<string, unknown>
  const lim = (res.limits ?? {}) as Record<string, unknown>

  const mounts = Array.isArray(c.volumeMounts)
    ? (c.volumeMounts as Record<string, unknown>[]).map((m) => ({
        key: str(m.name),
        value: str(m.mountPath),
        option: str(m.subPath),
      }))
    : []

  const envFrom = Array.isArray(c.envFrom)
    ? (c.envFrom as Record<string, unknown>[])
        .filter((e) => e.configMapRef && typeof e.configMapRef === 'object')
        .map((e) => ({ key: str((e.configMapRef as Record<string, unknown>).name) }))
    : []

  const sc = (c.securityContext ?? {}) as Record<string, unknown>

  const lc = (c.lifecycle ?? {}) as Record<string, unknown>
  const postCmd = (lc.postStart as Record<string, unknown> | undefined)?.exec
  const preCmd = (lc.preStop as Record<string, unknown> | undefined)?.exec

  return {
    Name: str(c.name),
    Image: str(c.image),
    PackageId: '',
    CreateFeedSecrets: 'False',
    IsInitContainer: 'False',
    Ports: ports,
    Resources: {
      requests: { cpu: str(req.cpu), memory: str(req.memory) },
      limits: { cpu: str(lim.cpu), memory: str(lim.memory) },
    },
    VolumeMounts: mounts,
    ConfigMapEnvFromSource: envFrom,
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
    },
    Lifecycle: {
      postStart: postCmd ? { type: 'exec', command: Array.isArray((postCmd as Record<string, unknown>).command) ? ((postCmd as Record<string, unknown>).command as unknown[]).join(' ') : str((postCmd as Record<string, unknown>).command) } : undefined,
      preStop: preCmd ? { type: 'exec', command: Array.isArray((preCmd as Record<string, unknown>).command) ? ((preCmd as Record<string, unknown>).command as unknown[]).join(' ') : str((preCmd as Record<string, unknown>).command) } : undefined,
    },
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
    ? (tmplSpec.containers as Record<string, unknown>[]).map(parseContainer)
    : []

  const volumes: VolumeSpec[] = Array.isArray(tmplSpec.volumes)
    ? (tmplSpec.volumes as Record<string, unknown>[]).map((v) => {
        let type = 'EmptyDir'
        let ref = ''
        if (v.configMap) { type = 'ConfigMap'; ref = str((v.configMap as Record<string, unknown>).name) }
        else if (v.secret) { type = 'Secret'; ref = str((v.secret as Record<string, unknown>).secretName) }
        else if (v.persistentVolumeClaim) { type = 'PVC'; ref = str((v.persistentVolumeClaim as Record<string, unknown>).claimName) }
        else if (v.hostPath) { type = 'HostPath'; ref = str((v.hostPath as Record<string, unknown>).path) }
        return { Name: str(v.name), Type: type, ReferenceName: ref }
      })
    : []

  const tolerations = Array.isArray(tmplSpec.tolerations)
    ? (tmplSpec.tolerations as Record<string, unknown>[]).map((t) => ({
        key: str(t.key),
        operator: str(t.operator) || 'Equal',
        value: str(t.value),
        effect: str(t.effect),
      }))
    : []

  const imagePullSecrets = Array.isArray(tmplSpec.imagePullSecrets)
    ? (tmplSpec.imagePullSecrets as Record<string, unknown>[]).map((s) => ({ name: str(s.name) }))
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
    containers,
    volumes,
    tolerations,
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
    serviceName: str(meta.name),
    serviceType: str(spec.type) || 'ClusterIP',
    serviceClusterIp: str(spec.clusterIP),
    servicePorts,
  }
}

function parseConfigMap(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  return {
    configMapName: str(meta.name),
    configMapValues: mapToKv(doc.data),
  }
}

function parseSecret(doc: Record<string, unknown>): Partial<ContainersEditorState> {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>
  return {
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
    } else if (kind === 'ConfigMap') {
      result = { ...result, ...parseConfigMap(doc) }
    } else if (kind === 'Secret') {
      result = { ...result, ...parseSecret(doc) }
    }
  }

  return result
}
