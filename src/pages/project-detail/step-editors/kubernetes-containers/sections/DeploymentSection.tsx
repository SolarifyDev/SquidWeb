import React, { useState, useMemo } from 'react'
import { Input, Radio, Button, Modal, message } from 'antd'
import { CopyOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { KeyValueListEditor } from '../../shared/KeyValueListEditor'
import { VolumesSection } from './VolumesSection'
import { ContainersSection } from './ContainersSection'
import { generateAllYaml } from '../generateYaml'
import { parseYamlToState } from '../parseYamlToState'
import type { ContainersEditorState, HostAlias } from '../types'

interface DeploymentSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

function EditYamlSubSection({ state, onApply }: { state: ContainersEditorState; onApply: (partial: Partial<ContainersEditorState>) => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const generatedYaml = useMemo(() => generateAllYaml(state), [state])

  const openModal = () => {
    setYamlText(generatedYaml)
    setParseError(null)
    setModalOpen(true)
  }

  const handleYamlChange = (text: string) => {
    setYamlText(text)
    setParseError(null)
  }

  const handleDone = () => {
    try {
      const partial = parseYamlToState(yamlText)
      onApply(partial)
      setModalOpen(false)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid YAML')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlText)
      message.success('Copied to clipboard')
    } catch {
      message.error('Failed to copy')
    }
  }

  const lineCount = yamlText.split('\n').length

  return (
    <CollapsibleSection title="Edit YAML" subtitle="Edit the resource YAML." defaultOpen>
      <p className="text-xs text-slate-500 leading-relaxed mb-0">
        Directly edit the raw Kubernetes resource in YAML. This is intended to populate the step from existing YAML, or for the resource created by this step to be exported.
      </p>
      <p className="text-xs text-slate-500 leading-relaxed mb-0">
        Be aware that not every valid Kubernetes property is reflected in the UI, and unrecognized properties are ignored. Also note that the YAML here is parsed literally, and does not implement variable replacements. The <code className="text-xs bg-slate-100 px-1 rounded">Deploy raw Kubernetes YAML</code> step can be used to deploy raw YAML without these restrictions.
      </p>
      <div>
        <Button onClick={openModal}>Edit YAML</Button>
      </div>

      <Modal
        title="Edit YAML"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={720}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleDone}>Done</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Warning callout */}
          <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-amber-500 flex-shrink-0 mt-0.5">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="mb-1 font-medium">Not all fields are supported</p>
              <p className="mb-0">
                Not every valid Kubernetes property is reflected in the UI. Unrecognized properties will be ignored when applying YAML back to the form. Variable substitution syntax (<code className="text-xs bg-amber-100 px-1 rounded">{"#{Variable}"}</code>) is not processed in this preview.
              </p>
            </div>
          </div>

          {parseError && (
            <div className="flex gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <span className="font-medium">Parse error:</span> {parseError}
            </div>
          )}

          {/* Editable YAML with line numbers */}
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                Copy to clipboard
              </Button>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="flex bg-white max-h-[60vh] overflow-auto">
                {/* Line numbers */}
                <div className="flex-shrink-0 bg-slate-50 border-r border-slate-200 select-none pointer-events-none">
                  <pre className="text-xs text-slate-400 text-right px-3 py-3 leading-[1.6] font-mono m-0">
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </pre>
                </div>
                {/* Editable YAML */}
                <textarea
                  value={yamlText}
                  onChange={(e) => handleYamlChange(e.target.value)}
                  spellCheck={false}
                  className="flex-1 min-w-0 resize-none text-xs text-slate-800 px-4 py-3 leading-[1.6] font-mono border-none outline-none bg-white"
                  style={{ minHeight: `${Math.max(lineCount, 10) * 1.6 * 12 + 24}px` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </CollapsibleSection>
  )
}

export function DeploymentSection({ state, updateField }: DeploymentSectionProps) {
  const handleYamlApply = (partial: Partial<ContainersEditorState>) => {
    for (const [key, value] of Object.entries(partial) as [keyof ContainersEditorState, ContainersEditorState[keyof ContainersEditorState]][]) {
      updateField(key, value)
    }
  }

  const updateDnsOption = (index: number, field: 'name' | 'value', value: string) => {
    updateField('dnsConfigOptions', state.dnsConfigOptions.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)))
  }

  const updatePodSysctl = (index: number, field: 'name' | 'value', value: string) => {
    updateField('sysctls', state.sysctls.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const updateToleration = (index: number, field: 'key' | 'operator' | 'value' | 'effect', value: string) => {
    updateField('tolerations', state.tolerations.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  return (
    <CollapsibleSection title="Deployment" subtitle="Configure the Kubernetes Deployment resource." defaultOpen fullWidth>
      <EditYamlSubSection state={state} onApply={handleYamlApply} />

      <CollapsibleSection title="Resource Type" subtitle="Select whether to deploy a Deployment, StatefulSet, DaemonSet or Job." defaultOpen>
        <Radio.Group value={state.resourceType} onChange={(e) => updateField('resourceType', e.target.value)} className="flex flex-col gap-0">
          <Radio value="Deployment"><span className="text-sm">Deployment</span></Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-2">
            A Deployment provides declarative updates for Pods and ReplicaSets.{' '}
            <a href="https://kubernetes.io/docs/concepts/workloads/controllers/deployment/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
          <Radio value="StatefulSet"><span className="text-sm">StatefulSet</span></Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-2">
            StatefulSet is the workload API object used to manage stateful applications.{' '}
            <a href="https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
          <Radio value="DaemonSet"><span className="text-sm">DaemonSet</span></Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-2">
            A DaemonSet ensures that all (or some) nodes run a copy of a pod.{' '}
            <a href="https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
          <Radio value="Job"><span className="text-sm">Job</span></Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-0">
            A Job creates one or more Pods and will continue to retry execution of the Pods until a specified number of them successfully terminate.{' '}
            <a href="https://kubernetes.io/docs/concepts/workloads/controllers/job/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </Radio.Group>
      </CollapsibleSection>

      <CollapsibleSection title="Deployment" subtitle="Enter the details for the deployment." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Deployment name</label>
          <Input value={state.deploymentName} onChange={(e) => updateField('deploymentName', e.target.value)} placeholder="my-deployment" />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">The name of the deployment must be unique, and is used by Kubernetes when updating an existing resource.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Replicas</label>
          <Input value={state.replicas} onChange={(e) => updateField('replicas', e.target.value)} placeholder="1 (default)" />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">The number of pod replicas to create from this deployment.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Revision history limit</label>
          <Input value={state.revisionHistoryLimit} onChange={(e) => updateField('revisionHistoryLimit', e.target.value)} placeholder="" />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">The number of revisions to retain.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Progression deadline in seconds</label>
          <Input value={state.progressDeadlineSeconds} onChange={(e) => updateField('progressDeadlineSeconds', e.target.value)} placeholder="600 (default)" />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">The maximum time for a deployment to make progress before it is considered to be failed.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pod termination grace period in seconds</label>
          <Input value={state.podTerminationGracePeriodSeconds} onChange={(e) => updateField('podTerminationGracePeriodSeconds', e.target.value)} placeholder="30 (default)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Labels</label>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">Add labels to be applied to the deployment resource, pods managed by the deployment resource, the service and the ingress.</p>
          <KeyValueListEditor items={state.deploymentLabels} onChange={(v) => updateField('deploymentLabels', v)} addLabel="Add Label" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Namespace"
        subtitle={<span>The Kubernetes context with be set with the namespace <strong>{state.namespace || '#{K8SNameSpace}'}</strong></span>}
        defaultOpen={false}
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Namespace</label>
          <Input value={state.namespace} onChange={(e) => updateField('namespace', e.target.value)} placeholder="default" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Deployment Strategy" subtitle="Choose how the deployment will be updated." defaultOpen>
        <Radio.Group value={state.deploymentStyle} onChange={(e) => updateField('deploymentStyle', e.target.value)} className="flex flex-col gap-0">
          <Radio value="Recreate">
            <span className="text-sm"><strong>Recreate deployments</strong> delete existing pods before creating new pods</span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-1">
            Use this option when container versions can not be mixed. This strategy does result in downtime.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-3">
            Learn more about the <a href="https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#recreate-deployment" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">recreate strategy</a>.
          </p>

          <Radio value="RollingUpdate">
            <span className="text-sm"><strong>Rolling update deployments</strong> deploys new pods while removing older pods</span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-1">
            This option requires that two container versions can run side by side, and avoids downtime.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-2">
            Learn more about the <a href="https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">rolling update strategy</a>.
          </p>
          <Radio value="BlueGreen">
            <span className="text-sm"><strong>Blue/Green deployments</strong> create a new deployment resource and point the service to new pods</span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-1">
            This strategy requires that two container versions can run side by side, and ensures that traffic is cut over to the new pods in a single operation with no downtime.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-0">
            Learn more about the <a href="https://kubernetes.io/docs/concepts/workloads/controllers/deployment/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">blue/green strategy</a>.
          </p>
        </Radio.Group>
        {state.deploymentStyle === 'RollingUpdate' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Unavailable</label>
              <Input size="small" value={state.maxUnavailable} onChange={(e) => updateField('maxUnavailable', e.target.value)} placeholder="25%" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Surge</label>
              <Input size="small" value={state.maxSurge} onChange={(e) => updateField('maxSurge', e.target.value)} placeholder="25%" />
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Kubernetes Object Status Check" subtitle="Configure how to validate the status of your Kubernetes objects" defaultOpen>
        <Radio.Group value={state.objectStatusCheck} onChange={(e) => updateField('objectStatusCheck', e.target.value)} className="flex flex-col gap-0">
          <Radio value="enabled">
            <span className="text-sm">
              Check that Kubernetes objects are running successfully{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ml-1" style={{ backgroundColor: 'rgb(238,250,245)', color: 'rgb(0,106,61)' }}>Recommended</span>
            </span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-3">
            Get real-time status updates while this step is running and validate the status of your Kubernetes objects before considering this step successful.
          </p>

          <Radio value="legacyWait">
            <span className="text-sm">
              Check that the rollout was successful{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ml-1" style={{ backgroundColor: 'rgb(225,225,225)', color: 'rgb(46,46,46)' }}>Legacy</span>
            </span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-3">
            Use the <code className="text-xs bg-slate-100 px-1 rounded">kubectl rollout status</code> command to get confirmation that your pods have updated. This option doesn't show status updates in real-time and may be deprecated in future.
          </p>

          <Radio value="disabled">
            <span className="text-sm">Don't do any verification checks</span>
          </Radio>
          <p className="text-xs text-slate-400 leading-relaxed ml-6 mt-0 mb-0">
            The deployment will be marked as complete without waiting for any updates from Kubernetes.
          </p>
        </Radio.Group>
      </CollapsibleSection>

      <VolumesSection volumes={state.volumes} onChange={(v) => updateField('volumes', v)} />

      <CollapsibleSection title="Host Aliases" subtitle="Add Host Aliases." defaultOpen>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => updateField('hostAliases', [...state.hostAliases, { ip: '', hostnames: '' }])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <PlusOutlined style={{ fontSize: 11 }} />
            Add Host Alias
          </button>
        </div>
        {state.hostAliases.length > 0 && (
          <div className="space-y-2">
            {state.hostAliases.map((alias, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input size="small" placeholder="IP address" value={alias.ip} onChange={(e) => updateField('hostAliases', state.hostAliases.map((a, j) => j === i ? { ...a, ip: e.target.value } : a))} style={{ width: 140 }} />
                <Input size="small" placeholder="Hostnames (space-separated)" value={alias.hostnames} onChange={(e) => updateField('hostAliases', state.hostAliases.map((a, j) => j === i ? { ...a, hostnames: e.target.value } : a))} className="flex-1" />
                <button
                  type="button"
                  onClick={() => updateField('hostAliases', state.hostAliases.filter((_, j) => j !== i))}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <ContainersSection
        containers={state.containers}
        onChange={(v) => updateField('containers', v)}
        feedId={state.feedId}
        packageId={state.packageId}
        onFeedChange={(feedId, packageId) => {
          updateField('feedId', feedId)
          updateField('packageId', packageId)
        }}
      />

      <CollapsibleSection title="Pod Priority Class Name" subtitle="Set the Priority Class Name for your pod" defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pod priority class name</label>
          <Input
            value={state.podPriorityClassName}
            onChange={(e) => updateField('podPriorityClassName', e.target.value)}
            placeholder="high-priority"
          />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://oc.to/K8sPodPriorityDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            pod priority class names
          </a>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Pod Restart Policy" subtitle="Define the restart policy for the pods in this deployment." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">The restart policy</label>
          <Radio.Group
            value={state.podRestartPolicy}
            onChange={(e) => updateField('podRestartPolicy', e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="Always"><span className="text-sm">Always</span></Radio>
            <Radio value="OnFailure"><span className="text-sm">On Failure</span></Radio>
            <Radio value="Never"><span className="text-sm">Never</span></Radio>
          </Radio.Group>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          A pod&apos;s restart policy determines how and when it should restart.{' '}
          <a
            href="https://oc.to/K8sRestartPolicyDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            More information
          </a>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="DNS Policy" subtitle="Define the DNS policy for the pods in this deployment." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">The DNS policy</label>
          <Radio.Group
            value={state.podDnsPolicy}
            onChange={(e) => updateField('podDnsPolicy', e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="ClusterFirst"><span className="text-sm">Cluster First</span></Radio>
            <Radio value="ClusterFirstWithHostNet"><span className="text-sm">Cluster First With Host Net</span></Radio>
            <Radio value="Default"><span className="text-sm">Default</span></Radio>
            <Radio value="None"><span className="text-sm">None</span></Radio>
          </Radio.Group>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          A pod&apos;s DNS policy determines how name resolution is performed.{' '}
          <a
            href="https://oc.to/K8SPodDNSPolicy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            More information
          </a>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="DNS Config" subtitle="Define the DNS configuration for the pods in this deployment." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nameservers</label>
          <Input.TextArea
            size="small"
            rows={3}
            value={state.podDnsNameservers}
            onChange={(e) => updateField('podDnsNameservers', e.target.value)}
            placeholder={"10.96.0.10\n10.96.0.11"}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            A newline separated list of up to 3 DNS name server IP addresses.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Searches</label>
          <Input.TextArea
            size="small"
            rows={3}
            value={state.podDnsSearches}
            onChange={(e) => updateField('podDnsSearches', e.target.value)}
            placeholder={"svc.cluster.local\nexample.com"}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            A newline separated list of up to 6 DNS search domains for host-name lookup.
          </p>
        </div>

        <div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateField('dnsConfigOptions', [...state.dnsConfigOptions, { name: '', value: '' }])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              Add Options
            </button>
          </div>

          {state.dnsConfigOptions.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-2 gap-2 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-400">Name</span>
                <span className="text-[11px] font-medium text-slate-400">Value (optional)</span>
              </div>
              {state.dnsConfigOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    size="small"
                    placeholder="ndots"
                    value={option.name}
                    onChange={(e) => updateDnsOption(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    size="small"
                    placeholder="2"
                    value={option.value}
                    onChange={(e) => updateDnsOption(index, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('dnsConfigOptions', state.dnsConfigOptions.filter((_, i) => i !== index))}
                    className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <CloseOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed mt-2 mb-0">
            A list of DNS resolver options. Names are required, values are optional.
          </p>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          A pod&apos;s DNS configuration provides settings when the pod DNS policy is set to <code className="text-xs bg-slate-100 px-1 rounded">None</code>.{' '}
          <a
            href="https://oc.to/K8SPodDNSConfiguration"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            More information
          </a>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Host Networking" subtitle="Define if the policy allows the use of HostNetwork in the pod spec." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Host networking</label>
          <Radio.Group
            value={state.podHostNetworking}
            onChange={(e) => updateField('podHostNetworking', e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="True"><span className="text-sm">Enable host networking</span></Radio>
            <Radio value="False"><span className="text-sm">Disable host networking</span></Radio>
          </Radio.Group>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          Controls whether the pod may use the node network namespace. Doing so gives the pod access to the loopback device,
          services listening on localhost, and could be used to snoop on network activity of other pods on the same node.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Pod Security Context" subtitle="The security context to be applied to the pods." defaultOpen>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">FSGroup</label>
          <Input
            size="small"
            value={state.podSecurityFsGroup}
            onChange={(e) => updateField('podSecurityFsGroup', e.target.value)}
            placeholder="1000"
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            A special supplemental group ID that applies to all containers in a pod.{' '}
            <a href="https://oc.to/KubernetesSecurityContext" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Run as group ID</label>
          <Input
            size="small"
            value={state.podSecurityRunAsGroup}
            onChange={(e) => updateField('podSecurityRunAsGroup', e.target.value)}
            placeholder="1000"
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The group ID to run the entrypoint of the container process. Introduced in Kubernetes 1.10.{' '}
            <a href="https://oc.to/KubernetesSecurityContext" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Run as user ID</label>
          <Input
            size="small"
            value={state.podSecurityRunAsUser}
            onChange={(e) => updateField('podSecurityRunAsUser', e.target.value)}
            placeholder="1000"
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The user ID to run the entrypoint of the container process.{' '}
            <a href="https://oc.to/KubernetesSecurityContext" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Supplemental groups</label>
          <Input
            size="small"
            value={state.podSecuritySupplementalGroups}
            onChange={(e) => updateField('podSecuritySupplementalGroups', e.target.value)}
            placeholder="2000, 3000"
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            A comma separated list of group IDs applied to the first process run in each container, in addition to the container&apos;s primary group ID.{' '}
            <a href="https://oc.to/KubernetesSecurityContextSupplementalGroups" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Run as non-root</label>
          <Radio.Group
            value={state.podSecurityRunAsNonRoot}
            onChange={(e) => updateField('podSecurityRunAsNonRoot', e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="True"><span className="text-sm">Enable run as non-root</span></Radio>
            <Radio value="False"><span className="text-sm">Do not enable run as non-root</span></Radio>
          </Radio.Group>
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            Require that containers run as a non-root user.{' '}
            <a href="https://oc.to/KubernetesSecurityContextRunAsNonRoot" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SELinux level</label>
          <Input
            size="small"
            value={state.podSecuritySeLinuxLevel}
            onChange={(e) => updateField('podSecuritySeLinuxLevel', e.target.value)}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The SELinux level that applies to the container.{' '}
            <a href="https://oc.to/KubernetesSecurityContextSELinux" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SELinux role</label>
          <Input
            size="small"
            value={state.podSecuritySeLinuxRole}
            onChange={(e) => updateField('podSecuritySeLinuxRole', e.target.value)}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The SELinux role that applies to the container.{' '}
            <a href="https://oc.to/KubernetesSecurityContextSELinux" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SELinux type</label>
          <Input
            size="small"
            value={state.podSecuritySeLinuxType}
            onChange={(e) => updateField('podSecuritySeLinuxType', e.target.value)}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The SELinux type that applies to the container.{' '}
            <a href="https://oc.to/KubernetesSecurityContextSELinux" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SELinux user</label>
          <Input
            size="small"
            value={state.podSecuritySeLinuxUser}
            onChange={(e) => updateField('podSecuritySeLinuxUser', e.target.value)}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-0">
            The SELinux user that applies to the container.{' '}
            <a href="https://oc.to/KubernetesSecurityContextSELinux" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>

        <div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateField('sysctls', [...state.sysctls, { name: '', value: '' }])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              Add Sysctl
            </button>
          </div>

          {state.sysctls.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-2 gap-2 pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-400">Name</span>
                <span className="text-[11px] font-medium text-slate-400">Value</span>
              </div>
              {state.sysctls.map((sysctl, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    size="small"
                    placeholder="kernel.shm_rmid_forced"
                    value={sysctl.name}
                    onChange={(e) => updatePodSysctl(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    size="small"
                    placeholder="0"
                    value={sysctl.value}
                    onChange={(e) => updatePodSysctl(index, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => updateField('sysctls', state.sysctls.filter((_, i) => i !== index))}
                    className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <CloseOutlined style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed mt-2 mb-0">
            The list of namespaced sysctls used for the pod. Introduced in Kubernetes 1.11.{' '}
            <a href="https://oc.to/KubernetesSecuritySysctl" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">More information</a>.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Pod Affinity / Anti-Affinity"
        subtitle="Define the pod affinity or anti-affinity that determines where the pod resources created by this deployment resource will be placed."
        defaultOpen
      >
        <div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateField('podAffinity', state.podAffinity || '{}')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              Add Pod Affinity
            </button>
          </div>

          {state.podAffinity && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Pod affinity (JSON)</label>
                <button
                  type="button"
                  onClick={() => updateField('podAffinity', '')}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Remove pod affinity"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
              <Input.TextArea
                size="small"
                rows={4}
                value={state.podAffinity}
                onChange={(e) => updateField('podAffinity', e.target.value)}
                placeholder='{"requiredDuringSchedulingIgnoredDuringExecution": []}'
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateField('podAntiAffinity', state.podAntiAffinity || '{}')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              Add Pod Anti-Affinity
            </button>
          </div>

          {state.podAntiAffinity && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Pod anti-affinity (JSON)</label>
                <button
                  type="button"
                  onClick={() => updateField('podAntiAffinity', '')}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Remove pod anti-affinity"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
              <Input.TextArea
                size="small"
                rows={4}
                value={state.podAntiAffinity}
                onChange={(e) => updateField('podAntiAffinity', e.target.value)}
                placeholder='{"requiredDuringSchedulingIgnoredDuringExecution": []}'
              />
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          Pod affinity rules determine which nodes a pod will be placed on based on the presence or absence of other pods.{' '}
          <a
            href="https://oc.to/K8SPodAffinity"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            More information
          </a>
          .
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Node Affinity"
        subtitle="Define the node affinity that determines where the pod resources created by this deployment resource will be placed."
        defaultOpen
      >
        <div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateField('nodeAffinity', state.nodeAffinity || '{}')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              Add Node Affinity
            </button>
          </div>

          {state.nodeAffinity && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Node affinity (JSON)</label>
                <button
                  type="button"
                  onClick={() => updateField('nodeAffinity', '')}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Remove node affinity"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
              <Input.TextArea
                size="small"
                rows={4}
                value={state.nodeAffinity}
                onChange={(e) => updateField('nodeAffinity', e.target.value)}
                placeholder='{"requiredDuringSchedulingIgnoredDuringExecution": []}'
              />
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          Pods can be scheduled onto a node as long as at least one of the <code className="text-xs bg-slate-100 px-1 rounded">Required</code> rules is satisfied.
          In effect this means the <code className="text-xs bg-slate-100 px-1 rounded">Required</code> rules are combined with the boolean &quot;or&quot; operator.
          <code className="text-xs bg-slate-100 px-1 rounded">Preferred</code> rules will attempt to be satisfied, but if not the pods will still be scheduled.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Tolerations"
        subtitle="Add tolerations to allow pod resources to be scheduled on tainted nodes"
        defaultOpen
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => updateField('tolerations', [...state.tolerations, { key: '', operator: 'Equal', value: '', effect: '' }])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <PlusOutlined style={{ fontSize: 11 }} />
            Add Toleration
          </button>
        </div>

        {state.tolerations.length > 0 && (
          <div className="space-y-2">
            {state.tolerations.map((tol, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border border-slate-200 rounded">
                <Input
                  size="small"
                  placeholder="Key"
                  value={tol.key}
                  onChange={(e) => updateToleration(index, 'key', e.target.value)}
                  className="flex-1"
                />
                <Input
                  size="small"
                  placeholder="Operator"
                  value={tol.operator}
                  onChange={(e) => updateToleration(index, 'operator', e.target.value)}
                  style={{ width: 120 }}
                />
                <Input
                  size="small"
                  placeholder="Value"
                  value={tol.value}
                  onChange={(e) => updateToleration(index, 'value', e.target.value)}
                  className="flex-1"
                />
                <Input
                  size="small"
                  placeholder="Effect"
                  value={tol.effect}
                  onChange={(e) => updateToleration(index, 'effect', e.target.value)}
                  style={{ width: 130 }}
                />
                <button
                  type="button"
                  onClick={() => updateField('tolerations', state.tolerations.filter((_, i) => i !== index))}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Remove toleration"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Pod Annotations"
        subtitle="Add annotations to configure the pods resources created by the deployment resource."
        defaultOpen
      >
        <KeyValueListEditor
          items={state.podAnnotations}
          onChange={(v) => updateField('podAnnotations', v)}
          addLabel="Add Annotation"
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Deployment Annotations"
        subtitle="Add annotations to configure the Deployment resource."
        defaultOpen
      >
        <KeyValueListEditor
          items={state.deploymentAnnotations}
          onChange={(v) => updateField('deploymentAnnotations', v)}
          addLabel="Add Annotation"
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Service Account Name"
        subtitle="Configure the service account for the pod"
        defaultOpen
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Service Account Name</label>
          <Input
            size="small"
            value={state.serviceAccountName}
            onChange={(e) => updateField('serviceAccountName', e.target.value)}
            placeholder="my-service-account"
          />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          When processes in containers inside pods access the cluster API they are authenticated as a{' '}
          <a
            href="https://oc.to/KubernetesPodServiceAccountName"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            service account
          </a>
          .
        </p>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          Leaving this field blank results in no service account being specified in the pod spec. When the pods are created,
          the default service account in the same namespace will be automatically assigned.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="Readiness Gates"
        subtitle="Define the readiness gates to assign to the container."
        defaultOpen
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pod readiness gates</label>
          <Input.TextArea
            size="small"
            rows={3}
            value={state.podReadinessGates}
            onChange={(e) => updateField('podReadinessGates', e.target.value)}
            placeholder="example.com/feature-ready"
          />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-0">
          A new line separated list of pod readiness gates.{' '}
          <a
            href="https://oc.to/KubernetesReadinessGates"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            More information
          </a>
          .
        </p>
      </CollapsibleSection>
    </CollapsibleSection>
  )
}
