import React, { useState, useEffect, useCallback } from 'react'
import { Input, Select, Radio, Modal, Tooltip } from 'antd'
import { PlusOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { type ContainerSpec, type ProbeConfig, defaultContainer } from '../types'
import { getExternalFeeds, type ExternalFeedDto } from 'pages/apis/externalFeed'

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

// ── Probe editor card ─────────────────────────────────────────────────────────

function ProbeModalCard({ label, subtitle, probe, onChange }: {
  label: string
  subtitle: string
  probe: ProbeConfig
  onChange: (p: ProbeConfig) => void
}) {
  const currentSubtitle = probe.type ? `Type: ${probe.type}` : subtitle

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
            { label: 'HTTP GET', value: 'httpGet' },
            { label: 'TCP Socket', value: 'tcpSocket' },
            { label: 'Exec', value: 'exec' },
          ]}
        />
      </div>
      {probe.type === 'httpGet' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Path</label>
            <Input size="small" value={probe.httpGet?.path ?? ''} onChange={(e) => onChange({ ...probe, httpGet: { path: e.target.value, port: probe.httpGet?.port ?? '', scheme: probe.httpGet?.scheme ?? 'HTTP' } })} placeholder="/" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
            <Input size="small" value={probe.httpGet?.port ?? ''} onChange={(e) => onChange({ ...probe, httpGet: { ...probe.httpGet!, port: e.target.value } })} placeholder="8080" />
          </div>
        </>
      )}
      {probe.type === 'tcpSocket' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
          <Input size="small" value={probe.tcpSocket?.port ?? ''} onChange={(e) => onChange({ ...probe, tcpSocket: { port: e.target.value } })} placeholder="8080" />
        </div>
      )}
      {probe.type === 'exec' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Command</label>
          <Input size="small" value={probe.exec?.command ?? ''} onChange={(e) => onChange({ ...probe, exec: { command: e.target.value } })} placeholder="cat /tmp/healthy" />
        </div>
      )}
      {probe.type && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Initial Delay (s)</label>
            <Input size="small" type="number" value={probe.initialDelaySeconds} onChange={(e) => onChange({ ...probe, initialDelaySeconds: e.target.value })} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period (s)</label>
            <Input size="small" type="number" value={probe.periodSeconds} onChange={(e) => onChange({ ...probe, periodSeconds: e.target.value })} placeholder="10" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Timeout (s)</label>
            <Input size="small" type="number" value={probe.timeoutSeconds} onChange={(e) => onChange({ ...probe, timeoutSeconds: e.target.value })} placeholder="1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Failure Threshold</label>
            <Input size="small" type="number" value={probe.failureThreshold} onChange={(e) => onChange({ ...probe, failureThreshold: e.target.value })} placeholder="3" />
          </div>
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
  const selectedFeed = feeds.find((f) => f.id === feedId) ?? null
  const registryHost = selectedFeed?.registryPath || (selectedFeed?.feedUri ? (() => {
    try {
      const u = new URL(selectedFeed.feedUri)
      return u.port && u.port !== '443' ? `${u.hostname}:${u.port}` : u.hostname
    } catch { return selectedFeed.feedUri }
  })() : '')
  const imagePreview = registryHost && packageId ? `${registryHost}/${packageId}` : packageId

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
              <Input
                size="small"
                value={packageId}
                onChange={(e) => onFeedChange(feedId, e.target.value)}
                placeholder="my-image"
              />
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
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 pb-1 border-b border-slate-100">
              <span className="text-[11px] font-medium text-slate-400">Name</span>
              <span className="text-[11px] font-medium text-slate-400">Port</span>
              <span className="text-[11px] font-medium text-slate-400">Protocol</span>
            </div>
            {container.Ports.map((port, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input size="small" placeholder="http" value={port.key} onChange={(e) => onChange({ ...container, Ports: container.Ports.map((p, j) => j === i ? { ...p, key: e.target.value } : p) })} className="flex-1" />
                <Input size="small" placeholder="8080" value={port.value} onChange={(e) => onChange({ ...container, Ports: container.Ports.map((p, j) => j === i ? { ...p, value: e.target.value } : p) })} style={{ width: 80 }} />
                <Select size="small" value={port.option || 'TCP'} onChange={(v) => onChange({ ...container, Ports: container.Ports.map((p, j) => j === i ? { ...p, option: v } : p) })} style={{ width: 90 }} options={[{ label: 'TCP', value: 'TCP' }, { label: 'UDP', value: 'UDP' }]} />
                <button type="button" onClick={() => onChange({ ...container, Ports: container.Ports.filter((_, j) => j !== i) })} className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors">
                  <CloseOutlined style={{ fontSize: 11 }} />
                </button>
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
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 pb-1 border-b border-slate-100">
              <span className="text-[11px] font-medium text-slate-400">Volume Name</span>
              <span className="text-[11px] font-medium text-slate-400">Mount Path</span>
              <span className="text-[11px] font-medium text-slate-400">Sub Path</span>
            </div>
            {container.VolumeMounts.map((mount, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input size="small" placeholder="my-volume" value={mount.key} onChange={(e) => onChange({ ...container, VolumeMounts: container.VolumeMounts.map((m, j) => j === i ? { ...m, key: e.target.value } : m) })} className="flex-1" />
                <Input size="small" placeholder="/app/data" value={mount.value} onChange={(e) => onChange({ ...container, VolumeMounts: container.VolumeMounts.map((m, j) => j === i ? { ...m, value: e.target.value } : m) })} className="flex-1" />
                <Input size="small" placeholder="subpath" value={mount.option} onChange={(e) => onChange({ ...container, VolumeMounts: container.VolumeMounts.map((m, j) => j === i ? { ...m, option: e.target.value } : m) })} style={{ width: 100 }} />
                <button type="button" onClick={() => onChange({ ...container, VolumeMounts: container.VolumeMounts.filter((_, j) => j !== i) })} className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors">
                  <CloseOutlined style={{ fontSize: 11 }} />
                </button>
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

      {/* Environment Variables */}
      <SectionHeading title="Environment Variables" description="Environment variables can be defined in the container from key/value pairs, or from data held in secret or config map resources." />

      <ModalCard
        title="ConfigMap Environment Variables"
        subtitle={container.ConfigMapEnvFromSource.filter((s) => s.key).length > 0
          ? `Setting environment variables from config map ${container.ConfigMapEnvFromSource.filter((s) => s.key).map((s) => s.key).join(', ')}`
          : 'No environment variables from ConfigMap included'}
        defaultOpen={false}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange({ ...container, ConfigMapEnvFromSource: [...container.ConfigMapEnvFromSource, { key: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <PlusOutlined style={{ fontSize: 10 }} /> Add ConfigMap Source
          </button>
        </div>
        {container.ConfigMapEnvFromSource.length > 0 && (
          <div className="space-y-2">
            {container.ConfigMapEnvFromSource.map((src, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input size="small" placeholder="ConfigMap name" value={src.key}
                  onChange={(e) => onChange({ ...container, ConfigMapEnvFromSource: container.ConfigMapEnvFromSource.map((s, j) => j === i ? { key: e.target.value } : s) })}
                  className="flex-1" />
                <button type="button" onClick={() => onChange({ ...container, ConfigMapEnvFromSource: container.ConfigMapEnvFromSource.filter((_, j) => j !== i) })}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors">
                  <CloseOutlined style={{ fontSize: 11 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ModalCard>

      {/* Liveness Probe */}
      <SectionHeading title="Liveness Probe" description="Liveness probes are used to confirm that a container is still running and healthy." />
      <ProbeModalCard label="Liveness Probe Type" subtitle="No liveness probe type selected" probe={container.LivenessProbe} onChange={(p) => onChange({ ...container, LivenessProbe: p })} />

      {/* Startup Probe */}
      <SectionHeading title="Startup Probe" description="Startup probes are useful for delaying liveness probes until the container has successfully started." />
      <ProbeModalCard label="Startup Probe Type" subtitle="No startup probe type selected" probe={container.StartupProbe} onChange={(p) => onChange({ ...container, StartupProbe: p })} />

      {/* Readiness Probe */}
      <SectionHeading title="Readiness Probe" description="Readiness probes are used to confirm that a container has started." />
      <ProbeModalCard label="Readiness Probe Type" subtitle="No readiness probe type selected" probe={container.ReadinessProbe} onChange={(p) => onChange({ ...container, ReadinessProbe: p })} />

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
    </div>
  )
}

// ── Container summary card (list view) ───────────────────────────────────────

function ContainerSummary({ container }: { container: ContainerSpec }) {
  const { Name, Image, Resources, Ports, ConfigMapEnvFromSource } = container
  const hasMemory = Resources.requests.memory || Resources.limits.memory
  const hasCpu = Resources.requests.cpu || Resources.limits.cpu

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1 leading-tight">{Name || 'Unnamed Container'}</h3>
      {Image && (
        <p className="text-xs text-slate-500 mb-0.5">
          Configuring the <strong>{Image}</strong> container
        </p>
      )}
      {hasMemory && (
        <p className="text-xs text-slate-500 mb-0.5">
          Memory: {Resources.requests.memory || '—'} request / {Resources.limits.memory || '—'} limit
        </p>
      )}
      {hasCpu && (
        <p className="text-xs text-slate-500 mb-0.5">
          CPU: {Resources.requests.cpu || '—'} request / {Resources.limits.cpu || '—'} limit
        </p>
      )}
      {Ports.length > 0 && (
        <p className="text-xs text-slate-500 mb-0.5">
          <span className="font-medium">Ports</span>
          {Ports.map((p, i) => (
            <span key={i} className="ml-2 text-slate-400">
              {p.key ? `${p.key} → ` : ''}{p.value}{p.option ? ` (${p.option})` : ''}
            </span>
          ))}
        </p>
      )}
      {ConfigMapEnvFromSource.length > 0 && (
        <p className="text-xs text-slate-500 mb-0">
          <span className="font-medium">ConfigMap Env</span>
          {ConfigMapEnvFromSource.map((s, i) => (
            <span key={i} className="ml-2 text-slate-400">{s.key}</span>
          ))}
        </p>
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
                <ContainerSummary container={container} />
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
          feedId={feedId}
          packageId={packageId}
          onFeedChange={onFeedChange}
        />
      </Modal>
    </CollapsibleSection>
  )
}
