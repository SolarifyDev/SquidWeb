import type { ContainersEditorState, ContainerSpec, ProbeConfig } from './types'
import type { KeyValueItem } from '../shared/KeyValueListEditor'

// ── Helpers ──────────────────────────────────────────────────────────────────

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map((line) => (line.trim() ? pad + line : line)).join('\n')
}

function kvToMap(items: KeyValueItem[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const item of items) {
    if (item.key.trim()) map[item.key] = item.value
  }
  return map
}

function emitMap(map: Record<string, string>, indentLevel: number): string {
  const entries = Object.entries(map)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${' '.repeat(indentLevel)}${k}: "${v}"`).join('\n')
}

function emitMapLiteral(map: Record<string, string>, indentLevel: number): string {
  const entries = Object.entries(map)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => {
    if (v.includes('\n')) {
      return `${' '.repeat(indentLevel)}${k}: |\n${indent(v, indentLevel + 2)}`
    }
    return `${' '.repeat(indentLevel)}${k}: ${v}`
  }).join('\n')
}

function tryParseJson(value: string): unknown | null {
  if (!value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function jsonToYaml(obj: unknown, level: number): string {
  const pad = ' '.repeat(level)
  if (obj == null) return ''
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
  if (Array.isArray(obj)) {
    return obj.map((item) => {
      const inner = jsonToYaml(item, level + 2)
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const lines = inner.split('\n')
        return `${pad}- ${lines[0].trim()}\n${lines.slice(1).map((l) => `${pad}  ${l.trim() ? l.trimStart() : l}`).join('\n')}`
      }
      return `${pad}- ${inner}`
    }).join('\n')
  }
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${pad}${k}:\n${jsonToYaml(v, level + 2)}`
      }
      return `${pad}${k}: ${jsonToYaml(v, level + 2)}`
    }).join('\n')
  }
  return String(obj)
}

// ── Probe YAML ───────────────────────────────────────────────────────────────

function emitProbe(probe: ProbeConfig, indentLevel: number): string | null {
  if (!probe.type) return null
  const pad = ' '.repeat(indentLevel)
  const lines: string[] = []

  if (probe.type === 'httpGet' && probe.httpGet) {
    lines.push(`${pad}httpGet:`)
    lines.push(`${pad}  path: ${probe.httpGet.path || '/'}`)
    lines.push(`${pad}  port: ${probe.httpGet.port || '80'}`)
    if (probe.httpGet.scheme && probe.httpGet.scheme !== 'HTTP') {
      lines.push(`${pad}  scheme: ${probe.httpGet.scheme}`)
    }
  } else if (probe.type === 'tcpSocket' && probe.tcpSocket) {
    lines.push(`${pad}tcpSocket:`)
    lines.push(`${pad}  port: ${probe.tcpSocket.port || '80'}`)
  } else if (probe.type === 'exec' && probe.exec?.command) {
    lines.push(`${pad}exec:`)
    lines.push(`${pad}  command:`)
    for (const part of probe.exec.command.split(/\s+/)) {
      lines.push(`${pad}    - ${part}`)
    }
  }

  if (probe.initialDelaySeconds) lines.push(`${pad}initialDelaySeconds: ${probe.initialDelaySeconds}`)
  if (probe.periodSeconds) lines.push(`${pad}periodSeconds: ${probe.periodSeconds}`)
  if (probe.timeoutSeconds) lines.push(`${pad}timeoutSeconds: ${probe.timeoutSeconds}`)
  if (probe.successThreshold) lines.push(`${pad}successThreshold: ${probe.successThreshold}`)
  if (probe.failureThreshold) lines.push(`${pad}failureThreshold: ${probe.failureThreshold}`)

  return lines.length > 0 ? lines.join('\n') : null
}

// ── Container YAML ───────────────────────────────────────────────────────────

function emitContainer(container: ContainerSpec, indentLevel: number): string {
  const pad = ' '.repeat(indentLevel)
  const lines: string[] = []

  lines.push(`${pad}- name: ${container.Name || 'unnamed'}`)
  lines.push(`${pad}  image: ${container.Image || 'nginx:latest'}`)

  // Ports
  const ports = container.Ports.filter((p) => p.value)
  if (ports.length > 0) {
    lines.push(`${pad}  ports:`)
    for (const port of ports) {
      lines.push(`${pad}    - containerPort: ${port.value}`)
      if (port.key) lines.push(`${pad}      name: ${port.key}`)
      if (port.option && port.option !== 'TCP') lines.push(`${pad}      protocol: ${port.option}`)
    }
  }

  // Resources
  const hasRequests = container.Resources.requests.cpu || container.Resources.requests.memory
  const hasLimits = container.Resources.limits.cpu || container.Resources.limits.memory
  if (hasRequests || hasLimits) {
    lines.push(`${pad}  resources:`)
    if (hasRequests) {
      lines.push(`${pad}    requests:`)
      if (container.Resources.requests.cpu) lines.push(`${pad}      cpu: "${container.Resources.requests.cpu}"`)
      if (container.Resources.requests.memory) lines.push(`${pad}      memory: "${container.Resources.requests.memory}"`)
    }
    if (hasLimits) {
      lines.push(`${pad}    limits:`)
      if (container.Resources.limits.cpu) lines.push(`${pad}      cpu: "${container.Resources.limits.cpu}"`)
      if (container.Resources.limits.memory) lines.push(`${pad}      memory: "${container.Resources.limits.memory}"`)
    }
  }

  // Volume mounts
  const mounts = container.VolumeMounts.filter((m) => m.key || m.value)
  if (mounts.length > 0) {
    lines.push(`${pad}  volumeMounts:`)
    for (const mount of mounts) {
      lines.push(`${pad}    - name: ${mount.key}`)
      lines.push(`${pad}      mountPath: ${mount.value}`)
      if (mount.option) lines.push(`${pad}      subPath: ${mount.option}`)
    }
  }

  // Env from ConfigMap
  const envFrom = container.ConfigMapEnvFromSource.filter((s) => s.key)
  if (envFrom.length > 0) {
    lines.push(`${pad}  envFrom:`)
    for (const src of envFrom) {
      lines.push(`${pad}    - configMapRef:`)
      lines.push(`${pad}        name: ${src.key}`)
    }
  }

  // Probes
  const livenessYaml = emitProbe(container.LivenessProbe, indentLevel + 4)
  if (livenessYaml) {
    lines.push(`${pad}  livenessProbe:`)
    lines.push(livenessYaml)
  }

  const readinessYaml = emitProbe(container.ReadinessProbe, indentLevel + 4)
  if (readinessYaml) {
    lines.push(`${pad}  readinessProbe:`)
    lines.push(readinessYaml)
  }

  const startupYaml = emitProbe(container.StartupProbe, indentLevel + 4)
  if (startupYaml) {
    lines.push(`${pad}  startupProbe:`)
    lines.push(startupYaml)
  }

  // Security context
  const sc = container.SecurityContext
  const scEntries: string[] = []
  if (sc.runAsUser) scEntries.push(`${pad}      runAsUser: ${sc.runAsUser}`)
  if (sc.runAsGroup) scEntries.push(`${pad}      runAsGroup: ${sc.runAsGroup}`)
  if (sc.runAsNonRoot === 'True') scEntries.push(`${pad}      runAsNonRoot: true`)
  if (sc.readOnlyRootFilesystem === 'True') scEntries.push(`${pad}      readOnlyRootFilesystem: true`)
  if (sc.privileged === 'True') scEntries.push(`${pad}      privileged: true`)
  if (sc.allowPrivilegeEscalation === 'True') scEntries.push(`${pad}      allowPrivilegeEscalation: true`)
  if (scEntries.length > 0) {
    lines.push(`${pad}  securityContext:`)
    lines.push(...scEntries)
  }

  // Lifecycle
  if (container.Lifecycle.postStart?.command || container.Lifecycle.preStop?.command) {
    lines.push(`${pad}  lifecycle:`)
    if (container.Lifecycle.postStart?.command) {
      lines.push(`${pad}    postStart:`)
      lines.push(`${pad}      exec:`)
      lines.push(`${pad}        command:`)
      for (const part of container.Lifecycle.postStart.command.split(/\s+/)) {
        lines.push(`${pad}          - ${part}`)
      }
    }
    if (container.Lifecycle.preStop?.command) {
      lines.push(`${pad}    preStop:`)
      lines.push(`${pad}      exec:`)
      lines.push(`${pad}        command:`)
      for (const part of container.Lifecycle.preStop.command.split(/\s+/)) {
        lines.push(`${pad}          - ${part}`)
      }
    }
  }

  return lines.join('\n')
}

// ── Public generators ────────────────────────────────────────────────────────

export function generateDeploymentYaml(state: ContainersEditorState): string {
  const resourceType = state.resourceType || 'Deployment'
  const deploymentName = state.deploymentName || 'my-deployment'
  const namespace = state.namespace || 'default'
  const replicas = state.replicas || '1'
  const labels = kvToMap(state.deploymentLabels)
  const annotations = kvToMap(state.deploymentAnnotations)
  const podAnnotations = kvToMap(state.podAnnotations)

  // Default selector label if no labels provided
  const selectorLabels = Object.keys(labels).length > 0 ? labels : { app: deploymentName }

  const apiVersion = resourceType === 'Job' ? 'batch/v1' : 'apps/v1'
  const lines: string[] = []

  lines.push(`apiVersion: ${apiVersion}`)
  lines.push(`kind: ${resourceType}`)
  lines.push('metadata:')
  lines.push(`  name: ${deploymentName}`)
  lines.push(`  namespace: ${namespace}`)
  if (Object.keys(labels).length > 0) {
    lines.push('  labels:')
    lines.push(emitMap(labels, 4))
  }
  if (Object.keys(annotations).length > 0) {
    lines.push('  annotations:')
    lines.push(emitMap(annotations, 4))
  }

  lines.push('spec:')
  lines.push(`  replicas: ${replicas}`)
  if (state.revisionHistoryLimit) lines.push(`  revisionHistoryLimit: ${state.revisionHistoryLimit}`)
  if (state.progressDeadlineSeconds) lines.push(`  progressDeadlineSeconds: ${state.progressDeadlineSeconds}`)
  lines.push('  selector:')
  lines.push('    matchLabels:')
  lines.push(emitMap(selectorLabels, 6))
  const strategyType = state.deploymentStyle === 'BlueGreen' ? 'RollingUpdate' : (state.deploymentStyle || 'RollingUpdate')
  lines.push(`  strategy:`)
  lines.push(`    type: ${strategyType}`)
  if (strategyType === 'RollingUpdate' && (state.maxUnavailable || state.maxSurge)) {
    lines.push(`    rollingUpdate:`)
    if (state.maxUnavailable) lines.push(`      maxUnavailable: ${state.maxUnavailable}`)
    if (state.maxSurge) lines.push(`      maxSurge: ${state.maxSurge}`)
  }
  lines.push('  template:')
  lines.push('    metadata:')
  lines.push('      labels:')
  lines.push(emitMap(selectorLabels, 8))
  if (Object.keys(podAnnotations).length > 0) {
    lines.push('      annotations:')
    lines.push(emitMap(podAnnotations, 8))
  }
  lines.push('    spec:')

  // Pod termination grace period
  if (state.podTerminationGracePeriodSeconds) lines.push(`      terminationGracePeriodSeconds: ${state.podTerminationGracePeriodSeconds}`)

  // Volumes
  const vols = state.volumes.filter((v) => v.Name)
  if (vols.length > 0) {
    lines.push('      volumes:')
    for (const vol of vols) {
      lines.push(`        - name: ${vol.Name}`)
      if (vol.Type === 'ConfigMap') {
        lines.push(`          configMap:`)
        lines.push(`            name: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'Secret') {
        lines.push(`          secret:`)
        lines.push(`            secretName: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'EmptyDir') {
        lines.push(`          emptyDir: {}`)
      } else if (vol.Type === 'PVC') {
        lines.push(`          persistentVolumeClaim:`)
        lines.push(`            claimName: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'HostPath') {
        lines.push(`          hostPath:`)
        lines.push(`            path: ${vol.ReferenceName || '/'}`)
      }
    }
  }

  // Tolerations
  const tolerations = state.tolerations.filter((t) => t.key)
  if (tolerations.length > 0) {
    lines.push('      tolerations:')
    for (const tol of tolerations) {
      lines.push(`        - key: ${tol.key}`)
      lines.push(`          operator: ${tol.operator || 'Equal'}`)
      if (tol.value) lines.push(`          value: "${tol.value}"`)
      if (tol.effect) lines.push(`          effect: ${tol.effect}`)
    }
  }

  // Affinity
  const nodeAffinity = tryParseJson(state.nodeAffinity)
  const podAffinity = tryParseJson(state.podAffinity)
  const podAntiAffinity = tryParseJson(state.podAntiAffinity)
  if (nodeAffinity || podAffinity || podAntiAffinity) {
    lines.push('      affinity:')
    if (nodeAffinity) {
      lines.push('        nodeAffinity:')
      lines.push(jsonToYaml(nodeAffinity, 10))
    }
    if (podAffinity) {
      lines.push('        podAffinity:')
      lines.push(jsonToYaml(podAffinity, 10))
    }
    if (podAntiAffinity) {
      lines.push('        podAntiAffinity:')
      lines.push(jsonToYaml(podAntiAffinity, 10))
    }
  }

  // DNS config
  const dnsOpts = state.dnsConfigOptions.filter((d) => d.name)
  if (dnsOpts.length > 0) {
    lines.push('      dnsConfig:')
    lines.push('        options:')
    for (const opt of dnsOpts) {
      lines.push(`          - name: ${opt.name}`)
      if (opt.value) lines.push(`            value: "${opt.value}"`)
    }
  }

  // Pod security context (sysctls)
  const sysctls = state.sysctls.filter((s) => s.name)
  if (sysctls.length > 0) {
    lines.push('      securityContext:')
    lines.push('        sysctls:')
    for (const sysctl of sysctls) {
      lines.push(`          - name: ${sysctl.name}`)
      lines.push(`            value: "${sysctl.value}"`)
    }
  }

  // Image pull secrets
  const pullSecrets = state.imagePullSecrets.filter((s) => s.name)
  if (pullSecrets.length > 0) {
    lines.push('      imagePullSecrets:')
    for (const secret of pullSecrets) {
      lines.push(`        - name: ${secret.name}`)
    }
  }

  // Containers
  if (state.containers.length > 0) {
    lines.push('      containers:')
    for (const container of state.containers) {
      lines.push(emitContainer(container, 6))
    }
  } else {
    lines.push('      containers: []')
  }

  return lines.filter((l) => l !== '').join('\n')
}

export function generateServiceYaml(state: ContainersEditorState): string | null {
  if (!state.serviceName) return null

  const ports = state.servicePorts.filter((p) => p.port)
  if (ports.length === 0) return null

  const deploymentName = state.deploymentName || 'my-deployment'
  const namespace = state.namespace || 'default'
  const labels = kvToMap(state.deploymentLabels)
  const selectorLabels = Object.keys(labels).length > 0 ? labels : { app: deploymentName }

  const lines: string[] = []
  lines.push('apiVersion: v1')
  lines.push('kind: Service')
  lines.push('metadata:')
  lines.push(`  name: ${state.serviceName}`)
  lines.push(`  namespace: ${namespace}`)
  lines.push('spec:')
  lines.push(`  type: ${state.serviceType || 'ClusterIP'}`)
  lines.push('  selector:')
  lines.push(emitMap(selectorLabels, 4))
  lines.push('  ports:')
  for (const port of ports) {
    lines.push(`    - port: ${port.port}`)
    if (port.name) lines.push(`      name: ${port.name}`)
    if (port.targetPort) lines.push(`      targetPort: ${port.targetPort}`)
    if (port.nodePort && state.serviceType === 'NodePort') lines.push(`      nodePort: ${port.nodePort}`)
    if (port.protocol && port.protocol !== 'TCP') lines.push(`      protocol: ${port.protocol}`)
  }

  return lines.join('\n')
}

export function generateConfigMapYaml(state: ContainersEditorState): string | null {
  if (!state.configMapName) return null

  const data = kvToMap(state.configMapValues)
  if (Object.keys(data).length === 0) return null

  const namespace = state.namespace || 'default'
  const lines: string[] = []
  lines.push('apiVersion: v1')
  lines.push('kind: ConfigMap')
  lines.push('metadata:')
  lines.push(`  name: ${state.configMapName}`)
  lines.push(`  namespace: ${namespace}`)
  lines.push('data:')
  lines.push(emitMapLiteral(data, 2))

  return lines.join('\n')
}

export function generateSecretYaml(state: ContainersEditorState): string | null {
  if (!state.secretName) return null

  const data = kvToMap(state.secretValues)
  if (Object.keys(data).length === 0) return null

  const namespace = state.namespace || 'default'
  const lines: string[] = []
  lines.push('apiVersion: v1')
  lines.push('kind: Secret')
  lines.push('metadata:')
  lines.push(`  name: ${state.secretName}`)
  lines.push(`  namespace: ${namespace}`)
  lines.push('type: Opaque')
  lines.push('stringData:')
  lines.push(emitMapLiteral(data, 2))

  return lines.join('\n')
}

export function generateAllYaml(state: ContainersEditorState): string {
  const parts: string[] = []

  const deployment = generateDeploymentYaml(state)
  if (deployment) parts.push(deployment)

  const service = generateServiceYaml(state)
  if (service) parts.push(service)

  const configMap = generateConfigMapYaml(state)
  if (configMap) parts.push(configMap)

  const secret = generateSecretYaml(state)
  if (secret) parts.push(secret)

  return parts.join('\n---\n')
}
