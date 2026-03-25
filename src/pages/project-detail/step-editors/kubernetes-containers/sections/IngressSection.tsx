import React, { useMemo, useState } from 'react'
import { Button, Input, Modal, Radio, Select, message } from 'antd'
import { CloseOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { KeyValueListEditor } from '../../shared/KeyValueListEditor'
import { generateIngressYaml } from '../generateYaml'
import { parseYamlToState } from '../parseYamlToState'
import type { ContainersEditorState, IngressPath } from '../types'

interface IngressSectionProps {
  state: ContainersEditorState
  updateField: <K extends keyof ContainersEditorState>(field: K, value: ContainersEditorState[K]) => void
  showNamespaceSection?: boolean
}

const INGRESS_ANNOTATION_OPTIONS = [
  'nginx.ingress.kubernetes.io/proxy-connect-timeout',
  'nginx.ingress.kubernetes.io/proxy-send-timeout',
  'nginx.ingress.kubernetes.io/proxy-read-timeout',
  'nginx.ingress.kubernetes.io/proxy-body-size',
  'nginx.ingress.kubernetes.io/limit-rpm',
  'kubernetes.io/ingress.class',
  'kubernetes.io/tls-acme',
  'prometheus.io/probe',
  'cert-manager.io/cluster-issuer',
]

const INGRESS_PATH_TYPE_OPTIONS = [
  { label: 'Implementation Specific', value: 'ImplementationSpecific' },
  { label: 'Prefix', value: 'Prefix' },
  { label: 'Exact', value: 'Exact' },
]

function EditIngressYamlSubSection({
  state,
  onApply,
}: {
  state: ContainersEditorState
  onApply: (partial: Partial<ContainersEditorState>) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const generatedYaml = useMemo(() => generateIngressYaml(state) ?? '', [state])

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

export function IngressSection({ state, updateField, showNamespaceSection = false }: IngressSectionProps) {
  const [hostRuleModalOpen, setHostRuleModalOpen] = useState(false)
  const [hostRuleEditIndex, setHostRuleEditIndex] = useState<number | null>(null)
  const [hostRuleHost, setHostRuleHost] = useState('')
  const [hostRulePaths, setHostRulePaths] = useState<IngressPath[]>([])
  const [tlsModalOpen, setTlsModalOpen] = useState(false)
  const [tlsEditIndex, setTlsEditIndex] = useState<number | null>(null)
  const [tlsMode, setTlsMode] = useState<'IngressDefault' | 'Octopus' | 'Secret'>('IngressDefault')
  const [tlsSecretName, setTlsSecretName] = useState('')
  const [tlsDraftHosts, setTlsDraftHosts] = useState<string[]>([])

  const handleYamlApply = (partial: Partial<ContainersEditorState>) => {
    const fields: (keyof ContainersEditorState)[] = ['namespace', 'ingressName', 'ingressClassName', 'ingressAnnotations', 'ingressRules', 'ingressTls']
    for (const field of fields) {
      const value = partial[field]
      if (value !== undefined) {
        updateField(field, value)
      }
    }
  }

  const defaultServicePort = state.servicePorts.find((port) => port.targetPort?.trim())?.targetPort || state.servicePorts.find((port) => port.port?.trim())?.port || ''
  const defaultServiceName = state.serviceName || ''
  const buildDefaultPath = (): IngressPath => ({
    path: '/',
    pathType: 'ImplementationSpecific',
    backend: {
      serviceName: defaultServiceName,
      servicePort: defaultServicePort,
    },
  })
  const insertVariable = () => message.info('Insert Variable is not available yet')

  const openAddHostRuleModal = () => {
    setHostRuleEditIndex(null)
    setHostRuleHost('')
    setHostRulePaths([])
    setHostRuleModalOpen(true)
  }

  const openEditHostRuleModal = (index: number) => {
    const existingRule = state.ingressRules[index]
    if (!existingRule) return
    const existingPaths = existingRule.paths.length > 0
      ? existingRule.paths.map((path) => ({
          path: path.path || '/',
          pathType: path.pathType || 'ImplementationSpecific',
          backend: {
            serviceName: path.backend.serviceName || defaultServiceName,
            servicePort: path.backend.servicePort || defaultServicePort,
          },
        }))
      : [buildDefaultPath()]
    setHostRuleEditIndex(index)
    setHostRuleHost(existingRule.host || '')
    setHostRulePaths(existingPaths)
    setHostRuleModalOpen(true)
  }

  const updateHostRulePath = (index: number, field: 'path' | 'pathType', value: string) => {
    setHostRulePaths((prev) => prev.map((path, i) => (i === index ? { ...path, [field]: value } : path)))
  }

  const updateHostRuleBackend = (index: number, field: 'serviceName' | 'servicePort', value: string) => {
    setHostRulePaths((prev) =>
      prev.map((path, i) => (i === index ? { ...path, backend: { ...path.backend, [field]: value } } : path)),
    )
  }

  const addHostRulePath = () => {
    setHostRulePaths((prev) => [...prev, buildDefaultPath()])
  }

  const removeHostRulePath = (index: number) => {
    setHostRulePaths((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddHostRule = () => {
    openAddHostRuleModal()
  }

  const confirmAddHostRule = () => {
    const normalizedPaths = hostRulePaths
      .map((path) => ({
        path: path.path.trim(),
        pathType: path.pathType || 'ImplementationSpecific',
        backend: {
          serviceName: path.backend.serviceName.trim(),
          servicePort: path.backend.servicePort.trim(),
        },
      }))
      .filter((path) => path.path || path.backend.serviceName || path.backend.servicePort)

    if (normalizedPaths.length === 0) {
      message.error('At least one path is required')
      return
    }
    if (normalizedPaths.some((path) => !path.backend.serviceName)) {
      message.error('Service name is required for every path')
      return
    }
    if (normalizedPaths.some((path) => !path.backend.servicePort)) {
      message.error('Service port is required for every path')
      return
    }

    const nextRule = {
      host: hostRuleHost.trim(),
      paths: normalizedPaths.map((path) => ({
        ...path,
        path: path.path || '/',
        pathType: path.pathType || 'ImplementationSpecific',
      })),
    }

    if (hostRuleEditIndex != null) {
      updateField('ingressRules', state.ingressRules.map((rule, index) => (index === hostRuleEditIndex ? nextRule : rule)))
    } else {
      updateField('ingressRules', [...state.ingressRules, nextRule])
    }
    setHostRuleModalOpen(false)
  }

  const handleSortRules = () => {
    const sorted = [...state.ingressRules].sort((a, b) => (a.host || '').localeCompare(b.host || '', undefined, { sensitivity: 'base' }))
    updateField('ingressRules', sorted)
  }

  const openTlsModal = () => {
    setTlsEditIndex(null)
    setTlsMode('IngressDefault')
    setTlsSecretName('')
    setTlsDraftHosts([])
    setTlsModalOpen(true)
  }

  const openEditTlsModal = (index: number) => {
    const existing = state.ingressTls[index]
    if (!existing) return
    setTlsEditIndex(index)
    setTlsMode(existing.secretName ? 'Secret' : 'IngressDefault')
    setTlsSecretName(existing.secretName || '')
    setTlsDraftHosts(existing.hosts.length > 0 ? [...existing.hosts] : [])
    setTlsModalOpen(true)
  }

  const updateTlsDraftHost = (index: number, value: string) => {
    setTlsDraftHosts((prev) => prev.map((host, i) => (i === index ? value : host)))
  }

  const addTlsDraftHost = () => {
    setTlsDraftHosts((prev) => [...prev, ''])
  }

  const removeTlsDraftHost = (index: number) => {
    setTlsDraftHosts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddTlsCertificate = () => {
    const hosts = tlsDraftHosts.map((host) => host.trim()).filter((host) => host.length > 0)
    if (hosts.length === 0) {
      message.error('At least one host is required')
      return
    }
    if (tlsMode === 'Secret' && !tlsSecretName.trim()) {
      message.error('Secret name is required for Existing Secret')
      return
    }

    const nextItem = {
      hosts,
      secretName: tlsMode === 'Secret' ? tlsSecretName.trim() : '',
    }
    if (tlsEditIndex != null) {
      updateField('ingressTls', state.ingressTls.map((tls, index) => (index === tlsEditIndex ? nextItem : tls)))
    } else {
      updateField('ingressTls', [...state.ingressTls, nextItem])
    }
    setTlsModalOpen(false)
    setTlsEditIndex(null)
  }

  const formatHostRuleSummary = (ruleHost: string, path: IngressPath) => {
    const host = ruleHost.trim()
    const normalizedPath = (path.path || '/').trim()
    const displayPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
    const hostAndPath = `${host || '(all hosts)'}${displayPath}`
    const serviceName = path.backend.serviceName || state.serviceName || '(service)'
    const servicePort = path.backend.servicePort || '(port)'
    return `${hostAndPath} => ${serviceName}:${servicePort}`
  }

  return (
    <CollapsibleSection title="Ingress" subtitle="Configure the Kubernetes Ingress resource." fullWidth>
      <EditIngressYamlSubSection state={state} onApply={handleYamlApply} />

      <CollapsibleSection title="Ingress Name" subtitle="Enter the ingress name exposing the deployment." defaultOpen>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          The name of the ingress resource.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#ingress-name"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ingress name
          </a>
          .
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ingress name</label>
          <Input
            value={state.ingressName}
            onChange={(e) => updateField('ingressName', e.target.value)}
            placeholder="my-ingress"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Ingress Class Name"
        subtitle="Enter the ingress class name for the controller that will implement this resource."
        defaultOpen
      >
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          The name of the ingress class.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#ingress-class-name"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ingress class names
          </a>
          .
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ingress class name</label>
          <Input
            value={state.ingressClassName}
            onChange={(e) => updateField('ingressClassName', e.target.value)}
            placeholder="nginx"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Ingress Annotations"
        subtitle="Add annotations to configure the ingress controller."
        defaultOpen
      >
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Ingress annotations can be specific to the type of ingress controller used by the Kubernetes cluster, and the suggested annotation keys are not exhaustive.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#ingress-annotations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ingress annotations
          </a>
          .
        </p>
        <KeyValueListEditor
          items={state.ingressAnnotations}
          onChange={(v) => updateField('ingressAnnotations', v)}
          addLabel="Add Annotation"
          layout="octopus"
          keyOptions={INGRESS_ANNOTATION_OPTIONS}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Ingress Host Rules" subtitle="Add rules to be applied to hosts." defaultOpen>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Host rules map incoming requests by their host name and path to ports exposed by the service resource.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://octopus.com/docs/deployment-examples/kubernetes-deployments/deploy-container#ingress-host-rules"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ingress host rules
          </a>
          .
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSortRules}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            Sort Rules
          </button>
          <button
            type="button"
            onClick={handleAddHostRule}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            Add Host Rule
          </button>
        </div>

        {state.ingressRules.length > 0 && (
          <ul className="space-y-2">
            {state.ingressRules.map((rule, index) => {
              const validPaths = rule.paths.filter((path) => path.path || path.backend.serviceName || path.backend.servicePort)
              const paths = validPaths.length > 0 ? validPaths : [{ path: '/', pathType: 'ImplementationSpecific', backend: { serviceName: state.serviceName || '', servicePort: '' } }]
              return (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 border border-slate-200 rounded px-3 py-2 bg-white cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => openEditHostRuleModal(index)}
                >
                  <div className="text-sm text-slate-700 min-w-0">
                    <ul className="list-disc pl-5 m-0 space-y-1">
                      {paths.map((path, pathIndex) => (
                        <li key={pathIndex} className="break-all">
                          <strong>{formatHostRuleSummary(rule.host, path)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      updateField('ingressRules', state.ingressRules.filter((_, i) => i !== index))
                    }}
                    className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Remove host rule"
                  >
                    <CloseOutlined style={{ fontSize: 13 }} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Modal
          title={hostRuleEditIndex != null ? 'Edit Host Rule' : 'Add Host Rule'}
          open={hostRuleModalOpen}
          onCancel={() => {
            setHostRuleModalOpen(false)
            setHostRuleEditIndex(null)
          }}
          onOk={confirmAddHostRule}
          okText="Ok"
          cancelText="Cancel"
          width={600}
        >
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-slate-600 mb-1">Host</label>
                <Input
                  value={hostRuleHost}
                  onChange={(e) => setHostRuleHost(e.target.value)}
                  placeholder="#{IngressBaseDomainName}"
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                aria-label="Insert Variable"
                onClick={insertVariable}
              >
                <span className="text-[10px] font-semibold">{'{ }'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-0">
              An optional value that defines the host that this ingress rule applies to. If left blank, this rule applies to all hosts.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 mb-0">Paths</p>
              <p className="text-xs text-slate-500 leading-relaxed mb-0">
                Include the URL path and the service <code className="text-xs bg-slate-100 px-1 rounded">Port</code> this ingress path directs traffic to. The service port can be the service name, or the port number.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addHostRulePath}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <PlusOutlined style={{ fontSize: 11 }} />
                  Add Path
                </button>
              </div>

              <ul className="space-y-2">
                {hostRulePaths.map((path, index) => (
                  <li key={index} className="border border-slate-200 rounded px-4 pt-3 pb-5 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-slate-600 mb-0">Path Item {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeHostRulePath(index)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="Remove path"
                      >
                        <CloseOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>

                    <div className="space-y-4 pb-1">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Path</label>
                        <div className="flex items-end gap-1">
                          <Input value={path.path} onChange={(e) => updateHostRulePath(index, 'path', e.target.value)} placeholder="/" />
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            aria-label="Insert Variable"
                            onClick={insertVariable}
                          >
                            <span className="text-[10px] font-semibold">{'{ }'}</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Service port</label>
                        <div className="flex items-end gap-1">
                          <Input
                            value={path.backend.servicePort}
                            onChange={(e) => updateHostRuleBackend(index, 'servicePort', e.target.value)}
                            placeholder="8080"
                          />
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            aria-label="Insert Variable"
                            onClick={insertVariable}
                          >
                            <span className="text-[10px] font-semibold">{'{ }'}</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Service name</label>
                        <div className="flex items-end gap-1">
                          <Input
                            value={path.backend.serviceName}
                            onChange={(e) => updateHostRuleBackend(index, 'serviceName', e.target.value)}
                            placeholder={state.serviceName || 'service-name'}
                          />
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            aria-label="Insert Variable"
                            onClick={insertVariable}
                          >
                            <span className="text-[10px] font-semibold">{'{ }'}</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Path Type</label>
                        <Select
                          value={path.pathType || 'ImplementationSpecific'}
                          options={INGRESS_PATH_TYPE_OPTIONS}
                          onChange={(value) => updateHostRulePath(index, 'pathType', value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      </CollapsibleSection>

      <CollapsibleSection title="Ingress TLS" subtitle="Configure TLS certificates" defaultOpen>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          The ingress can be configured to use TLS for specified hosts.
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-0">
          Learn more about{' '}
          <a
            href="https://oc.to/KubernetesIngressTls"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ingress TLS
          </a>
          .
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={openTlsModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            Add TLS certificate
          </button>
        </div>

        {state.ingressTls.length > 0 && (
          <ul className="space-y-2">
            {state.ingressTls.map((tls, index) => (
              <li
                key={index}
                className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => openEditTlsModal(index)}
              >
                <div className="text-sm text-slate-700 space-y-1">
                  <p className="mb-0">Hosts: <strong>{tls.hosts.join(', ') || '(none)'}</strong></p>
                  <p className="mb-0">Certificate: <strong>{tls.secretName || 'Ingress default / controller-managed'}</strong></p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    updateField('ingressTls', state.ingressTls.filter((_, i) => i !== index))
                  }}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Remove TLS certificate"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Modal
          title={tlsEditIndex != null ? 'Edit TLS certificate' : 'Configure TLS certificate'}
          open={tlsModalOpen}
          onCancel={() => {
            setTlsModalOpen(false)
            setTlsEditIndex(null)
          }}
          onOk={handleAddTlsCertificate}
          okText="Ok"
          cancelText="Cancel"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed mb-0">
              See the Kubernetes documentation for more information on{' '}
              <a
                href="https://oc.to/KubernetesIngressTls"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                ingress TLS
              </a>
              .
            </p>

            <Radio.Group value={tlsMode} onChange={(e) => setTlsMode(e.target.value)} className="flex flex-col gap-2">
              <Radio value="IngressDefault">
                <span className="text-sm">Ingress Default <span className="text-slate-500">(default)</span></span>
              </Radio>
              <p className="text-xs text-slate-500 leading-relaxed mt-0 mb-1 ml-6">
                Your ingress controller has default certificates defined, or is using SSL passthrough.
              </p>
              <Radio value="Octopus"><span className="text-sm">Squid Certificate</span></Radio>
              <Radio value="Secret"><span className="text-sm">Existing Secret</span></Radio>
            </Radio.Group>

            {tlsMode === 'Secret' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secret name</label>
                <Input
                  value={tlsSecretName}
                  onChange={(e) => setTlsSecretName(e.target.value)}
                  placeholder="my-tls-secret"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addTlsDraftHost}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  Add Host
                </button>
              </div>
              <ul className="space-y-2">
                {tlsDraftHosts.map((host, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Host</label>
                      <Input
                        value={host}
                        onChange={(e) => updateTlsDraftHost(index, e.target.value)}
                        placeholder="sslexample.foo.com"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTlsDraftHost(index)}
                      className="mt-6 flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Remove host"
                    >
                      <CloseOutlined style={{ fontSize: 13 }} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-0">
              Configure the hosts which TLS should be configured for. For example, <em>sslexample.foo.com</em>.
            </p>
          </div>
        </Modal>
      </CollapsibleSection>

      {showNamespaceSection ? (
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
      ) : null}
    </CollapsibleSection>
  )
}
