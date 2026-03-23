import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Input, Select, Radio, Modal, Tooltip, AutoComplete, message } from 'antd'
import { PlusOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { type ContainerSpec, type ProbeConfig, defaultContainer } from '../types'
import { getExternalFeeds, searchExternalFeedPackages, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { getRegistryHost } from '../generateYaml'

interface ContainersSectionProps {
  containers: ContainerSpec[]
  onChange: (containers: ContainerSpec[]) => void
  feedId: number | null
  packageId: string
  onFeedChange: (feedId: number | null, packageId: string) => void
}

// ── Octopus-style collapsible card for use inside the modal ──────────────────

function ModalCard({ title, subtitle, defaultOpen = true, children }: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</div>}
        </div>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
          className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}>
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-slate-100 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="pt-3 pb-1">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">{title}</div>
      {description && <p className="text-xs text-slate-500 mt-2 mb-0 leading-relaxed">{description}</p>}
    </div>
  )
}

const posixCapabilityOptions = [
  'ALL',
  'AUDIT_CONTROL',
  'AUDIT_READ',
  'AUDIT_WRITE',
  'BLOCK_SUSPEND',
  'CHOWN',
  'DAC_OVERRIDE',
  'DAC_READ_SEARCH',
  'FOWNER',
  'FSETID',
  'IPC_LOCK',
  'IPC_OWNER',
  'KILL',
  'LEASE',
  'LINUX_IMMUTABLE',
  'MAC_ADMIN',
  'MAC_OVERRIDE',
  'MKNOD',
  'NET_ADMIN',
  'NET_BIND_SERVICE',
  'NET_BROADCAST',
  'NET_RAW',
  'SETFCAP',
  'SETGID',
  'SETPCAP',
  'SETUID',
  'SYS_ADMIN',
  'SYS_BOOT',
  'SYS_CHROOT',
  'SYS_MODULE',
  'SYS_NICE',
  'SYS_PACCT',
  'SYS_PTRACE',
  'SYS_RAWIO',
  'SYS_RESOURCE',
  'SYS_TIME',
  'SYS_TTY_CONFIG',
  'SYSLOG',
  'WAKE_ALARM',
]

// ── Probe editor card ─────────────────────────────────────────────────────────

function ProbeModalCard({ label, subtitle, probe, onChange, hideFailureThreshold = false, hideTimeoutSeconds = false, hideInitialDelaySeconds = false, hidePeriodSeconds = false, hideSuccessThreshold = false }: {
  label: string
  subtitle: string
  probe: ProbeConfig
  onChange: (p: ProbeConfig) => void
  hideFailureThreshold?: boolean
  hideTimeoutSeconds?: boolean
  hideInitialDelaySeconds?: boolean
  hidePeriodSeconds?: boolean
  hideSuccessThreshold?: boolean
}) {
  const probeTypeLabel = probe.type === 'exec'
    ? 'Command'
    : probe.type === 'httpGet'
      ? 'HttpGet'
      : probe.type === 'tcpSocket'
        ? 'TCP Socket'
        : probe.type
  const currentSubtitle = probe.type ? `Type: ${probeTypeLabel}` : subtitle

  return (
    <ModalCard title={label} subtitle={currentSubtitle} defaultOpen={false}>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
        <Select
          size="small"
          value={probe.type || undefined}
          onChange={(v) => onChange({ ...probe, type: v ?? '' })}
          placeholder="None"
          allowClear
          className="w-full"
          options={[
            { label: 'Command', value: 'exec' },
            { label: 'HttpGet', value: 'httpGet' },
            { label: 'TCP Socket', value: 'tcpSocket' },
          ]}
        />
      </div>
      {probe.type === 'httpGet' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Path</label>
            <Input
              size="small"
              value={probe.httpGet?.path ?? ''}
              onChange={(e) => onChange({ ...probe, httpGet: { ...(probe.httpGet ?? { path: '', port: '', scheme: 'HTTP', host: '', httpHeaders: [] }), path: e.target.value } })}
              placeholder="/"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Host</label>
            <Input
              size="small"
              value={probe.httpGet?.host ?? ''}
              onChange={(e) => onChange({ ...probe, httpGet: { ...(probe.httpGet ?? { path: '', port: '', scheme: 'HTTP', host: '', httpHeaders: [] }), host: e.target.value } })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
            <Input
              size="small"
              value={probe.httpGet?.port ?? ''}
              onChange={(e) => onChange({ ...probe, httpGet: { ...(probe.httpGet ?? { path: '', port: '', scheme: 'HTTP', host: '', httpHeaders: [] }), port: e.target.value } })}
              placeholder="8080"
            />
          </div>
        </>
      )}
      {probe.type === 'tcpSocket' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Host</label>
            <Input
              size="small"
              value={probe.tcpSocket?.host ?? ''}
              onChange={(e) => onChange({ ...probe, tcpSocket: { ...(probe.tcpSocket ?? { host: '', port: '' }), host: e.target.value } })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
            <Input
              size="small"
              value={probe.tcpSocket?.port ?? ''}
              onChange={(e) => onChange({ ...probe, tcpSocket: { ...(probe.tcpSocket ?? { host: '', port: '' }), port: e.target.value } })}
              placeholder="8080"
            />
          </div>
        </>
      )}
      {probe.type === 'exec' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Command</label>
          <Input size="small" value={probe.exec?.command ?? ''} onChange={(e) => onChange({ ...probe, exec: { command: e.target.value } })} placeholder="cat /tmp/healthy" />
        </div>
      )}
      {probe.type && (
        <div className="grid grid-cols-2 gap-3">
          {!hideInitialDelaySeconds && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Initial Delay (s)</label>
              <Input size="small" type="number" value={probe.initialDelaySeconds} onChange={(e) => onChange({ ...probe, initialDelaySeconds: e.target.value })} placeholder="0" />
            </div>
          )}
          {!hidePeriodSeconds && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period (s)</label>
              <Input size="small" type="number" value={probe.periodSeconds} onChange={(e) => onChange({ ...probe, periodSeconds: e.target.value })} placeholder="10" />
            </div>
          )}
          {!hideTimeoutSeconds && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timeout (s)</label>
              <Input size="small" type="number" value={probe.timeoutSeconds} onChange={(e) => onChange({ ...probe, timeoutSeconds: e.target.value })} placeholder="1" />
            </div>
          )}
          {!hideFailureThreshold && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Failure Threshold</label>
              <Input size="small" type="number" value={probe.failureThreshold} onChange={(e) => onChange({ ...probe, failureThreshold: e.target.value })} placeholder="3" />
            </div>
          )}
          {!hideSuccessThreshold && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Success Threshold</label>
              <Input size="small" type="number" value={probe.successThreshold} onChange={(e) => onChange({ ...probe, successThreshold: e.target.value })} placeholder="1" />
            </div>
          )}
        </div>
      )}
    </ModalCard>
  )
}

// ── Container modal form (all fields) ────────────────────────────────────────

function ContainerModalForm({ container, onChange, feeds, feedsLoading, onRefreshFeeds, feedId, packageId, onFeedChange }: {
  container: ContainerSpec
  onChange: (c: ContainerSpec) => void
  feeds: ExternalFeedDto[]
  feedsLoading: boolean
  onRefreshFeeds: () => void
  feedId: number | null
  packageId: string
  onFeedChange: (feedId: number | null, packageId: string) => void
}) {
  const [packageSearchTerm, setPackageSearchTerm] = useState(packageId)
  const [packageSearchOptions, setPackageSearchOptions] = useState<string[]>([])
  const [packageSearchLoading, setPackageSearchLoading] = useState(false)
  const packageSearchRequestId = useRef(0)

  useEffect(() => {
    setPackageSearchTerm(packageId)
  }, [packageId])

  useEffect(() => {
    const query = packageSearchTerm.trim()
    if (!feedId || !query) {
      setPackageSearchOptions([])
      setPackageSearchLoading(false)
      return
    }

    const requestId = ++packageSearchRequestId.current
    const timer = window.setTimeout(() => {
      setPackageSearchLoading(true)
      searchExternalFeedPackages({ feedId, query, take: 20 })
        .then((res) => {
          if (requestId !== packageSearchRequestId.current) return
          setPackageSearchOptions((res.packages ?? []).filter((pkg) => Boolean(pkg)))
        })
        .catch(() => {
          if (requestId !== packageSearchRequestId.current) return
          setPackageSearchOptions([])
        })
        .finally(() => {
          if (requestId !== packageSearchRequestId.current) return
          setPackageSearchLoading(false)
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [feedId, packageSearchTerm])

  const registryHost = getRegistryHost(feeds.find((f) => f.id === feedId))
  const imagePreview = registryHost && packageId ? `${registryHost}/${packageId}` : packageId
  const updatePortAt = (index: number, patch: Partial<{ key: string; value: string; option: string }>) => {
    onChange({ ...container, Ports: container.Ports.map((port, i) => (i === index ? { ...port, ...patch } : port)) })
  }
  const removePortAt = (index: number) => {
    onChange({ ...container, Ports: container.Ports.filter((_, i) => i !== index) })
  }
  const updateVolumeMountAt = (index: number, patch: Partial<{ key: string; value: string; option: string }>) => {
    onChange({ ...container, VolumeMounts: container.VolumeMounts.map((mount, i) => (i === index ? { ...mount, ...patch } : mount)) })
  }
  const removeVolumeMountAt = (index: number) => {
    onChange({ ...container, VolumeMounts: container.VolumeMounts.filter((_, i) => i !== index) })
  }
  const environmentVariables = container.EnvironmentVariables ?? []
  const fieldRefEnvVariables = container.FieldRefEnvironmentVariables ?? []
  const configMapEnvFromSource = container.ConfigMapEnvFromSource ?? []
  const configMapEnvVariables = container.ConfigMapEnvironmentVariables ?? []
  const secretEnvFromSource = container.SecretEnvFromSource ?? []
  const secretEnvVariables = container.SecretEnvironmentVariables ?? []
  const updateEnvironmentVariableAt = (index: number, patch: Partial<{ key: string; value: string }>) => {
    onChange({ ...container, EnvironmentVariables: environmentVariables.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
  }
  const removeEnvironmentVariableAt = (index: number) => {
    onChange({ ...container, EnvironmentVariables: environmentVariables.filter((_, i) => i !== index) })
  }
  const updateFieldRefEnvVariableAt = (index: number, patch: Partial<{ key: string; value: string }>) => {
    onChange({ ...container, FieldRefEnvironmentVariables: fieldRefEnvVariables.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
  }
  const removeFieldRefEnvVariableAt = (index: number) => {
    onChange({ ...container, FieldRefEnvironmentVariables: fieldRefEnvVariables.filter((_, i) => i !== index) })
  }
  const updateConfigMapEnvFromAt = (index: number, patch: Partial<{ key: string; value?: string; option?: string }>) => {
    onChange({ ...container, ConfigMapEnvFromSource: configMapEnvFromSource.map((source, i) => (i === index ? { ...source, ...patch } : source)) })
  }
  const removeConfigMapEnvFromAt = (index: number) => {
    onChange({ ...container, ConfigMapEnvFromSource: configMapEnvFromSource.filter((_, i) => i !== index) })
  }
  const updateConfigMapEnvVarAt = (index: number, patch: Partial<{ key: string; value: string; option: string; optional?: string }>) => {
    onChange({ ...container, ConfigMapEnvironmentVariables: configMapEnvVariables.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
  }
  const removeConfigMapEnvVarAt = (index: number) => {
    onChange({ ...container, ConfigMapEnvironmentVariables: configMapEnvVariables.filter((_, i) => i !== index) })
  }
  const updateSecretEnvFromAt = (index: number, patch: Partial<{ key: string; value?: string; option?: string }>) => {
    onChange({ ...container, SecretEnvFromSource: secretEnvFromSource.map((source, i) => (i === index ? { ...source, ...patch } : source)) })
  }
  const removeSecretEnvFromAt = (index: number) => {
    onChange({ ...container, SecretEnvFromSource: secretEnvFromSource.filter((_, i) => i !== index) })
  }
  const updateSecretEnvVarAt = (index: number, patch: Partial<{ key: string; value: string; option: string; optional?: string }>) => {
    onChange({ ...container, SecretEnvironmentVariables: secretEnvVariables.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
  }
  const removeSecretEnvVarAt = (index: number) => {
    onChange({ ...container, SecretEnvironmentVariables: secretEnvVariables.filter((_, i) => i !== index) })
  }
  const addedPosixCapabilities = container.SecurityContext.addCapabilities ?? []
  const droppedPosixCapabilities = container.SecurityContext.dropCapabilities ?? []
  const updateAddedPosixCapabilityAt = (index: number, value: string) => {
    onChange({
      ...container,
      SecurityContext: {
        ...container.SecurityContext,
        addCapabilities: addedPosixCapabilities.map((capability, i) => (i === index ? value : capability)),
      },
    })
  }
  const updateDroppedPosixCapabilityAt = (index: number, value: string) => {
    onChange({
      ...container,
      SecurityContext: {
        ...container.SecurityContext,
        dropCapabilities: droppedPosixCapabilities.map((capability, i) => (i === index ? value : capability)),
      },
    })
  }
  const addPosixCapability = (mode: 'add' | 'drop') => {
    if (mode === 'add') {
      onChange({
        ...container,
        SecurityContext: { ...container.SecurityContext, addCapabilities: [...addedPosixCapabilities, ''] },
      })
      return
    }
    onChange({
      ...container,
      SecurityContext: { ...container.SecurityContext, dropCapabilities: [...droppedPosixCapabilities, ''] },
    })
  }
  const removePosixCapabilityAt = (mode: 'add' | 'drop', index: number) => {
    if (mode === 'add') {
      onChange({
        ...container,
        SecurityContext: { ...container.SecurityContext, addCapabilities: addedPosixCapabilities.filter((_, i) => i !== index) },
      })
      return
    }
    onChange({
      ...container,
      SecurityContext: { ...container.SecurityContext, dropCapabilities: droppedPosixCapabilities.filter((_, i) => i !== index) },
    })
  }

  return (
    <div>
      {/* Image Details */}
      <ModalCard title="Image Details" subtitle="Provide a name and a package image for the container.">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <Input value={container.Name} onChange={(e) => onChange({ ...container, Name: e.target.value })} placeholder="my-container" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Package Image</p>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Select a Docker registry feed to resolve the container image at deployment time. The release version is appended as the image tag.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Package feed</label>
              <div className="flex items-center gap-2">
                <Select
                  size="small"
                  value={feedId ?? undefined}
                  onChange={(v) => onFeedChange(v ?? null, packageId)}
                  placeholder="Select a feed..."
                  allowClear
                  className="flex-1"
                  options={feeds.map((f) => ({ label: f.name, value: f.id }))}
                />
                <Tooltip title="Refresh feeds">
                  <button
                    type="button"
                    onClick={onRefreshFeeds}
                    disabled={feedsLoading}
                    className="flex-shrink-0 flex items-center justify-center w-[24px] h-[24px] rounded border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50"
                  >
                    <ReloadOutlined style={{ fontSize: 13 }} spin={feedsLoading} />
                  </button>
                </Tooltip>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Package ID</label>
              <AutoComplete
                className="w-full"
                value={packageId}
                allowClear
                options={packageSearchOptions.map((value) => ({ value }))}
                onSearch={setPackageSearchTerm}
                onSelect={(value) => {
                  setPackageSearchTerm(value)
                  onFeedChange(feedId, value)
                }}
                onChange={(value) => {
                  setPackageSearchTerm(value)
                  onFeedChange(feedId, value)
                }}
                filterOption={false}
                notFoundContent={feedId && packageSearchTerm.trim() ? (packageSearchLoading ? 'Searching packages...' : 'No packages found') : null}
              >
                <Input size="small" placeholder="my-image" />
              </AutoComplete>
              <p className="text-xs text-slate-400 mt-1 mb-0">
                Enter the ID of the package (image name within the registry, without tag).
                {imagePreview && <> Image: <code className="text-xs bg-slate-100 px-1 rounded">{imagePreview}:&lt;version&gt;</code></>}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700 mb-1">Generate docker-registry secret</p>
            <Radio.Group
              value={container.CreateFeedSecrets || 'False'}
              onChange={(e) => onChange({ ...container, CreateFeedSecrets: e.target.value })}
              className="flex flex-col gap-0"
            >
              <Radio value="True"><span className="text-sm">Generate docker-registry secret</span></Radio>
              <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-2">
                Select this option when the Kubernetes cluster requires credentials to access the Docker registry. A <code className="text-xs bg-slate-100 px-1 rounded">docker-registry</code> secret will be created and the pod's <code className="text-xs bg-slate-100 px-1 rounded">imagePullSecrets</code> property will reference it.
              </p>
              <Radio value="False"><span className="text-sm">Do not generate docker-registry secret</span></Radio>
              <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-0">
                Select this option when the cluster is granted access to the registry by other means (e.g. IAM rules for ECR+EKS, ACR+AKS, GCR+GKE).
              </p>
            </Radio.Group>
          </div>
        </div>
      </ModalCard>

      <ModalCard title="Command And Args" subtitle="Override the container entrypoint and arguments." defaultOpen={false}>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Command</label>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            value={(container.Command ?? []).join('\n')}
            onChange={(e) => onChange({ ...container, Command: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })}
            placeholder={"/bin/sh\n-c\necho hello"}
          />
          <p className="text-xs text-slate-400 mt-1 mb-0">One argument per line.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Args</label>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            value={(container.Args ?? []).join('\n')}
            onChange={(e) => onChange({ ...container, Args: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })}
            placeholder={"--port\n3000"}
          />
          <p className="text-xs text-slate-400 mt-1 mb-0">One argument per line.</p>
        </div>
      </ModalCard>

      {/* Ports */}
      <ModalCard title="Ports" subtitle="Add ports to be referenced by the target node in the associated service.">
        <p className="text-xs text-slate-500 leading-relaxed">Containers expose network services through their ports.</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange({ ...container, Ports: [...container.Ports, { key: '', value: '', option: 'TCP' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <PlusOutlined style={{ fontSize: 10 }} /> Add Port
          </button>
        </div>
        {container.Ports.length > 0 && (
          <div className="space-y-3">
            {container.Ports.map((port, i) => (
              <div key={i} className="rounded border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={port.key}
                        placeholder="Name"
                        onChange={(e) => updatePortAt(i, { key: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                      />
                    </div>
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={port.value}
                        placeholder="Port"
                        onChange={(e) => updatePortAt(i, { value: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                      />
                    </div>
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <select
                        value={port.option || 'TCP'}
                        onChange={(e) => updatePortAt(i, { option: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0"
                      >
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removePortAt(i)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                    aria-label="Remove port"
                  >
                    <CloseOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalCard>

      {/* Volume Mounts */}
      <ModalCard title="Volume Mounts" subtitle="Include volume mount points to be exposed on the container." defaultOpen={false}>
        <p className="text-xs text-slate-500 leading-relaxed">Volumes exposed to the containers are mounted to the container filesystem here.</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange({ ...container, VolumeMounts: [...container.VolumeMounts, { key: '', value: '', option: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <PlusOutlined style={{ fontSize: 10 }} /> Add Volume Mount
          </button>
        </div>
        {container.VolumeMounts.length > 0 && (
          <div className="space-y-3">
            {container.VolumeMounts.map((mount, i) => (
              <div key={i} className="rounded border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={mount.key}
                        placeholder="Volume Name"
                        onChange={(e) => updateVolumeMountAt(i, { key: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                      />
                    </div>
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={mount.value}
                        placeholder="Mount Path"
                        onChange={(e) => updateVolumeMountAt(i, { value: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                      />
                    </div>
                    <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={mount.option}
                        placeholder="Sub Path"
                        onChange={(e) => updateVolumeMountAt(i, { option: e.target.value })}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeVolumeMountAt(i)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                    aria-label="Remove volume mount"
                  >
                    <CloseOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalCard>

      {/* Container Type */}
      <ModalCard title="Container Type" subtitle="Select the type of container to be defined." defaultOpen={false}>
        <div className="space-y-2">
          {[
            { value: 'False', label: 'Regular container' },
            { value: 'True', label: 'Init container' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="radio"
                name="IsInitContainer"
                value={opt.value}
                checked={(container.IsInitContainer || 'False') === opt.value}
                onChange={(e) => onChange({ ...container, IsInitContainer: e.target.value })}
                className="accent-squid-blue w-4 h-4"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#container-type"
            target="_blank"
            rel="noopener noreferrer"
            className="text-squid-blue hover:underline"
          >
            container types
          </a>
          .
        </p>
      </ModalCard>

      <ModalCard
        title="Termination message path and policy"
        subtitle="Set the path to the file that contains the container status message"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-slate-600 mb-1">Termination message path</label>
              <Input
                value={container.TerminationMessagePath || ''}
                onChange={(e) => onChange({ ...container, TerminationMessagePath: e.target.value })}
                placeholder="/dev/termination-log"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label="Insert Variable"
              onClick={() => message.info('Insert Variable is not available yet')}
            >
              <span className="text-[10px] font-semibold">{'{ }'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Termination message policy</label>
            <Radio.Group
              value={container.TerminationMessagePolicy || 'File'}
              onChange={(e) => onChange({ ...container, TerminationMessagePolicy: e.target.value })}
              className="flex flex-col gap-2"
            >
              <Radio value="File"><span className="text-sm">File</span></Radio>
              <Radio value="FallbackToLogsOnError"><span className="text-sm">Fallback To Logs On Error</span></Radio>
            </Radio.Group>
          </div>
        </div>
      </ModalCard>

      <ModalCard
        title="Image Pull Policy"
        subtitle="Define how the image will be downloaded."
        defaultOpen={false}
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Image pull policy</label>
          <Radio.Group
            value={container.ImagePullPolicy ?? ''}
            onChange={(e) => onChange({ ...container, ImagePullPolicy: e.target.value })}
            className="flex flex-col gap-2"
          >
            <Radio value=""><span className="text-sm">Default</span></Radio>
            <Radio value="IfNotPresent"><span className="text-sm">If Not Present</span></Radio>
            <Radio value="Always"><span className="text-sm">Always</span></Radio>
            <Radio value="Never"><span className="text-sm">Never</span></Radio>
          </Radio.Group>
        </div>
        <p className="text-xs text-slate-400 mt-1 mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#image-pull-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-squid-blue hover:underline"
          >
            image pull policy
          </a>
          .
        </p>
      </ModalCard>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Resources */}
        <SectionHeading title="Resources" description="The CPU and memory resources required by the container are defined as resource requests and limits." />

        <ModalCard
          title="CPU Requests and Limits"
          subtitle={(container.Resources.requests.cpu || container.Resources.limits.cpu)
            ? `Requesting ${container.Resources.requests.cpu || '—'} of CPU. Limiting to ${container.Resources.limits.cpu || '—'}.`
            : 'No CPU resource requests or limits specified'}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Request</label>
              <Input size="small" value={container.Resources.requests.cpu ?? ''} onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, requests: { ...container.Resources.requests, cpu: e.target.value } } })} placeholder="100m" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Limit</label>
              <Input size="small" value={container.Resources.limits.cpu ?? ''} onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, limits: { ...container.Resources.limits, cpu: e.target.value } } })} placeholder="500m" />
            </div>
          </div>
        </ModalCard>

        <ModalCard
          title="Memory Requests and Limits"
          subtitle={(container.Resources.requests.memory || container.Resources.limits.memory)
            ? `Requesting ${container.Resources.requests.memory || '—'} of memory. Limiting to ${container.Resources.limits.memory || '—'}.`
            : 'No memory resource requests or limits specified'}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Request</label>
              <Input size="small" value={container.Resources.requests.memory ?? ''} onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, requests: { ...container.Resources.requests, memory: e.target.value } } })} placeholder="128Mi" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Limit</label>
              <Input size="small" value={container.Resources.limits.memory ?? ''} onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, limits: { ...container.Resources.limits, memory: e.target.value } } })} placeholder="256Mi" />
            </div>
          </div>
        </ModalCard>

        <ModalCard
          title="Ephemeral Storage Requests and Limits"
          subtitle="Specify the ephemeral storage requests and limits."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ephemeral storage request</label>
              <Input
                size="small"
                value={container.Resources.requests.ephemeralStorage ?? ''}
                onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, requests: { ...container.Resources.requests, ephemeralStorage: e.target.value } } })}
                placeholder="1Gi"
              />
              <p className="text-xs text-slate-400 mt-1 mb-0">
                If left blank, request follows limit. If limit is also blank, namespace default is used.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ephemeral storage limit</label>
              <Input
                size="small"
                value={container.Resources.limits.ephemeralStorage ?? ''}
                onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, limits: { ...container.Resources.limits, ephemeralStorage: e.target.value } } })}
                placeholder="2Gi"
              />
              <p className="text-xs text-slate-400 mt-1 mb-0">
                If this value is not set, namespace default is used.
              </p>
            </div>
          </div>
        </ModalCard>

        <ModalCard
          title="GPU Requests and Limits"
          subtitle="Specify the GPU requests and limits."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nvidia GPU limit</label>
              <Input
                size="small"
                value={container.Resources.limits.nvidiaGpu ?? container.Resources.requests.nvidiaGpu ?? ''}
                onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, limits: { ...container.Resources.limits, nvidiaGpu: e.target.value } } })}
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">AMD GPU limit</label>
              <Input
                size="small"
                value={container.Resources.limits.amdGpu ?? container.Resources.requests.amdGpu ?? ''}
                onChange={(e) => onChange({ ...container, Resources: { ...container.Resources, limits: { ...container.Resources.limits, amdGpu: e.target.value } } })}
                placeholder="1"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 mb-0">
              See the{' '}
              <a
                href="https://oc.to/K8SGpuSchedule"
                target="_blank"
                rel="noopener noreferrer"
                className="text-squid-blue hover:underline"
              >
                Kubernetes documentation
              </a>
              {' '}for details on scheduling GPU resources.
            </p>
          </div>
        </ModalCard>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Environment Variables */}
        <SectionHeading title="Environment Variables" description="Environment variables can be defined in the container from key/value pairs, or from data held in secret or config map resources." />

        <ModalCard
          title="Environment Variables"
          subtitle="Define environment variables for the container."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, EnvironmentVariables: [...environmentVariables, { key: '', value: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add Environment Variable
              </button>
            </div>
            {environmentVariables.length > 0 && (
              <div className="space-y-3">
                {environmentVariables.map((item, i) => (
                  <div key={`env-var-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={item.key}
                            placeholder="Name"
                            onChange={(e) => updateEnvironmentVariableAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={item.value}
                            placeholder="Value"
                            onChange={(e) => updateEnvironmentVariableAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEnvironmentVariableAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove environment variable"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalCard>

        <ModalCard
          title="ConfigMap Environment Variables"
          subtitle="Define environment variables, sourced from a ConfigMap, for the container."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, ConfigMapEnvironmentVariables: [...configMapEnvVariables, { key: '', value: '', option: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add Individual environment variable from a configmap
              </button>
            </div>
            {configMapEnvVariables.length > 0 && (
              <div className="space-y-3">
                {configMapEnvVariables.map((envVar, i) => (
                  <div key={`config-map-env-var-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.key}
                            placeholder="Environment variable name"
                            onChange={(e) => updateConfigMapEnvVarAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.value}
                            placeholder="Config map name"
                            onChange={(e) => updateConfigMapEnvVarAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.option}
                            placeholder="Config map key"
                            onChange={(e) => updateConfigMapEnvVarAt(i, { option: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeConfigMapEnvVarAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove config map environment variable"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Add an individual value from a config map as an environment variable.
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, ConfigMapEnvFromSource: [...configMapEnvFromSource, { key: '', value: '', option: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add All environment variables from a configmap
              </button>
            </div>
            {configMapEnvFromSource.length > 0 && (
              <div className="space-y-3">
                {configMapEnvFromSource.map((src, i) => (
                  <div key={`config-map-env-source-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={src.key}
                            placeholder="Config map name"
                            onChange={(e) => updateConfigMapEnvFromAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={src.value || ''}
                            placeholder="Optional environment variable prefix"
                            onChange={(e) => updateConfigMapEnvFromAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <select
                            value={src.option || ''}
                            onChange={(e) => updateConfigMapEnvFromAt(i, { option: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0"
                          >
                            <option value="">Config map is optional (default)</option>
                            <option value="True">Config map is optional: Yes</option>
                            <option value="False">Config map is optional: No</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeConfigMapEnvFromAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove config map env source"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Add all values from a config map as environment variables, with an optional prefix on the environment variable name.
            </p>
          </div>
        </ModalCard>

        <ModalCard
          title="Secret Environment Variables"
          subtitle="Define environment variables, sourced from a secret, for the container."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, SecretEnvironmentVariables: [...secretEnvVariables, { key: '', value: '', option: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add Individual environment variable from a secret
              </button>
            </div>
            {secretEnvVariables.length > 0 && (
              <div className="space-y-3">
                {secretEnvVariables.map((envVar, i) => (
                  <div key={`secret-env-var-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.key}
                            placeholder="Name"
                            onChange={(e) => updateSecretEnvVarAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.value}
                            placeholder="Secret name"
                            onChange={(e) => updateSecretEnvVarAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={envVar.option}
                            placeholder="Key"
                            onChange={(e) => updateSecretEnvVarAt(i, { option: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSecretEnvVarAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove secret environment variable"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Add an individual value from a secret as an environment variable.
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, SecretEnvFromSource: [...secretEnvFromSource, { key: '', value: '', option: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add All environment variables from a secret
              </button>
            </div>
            {secretEnvFromSource.length > 0 && (
              <div className="space-y-3">
                {secretEnvFromSource.map((src, i) => (
                  <div key={`secret-env-source-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={src.key}
                            placeholder="Secret name"
                            onChange={(e) => updateSecretEnvFromAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={src.value || ''}
                            placeholder="Optional environment variable prefix"
                            onChange={(e) => updateSecretEnvFromAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <select
                            value={src.option || ''}
                            onChange={(e) => updateSecretEnvFromAt(i, { option: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0"
                          >
                            <option value="">Secret is optional (default)</option>
                            <option value="True">Secret is optional: Yes</option>
                            <option value="False">Secret is optional: No</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSecretEnvFromAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove secret env source"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Add all values from a secret as environment variables, with an optional prefix on the environment variable name.
            </p>
          </div>
        </ModalCard>

        <ModalCard
          title="Pod and Container Field Environment Variables (Downward API)"
          subtitle="Define environment variables, sourced from the container or pod metadata, for the container."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Environment variables can expose{' '}
              <a
                href="https://oc.to/KubernetesEnvironmentVariableExposePodInformation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-squid-blue hover:underline"
              >
                Pod and Container fields
              </a>
              . For example <code className="text-xs bg-slate-100 px-1 rounded">spec.nodeName</code>.
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-0">
              See the{' '}
              <a
                href="https://oc.to/KubernetesDownwardApiCapabilities"
                target="_blank"
                rel="noopener noreferrer"
                className="text-squid-blue hover:underline"
              >
                Kubernetes documentation
              </a>
              {' '}for the fields available via the Downward API.
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange({ ...container, FieldRefEnvironmentVariables: [...fieldRefEnvVariables, { key: '', value: '' }] })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add Field Reference Environment Variable
              </button>
            </div>
            {fieldRefEnvVariables.length > 0 && (
              <div className="space-y-3">
                {fieldRefEnvVariables.map((item, i) => (
                  <div key={`field-ref-env-var-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={item.key}
                            placeholder="Name"
                            onChange={(e) => updateFieldRefEnvVariableAt(i, { key: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                        <div className="border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                          <input
                            type="text"
                            value={item.value}
                            placeholder="Field Path"
                            onChange={(e) => updateFieldRefEnvVariableAt(i, { value: e.target.value })}
                            className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 placeholder-slate-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFieldRefEnvVariableAt(i)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        aria-label="Remove field reference environment variable"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalCard>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Liveness Probe */}
        <SectionHeading title="Liveness Probe" description="Liveness probes are used to confirm that a container is still running and healthy." />
        <ModalCard title="Failure Threshold" subtitle="Set how many times the probe can fail after the pod has been started." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Failure threshold</label>
            <Input
              size="small"
              value={container.LivenessProbe.failureThreshold}
              onChange={(e) => onChange({ ...container, LivenessProbe: { ...container.LivenessProbe, failureThreshold: e.target.value } })}
              placeholder="3 (default)"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 mb-0">After this many consecutive failures, the pod is restarted.</p>
        </ModalCard>
        <ModalCard title="Timeout" subtitle="Specify the number of seconds to wait for a probe response." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Timeout in seconds</label>
            <Input
              size="small"
              value={container.LivenessProbe.timeoutSeconds}
              onChange={(e) => onChange({ ...container, LivenessProbe: { ...container.LivenessProbe, timeoutSeconds: e.target.value } })}
              placeholder="1 (default)"
            />
          </div>
        </ModalCard>
        <ModalCard title="Initial Delay" subtitle="Set the number of seconds to wait before the probe is initiated." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Initial delay in seconds</label>
            <Input
              size="small"
              value={container.LivenessProbe.initialDelaySeconds}
              onChange={(e) => onChange({ ...container, LivenessProbe: { ...container.LivenessProbe, initialDelaySeconds: e.target.value } })}
            />
          </div>
        </ModalCard>
        <ModalCard title="Period" subtitle="How frequently should the probe be executed." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period in seconds</label>
            <Input
              size="small"
              value={container.LivenessProbe.periodSeconds}
              onChange={(e) => onChange({ ...container, LivenessProbe: { ...container.LivenessProbe, periodSeconds: e.target.value } })}
              placeholder="10 (default)"
            />
          </div>
        </ModalCard>
        <ProbeModalCard
          label="Liveness Probe Type"
          subtitle="No liveness probe type selected"
          probe={container.LivenessProbe}
          onChange={(p) => onChange({ ...container, LivenessProbe: p })}
          hideFailureThreshold
          hideTimeoutSeconds
          hideInitialDelaySeconds
          hidePeriodSeconds
        />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Startup Probe */}
        <SectionHeading title="Startup Probe" description="Startup probes are useful for delaying liveness probes until the container has successfully started." />
        <ModalCard
          title="Success threshold"
          subtitle="Specify how many consecutive times the probe must succeed for the container to be considered ready after a failure."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Success threshold</label>
            <Input
              size="small"
              value={container.StartupProbe.successThreshold}
              onChange={(e) => onChange({ ...container, StartupProbe: { ...container.StartupProbe, successThreshold: e.target.value } })}
              placeholder="1 (default)"
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Failure Threshold"
          subtitle="Set how many times the probe can fail after the pod has been started."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Failure threshold</label>
            <Input
              size="small"
              value={container.StartupProbe.failureThreshold}
              onChange={(e) => onChange({ ...container, StartupProbe: { ...container.StartupProbe, failureThreshold: e.target.value } })}
              placeholder="3 (default)"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 mb-0">After this many consecutive failures, the pod is restarted.</p>
        </ModalCard>
        <ModalCard
          title="Timeout"
          subtitle="Specify the number of seconds to wait for a probe response."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Timeout in seconds</label>
            <Input
              size="small"
              value={container.StartupProbe.timeoutSeconds}
              onChange={(e) => onChange({ ...container, StartupProbe: { ...container.StartupProbe, timeoutSeconds: e.target.value } })}
              placeholder="1 (default)"
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Initial Delay"
          subtitle="Set the number of seconds to wait before the probe is initiated."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Initial delay in seconds</label>
            <Input
              size="small"
              value={container.StartupProbe.initialDelaySeconds}
              onChange={(e) => onChange({ ...container, StartupProbe: { ...container.StartupProbe, initialDelaySeconds: e.target.value } })}
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Period"
          subtitle="How frequently should the probe be executed."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period in seconds</label>
            <Input
              size="small"
              value={container.StartupProbe.periodSeconds}
              onChange={(e) => onChange({ ...container, StartupProbe: { ...container.StartupProbe, periodSeconds: e.target.value } })}
              placeholder="10 (default)"
            />
          </div>
        </ModalCard>
        <ProbeModalCard
          label="Startup Probe Type"
          subtitle="No startup probe type selected"
          probe={container.StartupProbe}
          onChange={(p) => onChange({ ...container, StartupProbe: p })}
          hideFailureThreshold
          hideTimeoutSeconds
          hideInitialDelaySeconds
          hidePeriodSeconds
          hideSuccessThreshold
        />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Readiness Probe */}
        <SectionHeading title="Readiness Probe" description="Readiness probes are used to confirm that a container has started." />
        <ModalCard
          title="Success threshold"
          subtitle="Specify how many consecutive times the probe must succeed for the container to be considered ready after a failure."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Success threshold</label>
            <Input
              size="small"
              value={container.ReadinessProbe.successThreshold}
              onChange={(e) => onChange({ ...container, ReadinessProbe: { ...container.ReadinessProbe, successThreshold: e.target.value } })}
              placeholder="1 (default)"
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Failure Threshold"
          subtitle="Set how many times the probe can fail after the pod has been started."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Failure threshold</label>
            <Input
              size="small"
              value={container.ReadinessProbe.failureThreshold}
              onChange={(e) => onChange({ ...container, ReadinessProbe: { ...container.ReadinessProbe, failureThreshold: e.target.value } })}
              placeholder="3 (default)"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 mb-0">After this many consecutive failures, the container is considered not ready.</p>
        </ModalCard>
        <ModalCard
          title="Timeout"
          subtitle="Specify the number of seconds to wait for a probe response."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Timeout in seconds</label>
            <Input
              size="small"
              value={container.ReadinessProbe.timeoutSeconds}
              onChange={(e) => onChange({ ...container, ReadinessProbe: { ...container.ReadinessProbe, timeoutSeconds: e.target.value } })}
              placeholder="1 (default)"
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Initial Delay"
          subtitle="Set the number of seconds to wait before the probe is initiated."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Initial delay in seconds</label>
            <Input
              size="small"
              value={container.ReadinessProbe.initialDelaySeconds}
              onChange={(e) => onChange({ ...container, ReadinessProbe: { ...container.ReadinessProbe, initialDelaySeconds: e.target.value } })}
            />
          </div>
        </ModalCard>
        <ModalCard
          title="Period"
          subtitle="How frequently should the probe be executed."
          defaultOpen={false}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period in seconds</label>
            <Input
              size="small"
              value={container.ReadinessProbe.periodSeconds}
              onChange={(e) => onChange({ ...container, ReadinessProbe: { ...container.ReadinessProbe, periodSeconds: e.target.value } })}
              placeholder="10 (default)"
            />
          </div>
        </ModalCard>
        <ProbeModalCard
          label="Readiness Probe Type"
          subtitle="No readiness probe type selected"
          probe={container.ReadinessProbe}
          onChange={(p) => onChange({ ...container, ReadinessProbe: p })}
          hideSuccessThreshold
          hideFailureThreshold
          hideTimeoutSeconds
          hideInitialDelaySeconds
          hidePeriodSeconds
        />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Lifecycle Hooks */}
        <SectionHeading title="Lifecycle Hooks" description="Lifecycle hooks describe actions that the management system should take in response to container lifecycle events." />

        <ModalCard title="PostStart" subtitle={container.Lifecycle.postStart?.command ? 'Command will be invoked' : 'No handler has been configured'} defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Command (exec)</label>
            <Input size="small" value={container.Lifecycle.postStart?.command ?? ''} onChange={(e) => onChange({ ...container, Lifecycle: { ...container.Lifecycle, postStart: { type: 'exec', command: e.target.value } } })} placeholder='/bin/sh -c "sleep 5"' />
          </div>
        </ModalCard>

        <ModalCard title="PreStop" subtitle={container.Lifecycle.preStop?.command ? 'Command will be invoked' : 'No handler has been configured'} defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Command (exec)</label>
            <Input size="small" value={container.Lifecycle.preStop?.command ?? ''} onChange={(e) => onChange({ ...container, Lifecycle: { ...container.Lifecycle, preStop: { type: 'exec', command: e.target.value } } })} placeholder='/bin/sh -c "sleep 10"' />
          </div>
        </ModalCard>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-3 mb-3">
        {/* Security Context */}
        <SectionHeading title="Security Context" description="The security context defines privilege and access control settings for a container." />

        <ModalCard title="Privilege escalation" subtitle="Allow a container to gain more privileges than its parent." defaultOpen={false}>
          <Radio.Group
            value={container.SecurityContext.allowPrivilegeEscalation || 'False'}
            onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, allowPrivilegeEscalation: e.target.value } })}
            className="flex flex-col gap-1"
          >
            <Radio value="True"><span className="text-sm">Allow privilege escalation</span></Radio>
            <Radio value="False"><span className="text-sm">Do not allow privilege escalation</span></Radio>
          </Radio.Group>
        </ModalCard>

        <ModalCard title="Privileged mode" subtitle="Run container in privileged mode." defaultOpen={false}>
          <Radio.Group
            value={container.SecurityContext.privileged || 'False'}
            onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, privileged: e.target.value } })}
            className="flex flex-col gap-1"
          >
            <Radio value="True"><span className="text-sm">Enable privileged mode</span></Radio>
            <Radio value="False"><span className="text-sm">Do not enable privileged mode</span></Radio>
          </Radio.Group>
        </ModalCard>

        <ModalCard title="Read only root file system" subtitle="Require that containers run with a read-only root filesystem." defaultOpen={false}>
          <Radio.Group
            value={container.SecurityContext.readOnlyRootFilesystem || 'False'}
            onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, readOnlyRootFilesystem: e.target.value } })}
            className="flex flex-col gap-1"
          >
            <Radio value="True"><span className="text-sm">Enable read only root file system</span></Radio>
            <Radio value="False"><span className="text-sm">Do not enable read only root file system</span></Radio>
          </Radio.Group>
        </ModalCard>

        <ModalCard title="Run as non-root" subtitle="Require that containers run as a non-root user." defaultOpen={false}>
          <Radio.Group
            value={container.SecurityContext.runAsNonRoot || 'False'}
            onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, runAsNonRoot: e.target.value } })}
            className="flex flex-col gap-1"
          >
            <Radio value="True"><span className="text-sm">Enable run as non-root</span></Radio>
            <Radio value="False"><span className="text-sm">Do not enable run as non-root</span></Radio>
          </Radio.Group>
        </ModalCard>

        <ModalCard title="Run as user" subtitle="The UID to run the entrypoint of the container process." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Run as user ID</label>
            <Input size="small" value={container.SecurityContext.runAsUser ?? ''} onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, runAsUser: e.target.value } })} placeholder="1000" />
          </div>
        </ModalCard>

        <ModalCard title="Run as group" subtitle="The GID to run the entrypoint of the container process." defaultOpen={false}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Run as group ID</label>
            <Input size="small" value={container.SecurityContext.runAsGroup ?? ''} onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, runAsGroup: e.target.value } })} placeholder="1000" />
          </div>
        </ModalCard>

        <ModalCard title="POSIX capabilities" subtitle="POSIX capabilities to add or drop from the container." defaultOpen={false}>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => addPosixCapability('add')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <PlusOutlined style={{ fontSize: 10 }} /> Define Added POSIX Capability
                </button>
              </div>
              {addedPosixCapabilities.length > 0 && (
                <div className="space-y-3">
                  {addedPosixCapabilities.map((capability, i) => (
                    <div key={`security-context-cap-add-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Capability</label>
                          <AutoComplete
                            className="w-full"
                            value={capability}
                            options={posixCapabilityOptions.map((value) => ({ value }))}
                            onChange={(value) => updateAddedPosixCapabilityAt(i, value)}
                            filterOption={(inputValue, option) => (option?.value ?? '').toUpperCase().includes(inputValue.toUpperCase())}
                          >
                            <Input size="small" placeholder="Capability" />
                          </AutoComplete>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePosixCapabilityAt('add', i)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                          aria-label="Remove added POSIX capability"
                        >
                          <CloseOutlined style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => addPosixCapability('drop')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <PlusOutlined style={{ fontSize: 10 }} /> Define Dropped POSIX Capability
                </button>
              </div>
              {droppedPosixCapabilities.length > 0 && (
                <div className="space-y-3">
                  {droppedPosixCapabilities.map((capability, i) => (
                    <div key={`security-context-cap-drop-${i}`} className="rounded border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Capability</label>
                          <AutoComplete
                            className="w-full"
                            value={capability}
                            options={posixCapabilityOptions.map((value) => ({ value }))}
                            onChange={(value) => updateDroppedPosixCapabilityAt(i, value)}
                            filterOption={(inputValue, option) => (option?.value ?? '').toUpperCase().includes(inputValue.toUpperCase())}
                          >
                            <Input size="small" placeholder="Capability" />
                          </AutoComplete>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePosixCapabilityAt('drop', i)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                          aria-label="Remove dropped POSIX capability"
                        >
                          <CloseOutlined style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalCard>

        <ModalCard title="SELinux options" subtitle="The SELinux context to be applied to the container." defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SELinux level</label>
              <Input
                size="small"
                value={container.SecurityContext.seLinuxLevel ?? ''}
                onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, seLinuxLevel: e.target.value } })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SELinux role</label>
              <Input
                size="small"
                value={container.SecurityContext.seLinuxRole ?? ''}
                onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, seLinuxRole: e.target.value } })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SELinux type</label>
              <Input
                size="small"
                value={container.SecurityContext.seLinuxType ?? ''}
                onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, seLinuxType: e.target.value } })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SELinux user</label>
              <Input
                size="small"
                value={container.SecurityContext.seLinuxUser ?? ''}
                onChange={(e) => onChange({ ...container, SecurityContext: { ...container.SecurityContext, seLinuxUser: e.target.value } })}
              />
            </div>
          </div>
        </ModalCard>
      </div>
    </div>
  )
}

// ── Container summary card (list view) ───────────────────────────────────────

function resolveResourceValue(resources: Record<string, string | undefined>, keys: string[]): string {
  for (const key of keys) {
    const value = resources[key]
    if ((value ?? '').trim()) return value!.trim()
  }
  return ''
}

function ResourceSummaryLine({ label, request, limit }: { label: string; request: string; limit: string }) {
  if (!request && !limit) return null
  if (!request) {
    return (
      <div className="text-xs text-slate-600">
        {label} limit set to <strong>{limit}</strong>
      </div>
    )
  }
  return (
    <div className="text-xs text-slate-600">
      Requesting <strong>{request}</strong> of {label.toLowerCase()}
      {limit && (
        <span> with a limit of <strong>{limit}</strong></span>
      )}
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{title}</div>
      <div className="text-xs text-slate-700 mt-1 space-y-1">{children}</div>
    </div>
  )
}

function ContainerSummary({ container, feedName }: { container: ContainerSpec; feedName?: string }) {
  const { Name, Image, PackageId, Resources, Ports, VolumeMounts, EnvironmentVariables, FieldRefEnvironmentVariables, ConfigMapEnvFromSource, ConfigMapEnvironmentVariables, SecretEnvFromSource, SecretEnvironmentVariables } = container
  const memoryRequest = resolveResourceValue(Resources.requests, ['memory'])
  const memoryLimit = resolveResourceValue(Resources.limits, ['memory'])
  const cpuRequest = resolveResourceValue(Resources.requests, ['cpu'])
  const cpuLimit = resolveResourceValue(Resources.limits, ['cpu'])
  const ephemeralStorageRequest = resolveResourceValue(Resources.requests, ['ephemeralStorage', 'ephemeral-storage'])
  const ephemeralStorageLimit = resolveResourceValue(Resources.limits, ['ephemeralStorage', 'ephemeral-storage'])
  const nvidiaGpuRequest = resolveResourceValue(Resources.requests, ['nvidiaGpu', 'nvidia.com/gpu'])
  const nvidiaGpuLimit = resolveResourceValue(Resources.limits, ['nvidiaGpu', 'nvidia.com/gpu'])
  const amdGpuRequest = resolveResourceValue(Resources.requests, ['amdGpu', 'amd.com/gpu'])
  const amdGpuLimit = resolveResourceValue(Resources.limits, ['amdGpu', 'amd.com/gpu'])

  const imageDisplayValue = (Image || PackageId || '').trim()
  const ports = (Ports ?? []).filter((port) => (port.value ?? '').trim())
  const mounts = (VolumeMounts ?? []).filter((mount) => (mount.key ?? '').trim() || (mount.value ?? '').trim() || (mount.option ?? '').trim())
  const envVars = (EnvironmentVariables ?? []).filter((item) => (item.key ?? '').trim())
  const fieldRefEnvVars = (FieldRefEnvironmentVariables ?? []).filter((item) => (item.key ?? '').trim() && (item.value ?? '').trim())
  const configMapEnvFrom = (ConfigMapEnvFromSource ?? []).filter((item) => (item.key ?? '').trim())
  const configMapEnvVars = (ConfigMapEnvironmentVariables ?? []).filter((item) => (item.key ?? '').trim() && (item.value ?? '').trim() && (item.option ?? '').trim())
  const secretEnvFrom = (SecretEnvFromSource ?? []).filter((item) => (item.key ?? '').trim())
  const secretEnvVars = (SecretEnvironmentVariables ?? []).filter((item) => (item.key ?? '').trim() && (item.value ?? '').trim() && (item.option ?? '').trim())

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-slate-800 leading-tight">{Name || 'Unnamed Container'}</h3>

      {imageDisplayValue && (
        <div className="text-xs text-slate-600">
          Configuring the <strong>{imageDisplayValue}</strong> container
          {feedName && (
            <span> from feed <strong>{feedName}</strong></span>
          )}
        </div>
      )}

      <ResourceSummaryLine label="Memory" request={memoryRequest} limit={memoryLimit} />
      <ResourceSummaryLine label="CPU" request={cpuRequest} limit={cpuLimit} />
      <ResourceSummaryLine label="Ephemeral Storage" request={ephemeralStorageRequest} limit={ephemeralStorageLimit} />
      <ResourceSummaryLine label="Nvidia GPU" request={nvidiaGpuRequest} limit={nvidiaGpuLimit} />
      <ResourceSummaryLine label="AMD GPU" request={amdGpuRequest} limit={amdGpuLimit} />

      {ports.length > 0 && (
        <SummarySection title="Ports">
          {ports.map((port, index) => (
            <div key={`summary-port-${index}`}>
              {port.key ? <span>{port.key}: </span> : null}
              {port.value}{port.option ? `/${port.option}` : ''}
            </div>
          ))}
        </SummarySection>
      )}

      {(configMapEnvFrom.length > 0 || configMapEnvVars.length > 0) && (
        <SummarySection title="Environment Variables from Config Map">
          {configMapEnvFrom.map((item, index) => {
            const optional = item.option !== 'False'
            const prefix = (item.value ?? '').trim()
            return (
              <div key={`summary-config-map-env-from-${index}`}>
                Environment variables from {optional ? 'an optional ' : ''}config map <strong>{item.key}</strong>
                {prefix ? <span> with prefix <strong>{prefix}</strong></span> : null}
              </div>
            )
          })}
          {configMapEnvVars.map((item, index) => (
            <div key={`summary-config-map-env-var-${index}`}>
              <strong>{item.key}</strong> from config map <strong>{item.value}</strong> key <strong>{item.option}</strong>
            </div>
          ))}
        </SummarySection>
      )}

      {(secretEnvFrom.length > 0 || secretEnvVars.length > 0) && (
        <SummarySection title="Environment Variables from Secret">
          {secretEnvFrom.map((item, index) => {
            const optional = item.option !== 'False'
            const prefix = (item.value ?? '').trim()
            return (
              <div key={`summary-secret-env-from-${index}`}>
                Environment variables from {optional ? 'an optional ' : ''}secret <strong>{item.key}</strong>
                {prefix ? <span> with prefix <strong>{prefix}</strong></span> : null}
              </div>
            )
          })}
          {secretEnvVars.map((item, index) => (
            <div key={`summary-secret-env-var-${index}`}>
              <strong>{item.key}</strong> from secret <strong>{item.value}</strong> key <strong>{item.option}</strong>
            </div>
          ))}
        </SummarySection>
      )}

      {envVars.length > 0 && (
        <SummarySection title="Environment Variables">
          {envVars.map((item, index) => (
            <div key={`summary-env-var-${index}`}>
              <strong>{item.key}</strong>{item.value ? ` = ${item.value}` : ''}
            </div>
          ))}
        </SummarySection>
      )}

      {fieldRefEnvVars.length > 0 && (
        <SummarySection title="Pod and Container Field Environment Variables">
          {fieldRefEnvVars.map((item, index) => (
            <div key={`summary-field-ref-${index}`}>
              <strong>{item.key}</strong> from field path <strong>{item.value}</strong>
            </div>
          ))}
        </SummarySection>
      )}

      {mounts.length > 0 && (
        <SummarySection title="Volume Mounts">
          {mounts.map((mount, index) => (
            <div key={`summary-volume-mount-${index}`} className="rounded border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-500 w-24">Name</td>
                    <td className="px-2 py-1.5 text-slate-700">{mount.key || '—'}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-500">Path</td>
                    <td className="px-2 py-1.5 text-slate-700">{mount.value || '—'}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-slate-500">Sub Path</td>
                    <td className="px-2 py-1.5 text-slate-700">{mount.option || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </SummarySection>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ContainersSection({ containers, onChange, feedId, packageId, onFeedChange }: ContainersSectionProps) {
  const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
  const [feedsLoading, setFeedsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<ContainerSpec>(defaultContainer())

  const loadFeeds = useCallback(() => {
    setFeedsLoading(true)
    getExternalFeeds()
      .then((res) => setFeeds(res.externalFeeds ?? []))
      .catch(() => {})
      .finally(() => setFeedsLoading(false))
  }, [])

  useEffect(() => { loadFeeds() }, [loadFeeds])

  const feedNameById = useMemo(() => {
    const byId = new Map<number, string>()
    for (const feed of feeds) {
      const id = Number(feed.id)
      if (!Number.isFinite(id)) continue
      byId.set(id, feed.name)
    }
    return byId
  }, [feeds])

  const openAdd = () => {
    setDraft(defaultContainer())
    setEditingIndex(null)
    setModalOpen(true)
  }

  const openEdit = (index: number) => {
    setDraft({ ...containers[index] })
    setEditingIndex(index)
    setModalOpen(true)
  }

  const handleOk = () => {
    if (editingIndex === null) {
      onChange([...containers, draft])
    } else {
      onChange(containers.map((c, i) => (i === editingIndex ? draft : c)))
    }
    setModalOpen(false)
  }

  return (
    <CollapsibleSection title="Containers" subtitle="Add containers that make up the pod managed by this deployment." defaultOpen>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <PlusOutlined style={{ fontSize: 11 }} />
          Add Container
        </button>
      </div>

      {containers.length > 0 && (
        <div className="space-y-2">
          {containers.map((container, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-4 py-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => openEdit(i)}
            >
              <div className="flex-1 min-w-0">
                <ContainerSummary
                  container={container}
                  feedName={
                    container.FeedId === null || container.FeedId === undefined
                      ? undefined
                      : (feedNameById.get(Number(container.FeedId)) ?? `Feed #${container.FeedId}`)
                  }
                />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(containers.filter((_, j) => j !== i)) }}
                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mt-0.5"
              >
                <CloseOutlined style={{ fontSize: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editingIndex === null ? 'Add Container' : 'Edit Container'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={900}
        styles={{ body: { maxHeight: '55vh', overflowY: 'auto', padding: '16px 24px' } }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center px-4 py-[6px] text-sm font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              className="inline-flex items-center px-4 py-[6px] text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Ok
            </button>
          </div>
        }
      >
        <ContainerModalForm
          container={draft}
          onChange={setDraft}
          feeds={feeds}
          feedsLoading={feedsLoading}
          onRefreshFeeds={loadFeeds}
          feedId={draft.FeedId}
          packageId={draft.PackageId}
          onFeedChange={(fid, pid) => setDraft({ ...draft, FeedId: fid, PackageId: pid })}
        />
      </Modal>
    </CollapsibleSection>
  )
}
