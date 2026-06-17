import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Checkbox, Collapse, Modal, Tabs, Spin, Input, Select, message } from 'antd'
import { SearchOutlined, FilterOutlined, MoreOutlined, PlusOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import {
  getMachineUpgradeInfo,
  getMachines,
  MachineDto,
  UpgradeInfoResponseData,
} from 'pages/apis/machine'
import { getEnvironments, EnvironmentDto } from 'pages/apis/environment'
import { createTargetTag, getTargetTags, TargetTagDto } from 'pages/apis/targetTag'
import { useSpace } from 'contexts/SpaceContext'

const { Panel } = Collapse

// ── Types ─────────────────────────────────────────────────────────────────────

// Matches Squid.Message KubernetesApiEndpointDto (PascalCase from System.Text.Json)
interface KubernetesApiEndpoint {
  CommunicationStyle: string
  ClusterUrl: string
  Namespace: string
  SkipTlsVerification: string
  ClusterCertificatePath?: string
  ProxyId?: string
  DefaultWorkerPoolId?: string
  ContainerOptions?: string
}

// Matches Squid.Message KubernetesAgentEndpointDto (PascalCase from System.Text.Json)
interface KubernetesAgentEndpoint {
  CommunicationStyle: string  // "KubernetesAgent"
  SubscriptionId: string
  Thumbprint: string
  Namespace: string
}

interface LinuxTentacleEndpoint {
  CommunicationStyle: string
  Uri?: string
  uri?: string
  HostName?: string
  Hostname?: string
  hostName?: string
  host?: string
}

interface OpenClawEndpoint {
  CommunicationStyle: string
  BaseUrl?: string
  baseUrl?: string
}

type MachineEndpoint = KubernetesApiEndpoint | KubernetesAgentEndpoint | LinuxTentacleEndpoint | OpenClawEndpoint

interface DeploymentTarget {
  id: number
  name: string
  rawCommunicationStyle: string
  communicationStyle: string
  agentVersion: string
  summary: string
  environmentNames: string[]
  tags: string[]
  healthState: 'Healthy' | 'Unhealthy' | 'Unavailable' | 'Unknown' | 'Disabled'
}

interface DeploymentData {
  healthy: DeploymentTarget[]
  disabled: DeploymentTarget[]
}

function parseEndpointJson(json: string): MachineEndpoint | null {
  try {
    return JSON.parse(json) as MachineEndpoint
  } catch {
    return null
  }
}

function communicationStyleLabel(style: string): string {
  const map: Record<string, string> = {
    KubernetesApi: 'Kubernetes API',
    KubernetesAgent: 'Kubernetes Agent',
    TentaclePassive: 'Listening Tentacle',
    TentacleListening: 'Listening Tentacle',
    LinuxListening: 'Listening Tentacle',
    LinuxTentacleListening: 'Listening Tentacle',
    LinuxTentacle: 'Listening Tentacle',
    TentacleActive: 'Polling Tentacle',
    TentaclePolling: 'Polling Tentacle',
    LinuxPolling: 'Polling Tentacle',
    LinuxTentaclePolling: 'Polling Tentacle',
    Ssh: 'SSH Connection',
  }
  return map[style] || style
}

function isLinuxListeningStyle(style: string): boolean {
  const normalized = style.trim().toLowerCase()
  return normalized === 'tentaclepassive' || normalized === 'tentaclelistening' || normalized === 'linuxlistening' || normalized === 'linuxtentaclelistening' || normalized === 'linuxtentacle'
}

function isPollingTentacleStyle(style: string): boolean {
  const normalized = style.trim().toLowerCase()
  return normalized === 'tentacleactive' || normalized === 'tentaclepolling' || normalized === 'linuxpolling' || normalized === 'linuxtentaclepolling'
}

function isTentacleAgentStyle(style: string): boolean {
  return isLinuxListeningStyle(style) || isPollingTentacleStyle(style)
}

function extractPollingSubscriptionIdFromUri(rawValue: string): string {
  const value = rawValue.trim()
  if (!value || !value.toLowerCase().startsWith('poll://')) return ''
  return value.slice('poll://'.length).replace(/^\/+|\/+$/g, '')
}

function formatPollingSubscriptionUri(subscriptionId: string): string {
  const value = subscriptionId.trim()
  if (!value) return ''
  return `poll://${value}/`
}

function readLinuxListeningHostname(ep: MachineEndpoint): string {
  const endpoint = ep as LinuxTentacleEndpoint
  const direct = (endpoint.HostName ?? endpoint.Hostname ?? endpoint.hostName ?? endpoint.host ?? '').trim()
  if (direct) return direct

  const uri = (endpoint.Uri ?? endpoint.uri ?? '').trim()
  if (!uri) return ''

  try {
    return new URL(uri).hostname
  } catch {
    return ''
  }
}

function endpointSummary(ep: MachineEndpoint | null, machine?: MachineDto): string {
  if (!ep) return ''
  if (ep.CommunicationStyle === 'KubernetesApi') return (ep as KubernetesApiEndpoint).ClusterUrl || ''
  if (ep.CommunicationStyle === 'KubernetesAgent') return (ep as KubernetesAgentEndpoint).Thumbprint || ''
  if (isLinuxListeningStyle(ep.CommunicationStyle)) return readLinuxListeningHostname(ep)
  if (isPollingTentacleStyle(ep.CommunicationStyle)) {
    const machineUriId = extractPollingSubscriptionIdFromUri(machine?.uri ?? '')
    if (machineUriId) return formatPollingSubscriptionUri(machineUriId)

    const endpointAny = ep as any
    const endpointUriId = extractPollingSubscriptionIdFromUri(String(endpointAny.Uri ?? endpointAny.uri ?? ''))
    if (endpointUriId) return formatPollingSubscriptionUri(endpointUriId)

    const subscriptionId = String(machine?.pollingSubscriptionId ?? endpointAny.SubscriptionId ?? endpointAny.subscriptionId ?? '').trim()
    return formatPollingSubscriptionUri(subscriptionId)
  }
  return ''
}

function buildTargetTagLookup(tags: TargetTagDto[]): Map<string, string> {
  const lookup = new Map<string, string>()
  tags.forEach((tag) => {
    lookup.set(String(tag.id), tag.name)
    lookup.set(tag.name, tag.name)
    lookup.set(tag.name.toLowerCase(), tag.name)
  })
  return lookup
}

function addEnvironmentLookupKey(lookup: Map<string, string>, rawKey: string | number | undefined, name: string) {
  const key = String(rawKey ?? '').trim()
  if (!key) return

  lookup.set(key, name)
  lookup.set(key.toLowerCase(), name)

  const prefixed = /^environments?-(.+)$/i.exec(key)
  if (prefixed?.[1]) {
    const tail = prefixed[1].trim()
    if (tail) {
      lookup.set(tail, name)
      lookup.set(tail.toLowerCase(), name)
    }
  }

  if (/^\d+$/.test(key)) {
    const prefixedKey = `Environments-${key}`
    lookup.set(prefixedKey, name)
    lookup.set(prefixedKey.toLowerCase(), name)
  }
}

function buildEnvironmentLookup(environments: EnvironmentDto[]): Map<string, string> {
  const lookup = new Map<string, string>()
  environments.forEach((env) => {
    addEnvironmentLookupKey(lookup, env.id, env.name)
    addEnvironmentLookupKey(lookup, env.slug, env.name)
    addEnvironmentLookupKey(lookup, env.name, env.name)
  })
  return lookup
}

function resolveEnvironmentName(raw: string, envLookup: Map<string, string>): string {
  const value = raw.trim()
  if (!value) return ''

  const direct = envLookup.get(value) ?? envLookup.get(value.toLowerCase())
  if (direct) return direct

  const prefixed = /^environments?-(.+)$/i.exec(value)
  if (prefixed) {
    const byId = envLookup.get(prefixed[1]) ?? envLookup.get(prefixed[1].toLowerCase())
    if (byId) return byId
  }

  if (/^\d+$/.test(value)) {
    const prefixedNumeric = `Environments-${value}`
    const byNumericPrefixed = envLookup.get(prefixedNumeric) ?? envLookup.get(prefixedNumeric.toLowerCase())
    if (byNumericPrefixed) return byNumericPrefixed
  }

  // Only show names resolved from environment list API.
  return ''
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items))
}

export function resolveMachineHealthState(machine: MachineDto): DeploymentTarget['healthState'] {
  if (machine.isDisabled) return 'Disabled'

  const rawValue = (
    machine.healthStatus
    ?? machine.HealthStatus
    ?? (machine as any).machineHealthStatus
    ?? (machine as any).MachineHealthStatus
    ?? null
  )

  if (rawValue === null || rawValue === undefined) return 'Unknown'

  if (typeof rawValue === 'number') {
    // Mirrors the server MachineHealthStatus enum: Unknown=0, Healthy=1, HasWarnings=2,
    // Unhealthy=3, Unavailable=4. "Disabled" is NOT a health value — it is driven solely by
    // isDisabled (handled above). The previous mapping shifted these (e.g. 4 -> "Disabled"),
    // so an enabled-but-Unavailable target was wrongly shown as Disabled.
    if (rawValue === 1) return 'Healthy'
    if (rawValue === 2) return 'Unhealthy' // HasWarnings — surfaced as a warning state
    if (rawValue === 3) return 'Unhealthy'
    if (rawValue === 4) return 'Unavailable'
    return 'Unknown'
  }

  if (typeof rawValue === 'boolean') {
    return rawValue ? 'Healthy' : 'Unhealthy'
  }

  const normalized = String(rawValue).trim().toLowerCase()
  if (!normalized) return 'Unknown'
  if (normalized.includes('disabled')) return 'Disabled'
  if (normalized.includes('unavailable')) return 'Unavailable'
  if (
    normalized.includes('unhealthy')
    || normalized.includes('warning')
    || normalized.includes('warn')
    || normalized.includes('fail')
    || normalized.includes('error')
  ) {
    return 'Unhealthy'
  }
  if (normalized.includes('healthy') || normalized.includes('success') || normalized.includes('ok')) {
    return 'Healthy'
  }
  return 'Unknown'
}

function mapMachineToTarget(m: MachineDto, envLookup: Map<string, string>, targetTagLookup: Map<string, string>): DeploymentTarget {
  const envIds = (m.environmentIds ?? []).map(String)
  const envNames = unique(envIds.map((id) => resolveEnvironmentName(id, envLookup)).filter(Boolean))
  const roleValues = m.roles ?? []
  const rolesList = unique(roleValues
    .map((role) => {
      const mapped = targetTagLookup.get(role) ?? targetTagLookup.get(role.toLowerCase())
      if (mapped) return mapped
      // Keep non-numeric free-form tags, hide unresolved numeric ids.
      return /^\d+$/.test(role) ? '' : role
    })
    .filter(Boolean))
  const ep = parseEndpointJson(m.endpoint || '{}')
  const style = ep?.CommunicationStyle || 'Unknown'
  return {
    id: m.id,
    name: m.name,
    rawCommunicationStyle: style,
    communicationStyle: communicationStyleLabel(style),
    agentVersion: String(m.agentVersion ?? ''),
    summary: endpointSummary(ep, m),
    environmentNames: envNames,
    tags: rolesList,
    healthState: resolveMachineHealthState(m),
  }
}

// ── Health status SVG icons ────────────────────────────────────────────────────

function HealthyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <circle fill="#53B953" cx="8" cy="8" r="8" />
        <path stroke="#FFF" strokeWidth=".5" fill="#FFF" d="M6.88804 11.083024L12.12 5.851064 11.296838 5 6.88804 9.42275 4.823163 7.343916 4 8.16708z" />
      </g>
    </svg>
  )
}

function DisabledIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <rect fill="#9E9E9E" width="16" height="16" rx="8" />
        <path
          d="M12.240622 3.58747c0-.126157-.09669-.228427-.21596-.228427H4.802677l7.437945 6.58802V3.58747zm-3.739554 7.18861h2.69302l.896546.793832L12.5 11.05282 3.409366 3 3 3.517093l.895418.793235v6.237922c0 .126157.09669.228428.21596.228428h3.684295v.938163c-.246475.089186-.440077.293965-.524395.55467H4.797602c-.15057 0-.27263.129105-.27263.288366 0 .15926.12206.288368.27263.288368H7.27297c.116063.36099.43654.603756.797023.603756.360484 0 .68096-.242766.797024-.603756h2.47142c.15057 0 .27263-.129107.27263-.288368 0-.15926-.12206-.288367-.27263-.288367H8.86307c-.084762-.260412-.278197-.465014-.524395-.55467v-.93876h.162393z"
          fillRule="nonzero"
          fill="#FFF"
        />
      </g>
    </svg>
  )
}

function UnhealthyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <circle fill="#E53935" cx="8" cy="8" r="8" />
        <path d="M5.12 5.12l5.76 5.76M10.88 5.12L5.12 10.88" stroke="#FFF" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function UnknownHealthIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <circle fill="#9CA3AF" cx="8" cy="8" r="8" />
        <path d="M8 11.2a.9.9 0 110 1.8.9.9 0 010-1.8zm0-7.4c1.66 0 3 1.17 3 2.62 0 .94-.45 1.43-1.08 1.95-.54.45-.92.76-.92 1.53v.17H7.1v-.24c0-1.23.6-1.84 1.26-2.38.46-.38.74-.64.74-1.03 0-.46-.48-.84-1.1-.84-.66 0-1.17.42-1.28 1.02H4.9C5.04 4.84 6.34 3.8 8 3.8z" fill="#FFF" />
      </g>
    </svg>
  )
}

function renderHealthIcon(healthState: DeploymentTarget['healthState']) {
  if (healthState === 'Healthy') return <HealthyIcon size={16} />
  if (healthState === 'Unhealthy') return <UnhealthyIcon size={16} />
  if (healthState === 'Disabled') return <DisabledIcon size={16} />
  return <UnknownHealthIcon size={16} />
}

function healthStateTextClass(healthState: DeploymentTarget['healthState']): string {
  if (healthState === 'Healthy') return 'text-green-600'
  if (healthState === 'Unhealthy') return 'text-rose-600'
  if (healthState === 'Unavailable') return 'text-amber-600'
  if (healthState === 'Disabled') return 'text-gray-400'
  return 'text-gray-500'
}

// ── Machine type icon ──────────────────────────────────────────────────────────

function MachineTypeIcon({ machineType, isDisabled }: { machineType: string; isDisabled: boolean }) {
  const isKubernetes = machineType.toLowerCase().includes('kubernetes')
  const isOpenClaw = machineType.toLowerCase().includes('openclaw')
  const bg = isDisabled ? '#e0e0e0' : isKubernetes ? '#326ce5' : isOpenClaw ? '#ecfdf3' : '#4caf50'
  return (
    <div
      className="flex items-center justify-center rounded flex-shrink-0"
      style={{ width: 40, height: 40, backgroundColor: bg }}
    >
      {isKubernetes ? (
        <svg viewBox="0 0 32 32" width="22" height="22">
          <circle cx="16" cy="16" r="12" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="3" fill="white" />
          <line x1="16" y1="4" x2="16" y2="10" stroke="white" strokeWidth="1.5" />
          <line x1="16" y1="22" x2="16" y2="28" stroke="white" strokeWidth="1.5" />
          <line x1="4" y1="16" x2="10" y2="16" stroke="white" strokeWidth="1.5" />
          <line x1="22" y1="16" x2="28" y2="16" stroke="white" strokeWidth="1.5" />
          <line x1="7.5" y1="7.5" x2="11.8" y2="11.8" stroke="white" strokeWidth="1.5" />
          <line x1="20.2" y1="20.2" x2="24.5" y2="24.5" stroke="white" strokeWidth="1.5" />
          <line x1="24.5" y1="7.5" x2="20.2" y2="11.8" stroke="white" strokeWidth="1.5" />
          <line x1="11.8" y1="20.2" x2="7.5" y2="24.5" stroke="white" strokeWidth="1.5" />
        </svg>
      ) : isOpenClaw ? (
        <img
          src="/openclaw-icon.png"
          alt="OpenClaw"
          width={22}
          height={22}
          style={{
            objectFit: 'contain',
            filter: isDisabled ? 'grayscale(1)' : 'none',
            opacity: isDisabled ? 0.65 : 1,
          }}
        />
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v1.5H6zm0 3h8v1.5H6z" />
        </svg>
      )}
    </div>
  )
}

// ── Chip sub-components ────────────────────────────────────────────────────────

function EnvChipIcon() {
  return (
    <svg viewBox="0 0 200 200" width="11" height="11" fill="#666">
      <path d="M14 30v35h172V30zm26 26H23V39h17zM14 83v35h95V83zm26 26H23V92h17zM14 134v35h172v-35zm26 26H23v-17h17z" />
    </svg>
  )
}

function RoleChipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="#666">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
    </svg>
  )
}

function MachineChip({ icon, label, bgColor, textColor }: { icon?: React.ReactNode; label: string; bgColor?: string; textColor?: string }) {
  if (bgColor) {
    return (
      <div
        className="inline-flex items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap"
        style={{ backgroundColor: bgColor, color: textColor || '#fff', height: 24 }}
      >
        {label}
      </div>
    )
  }
  return (
    <div
      className="inline-flex items-center rounded-full border border-gray-200 bg-white overflow-hidden whitespace-nowrap"
      style={{ height: 26 }}
    >
      {icon && (
        <div
          className="flex items-center justify-center rounded-full bg-gray-200 flex-shrink-0"
          style={{ width: 20, height: 20, margin: '3px 0 3px 3px' }}
        >
          {icon}
        </div>
      )}
      <span className="px-2 text-xs text-gray-700">{label}</span>
    </div>
  )
}

// ── Agent form helpers ─────────────────────────────────────────────────────────

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

function MultiSelectField({
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
  options: { value: string; label: string }[]
  loading?: boolean
  value: string[]
  onChange: (v: string[]) => void
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

const mockEnvironmentOptions = [
  { value: 'Development', label: 'Development' },
  { value: 'Staging', label: 'Staging' },
  { value: 'Production', label: 'Production' },
  { value: 'Testing', label: 'Testing' },
  { value: 'UAT', label: 'UAT' },
]

// ── Main component ─────────────────────────────────────────────────────────────

const DeploymentTargets: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace();
  // API data
  const [deploymentData, setDeploymentData] = useState<DeploymentData>({ healthy: [], disabled: [] })
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [upgradeInfoByMachineId, setUpgradeInfoByMachineId] = useState<Record<number, UpgradeInfoResponseData>>({})
  const [loadingUpgradeInfoIds, setLoadingUpgradeInfoIds] = useState<Set<number>>(new Set())
  const [failedUpgradeInfoIds, setFailedUpgradeInfoIds] = useState<Set<number>>(new Set())

  const loadDeploymentTargets = useCallback(async () => {
    setLoadingTargets(true)
    try {
      const [machinesRes, envsRes, tagsRes] = await Promise.all([
        getMachines({ pageSize: 1000, spaceId: space.id }),
        getEnvironments({ pageSize: 1000, spaceId: space.id }),
        getTargetTags(),
      ])

      const envLookup = buildEnvironmentLookup(envsRes.environments ?? [])
      const targetTagLookup = buildTargetTagLookup(tagsRes.targetTags ?? [])
      const healthy: DeploymentTarget[] = []
      const disabled: DeploymentTarget[] = []
      machinesRes.machines.forEach((m) => {
        const target = mapMachineToTarget(m, envLookup, targetTagLookup)
        if (m.isDisabled) disabled.push(target)
        else healthy.push(target)
      })
      setDeploymentData({ healthy, disabled })
    } catch {
      // keep existing UI and silent-fail like current behavior
    } finally {
      setLoadingTargets(false)
    }
  }, [space.id])

  useEffect(() => {
    void loadDeploymentTargets()
  }, [loadDeploymentTargets])

  // UI state
  const [searchText, setSearchText] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [disabledOnly, setDisabledOnly] = useState(false)
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDeploymentType, setSelectedDeploymentType] = useState('Kubernetes')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // Kubernetes Agent form state
  const [agentFormView, setAgentFormView] = useState<'kubernetes-agent' | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentEnvironments, setAgentEnvironments] = useState<string[]>([])
  const [agentTags, setAgentTags] = useState<string[]>([])
  const [agentNamespace, setAgentNamespace] = useState('')
  const [agentStorageClass, setAgentStorageClass] = useState('')
  const [agentServerUrl, setAgentServerUrl] = useState('')
  const [agentCommsUrl, setAgentCommsUrl] = useState('')
  const [showOptional, setShowOptional] = useState(true)
  const [helpPanelVisible, setHelpPanelVisible] = useState(true)
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingEnvironmentOptions, setLoadingEnvironmentOptions] = useState(false)
  const [targetTagOptions, setTargetTagOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingTargetTagOptions, setLoadingTargetTagOptions] = useState(false)
  const [agentTagSearchValue, setAgentTagSearchValue] = useState('')
  const creatingTargetTagsRef = useRef<Set<string>>(new Set())

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
      if (prev.some((opt) => opt.label.trim().toLowerCase() === trimmed.toLowerCase())) return prev

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

  const handleAgentTagsChange = useCallback(async (values: string[]) => {
    const normalized = normalizeTagValues(values)

    const existingKeys = new Set(targetTagOptions.map((opt) => opt.label.trim().toLowerCase()))
    const known = normalized.filter((tag) => existingKeys.has(tag.toLowerCase()))
    const unknown = normalized.filter((tag) => !existingKeys.has(tag.toLowerCase()))

    setAgentTags(known)

    for (const tag of unknown) {
      // eslint-disable-next-line no-await-in-loop
      const createdTag = await createTargetTagIfNeeded(tag)
      if (createdTag) {
        setAgentTags((prev) => normalizeTagValues([...prev, createdTag]))
      }
    }
  }, [createTargetTagIfNeeded, normalizeTagValues, targetTagOptions])

  const handleCreateTargetTagFromSearch = useCallback(async (rawName: string) => {
    const normalized = normalizeTagValues([rawName])
    const tagName = normalized[0]
    if (!tagName) return

    setAgentTagSearchValue('')
    const createdTag = await createTargetTagIfNeeded(tagName)
    if (createdTag) {
      setAgentTags((prev) => normalizeTagValues([...prev, createdTag]))
    }
  }, [createTargetTagIfNeeded, normalizeTagValues])

  const closeModal = () => {
    setShowAddModal(false)
    setAgentFormView(null)
  }

  useEffect(() => {
    let mounted = true
    setLoadingEnvironmentOptions(true)
    getEnvironments({ pageSize: 1000, spaceId: space.id })
      .then((res) => {
        if (!mounted) return
        setEnvironmentOptions(
          (res.environments ?? []).map((env) => ({
            value: env.name,
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

  useEffect(() => {
    setUpgradeInfoByMachineId({})
    setLoadingUpgradeInfoIds(new Set())
    setFailedUpgradeInfoIds(new Set())
  }, [space.id])

  useEffect(() => {
    const allTargets = [...deploymentData.healthy, ...deploymentData.disabled]
    const candidateIds = allTargets
      .filter((target) => target.healthState !== 'Disabled' && isTentacleAgentStyle(target.rawCommunicationStyle))
      .map((target) => target.id)
    const idsToProbe = candidateIds
      .filter((id) => !upgradeInfoByMachineId[id])
      .filter((id) => !loadingUpgradeInfoIds.has(id))
      .filter((id) => !failedUpgradeInfoIds.has(id))

    if (idsToProbe.length === 0) return

    setLoadingUpgradeInfoIds((prev) => {
      const next = new Set(prev)
      idsToProbe.forEach((id) => next.add(id))
      return next
    })

    void Promise.all(idsToProbe.map(async (machineId) => {
      try {
        const info = await getMachineUpgradeInfo(machineId)
        return { machineId, info, failed: false as const }
      } catch {
        return { machineId, info: null, failed: true as const }
      }
    }))
      .then((results) => {
        const resolved = results.filter((item): item is { machineId: number; info: UpgradeInfoResponseData; failed: false } => item.failed === false && item.info != null)
        if (resolved.length > 0) {
          setUpgradeInfoByMachineId((prev) => {
            const next = { ...prev }
            resolved.forEach((item) => { next[item.machineId] = item.info })
            return next
          })
        }

        const failedIds = results.filter((item) => item.failed).map((item) => item.machineId)
        if (failedIds.length > 0) {
          setFailedUpgradeInfoIds((prev) => {
            const next = new Set(prev)
            failedIds.forEach((id) => next.add(id))
            return next
          })
        }
      })
      .finally(() => {
        setLoadingUpgradeInfoIds((prev) => {
          const next = new Set(prev)
          idsToProbe.forEach((id) => next.delete(id))
          return next
        })
      })
  }, [deploymentData, failedUpgradeInfoIds, loadingUpgradeInfoIds, upgradeInfoByMachineId])

  // Filter options
  const filterOptions = {
    environments: ['DEV', 'TEST', 'UAT', 'PRD', 'STAGE', 'QA'],
    tags: targetTagOptions.length > 0
      ? targetTagOptions.map((opt) => opt.label)
      : ['aws-eks', 'aws-eks-us', 'SJUSAKS', 'Aliyun-HK-AI', 'DotnetCore', 'protonk8s'],
    types: ['Kubernetes API', 'Polling Tentacle', 'Listening Tentacle', 'SSH Connection'],
    health: ['Healthy', 'Unhealthy', 'Unavailable', 'Disabled', 'Unknown'],
  }
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    environments: [], tags: [], types: [], health: [],
  })

  const handleFilterChange = (category: string, value: string, checked: boolean) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: checked ? [...prev[category], value] : prev[category].filter((v) => v !== value),
    }))
  }

  const resetFilters = () => {
    setDisabledOnly(false)
    setSelectedFilters({ environments: [], tags: [], types: [], health: [] })
  }

  const toggleExpand = (id: number) => {
    setExpandedTargets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filtered lists
  const targetMatchesFilters = useCallback((target: DeploymentTarget) => {
    const lowerSearch = searchText.trim().toLowerCase()
    const matchesSearch = lowerSearch.length === 0
      || target.name.toLowerCase().includes(lowerSearch)
      || target.communicationStyle.toLowerCase().includes(lowerSearch)

    if (!matchesSearch) return false

    const { environments, tags, types, health } = selectedFilters

    const matchesEnvironment = environments.length === 0
      || environments.some((env) => target.environmentNames.includes(env))
    if (!matchesEnvironment) return false

    const matchesTag = tags.length === 0
      || tags.some((tag) => target.tags.includes(tag))
    if (!matchesTag) return false

    const matchesType = types.length === 0
      || types.includes(target.communicationStyle)
    if (!matchesType) return false

    const matchesHealth = health.length === 0
      || health.includes(target.healthState)
    if (!matchesHealth) return false

    return true
  }, [searchText, selectedFilters])

  const filteredHealthy = deploymentData.healthy.filter(targetMatchesFilters)
  const filteredDisabled = deploymentData.disabled.filter(targetMatchesFilters)
  const displayHealthy = disabledOnly ? [] : filteredHealthy.filter((target) => target.healthState === 'Healthy')
  const displayNonHealthyEnabled = disabledOnly ? [] : filteredHealthy.filter((target) => target.healthState !== 'Healthy')
  const displayDisabled = filteredDisabled
  const total = displayHealthy.length + displayNonHealthyEnabled.length + displayDisabled.length

  const deploymentTypes = [
    { key: 'Kubernetes', label: 'Kubernetes' },
    { key: 'Linux', label: 'Linux' },
    { key: 'Windows', label: 'Windows' },
    { key: 'Mac', label: 'Mac' },
    { key: 'Azure', label: 'Azure' },
    { key: 'Aws', label: 'AWS' },
    { key: 'Cloud Region', label: 'Cloud Region' },
    { key: 'Offline Package Drop', label: 'Offline Package Drop' },
  ]

  // ── Machine row ─────────────────────────────────────────────────────────────

  const renderMachineRow = (target: DeploymentTarget, isLast: boolean) => {
    const isDisabled = target.healthState === 'Disabled'
    const isTentacleTarget = isTentacleAgentStyle(target.rawCommunicationStyle)
    const upgradeInfo = upgradeInfoByMachineId[target.id]
    const loadingUpgradeInfo = loadingUpgradeInfoIds.has(target.id)
    // collapsed = show summary ("N environments" + first 2 tags)
    // expanded = show all individual chips (default when total <= 4)
    const isSummary = expandedTargets.has(target.id)
    const totalChips = target.environmentNames.length + target.tags.length
    const canToggle = totalChips > 4

    const envChips = isSummary && target.environmentNames.length > 1
      ? [
          <MachineChip
            key="env-summary"
            icon={<EnvChipIcon />}
            label={`${target.environmentNames.length} environments`}
          />,
        ]
      : target.environmentNames.map((env) => (
          <MachineChip key={`env-${env}`} icon={<EnvChipIcon />} label={env} />
        ))

    const tagChips = isSummary
      ? target.tags.slice(0, 2)
      : target.tags

    return (
      <li
        key={target.id}
        className={`grid items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${isLast ? '' : 'border-b border-gray-100'}`}
        style={{ gridTemplateColumns: '40px minmax(180px, 280px) auto 1fr' }}
        onClick={() => navigate(`/${space.slug}/deployment/targets/${target.id}/settings`)}
      >
        {/* Col 1: Machine type icon */}
        <MachineTypeIcon machineType={target.communicationStyle} isDisabled={isDisabled} />

        {/* Col 2: Name / type / summary */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-semibold text-sm text-gray-900 leading-snug truncate">{target.name}</div>
            {isTentacleTarget && loadingUpgradeInfo ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">Checking upgrade...</span>
            ) : null}
            {isTentacleTarget && upgradeInfo?.canUpgrade ? (
              <span title={upgradeInfo.reason} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">
                Uparade available
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{target.communicationStyle}</div>
          {target.summary && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">{target.summary}</div>
          )}
        </div>

        {/* Col 3: Health status */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
          {renderHealthIcon(target.healthState)}
          <span className={`text-xs font-medium ${healthStateTextClass(target.healthState)}`}>
            {target.healthState}
          </span>
        </div>

        {/* Col 4: Chips — environments + tags */}
        <div className="flex items-center gap-1.5 flex-wrap ml-6">
          {envChips}

          {tagChips.map((tag) => (
            <MachineChip key={`tag-${tag}`} icon={<RoleChipIcon />} label={tag} />
          ))}

          {canToggle && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(target.id) }}
              className="text-xs text-blue-600 hover:underline bg-transparent border-0 cursor-pointer px-1 whitespace-nowrap"
            >
              {isSummary ? 'Show all' : 'Show summary'}
            </button>
          )}
        </div>
      </li>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          {/* Page header */}
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Deployment Targets</h1>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                onClick={() => navigate(`/${space.slug}/deployment/targets/add`)}
              >
                Add Deployment Target
              </Button>
            </div>

            {/* Search + filter toggle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded px-3 py-1.5 gap-2 bg-white" style={{ maxWidth: 320 }}>
                <SearchOutlined className="text-gray-400 flex-shrink-0" />
                <input
                  type="search"
                  placeholder="Search deployment targets..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="border-0 outline-none text-sm flex-1 bg-transparent"
                  style={{ minWidth: 0 }}
                />
              </div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-transparent border-0 cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
              >
                <FilterOutlined />
                {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex">
        {/* Advanced filters sidebar */}
        {showAdvancedFilters && (
          <div
            className="border-r border-gray-200 bg-gray-50 px-4 py-4 flex-shrink-0"
            style={{ width: 240, minHeight: 'calc(100vh - 140px)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Advanced filter</span>
              <button
                onClick={resetFilters}
                className="text-xs text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="mb-3 pb-3 border-b border-gray-200">
              <Checkbox checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)}>
                <span className="text-sm text-gray-700">Disabled only</span>
              </Checkbox>
            </div>

            <Collapse ghost expandIconPosition="end" className="!bg-transparent" style={{ border: 'none' }}>
              {([
                { key: 'environments', label: 'By environments', options: filterOptions.environments },
                { key: 'tags', label: 'By target tags', options: filterOptions.tags },
                { key: 'types', label: 'By deployment target types', options: filterOptions.types },
                { key: 'health', label: 'By health statuses', options: filterOptions.health },
              ] as const).map(({ key, label, options }) => (
                <Panel key={key} header={<span className="text-xs text-gray-600 font-medium">{label}</span>}>
                  <div className="space-y-1.5">
                    {options.map((opt) => (
                      <div key={opt}>
                        <Checkbox
                          checked={selectedFilters[key].includes(opt)}
                          onChange={(e) => handleFilterChange(key, opt, e.target.checked)}
                        >
                          <span className="text-sm text-gray-700">{opt}</span>
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}
            </Collapse>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 p-6">
          <Spin spinning={loadingTargets}>
              {/* Healthy section */}
              {displayHealthy.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-1 py-2 mb-1">
                    <HealthyIcon size={16} />
                    <span className="text-sm font-semibold text-gray-800">Healthy</span>
                    <span className="text-sm text-gray-500">({displayHealthy.length})</span>
                  </div>
                  <ul className="list-none m-0 p-0 border border-gray-200 rounded-md overflow-hidden bg-white">
                    {displayHealthy.map((t, i) =>
                      renderMachineRow(t, i === displayHealthy.length - 1)
                    )}
                  </ul>
                </div>
              )}

              {/* Non-healthy enabled section */}
              {displayNonHealthyEnabled.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-1 py-2 mb-1">
                    <UnknownHealthIcon size={16} />
                    <span className="text-sm font-semibold text-gray-800">Unhealthy / Unavailable / Unknown</span>
                    <span className="text-sm text-gray-500">({displayNonHealthyEnabled.length})</span>
                  </div>
                  <ul className="list-none m-0 p-0 border border-gray-200 rounded-md overflow-hidden bg-white">
                    {displayNonHealthyEnabled.map((t, i) =>
                      renderMachineRow(t, i === displayNonHealthyEnabled.length - 1)
                    )}
                  </ul>
                </div>
              )}

              {/* Disabled section */}
              {displayDisabled.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-1 py-2 mb-1">
                    <DisabledIcon size={16} />
                    <span className="text-sm font-semibold text-gray-800">Disabled</span>
                    <span className="text-sm text-gray-500">({displayDisabled.length})</span>
                  </div>
                  <ul className="list-none m-0 p-0 border border-gray-200 rounded-md overflow-hidden bg-white">
                    {displayDisabled.map((t, i) =>
                      renderMachineRow(t, i === displayDisabled.length - 1)
                    )}
                  </ul>
                </div>
              )}

              {/* Empty state */}
              {total === 0 && !loadingTargets && (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                  No deployment targets found.
                </div>
              )}
          </Spin>
        </div>
          </div>
        </div>

      {/* Add Deployment Target Modal */}
      <Modal
        title={agentFormView ? null : (
          <div>
            <div className="text-squid-blue text-sm mb-1">Deployment Targets</div>
            <div className="text-xl font-bold">Add Deployment Target</div>
          </div>
        )}
        open={showAddModal}
        onCancel={closeModal}
        width={agentFormView ? 1080 : 1000}
        footer={null}
        styles={{ body: agentFormView ? { padding: 0 } : undefined }}
      >
        {/* ── Template selection view ── */}
        {!agentFormView && (
          <>
            <p className="text-gray-700 mb-5">
              What type of <strong>Deployment Target</strong> do you want to set up?{' '}
              <span className="text-squid-blue cursor-pointer hover:underline">
                Learn more about Deployment Targets ↗
              </span>
            </p>

            <Tabs
              activeKey={selectedDeploymentType}
              onChange={setSelectedDeploymentType}
              items={deploymentTypes.map((t) => ({ key: t.key, label: t.label }))}
              className="mb-5"
            />

            {selectedDeploymentType === 'Kubernetes' && (
              <div>
                <p className="text-gray-700 mb-5">
                  Let's connect to a <strong>Kubernetes</strong> cluster.{' '}
                  <span className="text-squid-blue cursor-pointer hover:underline">
                    Learn more about connecting to Kubernetes clusters ↗
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-6">
                  {[
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
                  ].map((option) => (
                    <div
                      key={option.key}
                      className="relative border-2 rounded-lg p-6 cursor-pointer overflow-hidden transition-all duration-200"
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
                              if (option.key === 'agent') setAgentFormView('kubernetes-agent')
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
            )}
          </>
        )}

        {/* ── Kubernetes Agent form view ── */}
        {agentFormView === 'kubernetes-agent' && (
          <div className="flex" style={{ height: 680 }}>

            {/* Left: form */}
            <div className="flex flex-col flex-1 min-w-0" style={{ borderRadius: '4px 0 0 4px' }}>
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
                  options={environmentOptions.length > 0 ? environmentOptions : mockEnvironmentOptions}
                  loading={loadingEnvironmentOptions}
                  value={agentEnvironments}
                  onChange={setAgentEnvironments}
                />

                <MultiSelectField
                  label="Target tags"
                  helper="Add at least one target tag"
                  options={targetTagOptions}
                  loading={loadingTargetTagOptions}
                  value={agentTags}
                  onChange={(values) => { void handleAgentTagsChange(values) }}
                  searchValue={agentTagSearchValue}
                  onSearch={setAgentTagSearchValue}
                  onCreateFromSearch={(name) => { void handleCreateTargetTagFromSearch(name) }}
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
                      helper="Provide a Storage Class or leave this blank to use the default NFS storage"
                      value={agentStorageClass}
                      onChange={setAgentStorageClass}
                    />
                    <FormField
                      label="Squid Server URL"
                      helper="Provide the full URL to your Squid instance."
                      value={agentServerUrl}
                      onChange={setAgentServerUrl}
                    />
                    <FormField
                      label="Squid Server Communications URL"
                      helper="The URL of the Squid Server that the Agent will poll for work."
                      value={agentCommsUrl}
                      onChange={setAgentCommsUrl}
                    />
                  </>
                )}
              </div>

              {/* Footer buttons */}
              <div className="border-t border-gray-200 px-10 py-4 flex justify-end gap-3 flex-shrink-0">
                <Button size="large" onClick={() => setAgentFormView(null)}>Cancel</Button>
                <Button size="large" type="primary" className="!bg-green-700 hover:!bg-green-800 !border-green-700">
                  Next
                </Button>
              </div>
            </div>

            {/* Right: help panel */}
            {helpPanelVisible ? (
              <div
                className="flex flex-col border-l border-gray-200 bg-gray-50 flex-shrink-0"
                style={{ width: 340, borderRadius: '0 4px 4px 0' }}
              >
                {/* Collapse button */}
                <div className="flex justify-start p-3 flex-shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<DoubleRightOutlined />}
                    onClick={() => setHelpPanelVisible(false)}
                    className="text-gray-400 hover:text-gray-600"
                  />
                </div>

                {/* Illustration */}
                <div className="flex justify-center px-6 mb-5 flex-shrink-0">
                  <div
                    className="w-full rounded-lg bg-blue-50 flex items-center justify-center"
                    style={{ height: 160 }}
                  >
                    <svg viewBox="0 0 120 100" width="120" height="100">
                      {/* simplified K8s cluster illustration */}
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

                {/* Text */}
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
            ) : (
              /* Collapsed: narrow strip with expand button */
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
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}

export default DeploymentTargets
