import React, { useMemo, useState } from 'react'
import { Button, Input, Modal, Radio, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { generateServiceYaml } from '../generateYaml'
import { parseYamlToState } from '../parseYamlToState'
import type { ContainersEditorState } from '../types'

interface ServiceSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
}

function EditServiceYamlSubSection({
  state,
  onApply,
}: {
  state: ContainersEditorState
  onApply: (partial: Partial<ContainersEditorState>) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const generatedYaml = useMemo(() => generateServiceYaml(state) ?? '', [state])

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
        Directly edit the raw Kubernetes resource in YAML. This is intended to populated the step from existing YAML, or for the resource created by this step to be exported.
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

          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                Copy to clipboard
              </Button>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="flex bg-white max-h-[60vh] overflow-auto">
                <div className="flex-shrink-0 bg-slate-50 border-r border-slate-200 select-none pointer-events-none">
                  <pre className="text-xs text-slate-400 text-right px-3 py-3 leading-[1.6] font-mono m-0">
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </pre>
                </div>
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

export function ServiceSection({ state, updateField }: ServiceSectionProps) {
  const handleYamlApply = (partial: Partial<ContainersEditorState>) => {
    const fields: (keyof ContainersEditorState)[] = ['namespace', 'serviceName', 'serviceType', 'serviceClusterIp', 'servicePorts']
    for (const field of fields) {
      const value = partial[field]
      if (value !== undefined) {
        updateField(field, value)
      }
    }
  }

  return (
    <CollapsibleSection title="Service" subtitle="Configure the Kubernetes Service resource." fullWidth>
      <EditServiceYamlSubSection state={state} onApply={handleYamlApply} />

      <CollapsibleSection title="Service Name" subtitle="Enter the service exposing the deployment." defaultOpen>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          The unique name of the Kubernetes service resource.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#service-name"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            service name
          </a>
          .
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Service name</label>
          <Input
            value={state.serviceName}
            onChange={(e) => updateField('serviceName', e.target.value)}
            placeholder="my-service"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Service Type" subtitle="Select the service type." defaultOpen>
        <div>
          <Radio.Group
            value={state.serviceType}
            onChange={(e) => updateField('serviceType', e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="ClusterIP"><span className="text-sm">Cluster IP</span></Radio>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-0 ml-6">
              The cluster IP service resource is accessible to other resources in the Kubernetes cluster.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-1 ml-6">
              Learn more about{' '}
              <a
                href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#cluster-ip"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                cluster IP services
              </a>
              .
            </p>

            <Radio value="NodePort"><span className="text-sm">Node port</span></Radio>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-0 ml-6">
              The node port service resource is accessible to other resources in the Kubernetes cluster, and also via ports exposed on the Kubernetes nodes.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-1 ml-6">
              Learn more about{' '}
              <a
                href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#node-port"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                node port services
              </a>
              .
            </p>

            <Radio value="LoadBalancer"><span className="text-sm">Load balancer</span></Radio>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-0 ml-6">
              The load balancer service resource is accessible to other resources in the Kubernetes cluster, also via ports exposed on the Kubernetes nodes, and also through an external load balancer device.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-0 ml-6">
              Learn more about{' '}
              <a
                href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#load-balancer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                load balancer services
              </a>
              .
            </p>
          </Radio.Group>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Cluster IP address</label>
          <Input
            value={state.serviceClusterIp}
            onChange={(e) => updateField('serviceClusterIp', e.target.value)}
            placeholder=""
          />
          <p className="text-xs text-slate-500 leading-relaxed mt-1 mb-0">
            An optional value that defines the internal IP address of the service. If left blank, Kubernetes will assign a private IP address to the service.
          </p>
        </div>
      </CollapsibleSection>
    </CollapsibleSection>
  )
}
