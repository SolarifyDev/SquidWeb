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
          <label className="block text-xs font-medium text-slate-600 mb-1">Namespace</label>
          <Input value={state.namespace} onChange={(e) => updateField('namespace', e.target.value)} placeholder="default" />
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
    </CollapsibleSection>
  )
}
