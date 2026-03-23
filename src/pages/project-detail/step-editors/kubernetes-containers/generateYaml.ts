import type { ContainersEditorState, ContainerSpec, ProbeConfig } from './types'
import type { KeyValueItem } from '../shared/KeyValueListEditor'
import type { ExternalFeedDto } from 'pages/apis/externalFeed'

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
    return `${' '.repeat(indentLevel)}${k}: ${JSON.stringify(v)}`
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

export function getRegistryHost(feed: ExternalFeedDto | null | undefined): string {
  if (!feed) return ''
  if (feed.registryPath) return feed.registryPath
  if (!feed.feedUri) return ''
  try {
    const u = new URL(feed.feedUri)
    return u.port && u.port !== '443' ? `${u.hostname}:${u.port}` : u.hostname
  } catch { return feed.feedUri }
}

// ── Probe YAML ───────────────────────────────────────────────────────────────

function splitCommandParts(command: string): string[] {
  const value = command.trim()
  if (!value) return []
  const newlineParts = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  if (newlineParts.length > 1) return newlineParts
  return value.split(/\s+/).filter(Boolean)
}

function emitStringArrayBlock(lines: string[], indentLevel: number, key: string, values: string[]): void {
  if (values.length === 0) return
  const pad = ' '.repeat(indentLevel)
  lines.push(`${pad}${key}:`)
  for (const value of values) lines.push(`${pad}  - ${JSON.stringify(value)}`)
}

function normalizeResourceKey(key: string): string {
  if (key === 'ephemeralStorage') return 'ephemeral-storage'
  if (key === 'nvidiaGpu') return 'nvidia.com/gpu'
  if (key === 'amdGpu') return 'amd.com/gpu'
  return key
}

function normalizedResources(values: Record<string, string | undefined>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(values ?? {})) {
    const value = String(rawValue ?? '').trim()
    if (!value) continue
    map[normalizeResourceKey(rawKey)] = value
  }
  return map
}

function emitProbe(probe: ProbeConfig, indentLevel: number): string | null {
  if (!probe.type) return null
  const pad = ' '.repeat(indentLevel)
  const lines: string[] = []

  if (probe.type === 'httpGet' && probe.httpGet) {
    lines.push(`${pad}httpGet:`)
    lines.push(`${pad}  path: ${probe.httpGet.path || '/'}`)
    lines.push(`${pad}  port: ${probe.httpGet.port || '80'}`)
    if (probe.httpGet.host?.trim()) lines.push(`${pad}  host: ${JSON.stringify(probe.httpGet.host.trim())}`)
    if (probe.httpGet.scheme && probe.httpGet.scheme !== 'HTTP') {
      lines.push(`${pad}  scheme: ${probe.httpGet.scheme}`)
    }
    const headers = (probe.httpGet.httpHeaders ?? []).filter((header) => header.name?.trim())
    if (headers.length > 0) {
      lines.push(`${pad}  httpHeaders:`)
      for (const header of headers) {
        lines.push(`${pad}    - name: ${JSON.stringify(header.name)}`)
        lines.push(`${pad}      value: ${JSON.stringify(header.value ?? '')}`)
      }
    }
  } else if (probe.type === 'tcpSocket' && probe.tcpSocket) {
    lines.push(`${pad}tcpSocket:`)
    if (probe.tcpSocket.host?.trim()) lines.push(`${pad}  host: ${JSON.stringify(probe.tcpSocket.host.trim())}`)
    lines.push(`${pad}  port: ${probe.tcpSocket.port || '80'}`)
  } else if (probe.type === 'exec' && probe.exec?.command) {
    lines.push(`${pad}exec:`)
    emitStringArrayBlock(lines, indentLevel + 2, 'command', splitCommandParts(probe.exec.command))
  }

  if (probe.initialDelaySeconds) lines.push(`${pad}initialDelaySeconds: ${probe.initialDelaySeconds}`)
  if (probe.periodSeconds) lines.push(`${pad}periodSeconds: ${probe.periodSeconds}`)
  if (probe.timeoutSeconds) lines.push(`${pad}timeoutSeconds: ${probe.timeoutSeconds}`)
  if (probe.successThreshold) lines.push(`${pad}successThreshold: ${probe.successThreshold}`)
  if (probe.failureThreshold) lines.push(`${pad}failureThreshold: ${probe.failureThreshold}`)

  return lines.length > 0 ? lines.join('\n') : null
}

// ── Container YAML ───────────────────────────────────────────────────────────

function resolveContainerImage(container: ContainerSpec, registryHost?: string, statePackageId?: string): string {
  if (container.Image) return container.Image
  const pkgId = container.PackageId || statePackageId
  if (pkgId && registryHost) return `${registryHost}/${pkgId}`
  if (pkgId) return pkgId
  return 'nginx:latest'
}

function emitContainer(container: ContainerSpec, indentLevel: number, registryHost?: string, statePackageId?: string): string {
  const pad = ' '.repeat(indentLevel)
  const lines: string[] = []

  lines.push(`${pad}- name: ${container.Name || 'unnamed'}`)
  lines.push(`${pad}  image: ${resolveContainerImage(container, registryHost, statePackageId)}`)
  if (container.ImagePullPolicy) lines.push(`${pad}  imagePullPolicy: ${container.ImagePullPolicy}`)

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
  const requestResources = normalizedResources(container.Resources.requests)
  const limitResources = normalizedResources(container.Resources.limits)
  const hasRequests = Object.keys(requestResources).length > 0
  const hasLimits = Object.keys(limitResources).length > 0
  if (hasRequests || hasLimits) {
    lines.push(`${pad}  resources:`)
    if (hasRequests) {
      lines.push(`${pad}    requests:`)
      for (const [key, value] of Object.entries(requestResources)) {
        lines.push(`${pad}      ${key}: "${value}"`)
      }
    }
    if (hasLimits) {
      lines.push(`${pad}    limits:`)
      for (const [key, value] of Object.entries(limitResources)) {
        lines.push(`${pad}      ${key}: "${value}"`)
      }
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

  // Container command/args.
  emitStringArrayBlock(lines, indentLevel + 2, 'command', container.Command ?? [])
  emitStringArrayBlock(lines, indentLevel + 2, 'args', container.Args ?? [])

  // EnvFrom (ConfigMap + Secret)
  const configMapEnvFrom = (container.ConfigMapEnvFromSource ?? []).filter((s) => s.key)
  const secretEnvFrom = (container.SecretEnvFromSource ?? []).filter((s) => s.key)
  if (configMapEnvFrom.length > 0 || secretEnvFrom.length > 0) {
    lines.push(`${pad}  envFrom:`)
    for (const src of configMapEnvFrom) {
      lines.push(`${pad}    - configMapRef:`)
      lines.push(`${pad}        name: ${src.key}`)
      if (src.option === 'True') lines.push(`${pad}        optional: true`)
      if (src.option === 'False') lines.push(`${pad}        optional: false`)
      if (src.value) lines.push(`${pad}      prefix: ${JSON.stringify(src.value)}`)
    }
    for (const src of secretEnvFrom) {
      lines.push(`${pad}    - secretRef:`)
      lines.push(`${pad}        name: ${src.key}`)
      if (src.option === 'True') lines.push(`${pad}        optional: true`)
      if (src.option === 'False') lines.push(`${pad}        optional: false`)
      if (src.value) lines.push(`${pad}      prefix: ${JSON.stringify(src.value)}`)
    }
  }

  const envVars = (container.EnvironmentVariables ?? []).filter((v) => v.key)
  const fieldRefEnvVars = (container.FieldRefEnvironmentVariables ?? []).filter((v) => v.key && v.value)
  const configMapEnvVars = (container.ConfigMapEnvironmentVariables ?? []).filter((v) => v.key && v.value && v.option)
  const secretEnvVars = (container.SecretEnvironmentVariables ?? []).filter((v) => v.key && v.value && v.option)
  if (envVars.length > 0 || fieldRefEnvVars.length > 0 || configMapEnvVars.length > 0 || secretEnvVars.length > 0) {
    lines.push(`${pad}  env:`)
    for (const envVar of envVars) {
      lines.push(`${pad}    - name: ${envVar.key}`)
      lines.push(`${pad}      value: ${JSON.stringify(envVar.value ?? '')}`)
    }
    for (const envVar of fieldRefEnvVars) {
      lines.push(`${pad}    - name: ${envVar.key}`)
      lines.push(`${pad}      valueFrom:`)
      lines.push(`${pad}        fieldRef:`)
      lines.push(`${pad}          fieldPath: ${JSON.stringify(envVar.value)}`)
    }
    for (const envVar of configMapEnvVars) {
      lines.push(`${pad}    - name: ${envVar.key}`)
      lines.push(`${pad}      valueFrom:`)
      lines.push(`${pad}        configMapKeyRef:`)
      lines.push(`${pad}          name: ${envVar.value}`)
      lines.push(`${pad}          key: ${envVar.option}`)
      if (envVar.optional === 'True') lines.push(`${pad}          optional: true`)
      if (envVar.optional === 'False') lines.push(`${pad}          optional: false`)
    }
    for (const envVar of secretEnvVars) {
      lines.push(`${pad}    - name: ${envVar.key}`)
      lines.push(`${pad}      valueFrom:`)
      lines.push(`${pad}        secretKeyRef:`)
      lines.push(`${pad}          name: ${envVar.value}`)
      lines.push(`${pad}          key: ${envVar.option}`)
      if (envVar.optional === 'True') lines.push(`${pad}          optional: true`)
      if (envVar.optional === 'False') lines.push(`${pad}          optional: false`)
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

  // Lifecycle
  const emitLifecycleHandler = (handler: ContainerSpec['Lifecycle']['postStart'], handlerIndentLevel: number): string[] => {
    if (!handler || !handler.type) return []
    const handlerPad = ' '.repeat(handlerIndentLevel)
    const lifecycleLines: string[] = []
    if (handler.type === 'exec' && handler.command?.trim()) {
      lifecycleLines.push(`${handlerPad}exec:`)
      emitStringArrayBlock(lifecycleLines, handlerIndentLevel + 2, 'command', splitCommandParts(handler.command))
      return lifecycleLines
    }
    if (handler.type === 'httpGet' && handler.httpGet) {
      lifecycleLines.push(`${handlerPad}httpGet:`)
      lifecycleLines.push(`${handlerPad}  path: ${handler.httpGet.path || '/'}`)
      lifecycleLines.push(`${handlerPad}  port: ${handler.httpGet.port || '80'}`)
      if (handler.httpGet.host?.trim()) lifecycleLines.push(`${handlerPad}  host: ${JSON.stringify(handler.httpGet.host.trim())}`)
      if (handler.httpGet.scheme && handler.httpGet.scheme !== 'HTTP') lifecycleLines.push(`${handlerPad}  scheme: ${handler.httpGet.scheme}`)
      const headers = (handler.httpGet.httpHeaders ?? []).filter((header) => header.name?.trim())
      if (headers.length > 0) {
        lifecycleLines.push(`${handlerPad}  httpHeaders:`)
        for (const header of headers) {
          lifecycleLines.push(`${handlerPad}    - name: ${JSON.stringify(header.name)}`)
          lifecycleLines.push(`${handlerPad}      value: ${JSON.stringify(header.value ?? '')}`)
        }
      }
      return lifecycleLines
    }
    if (handler.type === 'tcpSocket' && handler.tcpSocket?.port) {
      lifecycleLines.push(`${handlerPad}tcpSocket:`)
      if (handler.tcpSocket.host?.trim()) lifecycleLines.push(`${handlerPad}  host: ${JSON.stringify(handler.tcpSocket.host.trim())}`)
      lifecycleLines.push(`${handlerPad}  port: ${handler.tcpSocket.port}`)
      return lifecycleLines
    }
    return []
  }

  if (container.Lifecycle.postStart || container.Lifecycle.preStop) {
    const postStartLines = emitLifecycleHandler(container.Lifecycle.postStart, indentLevel + 4)
    const preStopLines = emitLifecycleHandler(container.Lifecycle.preStop, indentLevel + 4)
    if (postStartLines.length > 0 || preStopLines.length > 0) {
      lines.push(`${pad}  lifecycle:`)
      if (postStartLines.length > 0) {
        lines.push(`${pad}    postStart:`)
        lines.push(...postStartLines)
      }
      if (preStopLines.length > 0) {
        lines.push(`${pad}    preStop:`)
        lines.push(...preStopLines)
      }
    }
  }

  if (container.TerminationMessagePath?.trim()) lines.push(`${pad}  terminationMessagePath: ${container.TerminationMessagePath.trim()}`)
  if ((container.TerminationMessagePolicy || 'File') !== 'File') lines.push(`${pad}  terminationMessagePolicy: ${container.TerminationMessagePolicy}`)

  // Security context
  const sc = container.SecurityContext
  const addedCapabilities = (sc.addCapabilities ?? []).map((cap) => cap.trim()).filter((cap) => cap.length > 0)
  const droppedCapabilities = (sc.dropCapabilities ?? []).map((cap) => cap.trim()).filter((cap) => cap.length > 0)
  const hasSeLinuxOptions = Boolean(sc.seLinuxLevel || sc.seLinuxRole || sc.seLinuxType || sc.seLinuxUser)
  const scEntries: string[] = []
  if (sc.runAsUser) scEntries.push(`${pad}      runAsUser: ${sc.runAsUser}`)
  if (sc.runAsGroup) scEntries.push(`${pad}      runAsGroup: ${sc.runAsGroup}`)
  if (sc.runAsNonRoot === 'True') scEntries.push(`${pad}      runAsNonRoot: true`)
  if (sc.readOnlyRootFilesystem === 'True') scEntries.push(`${pad}      readOnlyRootFilesystem: true`)
  if (sc.privileged === 'True') scEntries.push(`${pad}      privileged: true`)
  if (sc.allowPrivilegeEscalation === 'True') scEntries.push(`${pad}      allowPrivilegeEscalation: true`)
  if (addedCapabilities.length > 0 || droppedCapabilities.length > 0) {
    scEntries.push(`${pad}      capabilities:`)
    if (addedCapabilities.length > 0) {
      scEntries.push(`${pad}        add:`)
      for (const capability of addedCapabilities) scEntries.push(`${pad}          - ${capability}`)
    }
    if (droppedCapabilities.length > 0) {
      scEntries.push(`${pad}        drop:`)
      for (const capability of droppedCapabilities) scEntries.push(`${pad}          - ${capability}`)
    }
  }
  if (hasSeLinuxOptions) {
    scEntries.push(`${pad}      seLinuxOptions:`)
    if (sc.seLinuxLevel) scEntries.push(`${pad}        level: ${JSON.stringify(sc.seLinuxLevel)}`)
    if (sc.seLinuxRole) scEntries.push(`${pad}        role: ${JSON.stringify(sc.seLinuxRole)}`)
    if (sc.seLinuxType) scEntries.push(`${pad}        type: ${JSON.stringify(sc.seLinuxType)}`)
    if (sc.seLinuxUser) scEntries.push(`${pad}        user: ${JSON.stringify(sc.seLinuxUser)}`)
  }
  if (scEntries.length > 0) {
    lines.push(`${pad}  securityContext:`)
    lines.push(...scEntries)
  }

  return lines.join('\n')
}

// ── Public generators ────────────────────────────────────────────────────────

function appendPodTemplate(
  lines: string[],
  state: ContainersEditorState,
  selectorLabels: Record<string, string>,
  templateIndent: number,
  registryHost?: string,
): void {
  const podAnnotations = kvToMap(state.podAnnotations)
  const at = (offset: number) => ' '.repeat(templateIndent + offset)

  lines.push(`${at(0)}template:`)
  lines.push(`${at(2)}metadata:`)
  lines.push(`${at(4)}labels:`)
  lines.push(emitMap(selectorLabels, templateIndent + 6))
  if (Object.keys(podAnnotations).length > 0) {
    lines.push(`${at(4)}annotations:`)
    lines.push(emitMap(podAnnotations, templateIndent + 6))
  }
  lines.push(`${at(2)}spec:`)

  if (state.podTerminationGracePeriodSeconds) lines.push(`${at(4)}terminationGracePeriodSeconds: ${state.podTerminationGracePeriodSeconds}`)
  if (state.podPriorityClassName) lines.push(`${at(4)}priorityClassName: ${state.podPriorityClassName}`)
  if (state.serviceAccountName) lines.push(`${at(4)}serviceAccountName: ${state.serviceAccountName}`)
  if (state.podRestartPolicy) lines.push(`${at(4)}restartPolicy: ${state.podRestartPolicy}`)
  if (state.podDnsPolicy) lines.push(`${at(4)}dnsPolicy: ${state.podDnsPolicy}`)
  if (state.podHostNetworking) lines.push(`${at(4)}hostNetwork: ${state.podHostNetworking === 'True' ? 'true' : 'false'}`)

  const readinessGates = state.podReadinessGates
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
  if (readinessGates.length > 0) {
    lines.push(`${at(4)}readinessGates:`)
    for (const gate of readinessGates) {
      lines.push(`${at(6)}- conditionType: ${JSON.stringify(gate)}`)
    }
  }

  const hostAliases = state.hostAliases.filter((alias) => alias.ip.trim() || alias.hostnames.trim())
  if (hostAliases.length > 0) {
    lines.push(`${at(4)}hostAliases:`)
    for (const alias of hostAliases) {
      lines.push(`${at(6)}- ip: ${JSON.stringify(alias.ip.trim())}`)
      const hostnames = alias.hostnames
        .split(/[\s,]+/)
        .map((host) => host.trim())
        .filter(Boolean)
      if (hostnames.length > 0) {
        lines.push(`${at(8)}hostnames:`)
        for (const hostname of hostnames) {
          lines.push(`${at(10)}- ${JSON.stringify(hostname)}`)
        }
      }
    }
  }

  const vols = state.volumes.filter((v) => v.Name)
  if (vols.length > 0) {
    lines.push(`${at(4)}volumes:`)
    for (const vol of vols) {
      lines.push(`${at(6)}- name: ${vol.Name}`)
      if (vol.Type === 'ConfigMap') {
        lines.push(`${at(8)}configMap:`)
        lines.push(`${at(10)}name: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'Secret') {
        lines.push(`${at(8)}secret:`)
        lines.push(`${at(10)}secretName: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'EmptyDir') {
        lines.push(`${at(8)}emptyDir: {}`)
      } else if (vol.Type === 'PVC') {
        lines.push(`${at(8)}persistentVolumeClaim:`)
        lines.push(`${at(10)}claimName: ${vol.ReferenceName || vol.Name}`)
      } else if (vol.Type === 'HostPath') {
        lines.push(`${at(8)}hostPath:`)
        lines.push(`${at(10)}path: ${vol.ReferenceName || '/'}`)
      }
    }
  }

  const tolerations = state.tolerations.filter((t) => t.key)
  if (tolerations.length > 0) {
    lines.push(`${at(4)}tolerations:`)
    for (const tol of tolerations) {
      lines.push(`${at(6)}- key: ${tol.key}`)
      lines.push(`${at(8)}operator: ${tol.operator || 'Equal'}`)
      if (tol.value) lines.push(`${at(8)}value: ${JSON.stringify(tol.value)}`)
      if (tol.effect) lines.push(`${at(8)}effect: ${tol.effect}`)
    }
  }

  const nodeAffinity = tryParseJson(state.nodeAffinity)
  const podAffinity = tryParseJson(state.podAffinity)
  const podAntiAffinity = tryParseJson(state.podAntiAffinity)
  if (nodeAffinity || podAffinity || podAntiAffinity) {
    lines.push(`${at(4)}affinity:`)
    if (nodeAffinity) {
      lines.push(`${at(6)}nodeAffinity:`)
      lines.push(jsonToYaml(nodeAffinity, templateIndent + 8))
    }
    if (podAffinity) {
      lines.push(`${at(6)}podAffinity:`)
      lines.push(jsonToYaml(podAffinity, templateIndent + 8))
    }
    if (podAntiAffinity) {
      lines.push(`${at(6)}podAntiAffinity:`)
      lines.push(jsonToYaml(podAntiAffinity, templateIndent + 8))
    }
  }

  const dnsNameservers = state.podDnsNameservers
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
  const dnsSearches = state.podDnsSearches
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
  const dnsOpts = state.dnsConfigOptions.filter((d) => d.name)
  if (dnsNameservers.length > 0 || dnsSearches.length > 0 || dnsOpts.length > 0) {
    lines.push(`${at(4)}dnsConfig:`)
    if (dnsNameservers.length > 0) {
      lines.push(`${at(6)}nameservers:`)
      for (const ns of dnsNameservers) {
        lines.push(`${at(8)}- ${ns}`)
      }
    }
    if (dnsSearches.length > 0) {
      lines.push(`${at(6)}searches:`)
      for (const search of dnsSearches) {
        lines.push(`${at(8)}- ${search}`)
      }
    }
    if (dnsOpts.length > 0) {
      lines.push(`${at(6)}options:`)
      for (const opt of dnsOpts) {
        lines.push(`${at(8)}- name: ${opt.name}`)
        if (opt.value) lines.push(`${at(10)}value: ${JSON.stringify(opt.value)}`)
      }
    }
  }

  const supplementalGroups = state.podSecuritySupplementalGroups
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  const sysctls = state.sysctls.filter((s) => s.name)
  const hasSeLinux =
    !!state.podSecuritySeLinuxLevel ||
    !!state.podSecuritySeLinuxRole ||
    !!state.podSecuritySeLinuxType ||
    !!state.podSecuritySeLinuxUser
  const hasPodSecurityContext =
    !!state.podSecurityFsGroup ||
    !!state.podSecurityRunAsGroup ||
    !!state.podSecurityRunAsUser ||
    supplementalGroups.length > 0 ||
    state.podSecurityRunAsNonRoot === 'True' ||
    state.podSecurityRunAsNonRoot === 'False' ||
    hasSeLinux ||
    sysctls.length > 0

  if (hasPodSecurityContext) {
    lines.push(`${at(4)}securityContext:`)
    if (state.podSecurityFsGroup) lines.push(`${at(6)}fsGroup: ${state.podSecurityFsGroup}`)
    if (state.podSecurityRunAsGroup) lines.push(`${at(6)}runAsGroup: ${state.podSecurityRunAsGroup}`)
    if (state.podSecurityRunAsUser) lines.push(`${at(6)}runAsUser: ${state.podSecurityRunAsUser}`)
    if (supplementalGroups.length > 0) {
      lines.push(`${at(6)}supplementalGroups:`)
      for (const group of supplementalGroups) {
        lines.push(`${at(8)}- ${group}`)
      }
    }
    if (state.podSecurityRunAsNonRoot === 'True' || state.podSecurityRunAsNonRoot === 'False') {
      lines.push(`${at(6)}runAsNonRoot: ${state.podSecurityRunAsNonRoot === 'True' ? 'true' : 'false'}`)
    }
    if (hasSeLinux) {
      lines.push(`${at(6)}seLinuxOptions:`)
      if (state.podSecuritySeLinuxLevel) lines.push(`${at(8)}level: ${state.podSecuritySeLinuxLevel}`)
      if (state.podSecuritySeLinuxRole) lines.push(`${at(8)}role: ${state.podSecuritySeLinuxRole}`)
      if (state.podSecuritySeLinuxType) lines.push(`${at(8)}type: ${state.podSecuritySeLinuxType}`)
      if (state.podSecuritySeLinuxUser) lines.push(`${at(8)}user: ${state.podSecuritySeLinuxUser}`)
    }
    if (sysctls.length > 0) {
      lines.push(`${at(6)}sysctls:`)
      for (const sysctl of sysctls) {
        lines.push(`${at(8)}- name: ${sysctl.name}`)
        lines.push(`${at(10)}value: ${JSON.stringify(sysctl.value)}`)
      }
    }
  }

  const pullSecrets = state.imagePullSecrets.filter((s) => s.name)
  if (pullSecrets.length > 0) {
    lines.push(`${at(4)}imagePullSecrets:`)
    for (const secret of pullSecrets) {
      lines.push(`${at(6)}- name: ${secret.name}`)
    }
  }

  const initContainers = state.containers.filter((container) => container.IsInitContainer === 'True')
  const workloadContainers = state.containers.filter((container) => container.IsInitContainer !== 'True')
  const containerItemIndent = templateIndent + 4

  if (initContainers.length > 0) {
    lines.push(`${at(4)}initContainers:`)
    for (const container of initContainers) {
      lines.push(emitContainer(container, containerItemIndent, registryHost, state.packageId))
    }
  }

  if (workloadContainers.length > 0) {
    lines.push(`${at(4)}containers:`)
    for (const container of workloadContainers) {
      lines.push(emitContainer(container, containerItemIndent, registryHost, state.packageId))
    }
  } else {
    lines.push(`${at(4)}containers: []`)
  }
}

export function generateDeploymentYaml(state: ContainersEditorState, registryHost?: string): string {
  const resourceType = state.resourceType || 'Deployment'
  const deploymentName = state.deploymentName || 'my-deployment'
  const namespace = state.namespace || 'default'
  const replicas = state.replicas || '1'
  const labels = kvToMap(state.deploymentLabels)
  const annotations = kvToMap(state.deploymentAnnotations)
  const selectorLabels = Object.keys(labels).length > 0 ? labels : { app: deploymentName }

  const apiVersion = resourceType === 'Job' ? 'batch/v1' : 'apps/v1'
  const lines: string[] = []

  const pushSelector = () => {
    lines.push('  selector:')
    lines.push('    matchLabels:')
    lines.push(emitMap(selectorLabels, 6))
  }

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

  if (resourceType === 'Job') {
    appendPodTemplate(lines, state, selectorLabels, 2, registryHost)
    return lines.filter((l) => l !== '').join('\n')
  }

  if (resourceType === 'StatefulSet') {
    lines.push(`  serviceName: ${state.serviceName || deploymentName}`)
    lines.push(`  replicas: ${replicas}`)
    pushSelector()
    const updateStrategyType = state.deploymentStyle === 'OnDelete' ? 'OnDelete' : 'RollingUpdate'
    lines.push('  updateStrategy:')
    lines.push(`    type: ${updateStrategyType}`)
    appendPodTemplate(lines, state, selectorLabels, 2, registryHost)
    return lines.filter((l) => l !== '').join('\n')
  }

  if (resourceType === 'DaemonSet') {
    pushSelector()
    const updateStrategyType = state.deploymentStyle === 'OnDelete' ? 'OnDelete' : 'RollingUpdate'
    lines.push('  updateStrategy:')
    lines.push(`    type: ${updateStrategyType}`)
    if (updateStrategyType === 'RollingUpdate' && (state.maxUnavailable || state.maxSurge)) {
      lines.push('    rollingUpdate:')
      if (state.maxUnavailable) lines.push(`      maxUnavailable: ${state.maxUnavailable}`)
      if (state.maxSurge) lines.push(`      maxSurge: ${state.maxSurge}`)
    }
    appendPodTemplate(lines, state, selectorLabels, 2, registryHost)
    return lines.filter((l) => l !== '').join('\n')
  }

  // Deployment (default)
  lines.push(`  replicas: ${replicas}`)
  if (state.revisionHistoryLimit) lines.push(`  revisionHistoryLimit: ${state.revisionHistoryLimit}`)
  if (state.progressDeadlineSeconds) lines.push(`  progressDeadlineSeconds: ${state.progressDeadlineSeconds}`)
  pushSelector()
  const strategyType = state.deploymentStyle === 'Recreate' ? 'Recreate' : 'RollingUpdate'
  lines.push('  strategy:')
  lines.push(`    type: ${strategyType}`)
  if (strategyType === 'RollingUpdate' && (state.maxUnavailable || state.maxSurge)) {
    lines.push('    rollingUpdate:')
    if (state.maxUnavailable) lines.push(`      maxUnavailable: ${state.maxUnavailable}`)
    if (state.maxSurge) lines.push(`      maxSurge: ${state.maxSurge}`)
  }
  appendPodTemplate(lines, state, selectorLabels, 2, registryHost)

  return lines.filter((l) => l !== '').join('\n')
}

export function generateServiceYaml(state: ContainersEditorState): string | null {
  if (!state.serviceName) return null

  const ports = state.servicePorts.filter((p) => p.port)
  if (ports.length === 0) return null

  const deploymentName = state.deploymentName || 'my-deployment'
  const namespace = state.namespace || 'default'
  const labels = kvToMap(state.deploymentLabels)
  const annotations = kvToMap(state.serviceAnnotations)
  const selectorLabels = Object.keys(labels).length > 0 ? labels : { app: deploymentName }

  const lines: string[] = []
  lines.push('apiVersion: v1')
  lines.push('kind: Service')
  lines.push('metadata:')
  lines.push(`  name: ${state.serviceName}`)
  lines.push(`  namespace: ${namespace}`)
  if (Object.keys(annotations).length > 0) {
    lines.push('  annotations:')
    lines.push(emitMap(annotations, 4))
  }
  lines.push('spec:')
  lines.push(`  type: ${state.serviceType || 'ClusterIP'}`)
  if (state.serviceClusterIp) lines.push(`  clusterIP: ${JSON.stringify(state.serviceClusterIp)}`)
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

export function generateIngressYaml(state: ContainersEditorState): string | null {
  if (!state.ingressName) return null

  const namespace = state.namespace || 'default'
  const annotations = kvToMap(state.ingressAnnotations)
  const tlsItems = state.ingressTls.filter((tls) => tls.secretName || tls.hosts.length > 0)
  const rules = state.ingressRules.filter((rule) => rule.host || rule.paths.some((path) => path.path || path.backend.serviceName || path.backend.servicePort))

  const lines: string[] = []
  lines.push('apiVersion: networking.k8s.io/v1')
  lines.push('kind: Ingress')
  lines.push('metadata:')
  lines.push(`  name: ${state.ingressName}`)
  lines.push(`  namespace: ${namespace}`)
  if (Object.keys(annotations).length > 0) {
    lines.push('  annotations:')
    lines.push(emitMap(annotations, 4))
  }
  lines.push('spec:')
  if (state.ingressClassName) {
    lines.push(`  ingressClassName: ${state.ingressClassName}`)
  }
  if (tlsItems.length > 0) {
    lines.push('  tls:')
    for (const tls of tlsItems) {
      lines.push('    -')
      if (tls.hosts.length > 0) {
        lines.push('      hosts:')
        for (const host of tls.hosts) {
          lines.push(`        - ${host}`)
        }
      }
      if (tls.secretName) {
        lines.push(`      secretName: ${tls.secretName}`)
      }
    }
  }
  if (rules.length > 0) {
    lines.push('  rules:')
    for (const rule of rules) {
      lines.push('    -')
      if (rule.host) lines.push(`      host: ${rule.host}`)
      lines.push('      http:')
      lines.push('        paths:')
      const validPaths = rule.paths.filter((path) => path.path || path.backend.serviceName || path.backend.servicePort)
      const paths = validPaths.length > 0 ? validPaths : [{ path: '/', pathType: 'Prefix', backend: { serviceName: state.serviceName, servicePort: '80' } }]
      for (const path of paths) {
        lines.push(`          - path: ${path.path || '/'}`)
        lines.push(`            pathType: ${path.pathType || 'Prefix'}`)
        lines.push('            backend:')
        lines.push('              service:')
        lines.push(`                name: ${path.backend.serviceName || state.serviceName || 'service-name'}`)
        lines.push(`                port:`)
        if (/^\d+$/.test(path.backend.servicePort || '')) {
          lines.push(`                  number: ${path.backend.servicePort}`)
        } else if ((path.backend.servicePort || '').trim()) {
          lines.push(`                  name: ${path.backend.servicePort}`)
        } else {
          lines.push('                  number: 80')
        }
      }
    }
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

export function generateAllYaml(state: ContainersEditorState, registryHost?: string): string {
  const parts: string[] = []

  const deployment = generateDeploymentYaml(state, registryHost)
  if (deployment) parts.push(deployment)

  const service = generateServiceYaml(state)
  if (service) parts.push(service)

  const ingress = generateIngressYaml(state)
  if (ingress) parts.push(ingress)

  const configMap = generateConfigMapYaml(state)
  if (configMap) parts.push(configMap)

  const secret = generateSecretYaml(state)
  if (secret) parts.push(secret)

  return parts.join('\n---\n')
}
