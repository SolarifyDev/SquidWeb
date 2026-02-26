import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Input, Modal, Radio, Select, message } from 'antd'
import { CheckCircleFilled, CopyOutlined, DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'
import { getEnvironments } from 'pages/apis/environment'
import { createTargetTag, getTargetTags } from 'pages/apis/targetTag'
import { generateKubernetesAgentInstallScript, getConnectionStatus, registerKubernetesApi, type GenerateKubernetesAgentInstallScriptData } from 'pages/apis/machine'

const deploymentTypes = [
  { key: 'Kubernetes', label: 'Kubernetes' },
  { key: 'Linux', label: 'Linux' },
  { key: 'Windows', label: 'Windows' },
  { key: 'Mac', label: 'Mac' },
  { key: 'Azure', label: 'Azure' },
  { key: 'Aws', label: 'Aws' },
  { key: 'Cloud Region', label: 'Cloud Region' },
  { key: 'Offline Package Drop', label: 'Offline Package Drop' },
]

const kubernetesOptions = [
  {
    key: 'agent',
    title: 'Kubernetes Agent',
    desc: 'Install an agent to execute deployments on your cluster. No extra workers needed.',
    recommended: true,
  },
  {
    key: 'api',
    title: 'Kubernetes API',
    desc: 'Connect to your cluster via API and execute deployment tasks on workers.',
    recommended: false,
  },
]

function toShellScript(bash: string, shell: 'bash' | 'powershell'): string {
  if (shell === 'powershell') return bash.replace(/ \\\n/g, ' `\n')
  return bash
}

function InfoHint() {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 align-middle"
      title="More information"
      aria-label="More information"
    >
      i
    </span>
  )
}

function FormField({
  label,
  helper,
  placeholder,
  value,
  onChange,
}: {
  label: string
  helper?: React.ReactNode
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <Input
        variant="borderless"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-0 rounded-none text-base"
        style={{ borderBottom: '1px solid #9e9e9e', borderRadius: 0, fontSize: 16 }}
      />
      {helper && <p className="text-sm leading-5 text-gray-500 mt-1.5">{helper}</p>}
    </div>
  )
}

function MultiSelectField<T extends string | number = string>({
  label,
  helper,
  options,
  loading,
  value,
  onChange,
  searchValue,
  onSearch,
  onCreateFromSearch,
  createHintLabel = 'Press Enter to create',
}: {
  label: string
  helper?: React.ReactNode
  options: { value: T; label: string }[]
  loading?: boolean
  value: T[]
  onChange: (v: T[]) => void
  searchValue?: string
  onSearch?: (v: string) => void
  onCreateFromSearch?: (v: string) => void
  createHintLabel?: string
}) {
  const trimmedSearch = (searchValue ?? '').trim()
  const hasMatchingOption = trimmedSearch.length === 0
    ? true
    : options.some((option) => option.label.toLowerCase().includes(trimmedSearch.toLowerCase()))
  const canCreateFromSearch = !!onCreateFromSearch && trimmedSearch.length > 0 && !hasMatchingOption

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <Select
        mode="multiple"
        className="w-full"
        variant="borderless"
        size="large"
        value={value}
        onChange={onChange}
        options={options}
        loading={loading}
        searchValue={searchValue}
        onSearch={onSearch}
        optionFilterProp="label"
        filterOption={(input, option) =>
          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        notFoundContent={
          canCreateFromSearch ? (
            <div className="px-2 py-2 text-sm text-gray-600">
              {createHintLabel} <code>"{trimmedSearch}"</code>
            </div>
          ) : undefined
        }
        onInputKeyDown={(e) => {
          if (!canCreateFromSearch || e.key !== 'Enter') return
          e.preventDefault()
          onCreateFromSearch?.(trimmedSearch)
        }}
        style={{ borderBottom: '1px solid #9e9e9e', fontSize: 16 }}
      />
      {helper && <p className="text-sm leading-5 text-gray-500 mt-1.5">{helper}</p>}
    </div>
  )
}

function SelectField({
  label,
  helper,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string
  helper?: React.ReactNode
  options: { value: string; label: string }[]
  value?: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <Select
        className="w-full"
        variant="borderless"
        size="large"
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        style={{ borderBottom: '1px solid #9e9e9e', fontSize: 16 }}
      />
      {helper && <p className="text-sm leading-5 text-gray-500 mt-1.5">{helper}</p>}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold uppercase tracking-wide text-gray-500 mt-2 mb-3">{children}</div>
}

function NoteBlock({ children }: { children: React.ReactNode }) {
  return <div className="text-sm leading-5 text-gray-500 mt-1.5">{children}</div>
}

function ExpandableFormCard({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">{title}</div>
          {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
        </div>
        <Button
          type="text"
          size="small"
          icon={<DownOutlined className={expanded ? '' : '-rotate-90'} />}
          onClick={onToggle}
          aria-label={expanded ? 'Collapse section' : 'Expand section'}
          className="text-gray-500"
        />
      </div>
      {expanded && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )
}

const AddDeploymentTargetPage: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const [selectedDeploymentType, setSelectedDeploymentType] = useState('Kubernetes')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [agentFormView, setAgentFormView] = useState<'kubernetes-agent' | 'kubernetes-api' | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentEnvironments, setAgentEnvironments] = useState<number[]>([])
  const [agentTags, setAgentTags] = useState<string[]>([])
  const [agentNamespace, setAgentNamespace] = useState('')
  const [agentStorageClass, setAgentStorageClass] = useState('')
  const [agentServerUrl, setAgentServerUrl] = useState(() => window.location.origin)
  const [agentCommsUrl, setAgentCommsUrl] = useState(() => {
    const url = new URL(window.location.origin)
    return `${url.protocol}//${url.hostname}:10943`
  })
  const [showOptional, setShowOptional] = useState(true)
  const [helpPanelVisible, setHelpPanelVisible] = useState(true)
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: number; label: string }[]>([])
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false)
  const [targetTagOptions, setTargetTagOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingTargetTagOptions, setLoadingTargetTagOptions] = useState(false)
  const [agentTagSearchValue, setAgentTagSearchValue] = useState('')
  const [apiTagSearchValue, setApiTagSearchValue] = useState('')
  const creatingTargetTagsRef = useRef<Set<string>>(new Set())
  const [apiDisplayName, setApiDisplayName] = useState('')
  const [apiEnvironments, setApiEnvironments] = useState<number[]>([])
  const [apiTargetTags, setApiTargetTags] = useState<string[]>([])
  const [apiAuthType, setApiAuthType] = useState<string | undefined>(undefined)
  const [apiToken, setApiToken] = useState('')
  const [apiUsername, setApiUsername] = useState('')
  const [apiPassword, setApiPassword] = useState('')
  const [apiClientCertData, setApiClientCertData] = useState('')
  const [apiClientCertKeyData, setApiClientCertKeyData] = useState('')
  const [apiSaving, setApiSaving] = useState(false)
  const [apiClusterUrl, setApiClusterUrl] = useState('')
  const [apiClusterCertificate, setApiClusterCertificate] = useState<string | undefined>(undefined)
  const [apiSkipTlsVerification, setApiSkipTlsVerification] = useState(false)
  const [apiDefaultNamespace, setApiDefaultNamespace] = useState('')
  const [apiHealthCheckMode, setApiHealthCheckMode] = useState<'worker' | 'container'>('worker')
  const [apiContainerOptions, setApiContainerOptions] = useState('')
  const [apiTenantedMode, setApiTenantedMode] = useState<'untenanted' | 'tenanted' | 'both'>('untenanted')
  // --- Kubernetes Agent wizard ---
  const [scriptShell, setScriptShell] = useState<'bash' | 'powershell'>('bash')
  const [agentStep, setAgentStep] = useState<'form' | 'script' | 'connected'>('form')
  const [agentLoading, setAgentLoading] = useState(false)
  const [scriptData, setScriptData] = useState<GenerateKubernetesAgentInstallScriptData | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [apiExpanded, setApiExpanded] = useState<Record<string, boolean>>({
    displayName: true,
    environments: true,
    targetTags: true,
    authentication: true,
    kubernetesDetails: true,
    healthCheckContainerImage: true,
    containerOptions: true,
    tenantedDeployments: true,
  })

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if (pollingTimeoutRef.current) { clearTimeout(pollingTimeoutRef.current); pollingTimeoutRef.current = null }
  }, [])

  const closeAddModal = () => {
    stopPolling()
    setAgentFormView(null)
    setAgentStep('form')
    setScriptData(null)
  }

  const normalizeTagValues = useCallback((values: string[]) => {
    const existingByKey = new Map(targetTagOptions.map((opt) => [opt.label.trim().toLowerCase(), opt.label]))
    const seen = new Set<string>()
    const normalized: string[] = []

    values.forEach((raw) => {
      const trimmed = raw.trim()
      if (!trimmed) return
      const canonical = existingByKey.get(trimmed.toLowerCase()) ?? trimmed
      const key = canonical.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      normalized.push(canonical)
    })

    return normalized
  }, [targetTagOptions])

  const upsertTargetTagOption = useCallback((tagName: string) => {
    setTargetTagOptions((prev) => {
      const trimmed = tagName.trim()
      if (!trimmed) return prev

      const exists = prev.some((opt) => opt.label.trim().toLowerCase() === trimmed.toLowerCase())
      if (exists) return prev

      return [...prev, { value: trimmed, label: trimmed }]
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    })
  }, [])

  const createTargetTagIfNeeded = useCallback(async (rawName: string) => {
    const trimmed = rawName.trim()
    if (!trimmed) return null

    const key = trimmed.toLowerCase()
    const existing = targetTagOptions.find((opt) => opt.label.trim().toLowerCase() === key)
    if (existing) return existing.label
    if (creatingTargetTagsRef.current.has(key)) return null

    creatingTargetTagsRef.current.add(key)
    try {
      const created = await createTargetTag({ name: trimmed, spaceId: space.id })
      upsertTargetTagOption(created.name)
      return created.name?.trim() || trimmed
    } catch (error) {
      console.error('Failed to create target tag', error)
      message.error(`Failed to create target tag "${trimmed}"`)
      return null
    } finally {
      creatingTargetTagsRef.current.delete(key)
    }
  }, [space.id, targetTagOptions, upsertTargetTagOption])

  const handleTargetTagValuesChange = useCallback(async (
    values: string[],
    setValues: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const normalized = normalizeTagValues(values)

    const existingKeys = new Set(targetTagOptions.map((opt) => opt.label.trim().toLowerCase()))
    const known = normalized.filter((tag) => existingKeys.has(tag.toLowerCase()))
    const unknown = normalized.filter((tag) => !existingKeys.has(tag.toLowerCase()))

    setValues(known)

    for (const tag of unknown) {
      // Keep behavior close to Octopus: selecting a new custom value implicitly creates it.
      // eslint-disable-next-line no-await-in-loop
      const createdTag = await createTargetTagIfNeeded(tag)
      if (createdTag) {
        setValues((prev) => normalizeTagValues([...prev, createdTag]))
      }
    }
  }, [createTargetTagIfNeeded, normalizeTagValues, targetTagOptions])

  const handleCreateTargetTagFromSearch = useCallback(async (
    rawName: string,
    setValues: React.Dispatch<React.SetStateAction<string[]>>,
    clearSearch: () => void,
  ) => {
    const normalized = normalizeTagValues([rawName])
    const tagName = normalized[0]
    if (!tagName) return

    clearSearch()
    const createdTag = await createTargetTagIfNeeded(tagName)
    if (createdTag) {
      setValues((prev) => normalizeTagValues([...prev, createdTag]))
    }
  }, [createTargetTagIfNeeded, normalizeTagValues])

  const startPolling = useCallback((subscriptionId: string) => {
    stopPolling()

    pollingRef.current = setInterval(async () => {
      try {
        const res = await getConnectionStatus(subscriptionId)
        if (res.connected) {
          stopPolling()
          setAgentStep('connected')
        }
      } catch { /* ignore polling errors */ }
    }, 3000)

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling()
    }, 5 * 60 * 1000)
  }, [stopPolling])

  const handleAgentNext = async () => {
    if (!agentName.trim()) { message.warning('Please enter an agent name'); return }
    if (agentEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (agentTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (!agentServerUrl.trim()) { message.warning('Please provide Squid Server URL'); return }
    if (!agentCommsUrl.trim()) { message.warning('Please provide Squid Server Communications URL'); return }

    setAgentLoading(true)
    try {
      const data = await generateKubernetesAgentInstallScript({
        agentName: agentName.trim(),
        serverUrl: agentServerUrl.trim(),
        serverCommsUrl: agentCommsUrl.trim(),
        environmentIds: agentEnvironments,
        tags: agentTags,
        spaceId: space.id,
      })

      setScriptData(data)
      setAgentStep('script')
      startPolling(data.subscriptionId)
    } catch {
      message.error('Failed to generate install script')
    } finally {
      setAgentLoading(false)
    }
  }

  useEffect(() => stopPolling, [stopPolling])

  const toggleApiSection = (key: string) => {
    setApiExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAllApiSections = () => {
    setApiExpanded((prev) => {
      const shouldExpandAll = Object.values(prev).every((v) => v === false)
      return Object.fromEntries(Object.keys(prev).map((k) => [k, shouldExpandAll])) as Record<string, boolean>
    })
  }

  const handleSaveKubernetesApi = async () => {
    if (!apiDisplayName.trim()) { message.warning('Please enter a display name'); return }
    if (apiEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (apiTargetTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (!apiClusterUrl.trim()) { message.warning('Please enter the Kubernetes cluster URL'); return }
    if (!apiAuthType) { message.warning('Please select an authentication type'); return }

    const authTypeMap: Record<string, number> = { token: 3, usernamepassword: 1, certificate: 8 }

    setApiSaving(true)
    try {
      await registerKubernetesApi({
        machineName: apiDisplayName.trim(),
        spaceId: space.id,
        roles: apiTargetTags.join(','),
        environmentIds: apiEnvironments.join(','),
        clusterUrl: apiClusterUrl.trim(),
        clusterCertificate: apiClusterCertificate ?? '',
        namespace: apiDefaultNamespace.trim() || 'default',
        skipTlsVerification: apiSkipTlsVerification,
        accountType: authTypeMap[apiAuthType] ?? 3,
        token: apiAuthType === 'token' ? apiToken : undefined,
        username: apiAuthType === 'usernamepassword' ? apiUsername : undefined,
        password: apiAuthType === 'usernamepassword' ? apiPassword : undefined,
        clientCertificateData: apiAuthType === 'certificate' ? apiClientCertData : undefined,
        clientCertificateKeyData: apiAuthType === 'certificate' ? apiClientCertKeyData : undefined,
      })

      message.success('Kubernetes API target registered successfully')
      closeAddModal()
      navigate(`/${space.slug}/deployment/targets`)
    } catch {
      message.error('Failed to register Kubernetes API target')
    } finally {
      setApiSaving(false)
    }
  }

  useEffect(() => {
    let mounted = true
    setLoadingEnvironmentOptions(true)
    getEnvironments({ pageSize: 1000, spaceId: space.id })
      .then((res) => {
        if (!mounted) return
        setEnvironmentOptions(
          (res.environments ?? []).map((env) => ({
            value: env.id,
            label: env.name,
          }))
        )
      })
      .catch(() => {
        if (!mounted) return
        setEnvironmentOptions([])
      })
      .finally(() => {
        if (mounted) setLoadingEnvironmentOptions(false)
      })

    return () => {
      mounted = false
    }
  }, [space.id])

  useEffect(() => {
    let mounted = true
    setLoadingTargetTagOptions(true)
    getTargetTags()
      .then((res) => {
        if (!mounted) return
        setTargetTagOptions(
          (res.targetTags ?? [])
            .map((tag) => ({ value: tag.name, label: tag.name }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
        )
      })
      .catch((error) => {
        if (!mounted) return
        console.error('Failed to load target tags', error)
        setTargetTagOptions([])
      })
      .finally(() => {
        if (mounted) setLoadingTargetTagOptions(false)
      })

    return () => {
      mounted = false
    }
  }, [space.id])

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-4 pb-5 border-b border-gray-200">
            <nav>
              <ol>
                <li>
                  <button
                    onClick={() => navigate(`/${space.slug}/deployment/targets`)}
                    className="text-squid-blue hover:underline text-sm bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Deployment Targets
                  </button>
                </li>
              </ol>
            </nav>

            <div className="mt-2">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Add Deployment Target</h1>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <section className="border border-gray-200 rounded-md bg-white px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {deploymentTypes.map((type) => {
                  const active = selectedDeploymentType === type.key
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setSelectedDeploymentType(type.key)}
                      className={[
                        'px-4 py-2 rounded text-sm border transition-colors',
                        active
                          ? 'bg-squid-blue text-white border-squid-blue'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400',
                      ].join(' ')}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="border border-gray-200 rounded-md bg-white px-6 py-6">
              {selectedDeploymentType === 'Kubernetes' ? (
                <div>
                  <div className="mb-5 text-gray-700">
                    Let's connect to a <strong>Kubernetes</strong> cluster.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {kubernetesOptions.map((option) => (
                      <div
                        key={option.key}
                        className="relative border-2 rounded-lg p-6 overflow-hidden transition-all duration-200"
                        style={{
                          borderColor: hoveredCard === option.key ? '#16a34a' : '#e5e7eb',
                          boxShadow: hoveredCard === option.key ? '0 4px 12px rgba(22,163,74,0.15)' : 'none',
                        }}
                        onMouseEnter={() => setHoveredCard(option.key)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <div className="flex justify-center mb-4">
                          <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 text-4xl">☸</span>
                          </div>
                        </div>

                        <h3 className="text-base font-semibold text-center mb-2">{option.title}</h3>
                        <p className="text-sm text-gray-500 text-center mb-3">{option.desc}</p>

                        {option.recommended && (
                          <div className="flex justify-center">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Recommended
                            </span>
                          </div>
                        )}

                        {hoveredCard === option.key && (
                          <div
                            className="absolute inset-0 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                          >
                            <Button
                              className="shadow-md"
                              onClick={() => {
                                setHelpPanelVisible(true)
                                setAgentFormView(option.key === 'agent' ? 'kubernetes-agent' : 'kubernetes-api')
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  {selectedDeploymentType} deployment target wizard coming soon.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <Modal
        title={null}
        open={!!agentFormView}
        onCancel={closeAddModal}
        footer={null}
        width={agentFormView === 'kubernetes-agent' ? 1080 : 1120}
        styles={{ body: { padding: 0 } }}
      >
        {agentFormView === 'kubernetes-agent' ? (
          <div className="flex" style={{ minHeight: 680 }}>
            <div className="flex flex-col flex-1 min-w-0" style={{ borderRadius: '4px 0 0 4px' }}>
              {agentStep === 'form' && (
                <>
                  <div className="flex-1 overflow-y-auto px-10 pt-8 pb-5">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-7">Add New Kubernetes Agent</h2>

                    <FormField
                      label="Name"
                      helper="You can use the same name as your Kubernetes cluster"
                      value={agentName}
                      onChange={setAgentName}
                    />

                    <MultiSelectField
                      label="Environments"
                      helper="Select at least one environment"
                      options={environmentOptions}
                      loading={loadingEnvironmentOptions}
                      value={agentEnvironments}
                      onChange={setAgentEnvironments}
                    />

                    <MultiSelectField
                      label="Target tags"
                      helper={
                        <span className="inline-flex items-center gap-1">
                          <span>Add at least one target tag</span>
                          <InfoHint />
                        </span>
                      }
                      options={targetTagOptions}
                      loading={loadingTargetTagOptions}
                      value={agentTags}
                      onChange={(values) => { void handleTargetTagValuesChange(values, setAgentTags) }}
                      searchValue={agentTagSearchValue}
                      onSearch={setAgentTagSearchValue}
                      onCreateFromSearch={(name) => { void handleCreateTargetTagFromSearch(name, setAgentTags, () => setAgentTagSearchValue('')) }}
                    />

                    <button
                      onClick={() => setShowOptional(!showOptional)}
                      className="text-base text-squid-blue hover:underline bg-transparent border-0 cursor-pointer p-0 mb-5"
                    >
                      {showOptional ? 'Hide optional settings' : 'Show optional settings'}
                    </button>

                    {showOptional && (
                      <>
                        <FormField
                          label="Default Kubernetes namespace"
                          placeholder="default"
                          helper="Default namespace can be overridden by your step configuration and YAML"
                          value={agentNamespace}
                          onChange={setAgentNamespace}
                        />
                        <FormField
                          label="Storage class"
                          helper={
                            <span className="inline-flex items-center gap-1 flex-wrap">
                              <span>Provide a Storage Class</span>
                              <InfoHint />
                              <span>or leave this blank to use the default NFS storage</span>
                            </span>
                          }
                          value={agentStorageClass}
                          onChange={setAgentStorageClass}
                        />
                        <FormField
                          label="Squid Server URL"
                          placeholder="https://squid.example.com"
                          helper="Provide the full URL to your Squid instance."
                          value={agentServerUrl}
                          onChange={setAgentServerUrl}
                        />
                        <FormField
                          label="Squid Server Communications URL"
                          placeholder="https://squid.example.com:10943"
                          helper="The URL of the Squid Server that the Agent will poll for work."
                          value={agentCommsUrl}
                          onChange={setAgentCommsUrl}
                        />
                      </>
                    )}
                  </div>

                  <div className="border-t border-gray-200 px-10 py-4 flex justify-end gap-3 flex-shrink-0">
                    <Button size="large" onClick={closeAddModal}>Cancel</Button>
                    <Button
                      size="large"
                      type="primary"
                      loading={agentLoading}
                      onClick={handleAgentNext}
                      className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}

              {agentStep === 'script' && scriptData && (
                <>
                  <div className="flex-1 overflow-y-auto px-10 pt-8 pb-5">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Install Kubernetes Agent</h2>
                    <p className="text-sm text-gray-500 mb-7">
                      Run the following commands in your Kubernetes cluster to install the agent.
                    </p>

                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">1. Install NFS CSI Driver (one-time setup)</label>
                        <div className="flex items-center gap-2">
                          <Select
                            size="small"
                            value={scriptShell}
                            onChange={setScriptShell}
                            options={[
                              { value: 'bash', label: 'Bash' },
                              { value: 'powershell', label: 'PowerShell' },
                            ]}
                            style={{ width: 120 }}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => { navigator.clipboard.writeText(toShellScript(scriptData.nfsCsiDriverScript, scriptShell)); message.success('Copied') }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 text-sm p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                        {toShellScript(scriptData.nfsCsiDriverScript, scriptShell)}
                      </pre>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">2. Install Squid Agent</label>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => { navigator.clipboard.writeText(toShellScript(scriptData.agentInstallScript, scriptShell)); message.success('Copied') }}
                        >
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 text-sm p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                        {toShellScript(scriptData.agentInstallScript, scriptShell)}
                      </pre>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-md">
                      <LoadingOutlined className="text-squid-blue text-lg" />
                      <span className="text-sm text-gray-700">Waiting for agent to connect...</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 px-10 py-4 flex justify-end gap-3 flex-shrink-0">
                    <Button size="large" onClick={() => { stopPolling(); setAgentStep('form') }}>Back</Button>
                    <Button size="large" onClick={closeAddModal}>Close</Button>
                  </div>
                </>
              )}

              {agentStep === 'connected' && (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center px-10">
                    <CheckCircleFilled className="text-6xl text-green-600 mb-5" />
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Agent Connected</h2>
                    <p className="text-base text-gray-500 text-center">
                      The Kubernetes agent <strong>{agentName}</strong> has been successfully registered and is now polling for work.
                    </p>
                  </div>

                  <div className="border-t border-gray-200 px-10 py-4 flex justify-end gap-3 flex-shrink-0">
                    <Button
                      size="large"
                      type="primary"
                      className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                      onClick={() => { closeAddModal(); navigate(`/${space.slug}/deployment/targets`) }}
                    >
                      Go to Deployment Targets
                    </Button>
                  </div>
                </>
              )}
            </div>

            {helpPanelVisible && agentStep === 'form' ? (
              <div
                className="flex flex-col border-l border-gray-200 bg-gray-50 flex-shrink-0"
                style={{ width: 340, borderRadius: '0 4px 4px 0' }}
              >
                <div className="flex justify-start p-3 flex-shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<DoubleRightOutlined />}
                    onClick={() => setHelpPanelVisible(false)}
                    className="text-gray-400 hover:text-gray-600"
                  />
                </div>

                <div className="flex justify-center px-6 mb-5 flex-shrink-0">
                  <div
                    className="w-full rounded-lg bg-blue-50 flex items-center justify-center"
                    style={{ height: 160 }}
                  >
                    <svg viewBox="0 0 120 100" width="120" height="100">
                      <rect x="10" y="20" width="100" height="60" rx="6" fill="#dbeafe" />
                      <circle cx="35" cy="50" r="14" fill="#326ce5" />
                      <circle cx="60" cy="50" r="14" fill="#3b82f6" />
                      <circle cx="85" cy="50" r="14" fill="#60a5fa" />
                      <text x="35" y="54" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">☸</text>
                      <text x="60" y="54" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">☸</text>
                      <text x="85" y="54" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">☸</text>
                      <line x1="49" y1="50" x2="46" y2="50" stroke="#93c5fd" strokeWidth="1" />
                      <line x1="74" y1="50" x2="71" y2="50" stroke="#93c5fd" strokeWidth="1" />
                    </svg>
                  </div>
                </div>

                <div className="px-6 pb-6 flex-1 overflow-y-auto">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Connect seamlessly to Kubernetes
                  </h2>
                  <p className="text-base leading-6 text-gray-600 mb-3">
                    Installing the Kubernetes agent in your cluster eliminates the need for firewall adjustments or extra authentication.
                  </p>
                  <p className="text-base leading-6 text-gray-600">
                    The agent automatically updates itself during regular health checks to keep things running smoothly and securely.
                  </p>
                </div>
              </div>
            ) : agentStep === 'form' ? (
              <div
                className="flex items-center justify-center border-l border-gray-200 bg-gray-50 flex-shrink-0"
                style={{ width: 36 }}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DoubleLeftOutlined />}
                  onClick={() => setHelpPanelVisible(true)}
                  className="text-gray-400 hover:text-gray-600"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[82vh] overflow-y-auto">
            <div className="px-8 pt-7 pb-5 border-b border-gray-200 bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-semibold text-gray-900 m-0">Add Kubernetes API</h2>
            </div>

            <div className="px-8 py-4">
              <button
                type="button"
                onClick={toggleAllApiSections}
                className="text-xs font-semibold tracking-wide text-squid-blue hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                {Object.values(apiExpanded).every((v) => v === false) ? 'EXPAND ALL' : 'COLLAPSE ALL'}
              </button>
            </div>

            <div className="px-8 pb-8 space-y-5 bg-white">
              <ExpandableFormCard
                title="Display Name"
                subtitle="A short, memorable, unique name for this deployment target."
                expanded={apiExpanded.displayName}
                onToggle={() => toggleApiSection('displayName')}
              >
                <FormField
                  label="Display name"
                  value={apiDisplayName}
                  onChange={setApiDisplayName}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Environments"
                subtitle="Choose at least one environment for the deployment target."
                expanded={apiExpanded.environments}
                onToggle={() => toggleApiSection('environments')}
              >
                <MultiSelectField
                  label="Select environments"
                  options={environmentOptions}
                  loading={loadingEnvironmentOptions}
                  value={apiEnvironments}
                  onChange={setApiEnvironments}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title={<span className="inline-flex items-center gap-1">Target Tags <InfoHint /></span>}
                subtitle="Add at least one target tag to make this deployment target selectable by deployment and runbook processes."
                expanded={apiExpanded.targetTags}
                onToggle={() => toggleApiSection('targetTags')}
              >
                <MultiSelectField
                  label="Target tags"
                  options={targetTagOptions}
                  loading={loadingTargetTagOptions}
                  value={apiTargetTags}
                  onChange={(values) => { void handleTargetTagValuesChange(values, setApiTargetTags) }}
                  searchValue={apiTagSearchValue}
                  onSearch={setApiTagSearchValue}
                  onCreateFromSearch={(name) => { void handleCreateTargetTagFromSearch(name, setApiTargetTags, () => setApiTagSearchValue('')) }}
                />
                <NoteBlock>You are required to add at least one target tag.</NoteBlock>
              </ExpandableFormCard>

              <SectionHeading>Communication</SectionHeading>

              <ExpandableFormCard
                title="Authentication"
                subtitle="Select the account or certificate that identifies the Kubernetes user."
                expanded={apiExpanded.authentication}
                onToggle={() => toggleApiSection('authentication')}
              >
                <SelectField
                  label="Select an authentication type"
                  placeholder="Select an authentication type"
                  value={apiAuthType}
                  onChange={setApiAuthType}
                  options={[
                    { value: 'token', label: 'Token' },
                    { value: 'usernamepassword', label: 'Username / Password' },
                    { value: 'certificate', label: 'Client Certificate' },
                  ]}
                />

                {apiAuthType === 'token' && (
                  <FormField
                    label="Token"
                    placeholder="Bearer token"
                    value={apiToken}
                    onChange={setApiToken}
                  />
                )}

                {apiAuthType === 'usernamepassword' && (
                  <>
                    <FormField
                      label="Username"
                      value={apiUsername}
                      onChange={setApiUsername}
                    />
                    <FormField
                      label="Password"
                      value={apiPassword}
                      onChange={setApiPassword}
                    />
                  </>
                )}

                {apiAuthType === 'certificate' && (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Certificate Data</label>
                      <Input.TextArea
                        rows={4}
                        placeholder="Base64-encoded certificate data"
                        value={apiClientCertData}
                        onChange={(e) => setApiClientCertData(e.target.value)}
                        style={{ borderBottom: '1px solid #9e9e9e', borderRadius: 0 }}
                      />
                    </div>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Certificate Key Data</label>
                      <Input.TextArea
                        rows={4}
                        placeholder="Base64-encoded certificate key data"
                        value={apiClientCertKeyData}
                        onChange={(e) => setApiClientCertKeyData(e.target.value)}
                        style={{ borderBottom: '1px solid #9e9e9e', borderRadius: 0 }}
                      />
                    </div>
                  </>
                )}
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Kubernetes Details"
                subtitle="Enter the Kubernetes cluster details."
                expanded={apiExpanded.kubernetesDetails}
                onToggle={() => toggleApiSection('kubernetesDetails')}
              >
                <FormField
                  label="Kubernetes cluster URL"
                  value={apiClusterUrl}
                  onChange={setApiClusterUrl}
                />
                <NoteBlock>
                  Must be an absolute URL. e.g. <em>https://kubernetes.example.com</em>
                </NoteBlock>

                <div className="mt-4 mb-5">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <SelectField
                        label="Select certificate"
                        placeholder="Select certificate"
                        value={apiClusterCertificate}
                        onChange={setApiClusterCertificate}
                        options={[
                          { value: 'ca-cert-1', label: 'Cluster CA (Example)' },
                          { value: 'ca-cert-2', label: 'Shared Kubernetes CA' },
                        ]}
                      />
                    </div>
                    <div className="flex items-center gap-1 pb-5">
                      <Button icon={<SearchOutlined />} aria-label="Search certificate" />
                      <Button icon={<ReloadOutlined />} aria-label="Refresh certificates" />
                      <Button icon={<PlusOutlined />} aria-label="Add certificate" />
                    </div>
                  </div>
                  <NoteBlock>The optional cluster certificate authority.</NoteBlock>
                </div>

                <div className="mb-4">
                  <Checkbox
                    checked={apiSkipTlsVerification}
                    onChange={(e) => setApiSkipTlsVerification(e.target.checked)}
                  >
                    <span className="text-base text-gray-700">Skip TLS verification</span>
                  </Checkbox>
                  <NoteBlock>
                    Enable this option to skip the verification of the cluster certificate. This can only be selected if no cluster certificate is specified.
                  </NoteBlock>
                </div>

                <FormField
                  label="Default Kubernetes namespace"
                  placeholder="default"
                  value={apiDefaultNamespace}
                  onChange={setApiDefaultNamespace}
                />
                <NoteBlock>
                  Provide an optional default namespace that can be overridden by your step configuration and YAML.
                </NoteBlock>
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Health Check Container Image"
                subtitle="Choose to run directly on a worker or inside a container"
                expanded={apiExpanded.healthCheckContainerImage}
                onToggle={() => toggleApiSection('healthCheckContainerImage')}
              >
                <Radio.Group
                  value={apiHealthCheckMode}
                  onChange={(e) => setApiHealthCheckMode(e.target.value)}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <Radio value="worker">
                      <span className="text-base text-gray-800">Runs directly on a worker <span className="text-gray-500">(default)</span></span>
                    </Radio>
                    <NoteBlock>The worker will need the required dependencies pre-installed.</NoteBlock>
                  </div>
                  <div>
                    <Radio value="container">
                      <span className="text-base text-gray-800">Runs inside a container on a worker</span>
                    </Radio>
                    <NoteBlock>The worker must support container execution.</NoteBlock>
                  </div>
                </Radio.Group>
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Container Options"
                subtitle="Docker run options for container creation."
                expanded={apiExpanded.containerOptions}
                onToggle={() => toggleApiSection('containerOptions')}
              >
                <FormField
                  label="Container Options"
                  value={apiContainerOptions}
                  onChange={setApiContainerOptions}
                />
              </ExpandableFormCard>

              <SectionHeading>Restrictions</SectionHeading>

              <ExpandableFormCard
                title="Tenanted Deployments"
                subtitle="Choose the kind of deployments where this deployment target should be included."
                expanded={apiExpanded.tenantedDeployments}
                onToggle={() => toggleApiSection('tenantedDeployments')}
              >
                <Radio.Group
                  value={apiTenantedMode}
                  onChange={(e) => setApiTenantedMode(e.target.value)}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <Radio value="untenanted">
                      <span className="text-base text-gray-800">Exclude from tenanted deployments <span className="text-gray-500">(default)</span></span>
                    </Radio>
                    <NoteBlock>The deployment target will never be included in tenanted deployments.</NoteBlock>
                  </div>
                  <div>
                    <Radio value="tenanted">
                      <span className="text-base text-gray-800">Include only in tenanted deployments</span>
                    </Radio>
                    <NoteBlock>
                      The deployment target will only be included in deployments to the associated tenants. It will be excluded from untenanted deployments.
                    </NoteBlock>
                  </div>
                  <div>
                    <Radio value="both">
                      <span className="text-base text-gray-800">Include in both tenanted and untenanted deployments</span>
                    </Radio>
                    <NoteBlock>
                      The deployment target will be included in untenanted deployments, and deployments to the associated tenants.
                    </NoteBlock>
                  </div>
                </Radio.Group>
              </ExpandableFormCard>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-8 py-4 flex justify-end gap-3">
              <Button size="large" onClick={closeAddModal}>Cancel</Button>
              <Button size="large" type="primary" loading={apiSaving} onClick={handleSaveKubernetesApi} className="!bg-green-700 !border-green-700">
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AddDeploymentTargetPage
