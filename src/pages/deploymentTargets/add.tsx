import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Input, Modal, Radio, Select, message } from 'antd'
import { CheckCircleFilled, CopyOutlined, DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, ExclamationCircleOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useSpace } from 'contexts/SpaceContext'
import { getEnvironments } from 'pages/apis/environment'
import { getCertificates } from 'pages/apis/certificate'
import { createTargetTag, getTargetTags } from 'pages/apis/targetTag'
import { getServerConfiguration } from 'pages/apis/serverConfiguration'
import {
  EndpointResourceType,
  generateKubernetesAgentInstallScript,
  getConnectionStatus,
  registerKubernetesApi,
  registerOpenClaw,
  registerSshConnection,
  type GenerateKubernetesAgentInstallScriptData,
  type KubernetesAgentStorageType,
  type EndpointResourceReference,
} from 'pages/apis/machine'
import { DeploymentAccountType, getDeploymentAccounts } from 'pages/apis/deploymentAccount'

const deploymentTypes = [
  { key: 'Kubernetes', label: 'Kubernetes' },
  { key: 'OpenClaw', label: 'OpenClaw' },
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

const openClawOptions = [
  {
    key: 'gateway',
    title: 'OpenClaw Gateway',
    desc: 'Register an OpenClaw endpoint and choose authentication via account or inline tokens.',
    recommended: true,
  },
]

const linuxOptions = [
  {
    key: 'ssh',
    title: 'SSH Connection',
    desc: 'Connect to this target via Secure Shell (SSH).',
    recommended: true,
  },
]

type KubernetesApiAuthType =
  | 'usernamepassword'
  | 'token'
  | 'azureserviceprincipal'
  | 'azureoidc'
  | 'awsaccount'
  | 'awsoidc'
  | 'googlecloud'
  | 'certificate'
  | 'podserviceaccount'

type OpenClawAuthMode = 'account' | 'inline'

function toShellScript(bash: string | null | undefined, shell: 'bash' | 'powershell'): string {
  if (!bash) return ''
  if (shell === 'powershell') return bash.replace(/ \\\n/g, ' `\n')
  return bash
}

const kubernetesAgentStorageTypeOptions: Array<{ value: KubernetesAgentStorageType; label: string }> = [
  { value: 'builtin-nfs', label: 'Built-in NFS (default)' },
  { value: 'external-nfs', label: 'External NFS' },
  { value: 'custom', label: 'Custom PVC' },
]

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
  loading,
}: {
  label: string
  helper?: React.ReactNode
  options: { value: string; label: string }[]
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  loading?: boolean
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
        loading={loading}
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
  const [agentFormView, setAgentFormView] = useState<'kubernetes-agent' | 'kubernetes-api' | 'openclaw' | 'ssh' | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentEnvironments, setAgentEnvironments] = useState<string[]>([])
  const [agentTags, setAgentTags] = useState<string[]>([])
  const [agentStorageType, setAgentStorageType] = useState<KubernetesAgentStorageType>('builtin-nfs')
  const [agentNfsServer, setAgentNfsServer] = useState('')
  const [agentNfsPath, setAgentNfsPath] = useState('')
  const [agentCustomStorageClassName, setAgentCustomStorageClassName] = useState('')
  const [agentNamespace, setAgentNamespace] = useState('')
  const [agentServerUrl, setAgentServerUrl] = useState(() => window.location.origin)
  const [agentCommsUrl, setAgentCommsUrl] = useState(() => {
    const url = new URL(window.location.origin)
    return `${url.protocol}//${url.hostname}:10943`
  })
  const [agentServerThumbprint, setAgentServerThumbprint] = useState('')
  const [showOptional, setShowOptional] = useState(true)
  const [helpPanelVisible, setHelpPanelVisible] = useState(true)
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: number; label: string }[]>([])
  const [agentEnvironmentOptions, setAgentEnvironmentOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false)
  const [targetTagOptions, setTargetTagOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingTargetTagOptions, setLoadingTargetTagOptions] = useState(false)
  const [agentTagSearchValue, setAgentTagSearchValue] = useState('')
  const [apiTagSearchValue, setApiTagSearchValue] = useState('')
  const creatingTargetTagsRef = useRef<Set<string>>(new Set())
  const [apiDisplayName, setApiDisplayName] = useState('')
  const [apiEnvironments, setApiEnvironments] = useState<number[]>([])
  const [apiTargetTags, setApiTargetTags] = useState<string[]>([])
  const [apiAuthType, setApiAuthType] = useState<KubernetesApiAuthType | undefined>(undefined)
  const [apiSelectedAccountId, setApiSelectedAccountId] = useState<string | undefined>(undefined)
  const [apiSelectedClientCertificateId, setApiSelectedClientCertificateId] = useState<string | undefined>(undefined)
  const [apiToken, setApiToken] = useState('')
  const [apiUsername, setApiUsername] = useState('')
  const [apiPassword, setApiPassword] = useState('')
  const [apiAwsUseInstanceServiceRole, setApiAwsUseInstanceServiceRole] = useState(false)
  const [apiAwsAssumeDifferentServiceRole, setApiAwsAssumeDifferentServiceRole] = useState(false)
  const [apiAwsServiceRoleArn, setApiAwsServiceRoleArn] = useState('')
  const [apiAwsEksClusterName, setApiAwsEksClusterName] = useState('')
  const [apiAwsRegion, setApiAwsRegion] = useState('')
  const [apiAwsAssumeRoleSessionDuration, setApiAwsAssumeRoleSessionDuration] = useState('')
  const [apiAwsAssumeRoleExternalId, setApiAwsAssumeRoleExternalId] = useState('')
  const [apiSaving, setApiSaving] = useState(false)
  const [apiClusterUrl, setApiClusterUrl] = useState('')
  const [apiClusterCertificate, setApiClusterCertificate] = useState<string | undefined>(undefined)
  const [deploymentAccountOptions, setDeploymentAccountOptions] = useState<{ value: string; label: string; accountType: number }[]>([])
  const [loadingDeploymentAccounts, setLoadingDeploymentAccounts] = useState(false)
  const [certificateOptions, setCertificateOptions] = useState<{ value: string; label: string; hasPrivateKey: boolean }[]>([])
  const [loadingCertificateOptions, setLoadingCertificateOptions] = useState(false)
  const [apiSkipTlsVerification, setApiSkipTlsVerification] = useState(false)
  const [apiDefaultNamespace, setApiDefaultNamespace] = useState('')
  const [apiContainerOptions, setApiContainerOptions] = useState('')

  const [openClawDisplayName, setOpenClawDisplayName] = useState('')
  const [openClawEnvironments, setOpenClawEnvironments] = useState<number[]>([])
  const [openClawTargetTags, setOpenClawTargetTags] = useState<string[]>([])
  const [openClawBaseUrl, setOpenClawBaseUrl] = useState('')
  const [openClawAuthMode, setOpenClawAuthMode] = useState<OpenClawAuthMode>('account')
  const [openClawSelectedAccountId, setOpenClawSelectedAccountId] = useState<string | undefined>(undefined)
  const [openClawInlineGatewayToken, setOpenClawInlineGatewayToken] = useState('')
  const [openClawInlineHooksToken, setOpenClawInlineHooksToken] = useState('')
  const [openClawSaving, setOpenClawSaving] = useState(false)
  const [openClawTagSearchValue, setOpenClawTagSearchValue] = useState('')

  const [sshDisplayName, setSshDisplayName] = useState('')
  const [sshEnvironments, setSshEnvironments] = useState<number[]>([])
  const [sshTargetTags, setSshTargetTags] = useState<string[]>([])
  const [sshHost, setSshHost] = useState('')
  const [sshPortText, setSshPortText] = useState('22')
  const [sshFingerprint, setSshFingerprint] = useState('')
  const [sshRemoteWorkingDirectory, setSshRemoteWorkingDirectory] = useState('')
  const [sshSelectedAccountId, setSshSelectedAccountId] = useState<string | undefined>(undefined)
  const [sshSaving, setSshSaving] = useState(false)
  const [sshTagSearchValue, setSshTagSearchValue] = useState('')
  // --- Kubernetes Agent wizard ---
  const [scriptShell, setScriptShell] = useState<'bash' | 'powershell'>('bash')
  const [agentStep, setAgentStep] = useState<'form' | 'script' | 'connected'>('form')
  const [agentTimedOut, setAgentTimedOut] = useState(false)
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
    containerOptions: true,
  })

  const [openClawExpanded, setOpenClawExpanded] = useState<Record<string, boolean>>({
    displayName: true,
    environments: true,
    targetTags: true,
    authentication: true,
    openClawDetails: true,
  })

  const [sshExpanded, setSshExpanded] = useState<Record<string, boolean>>({
    displayName: true,
    environments: true,
    targetTags: true,
    authentication: true,
    sshDetails: true,
  })

  const tokenAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.Token).map(({ value, label }) => ({ value, label }))
  const usernamePasswordAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.UsernamePassword).map(({ value, label }) => ({ value, label }))
  const azureServicePrincipalAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.AzureServicePrincipal).map(({ value, label }) => ({ value, label }))
  const azureOidcAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.AzureOidc).map(({ value, label }) => ({ value, label }))
  const awsAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.AmazonWebServicesAccount || a.accountType === DeploymentAccountType.AmazonWebServicesRoleAccount).map(({ value, label }) => ({ value, label }))
  const awsOidcAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.AmazonWebServicesOidcAccount).map(({ value, label }) => ({ value, label }))
  const googleCloudAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.GoogleCloudAccount).map(({ value, label }) => ({ value, label }))
  const openClawAccountOptions = deploymentAccountOptions.filter((a) => a.accountType === DeploymentAccountType.OpenClawGateway).map(({ value, label }) => ({ value, label }))
  const sshAccountOptions = deploymentAccountOptions
    .filter((a) => a.accountType === DeploymentAccountType.SshKeyPair || a.accountType === DeploymentAccountType.UsernamePassword)
    .map(({ value, label }) => ({ value, label }))
  const clientCertificateOptions = certificateOptions.map(({ value, label }) => ({ value, label }))
  const clusterCertificateOptions = certificateOptions.map(({ value, label }) => ({ value, label }))

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if (pollingTimeoutRef.current) { clearTimeout(pollingTimeoutRef.current); pollingTimeoutRef.current = null }
  }, [])

  const closeAddModal = () => {
    stopPolling()
    setAgentTimedOut(false)
    setAgentFormView(null)
    setAgentStep('form')
    setScriptData(null)
    // Reset Kubernetes Agent form
    setAgentName('')
    setAgentEnvironments([])
    setAgentTags([])
    setAgentStorageType('builtin-nfs')
    setAgentNfsServer('')
    setAgentNfsPath('')
    setAgentCustomStorageClassName('')
    setAgentNamespace('')
    setAgentServerUrl(window.location.origin)
    const url = new URL(window.location.origin)
    setAgentCommsUrl(`${url.protocol}//${url.hostname}:10943`)
    setAgentServerThumbprint('')
    setAgentLoading(false)
    setScriptShell('bash')
    // Reset Kubernetes API form
    setApiDisplayName('')
    setApiEnvironments([])
    setApiTargetTags([])
    setApiAuthType(undefined)
    setApiSelectedAccountId(undefined)
    setApiSelectedClientCertificateId(undefined)
    setApiToken('')
    setApiUsername('')
    setApiPassword('')
    setApiAwsUseInstanceServiceRole(false)
    setApiAwsAssumeDifferentServiceRole(false)
    setApiAwsServiceRoleArn('')
    setApiAwsEksClusterName('')
    setApiAwsRegion('')
    setApiAwsAssumeRoleSessionDuration('')
    setApiAwsAssumeRoleExternalId('')
    setApiClusterUrl('')
    setApiClusterCertificate(undefined)
    setApiSkipTlsVerification(false)
    setApiDefaultNamespace('')
    setApiContainerOptions('')
    setApiSaving(false)

    setOpenClawDisplayName('')
    setOpenClawEnvironments([])
    setOpenClawTargetTags([])
    setOpenClawBaseUrl('')
    setOpenClawAuthMode('account')
    setOpenClawSelectedAccountId(undefined)
    setOpenClawInlineGatewayToken('')
    setOpenClawInlineHooksToken('')
    setOpenClawSaving(false)
    setOpenClawTagSearchValue('')

    setSshDisplayName('')
    setSshEnvironments([])
    setSshTargetTags([])
    setSshHost('')
    setSshPortText('22')
    setSshFingerprint('')
    setSshRemoteWorkingDirectory('')
    setSshSelectedAccountId(undefined)
    setSshSaving(false)
    setSshTagSearchValue('')
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
    setAgentTimedOut(false)

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
      setAgentTimedOut(true)
    }, 15 * 60 * 1000)
  }, [stopPolling])

  const handleAgentNext = async () => {
    if (!agentName.trim()) { message.warning('Please enter an agent name'); return }
    if (agentEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (agentTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (agentStorageType === 'external-nfs' && !agentNfsServer.trim()) { message.warning('Please provide an NFS server for External NFS'); return }
    if (agentStorageType === 'custom' && !agentCustomStorageClassName.trim()) { message.warning('Please provide a storage class name for Custom PVC'); return }
    if (!agentServerUrl.trim()) { message.warning('Please provide Squid Server URL'); return }
    if (!agentCommsUrl.trim()) { message.warning('Please provide Squid Server Communications URL'); return }

    setAgentLoading(true)
    try {
      const data = await generateKubernetesAgentInstallScript({
        agentName: agentName.trim(),
        serverUrl: agentServerUrl.trim(),
        serverCommsUrl: agentCommsUrl.trim(),
        serverThumbprint: agentServerThumbprint.trim(),
        storageType: agentStorageType,
        nfsServer: agentStorageType === 'external-nfs' ? agentNfsServer.trim() : undefined,
        nfsPath: agentStorageType === 'external-nfs' && agentNfsPath.trim() ? agentNfsPath.trim() : undefined,
        storageClassName: agentStorageType === 'custom' ? agentCustomStorageClassName.trim() : undefined,
        environments: agentEnvironments,
        tags: agentTags,
        spaceId: space.id,
        defaultNamespace: agentNamespace.trim() || undefined,
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

  useEffect(() => {
    if (agentFormView !== 'kubernetes-agent') return

    let mounted = true
    getServerConfiguration()
      .then((config) => {
        if (!mounted) return

        const payload = config as unknown as Record<string, unknown>
        const serverUrl = String(payload.serverUrl ?? payload.ServerUrl ?? '').trim()
        if (serverUrl) {
          setAgentServerUrl(serverUrl)
        }

        let commsUrl = String(payload.commsUrl ?? payload.CommsUrl ?? '').trim()
        if (!commsUrl && serverUrl) {
          try {
            const parsed = new URL(serverUrl)
            const pollingPort = Number(payload.pollingPort ?? payload.PollingPort)
            if (Number.isFinite(pollingPort) && pollingPort > 0) {
              parsed.port = String(pollingPort)
            }
            commsUrl = parsed.toString()
          } catch {
            commsUrl = ''
          }
        }
        if (commsUrl) {
          setAgentCommsUrl(commsUrl)
        }

        const thumbprint = String(payload.serverThumbprint ?? payload.ServerThumbprint ?? '').trim()
        setAgentServerThumbprint(thumbprint)
      })
      .catch((error) => {
        console.error('Failed to load server configuration', error)
      })

    return () => {
      mounted = false
    }
  }, [agentFormView])

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

  const toggleOpenClawSection = (key: string) => {
    setOpenClawExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAllOpenClawSections = () => {
    setOpenClawExpanded((prev) => {
      const shouldExpandAll = Object.values(prev).every((v) => v === false)
      return Object.fromEntries(Object.keys(prev).map((k) => [k, shouldExpandAll])) as Record<string, boolean>
    })
  }

  const toggleSshSection = (key: string) => {
    setSshExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAllSshSections = () => {
    setSshExpanded((prev) => {
      const shouldExpandAll = Object.values(prev).every((v) => v === false)
      return Object.fromEntries(Object.keys(prev).map((k) => [k, shouldExpandAll])) as Record<string, boolean>
    })
  }

  const loadCertificates = useCallback(async () => {
    setLoadingCertificateOptions(true)
    try {
      const res = await getCertificates({ pageSize: 1000, spaceId: space.id })
      setCertificateOptions(
        (res.certificates ?? []).map((cert) => ({
          value: String(cert.id),
          label: cert.name,
          hasPrivateKey: !!cert.hasPrivateKey,
        }))
      )
    } catch (error) {
      console.error('Failed to load certificates', error)
      setCertificateOptions([])
    } finally {
      setLoadingCertificateOptions(false)
    }
  }, [space.id])

  const handleSaveKubernetesApi = async () => {
    if (!apiDisplayName.trim()) { message.warning('Please enter a display name'); return }
    if (apiEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (apiTargetTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (!apiClusterUrl.trim()) { message.warning('Please enter the Kubernetes cluster URL'); return }
    if (!apiAuthType) { message.warning('Please select an authentication type'); return }

    setApiSaving(true)
    try {
      const resourceReferences: EndpointResourceReference[] = []

      if (
        apiAuthType === 'token' ||
        apiAuthType === 'usernamepassword' ||
        apiAuthType === 'azureserviceprincipal' ||
        apiAuthType === 'azureoidc' ||
        apiAuthType === 'awsoidc' ||
        apiAuthType === 'googlecloud'
      ) {
        const accountId = Number(apiSelectedAccountId)
        if (!Number.isFinite(accountId) || accountId <= 0) {
          message.warning('Please select an account')
          return
        }
        resourceReferences.push({
          type: EndpointResourceType.AuthenticationAccount,
          resourceId: accountId,
        })
      } else if (apiAuthType === 'awsaccount' && !apiAwsUseInstanceServiceRole) {
        const accountId = Number(apiSelectedAccountId)
        if (!Number.isFinite(accountId) || accountId <= 0) {
          message.warning('Please select an AWS account')
          return
        }
        resourceReferences.push({
          type: EndpointResourceType.AuthenticationAccount,
          resourceId: accountId,
        })
      } else if (apiAuthType === 'certificate') {
        const clientCertificateId = Number(apiSelectedClientCertificateId)
        if (!Number.isFinite(clientCertificateId) || clientCertificateId <= 0) {
          message.warning('Please select a certificate')
          return
        }
        resourceReferences.push({
          type: EndpointResourceType.ClientCertificate,
          resourceId: clientCertificateId,
        })
      }

      if (apiAuthType === 'awsaccount' && apiAwsAssumeDifferentServiceRole && !apiAwsServiceRoleArn.trim()) {
        message.warning('Please enter an AWS service role ARN')
        return
      }
      if (apiAuthType === 'awsaccount' && !apiAwsEksClusterName.trim()) {
        message.warning('Please enter an EKS cluster name')
        return
      }
      if (apiAuthType === 'awsaccount' && !apiAwsRegion.trim()) {
        message.warning('Please enter an AWS region')
        return
      }
      if (apiAuthType === 'awsaccount' && apiAwsAssumeRoleSessionDuration.trim() && !/^\d+$/.test(apiAwsAssumeRoleSessionDuration.trim())) {
        message.warning('Assume role session duration must be a number of seconds')
        return
      }

      const clusterCertificateId = Number(apiClusterCertificate)
      if (Number.isFinite(clusterCertificateId) && clusterCertificateId > 0) {
        resourceReferences.push({
          type: EndpointResourceType.ClusterCertificate,
          resourceId: clusterCertificateId,
        })
      }

      const allowNoAuthResourceReference = apiAuthType === 'awsaccount' && apiAwsUseInstanceServiceRole
      if (resourceReferences.length === 0) {
        if (apiAuthType === 'podserviceaccount') {
          message.warning('Pod Service Account currently requires a cluster certificate selection before saving.')
          return
        }
        if (!allowNoAuthResourceReference) {
          message.warning('Please select at least one authentication or certificate resource')
          return
        }
      }

      let providerType: number | undefined
      let providerConfig: string | undefined
      if (apiAuthType === 'awsaccount') {
        providerType = 1 // AwsEks
        const providerConfigPayload: Record<string, unknown> = {
          clusterName: apiAwsEksClusterName.trim(),
          region: apiAwsRegion.trim(),
          useInstanceRole: apiAwsUseInstanceServiceRole,
        }
        if (apiAwsAssumeDifferentServiceRole && apiAwsServiceRoleArn.trim()) {
          providerConfigPayload.assumeRoleArn = apiAwsServiceRoleArn.trim()
          if (apiAwsAssumeRoleSessionDuration.trim()) {
            providerConfigPayload.assumeRoleSessionDuration = apiAwsAssumeRoleSessionDuration.trim()
          }
          if (apiAwsAssumeRoleExternalId.trim()) {
            providerConfigPayload.assumeRoleExternalId = apiAwsAssumeRoleExternalId.trim()
          }
        }
        providerConfig = JSON.stringify(providerConfigPayload)
      }

      await registerKubernetesApi({
        machineName: apiDisplayName.trim(),
        spaceId: space.id,
        roles: apiTargetTags,
        environmentIds: apiEnvironments,
        clusterUrl: apiClusterUrl.trim(),
        namespace: apiDefaultNamespace.trim() || 'default',
        skipTlsVerification: apiSkipTlsVerification,
        providerType,
        providerConfig,
        resourceReferences,
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

  const handleSaveOpenClaw = async () => {
    if (!openClawDisplayName.trim()) { message.warning('Please enter a display name'); return }
    if (openClawEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (openClawTargetTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (!openClawBaseUrl.trim()) { message.warning('Please enter the OpenClaw URL'); return }

    setOpenClawSaving(true)
    try {
      const requestPayload: {
        machineName: string
        spaceId: number
        roles: string[]
        environmentIds: number[]
        baseUrl: string
        inlineGatewayToken?: string
        inlineHooksToken?: string
        resourceReferences?: EndpointResourceReference[]
      } = {
        machineName: openClawDisplayName.trim(),
        spaceId: space.id,
        roles: openClawTargetTags,
        environmentIds: openClawEnvironments,
        baseUrl: openClawBaseUrl.trim(),
      }

      if (openClawAuthMode === 'account') {
        const accountId = Number(openClawSelectedAccountId)
        if (!Number.isFinite(accountId) || accountId <= 0) {
          message.warning('Please select an OpenClaw account')
          return
        }
        requestPayload.resourceReferences = [{
          type: EndpointResourceType.AuthenticationAccount,
          resourceId: accountId,
        }]
      } else {
        const inlineGatewayToken = openClawInlineGatewayToken.trim()
        const inlineHooksToken = openClawInlineHooksToken.trim()
        if (!inlineGatewayToken) {
          message.warning('Please provide an inline gateway token')
          return
        }
        requestPayload.inlineGatewayToken = inlineGatewayToken
        if (inlineHooksToken) requestPayload.inlineHooksToken = inlineHooksToken
      }

      await registerOpenClaw(requestPayload)

      message.success('OpenClaw target registered successfully')
      closeAddModal()
      navigate(`/${space.slug}/deployment/targets`)
    } catch {
      message.error('Failed to register OpenClaw target')
    } finally {
      setOpenClawSaving(false)
    }
  }

  const handleSaveSshConnection = async () => {
    if (!sshDisplayName.trim()) { message.warning('Please enter a display name'); return }
    if (sshEnvironments.length === 0) { message.warning('Please select at least one environment'); return }
    if (sshTargetTags.length === 0) { message.warning('Please add at least one target tag'); return }
    if (!sshHost.trim()) { message.warning('Please enter the SSH host'); return }

    const parsedPort = Number(sshPortText)
    if (!Number.isFinite(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      message.warning('Please enter a valid SSH port (1-65535)')
      return
    }

    const accountId = Number(sshSelectedAccountId)
    if (!Number.isFinite(accountId) || accountId <= 0) {
      message.warning('Please select an SSH account')
      return
    }

    setSshSaving(true)
    try {
      await registerSshConnection({
        machineName: sshDisplayName.trim(),
        spaceId: space.id,
        roles: sshTargetTags,
        environmentIds: sshEnvironments,
        host: sshHost.trim(),
        port: Math.floor(parsedPort),
        fingerprint: sshFingerprint.trim(),
        remoteWorkingDirectory: sshRemoteWorkingDirectory.trim(),
        resourceReferences: [
          {
            type: EndpointResourceType.AuthenticationAccount,
            resourceId: accountId,
          },
        ],
      })

      message.success('SSH target registered successfully')
      closeAddModal()
      navigate(`/${space.slug}/deployment/targets`)
    } catch {
      message.error('Failed to register SSH target')
    } finally {
      setSshSaving(false)
    }
  }

  useEffect(() => {
    let mounted = true
    setLoadingEnvironmentOptions(true)
    getEnvironments({ pageSize: 1000, spaceId: space.id })
      .then((res) => {
        if (!mounted) return
        const envs = res.environments ?? []
        setEnvironmentOptions(envs.map((env) => ({ value: env.id, label: env.name })))
        setAgentEnvironmentOptions(envs.map((env) => ({ value: env.name, label: env.name })))
      })
      .catch(() => {
        if (!mounted) return
        setEnvironmentOptions([])
        setAgentEnvironmentOptions([])
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

  const loadDeploymentAccounts = useCallback(async () => {
    setLoadingDeploymentAccounts(true)
    try {
      const res = await getDeploymentAccounts({ pageSize: 1000, spaceId: space.id })
      setDeploymentAccountOptions(
        (res.deploymentAccounts ?? []).map((account) => ({
          value: String(account.id),
          label: account.name,
          accountType: account.accountType,
        }))
      )
    } catch (error) {
      console.error('Failed to load deployment accounts', error)
      setDeploymentAccountOptions([])
    } finally {
      setLoadingDeploymentAccounts(false)
    }
  }, [space.id])

  useEffect(() => {
    void loadDeploymentAccounts()
  }, [loadDeploymentAccounts])

  useEffect(() => {
    void loadCertificates()
  }, [loadCertificates])

  useEffect(() => {
    setApiSelectedAccountId(undefined)
    setApiSelectedClientCertificateId(undefined)
    if (apiAuthType !== 'awsaccount') {
      setApiAwsUseInstanceServiceRole(false)
      setApiAwsAssumeDifferentServiceRole(false)
      setApiAwsServiceRoleArn('')
      setApiAwsEksClusterName('')
      setApiAwsRegion('')
      setApiAwsAssumeRoleSessionDuration('')
      setApiAwsAssumeRoleExternalId('')
    }
  }, [apiAuthType])

  useEffect(() => {
    if (openClawAuthMode === 'account') {
      setOpenClawInlineGatewayToken('')
      setOpenClawInlineHooksToken('')
      return
    }

    setOpenClawSelectedAccountId(undefined)
  }, [openClawAuthMode])

  useEffect(() => {
    if (apiClusterCertificate) {
      setApiSkipTlsVerification(false)
      return
    }

    setApiSkipTlsVerification(true)
  }, [apiClusterCertificate])

  useEffect(() => {
    if (apiAuthType !== 'certificate') return
    void loadCertificates()
  }, [apiAuthType, loadCertificates])

  const nfsCsiDriverRequired = Boolean(scriptData && (scriptData.nfsCsiDriverRequired ?? scriptData.nfsCsiDriverScript))
  const agentInstallStepNumber = nfsCsiDriverRequired ? 2 : 1

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
              ) : selectedDeploymentType === 'OpenClaw' ? (
                <div>
                  <div className="mb-5 text-gray-700">
                    Register an <strong>OpenClaw</strong> deployment target.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {openClawOptions.map((option) => (
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
                          <div className="w-20 h-20 bg-white border border-emerald-100 rounded-lg flex items-center justify-center">
                            <img src="/openclaw-icon.png" alt="OpenClaw" className="w-12 h-12 object-contain" />
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
                                setAgentFormView('openclaw')
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
              ) : selectedDeploymentType === 'Linux' ? (
                <div>
                  <div className="mb-5 text-gray-700">
                    Connect to Linux targets via <strong>SSH</strong>.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {linuxOptions.map((option) => (
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
                          <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 24 24" width="44" height="44" fill="#0f172a" aria-hidden="true">
                              <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7H4zm2.6 2.3 2.8 2.7-2.8 2.7 1.1 1.1 3.9-3.8-3.9-3.8-1.1 1.1zM12.5 15h5v-1.5h-5V15z" />
                            </svg>
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
                                setAgentFormView('ssh')
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
        maskClosable={false}
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
                      options={agentEnvironmentOptions}
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

                    <SelectField
                      label="Storage type"
                      helper="Choose how agent storage should be provisioned."
                      options={kubernetesAgentStorageTypeOptions.map((option) => ({ value: option.value, label: option.label }))}
                      value={agentStorageType}
                      onChange={(value) => setAgentStorageType(value as KubernetesAgentStorageType)}
                    />

                    {agentStorageType === 'external-nfs' && (
                      <>
                        <FormField
                          label="NFS Server IP/Host"
                          helper="Required for External NFS mode."
                          value={agentNfsServer}
                          onChange={setAgentNfsServer}
                        />
                        <FormField
                          label="NFS Path"
                          placeholder="/export/path"
                          helper="Optional. Leave empty to use backend default."
                          value={agentNfsPath}
                          onChange={setAgentNfsPath}
                        />
                      </>
                    )}

                    {agentStorageType === 'custom' && (
                      <FormField
                        label="Storage class name"
                        helper="Required for Custom PVC mode."
                        value={agentCustomStorageClassName}
                        onChange={setAgentCustomStorageClassName}
                      />
                    )}

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

                    <div className="mb-4 flex items-center justify-end">
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
                    </div>

                    {nfsCsiDriverRequired && scriptData.nfsCsiDriverScript ? (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">1. Install NFS CSI Driver (one-time setup)</label>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => { navigator.clipboard.writeText(toShellScript(scriptData.nfsCsiDriverScript, scriptShell)); message.success('Copied') }}
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 text-sm p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                          {toShellScript(scriptData.nfsCsiDriverScript, scriptShell)}
                        </pre>
                      </div>
                    ) : null}

                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">{agentInstallStepNumber}. Install Squid Agent</label>
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

                    {agentTimedOut ? (
                      <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-md">
                        <ExclamationCircleOutlined className="text-orange-500 text-lg" />
                        <span className="text-sm text-orange-700">Connection timed out. Please check that the agent is running and try again.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-md">
                        <LoadingOutlined className="text-squid-blue text-lg" />
                        <span className="text-sm text-gray-700">Waiting for agent to connect...</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 px-10 py-4 flex justify-end gap-3 flex-shrink-0">
                    <Button size="large" onClick={() => { stopPolling(); setAgentTimedOut(false); setAgentStep('form') }}>Back</Button>
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
        ) : agentFormView === 'openclaw' ? (
          <div className="max-h-[82vh] overflow-y-auto">
            <div className="px-8 pt-7 pb-5 border-b border-gray-200 bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-semibold text-gray-900 m-0">Add OpenClaw Target</h2>
            </div>

            <div className="px-8 py-4">
              <button
                type="button"
                onClick={toggleAllOpenClawSections}
                className="text-xs font-semibold tracking-wide text-squid-blue hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                {Object.values(openClawExpanded).every((v) => v === false) ? 'EXPAND ALL' : 'COLLAPSE ALL'}
              </button>
            </div>

            <div className="px-8 pb-8 space-y-5 bg-white">
              <ExpandableFormCard
                title="Display Name"
                subtitle="A short, memorable, unique name for this deployment target."
                expanded={openClawExpanded.displayName}
                onToggle={() => toggleOpenClawSection('displayName')}
              >
                <FormField
                  label="Display name"
                  value={openClawDisplayName}
                  onChange={setOpenClawDisplayName}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Environments"
                subtitle="Choose at least one environment for the deployment target."
                expanded={openClawExpanded.environments}
                onToggle={() => toggleOpenClawSection('environments')}
              >
                <MultiSelectField
                  label="Select environments"
                  options={environmentOptions}
                  loading={loadingEnvironmentOptions}
                  value={openClawEnvironments}
                  onChange={setOpenClawEnvironments}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title={<span className="inline-flex items-center gap-1">Target Tags <InfoHint /></span>}
                subtitle="Add at least one target tag to make this deployment target selectable by deployment and runbook processes."
                expanded={openClawExpanded.targetTags}
                onToggle={() => toggleOpenClawSection('targetTags')}
              >
                <MultiSelectField
                  label="Target tags"
                  options={targetTagOptions}
                  loading={loadingTargetTagOptions}
                  value={openClawTargetTags}
                  onChange={(values) => { void handleTargetTagValuesChange(values, setOpenClawTargetTags) }}
                  searchValue={openClawTagSearchValue}
                  onSearch={setOpenClawTagSearchValue}
                  onCreateFromSearch={(name) => { void handleCreateTargetTagFromSearch(name, setOpenClawTargetTags, () => setOpenClawTagSearchValue('')) }}
                />
                <NoteBlock>You are required to add at least one target tag.</NoteBlock>
              </ExpandableFormCard>

              <SectionHeading>Communication</SectionHeading>

              <ExpandableFormCard
                title="Authentication"
                subtitle="Choose authentication via OpenClaw account or inline token."
                expanded={openClawExpanded.authentication}
                onToggle={() => toggleOpenClawSection('authentication')}
              >
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Authentication mode</label>
                  <Radio.Group
                    value={openClawAuthMode}
                    onChange={(event) => setOpenClawAuthMode(event.target.value as OpenClawAuthMode)}
                  >
                    <Radio value="account">OpenClaw Account</Radio>
                    <Radio value="inline">Inline Token</Radio>
                  </Radio.Group>
                </div>

                {openClawAuthMode === 'account' ? (
                  <div className="mb-5">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <SelectField
                          label="Select OpenClaw account"
                          placeholder="Select an OpenClaw account"
                          value={openClawSelectedAccountId}
                          onChange={setOpenClawSelectedAccountId}
                          options={openClawAccountOptions}
                          loading={loadingDeploymentAccounts}
                        />
                      </div>
                      <div className="flex items-center gap-1 pb-5">
                        <Button
                          icon={<ReloadOutlined />}
                          aria-label="Refresh OpenClaw accounts"
                          loading={loadingDeploymentAccounts}
                          onClick={() => { void loadDeploymentAccounts() }}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          aria-label="Add OpenClaw account"
                          onClick={() => window.open(`/${space.slug}/infrastructure/accounts/create?accountType=12`, '_blank', 'noopener,noreferrer')}
                        />
                      </div>
                    </div>
                    <NoteBlock>Only OpenClaw Gateway accounts can be selected.</NoteBlock>
                  </div>
                ) : (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Inline Gateway Token *</label>
                      <Input.Password
                        placeholder="dev-gw-token"
                        value={openClawInlineGatewayToken}
                        onChange={(event) => setOpenClawInlineGatewayToken(event.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2 mb-0">
                        Required. Used for <code>/tools/invoke</code> and <code>/v1/chat/completions</code>.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 mb-0">
                        Get it: <code>openclaw config get gateway.auth.token</code>
                      </p>
                    </div>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Inline Hooks Token (Optional)</label>
                      <Input.Password
                        placeholder="dev-hooks-token"
                        value={openClawInlineHooksToken}
                        onChange={(event) => setOpenClawInlineHooksToken(event.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2 mb-0">
                        Required only for RunAgent and Wake actions.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 mb-0">
                        OpenClaw uses a separate token for <code>/hooks/*</code> endpoints.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 mb-0">
                        Get it: <code>openclaw config get hooks.token</code>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 mb-0">
                        Set it: <code>openclaw config set hooks.token &lt;value&gt;</code>
                      </p>
                    </div>
                    <NoteBlock>Account tokens take precedence over inline tokens when both are provided.</NoteBlock>
                  </>
                )}
              </ExpandableFormCard>

              <ExpandableFormCard
                title="OpenClaw Details"
                subtitle="Enter endpoint settings for this OpenClaw target."
                expanded={openClawExpanded.openClawDetails}
                onToggle={() => toggleOpenClawSection('openClawDetails')}
              >
                <FormField
                  label="OpenClaw URL"
                  value={openClawBaseUrl}
                  onChange={setOpenClawBaseUrl}
                  placeholder="https://claw.example.com:18789"
                  helper="Use an absolute URL including port."
                />
              </ExpandableFormCard>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-8 py-4 flex justify-end gap-3">
              <Button size="large" onClick={closeAddModal}>Cancel</Button>
              <Button size="large" type="primary" loading={openClawSaving} onClick={handleSaveOpenClaw} className="!bg-green-700 !border-green-700">
                Save
              </Button>
            </div>
          </div>
        ) : agentFormView === 'ssh' ? (
          <div className="max-h-[82vh] overflow-y-auto">
            <div className="px-8 pt-7 pb-5 border-b border-gray-200 bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-semibold text-gray-900 m-0">Add SSH Connection</h2>
            </div>

            <div className="px-8 py-4">
              <button
                type="button"
                onClick={toggleAllSshSections}
                className="text-xs font-semibold tracking-wide text-squid-blue hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                {Object.values(sshExpanded).every((v) => v === false) ? 'EXPAND ALL' : 'COLLAPSE ALL'}
              </button>
            </div>

            <div className="px-8 pb-8 space-y-5 bg-white">
              <ExpandableFormCard
                title="Display Name"
                subtitle="A short, memorable, unique name for this deployment target."
                expanded={sshExpanded.displayName}
                onToggle={() => toggleSshSection('displayName')}
              >
                <FormField
                  label="Display name"
                  value={sshDisplayName}
                  onChange={setSshDisplayName}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title="Environments"
                subtitle="Choose at least one environment for the deployment target."
                expanded={sshExpanded.environments}
                onToggle={() => toggleSshSection('environments')}
              >
                <MultiSelectField
                  label="Select environments"
                  options={environmentOptions}
                  loading={loadingEnvironmentOptions}
                  value={sshEnvironments}
                  onChange={setSshEnvironments}
                />
              </ExpandableFormCard>

              <ExpandableFormCard
                title={<span className="inline-flex items-center gap-1">Target Tags <InfoHint /></span>}
                subtitle="Add at least one target tag to make this deployment target selectable by deployment and runbook processes."
                expanded={sshExpanded.targetTags}
                onToggle={() => toggleSshSection('targetTags')}
              >
                <MultiSelectField
                  label="Target tags"
                  options={targetTagOptions}
                  loading={loadingTargetTagOptions}
                  value={sshTargetTags}
                  onChange={(values) => { void handleTargetTagValuesChange(values, setSshTargetTags) }}
                  searchValue={sshTagSearchValue}
                  onSearch={setSshTagSearchValue}
                  onCreateFromSearch={(name) => { void handleCreateTargetTagFromSearch(name, setSshTargetTags, () => setSshTagSearchValue('')) }}
                />
                <NoteBlock>You are required to add at least one target tag.</NoteBlock>
              </ExpandableFormCard>

              <SectionHeading>Communication</SectionHeading>

              <ExpandableFormCard
                title="Authentication"
                subtitle="Choose an SSH account for this deployment target."
                expanded={sshExpanded.authentication}
                onToggle={() => toggleSshSection('authentication')}
              >
                <div className="mb-5">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <SelectField
                        label="Select SSH account"
                        placeholder="Select an SSH account"
                        value={sshSelectedAccountId}
                        onChange={setSshSelectedAccountId}
                        options={sshAccountOptions}
                        loading={loadingDeploymentAccounts}
                      />
                    </div>
                    <div className="flex items-center gap-1 pb-5">
                      <Button
                        icon={<ReloadOutlined />}
                        aria-label="Refresh SSH accounts"
                        loading={loadingDeploymentAccounts}
                        onClick={() => { void loadDeploymentAccounts() }}
                      />
                      <Button
                        icon={<PlusOutlined />}
                        aria-label="Add SSH account"
                        onClick={() => window.open(`/${space.slug}/infrastructure/accounts/create?accountType=2`, '_blank', 'noopener,noreferrer')}
                      />
                    </div>
                  </div>
                  <NoteBlock>Only Username/Password and SSH Key Pair accounts can be selected.</NoteBlock>
                </div>
              </ExpandableFormCard>

              <ExpandableFormCard
                title="SSH Details"
                subtitle="Configure host and endpoint details for this SSH target."
                expanded={sshExpanded.sshDetails}
                onToggle={() => toggleSshSection('sshDetails')}
              >
                <FormField
                  label="Host"
                  value={sshHost}
                  onChange={setSshHost}
                  placeholder="10.0.0.1 or server.example.com"
                />

                <FormField
                  label="Port"
                  value={sshPortText}
                  onChange={setSshPortText}
                  placeholder="22"
                />

                <FormField
                  label="Fingerprint"
                  value={sshFingerprint}
                  onChange={setSshFingerprint}
                  placeholder="SHA256:xxxx / MD5:xx:xx:xx"
                  helper="Optional. Leave empty to skip host fingerprint validation (recommended only for testing)."
                />

                <FormField
                  label="Remote Working Directory"
                  value={sshRemoteWorkingDirectory}
                  onChange={setSshRemoteWorkingDirectory}
                  placeholder="/tmp"
                  helper="Optional. Leave empty to use /tmp and append squid-{serverTaskId} automatically."
                />
              </ExpandableFormCard>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-8 py-4 flex justify-end gap-3">
              <Button size="large" onClick={closeAddModal}>Cancel</Button>
              <Button size="large" type="primary" loading={sshSaving} onClick={handleSaveSshConnection} className="!bg-green-700 !border-green-700">
                Save
              </Button>
            </div>
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
                  onChange={(value) => setApiAuthType(value as KubernetesApiAuthType)}
                  options={[
                    { value: 'usernamepassword', label: 'Username and password' },
                    { value: 'token', label: 'Token' },
                    { value: 'azureserviceprincipal', label: 'Azure Service Principal' },
                    { value: 'azureoidc', label: 'Azure OIDC Account' },
                    { value: 'awsaccount', label: 'AWS Account' },
                    { value: 'awsoidc', label: 'AWS OIDC Account' },
                    { value: 'googlecloud', label: 'Google Cloud Account' },
                    { value: 'certificate', label: 'Client Certificate' },
                    { value: 'podserviceaccount', label: 'Pod Service Account' },
                  ]}
                />

                {apiAuthType === 'token' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select a token account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={tokenAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with Token credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'usernamepassword' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select a username/password account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={usernamePasswordAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with Username / Password credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'azureserviceprincipal' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select an Azure service principal account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={azureServicePrincipalAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with Azure Service Principal credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'azureoidc' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select an Azure OIDC account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={azureOidcAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with Azure OIDC credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'awsaccount' && (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Execute using the AWS service role for an EC2 instance</label>
                      <Radio.Group
                        value={apiAwsUseInstanceServiceRole ? 'yes' : 'no'}
                        onChange={(event) => setApiAwsUseInstanceServiceRole(event.target.value === 'yes')}
                      >
                        <Radio value="yes">Yes</Radio>
                        <Radio value="no">No</Radio>
                      </Radio.Group>
                    </div>

                    {!apiAwsUseInstanceServiceRole && (
                      <div className="mb-5">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <SelectField
                              label="Select account"
                              placeholder="Select an AWS account"
                              value={apiSelectedAccountId}
                              onChange={setApiSelectedAccountId}
                              options={awsAccountOptions}
                              loading={loadingDeploymentAccounts}
                            />
                          </div>
                          <div className="flex items-center gap-1 pb-5">
                            <Button
                              icon={<ReloadOutlined />}
                              aria-label="Refresh AWS accounts"
                              loading={loadingDeploymentAccounts}
                              onClick={() => { void loadDeploymentAccounts() }}
                            />
                            <Button
                              icon={<PlusOutlined />}
                              aria-label="Add AWS account"
                              onClick={() => window.open(`/${space.slug}/infrastructure/accounts/create?accountType=6`, '_blank', 'noopener,noreferrer')}
                            />
                          </div>
                        </div>
                        <NoteBlock>Only Amazon Web Service Accounts may be selected.</NoteBlock>
                      </div>
                    )}

                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Assume a different AWS service role</label>
                      <Radio.Group
                        value={apiAwsAssumeDifferentServiceRole ? 'yes' : 'no'}
                        onChange={(event) => setApiAwsAssumeDifferentServiceRole(event.target.value === 'yes')}
                      >
                        <Radio value="yes">Yes</Radio>
                        <Radio value="no">No</Radio>
                      </Radio.Group>
                    </div>

                    {apiAwsAssumeDifferentServiceRole && (
                      <>
                        <FormField
                          label="AWS service role ARN"
                          placeholder="arn:aws:iam::123456789012:role/MyRole"
                          value={apiAwsServiceRoleArn}
                          onChange={setApiAwsServiceRoleArn}
                        />
                        <FormField
                          label="Assume role session duration (seconds)"
                          placeholder="3600"
                          value={apiAwsAssumeRoleSessionDuration}
                          onChange={setApiAwsAssumeRoleSessionDuration}
                        />
                        <FormField
                          label="Assume role external ID"
                          placeholder="optional-external-id"
                          value={apiAwsAssumeRoleExternalId}
                          onChange={setApiAwsAssumeRoleExternalId}
                        />
                      </>
                    )}

                    <FormField
                      label="EKS cluster name"
                      value={apiAwsEksClusterName}
                      onChange={setApiAwsEksClusterName}
                    />
                    <FormField
                      label="AWS region"
                      placeholder="us-west-2"
                      value={apiAwsRegion}
                      onChange={setApiAwsRegion}
                    />
                  </>
                )}

                {apiAuthType === 'awsoidc' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select an AWS OIDC account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={awsOidcAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with AWS OIDC credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'googlecloud' && (
                  <>
                    <SelectField
                      label="Select account"
                      placeholder="Select a Google Cloud account"
                      value={apiSelectedAccountId}
                      onChange={setApiSelectedAccountId}
                      options={googleCloudAccountOptions}
                      loading={loadingDeploymentAccounts}
                    />
                    <NoteBlock>Select a deployment account with Google Cloud credentials.</NoteBlock>
                  </>
                )}

                {apiAuthType === 'certificate' && (
                  <>
                    <SelectField
                      label="Select certificate"
                      placeholder="Select a client certificate"
                      value={apiSelectedClientCertificateId}
                      onChange={setApiSelectedClientCertificateId}
                      options={clientCertificateOptions}
                      loading={loadingCertificateOptions}
                    />
                  </>
                )}

                {apiAuthType === 'podserviceaccount' && (
                  <NoteBlock>
                    Pod Service Account will use the worker pod service account context. No deployment account is required.
                  </NoteBlock>
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
                        options={clusterCertificateOptions}
                        loading={loadingCertificateOptions}
                      />
                    </div>
                    <div className="flex items-center gap-1 pb-5">
                      <Button icon={<SearchOutlined />} aria-label="Search certificate" />
                      <Button
                        icon={<ReloadOutlined />}
                        aria-label="Refresh certificates"
                        loading={loadingCertificateOptions}
                        onClick={() => { void loadCertificates() }}
                      />
                      <Button icon={<PlusOutlined />} aria-label="Add certificate" />
                    </div>
                  </div>
                  <NoteBlock>The optional cluster certificate authority.</NoteBlock>
                </div>

                {!apiClusterCertificate && (
                  <div className="mb-4">
                    <Checkbox checked={apiSkipTlsVerification} disabled>
                      <span className="text-base text-gray-700">Skip TLS verification</span>
                    </Checkbox>
                    <NoteBlock>
                      Automatically enabled when no cluster certificate is selected.
                    </NoteBlock>
                  </div>
                )}

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
