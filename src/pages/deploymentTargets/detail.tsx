import React, { useEffect, useState, useCallback } from 'react'
import { Button, Dropdown, Input, Modal, Radio, Select, Spin, Switch, Tooltip, message } from 'antd'
import type { MenuProps } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  checkMachineHealth,
  deleteMachines,
  generateKubernetesAgentUpgradeScript,
  GenerateKubernetesAgentUpgradeScriptData,
  getLatestKubernetesAgentVersion,
  getMachines,
  MachineHealthCheckData,
  MachineDto,
  updateMachine,
} from 'pages/apis/machine'
import { getEnvironments, EnvironmentDto } from 'pages/apis/environment'
import { DeploymentAccountType, getDeploymentAccounts, DeploymentAccountDto } from 'pages/apis/deploymentAccount'
import { getTargetTags } from 'pages/apis/targetTag'
import { useSpace } from 'contexts/SpaceContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'settings' | 'connectivity' | 'deployments' | 'events'

// Matches Squid.Message KubernetesApiEndpointDto (PascalCase from System.Text.Json)
interface KubernetesApiEndpoint {
  CommunicationStyle: string
  ClusterUrl: string
  Namespace: string
  SkipTlsVerification: string
  ClusterCertificatePath?: string
  ResourceReferences?: { Type: number; ResourceId: number }[]
}

// Matches Squid.Message KubernetesAgentEndpointDto
interface KubernetesAgentEndpoint {
  CommunicationStyle: string
  SubscriptionId: string
  Thumbprint: string
  Namespace: string
  ReleaseName?: string
  HelmNamespace?: string
  ChartRef?: string
}

interface OpenClawEndpoint {
  CommunicationStyle: string
  BaseUrl?: string
  ResourceReferences?: { Type: number; ResourceId: number }[]
}

type MachineEndpoint = KubernetesApiEndpoint | KubernetesAgentEndpoint | OpenClawEndpoint
type OpenClawAuthMode = 'account' | 'inline'

// ── Sub-components ────────────────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M4.46829 18.9062L12.96 10.4688C13.522 9.84375 14.4585 9.84375 15.0205 10.4688C15.6449 11.0312 15.6449 11.9688 15.0205 12.5312L9.08878 18.4688H34.5015C35.3132 18.4688 36 19.1562 36 19.9688C36 20.8438 35.3132 21.4688 34.5015 21.4688L9.08878 21.5312L15.0205 27.4688C15.6449 28.0312 15.6449 28.9688 15.0205 29.5312C14.4585 30.1562 13.522 30.1562 12.96 29.5312L4.46829 21.0312C3.8439 20.4688 3.8439 19.5312 4.46829 18.9062Z" />
    </svg>
  )
}

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

function UnhealthyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <circle fill="#d14343" cx="8" cy="8" r="8" />
        <path d="M5 5l6 6M11 5L5 11" stroke="#FFF" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function UnknownHealthIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="none" fillRule="evenodd">
        <circle fill="#9ca3af" cx="8" cy="8" r="8" />
        <circle fill="#FFF" cx="8" cy="11.5" r="0.9" />
        <path d="M6.9 6.3A1.5 1.5 0 0 1 8 5.8c.9 0 1.6.6 1.6 1.5 0 .6-.3 1-.8 1.3-.4.2-.6.5-.6.9v.2" stroke="#FFF" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function UnavailableIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path
        d="M20.0312 7C15.3438 7 11.0938 9.5 8.71875 13.5C6.40625 17.5625 6.40625 22.5 8.71875 26.5C11.0938 30.5625 15.3438 33 20.0312 33C24.6562 33 28.9062 30.5625 31.2812 26.5C33.5938 22.5 33.5938 17.5625 31.2812 13.5C28.9062 9.5 24.6562 7 20.0312 7ZM20.0312 36C14.2812 36 9.03125 33 6.15625 28C3.28125 23.0625 3.28125 17 6.15625 12C9.03125 7.0625 14.2812 4 20.0312 4C25.7188 4 30.9688 7.0625 33.8438 12C36.7188 17 36.7188 23.0625 33.8438 28C30.9688 33 25.7188 36 20.0312 36ZM14.9688 14.9375C15.5312 14.375 16.4688 14.375 17.0312 14.9375L19.9688 17.875L22.9062 14.9375C23.5312 14.375 24.4688 14.375 25.0312 14.9375C25.6562 15.5625 25.6562 16.5 25.0312 17.0625L22.0938 20L25.0312 22.9375C25.6562 23.5625 25.6562 24.5 25.0312 25.0625C24.4688 25.6875 23.5312 25.6875 22.9062 25.0625L19.9688 22.125L17.0312 25.0625C16.4688 25.6875 15.5312 25.6875 14.9688 25.0625C14.3438 24.5 14.3438 23.5625 14.9688 22.9375L17.9062 20L14.9688 17.0625C14.3438 16.5 14.3438 15.5625 14.9688 14.9375Z"
        fill="#b42318"
      />
    </svg>
  )
}

function MachineTypeIcon({ machineType, isDisabled }: { machineType: string; isDisabled: boolean }) {
  const isKubernetes = machineType.toLowerCase().includes('kubernetes')
  const bg = isDisabled ? '#e0e0e0' : isKubernetes ? '#326ce5' : '#4caf50'
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
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v1.5H6zm0 3h8v1.5H6z" />
        </svg>
      )}
    </div>
  )
}

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

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="#666"
      style={{
        transition: 'transform 0.2s',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  )
}

function Chip({ icon, label }: { icon?: React.ReactNode; label: string }) {
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

function FilledChip({ label, bgColor, textColor }: { label: string; bgColor: string; textColor: string }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: bgColor, color: textColor, height: 24 }}
    >
      {label}
    </div>
  )
}

// ── Expandable Card ───────────────────────────────────────────────────────────

function ExpandableCard({
  title,
  summary,
  children,
  expanded,
  onToggle,
}: {
  title: string
  summary?: React.ReactNode
  children: React.ReactNode
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden mb-2">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          {!expanded && summary && (
            <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              {summary}
            </div>
          )}
        </div>
        <button
          className="flex-shrink-0 bg-transparent border-0 cursor-pointer p-1"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label={`Expand ${title}`}
        >
          <ExpandIcon expanded={expanded} />
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-6 mb-3 px-1">
      {children}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEndpointJson(json: string): MachineEndpoint | null {
  try {
    return JSON.parse(json) as MachineEndpoint
  } catch {
    return null
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isNotFoundError(error: unknown): boolean {
  const status = (error as any)?.response?.status
  if (status === 404) return true

  if (error instanceof Error && error.message.includes('404'))
    return true

  return false
}

function buildLegacyUpgradeData(
  machine: MachineDto,
  endpoint: KubernetesAgentEndpoint,
  latestVersion: string,
): GenerateKubernetesAgentUpgradeScriptData {
  const chartRef = endpoint.ChartRef || 'oci://registry-1.docker.io/squidcd/kubernetes-agent'
  const helmNamespace = endpoint.HelmNamespace || 'squid-agent'
  const releaseName = endpoint.ReleaseName
    || (endpoint.SubscriptionId ? `squid-agent-${endpoint.SubscriptionId.slice(0, 8)}` : 'squid-agent')

  const upgradeScript = [
    'helm upgrade --install --rollback-on-failure',
    '--version "1.*.*"',
    '--reuse-values',
    `--namespace ${helmNamespace}`,
    releaseName,
    chartRef,
  ].join(' \\\n')

  return {
    machineId: machine.id,
    currentVersion: machine.agentVersion ?? '',
    latestVersion,
    needsUpgrade: machine.agentVersion ? machine.agentVersion !== latestVersion : true,
    releaseName,
    helmNamespace,
    chartRef,
    upgradeScript,
  }
}

function communicationStyleLabel(style: string): string {
  const map: Record<string, string> = {
    KubernetesApi: 'Kubernetes API',
    KubernetesAgent: 'Kubernetes Agent',
    OpenClaw: 'OpenClaw',
    TentaclePassive: 'Listening Tentacle',
    TentacleActive: 'Polling Tentacle',
    Ssh: 'SSH Connection',
  }
  return map[style] || style
}

function isOpenClawStyle(style: string | undefined | null): boolean {
  return String(style ?? '').toLowerCase().includes('openclaw')
}

function readOpenClawEndpointBaseUrl(endpoint: MachineEndpoint | null): string {
  if (!endpoint || !isOpenClawStyle((endpoint as any).CommunicationStyle)) return ''
  const value = (endpoint as any).BaseUrl ?? (endpoint as any).baseUrl ?? ''
  return typeof value === 'string' ? value : ''
}

function readAuthAccountId(endpoint: MachineEndpoint | null): number | null {
  const refs = ((endpoint as any)?.ResourceReferences ?? (endpoint as any)?.resourceReferences) as Array<{ Type?: number; type?: number; ResourceId?: number; resourceId?: number }> | undefined
  if (!Array.isArray(refs)) return null
  const found = refs.find((ref) => (ref.Type ?? ref.type) === 1)
  if (!found) return null
  const id = Number(found.ResourceId ?? found.resourceId ?? 0)
  return Number.isFinite(id) && id > 0 ? id : null
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function normalizeNumberArray(values: number[]): number[] {
  return Array.from(new Set(values.filter((v) => Number.isFinite(v) && v > 0))).sort((a, b) => a - b)
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

type ConnectivityHealthState = 'Healthy' | 'Unhealthy' | 'Unavailable' | 'Disabled' | 'Unknown'

function getHealthStatusValue(healthData: MachineHealthCheckData | null): string | null {
  if (!healthData) return null
  const candidates: unknown[] = [
    healthData.HealthStatus,
    healthData.healthStatus,
    (healthData as any).MachineHealthStatus,
    (healthData as any).machineHealthStatus,
    (healthData as any).Status,
    (healthData as any).status,
    (healthData as any).Health,
    (healthData as any).health,
  ]
  const value = candidates.find((v) => v !== undefined && v !== null)
  if (value === undefined || value === null) return null

  if (typeof value === 'number') {
    // Compatibility for enum-like numeric status values.
    if (value === 1) return 'Healthy'
    if (value === 2) return 'Unhealthy'
    if (value === 3) return 'Unavailable'
    if (value === 4) return 'Disabled'
    return 'Unknown'
  }

  if (typeof value === 'boolean') {
    return value ? 'Healthy' : 'Unhealthy'
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

function getHealthDetailValue(healthData: MachineHealthCheckData | null): string | null {
  if (!healthData) return null
  const value = healthData.HealthDetail ?? healthData.healthDetail
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getHealthLastCheckedValue(healthData: MachineHealthCheckData | null): string | null {
  if (!healthData) return null
  const candidates: unknown[] = [
    healthData.HealthLastChecked,
    healthData.healthLastChecked,
    (healthData as any).LastChecked,
    (healthData as any).lastChecked,
    (healthData as any).HealthCheckTime,
    (healthData as any).healthCheckTime,
  ]
  const value = candidates.find((v) => v !== undefined && v !== null)
  if (value === undefined || value === null) return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(millis).toISOString()
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

function resolveConnectivityHealthState(machine: MachineDto, healthData: MachineHealthCheckData | null): ConnectivityHealthState {
  if (machine.isDisabled) return 'Disabled'
  const statusRaw = getHealthStatusValue(healthData)
  if (!statusRaw) return 'Healthy'

  const normalized = statusRaw.toLowerCase()
  if (normalized.includes('disabled')) return 'Disabled'
  if (normalized.includes('unavailable')) {
    return 'Unavailable'
  }
  if (
    normalized.includes('unhealthy')
    || normalized.includes('fail')
    || normalized.includes('error')
    || normalized.includes('warning')
  ) {
    return 'Unhealthy'
  }
  if (normalized.includes('healthy') || normalized.includes('success') || normalized.includes('ok')) {
    return 'Healthy'
  }

  return 'Healthy'
}

function formatHealthLastCheckedRelative(healthLastChecked: string | null): string {
  if (!healthLastChecked) return 'Last health check unknown'
  const raw = healthLastChecked.trim()
  if (!raw) return 'Last health check unknown'

  // If backend already returns relative text, display it directly.
  const relativeTextPattern = /(ago|just now|minute|hour|day|week|month|year|分鐘前|小時前|小时前|天前|剛剛|刚刚)/i
  if (relativeTextPattern.test(raw)) return `Last health check ${raw}`

  // Only convert to relative time when timezone is explicit to avoid local/UTC drift.
  const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw)
  if (!hasExplicitTimezone) return `Last health check ${raw}`

  const ts = Date.parse(raw)
  if (Number.isNaN(ts)) return `Last health check ${healthLastChecked}`

  const diffMs = Math.max(0, Date.now() - ts)
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 1) return 'Last health check just now'
  if (diffMinutes < 60) {
    return `Last health check ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Last health check ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return `Last health check ${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  return `Last health check ${new Date(ts).toLocaleString()}`
}

// ── Agent Version Info ────────────────────────────────────────────────────────

function AgentVersionInfo({
  agentVersion,
  upgradeData,
  upgradeError,
}: {
  agentVersion: string | null
  upgradeData: GenerateKubernetesAgentUpgradeScriptData | null
  upgradeError: string | null
}) {
  const [copied, setCopied] = useState(false)
  const latestVersion = upgradeData?.latestVersion ?? null
  const upgradeAvailable = upgradeData?.needsUpgrade ?? false
  const upgradeCommand = upgradeData?.upgradeScript ?? ''

  const handleCopy = useCallback(() => {
    if (!upgradeCommand) return
    navigator.clipboard.writeText(upgradeCommand).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [upgradeCommand])

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Agent Version:</span>
        <span className="text-sm font-mono text-gray-600">{agentVersion ?? 'Unknown'}</span>
        {upgradeAvailable && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
            Update available: {latestVersion}
          </span>
        )}
        {agentVersion && latestVersion && !upgradeAvailable && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
            Up to date
          </span>
        )}
      </div>
      {latestVersion && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-medium text-gray-700">Latest Version:</span>
          <span className="text-sm font-mono text-gray-600">{latestVersion}</span>
        </div>
      )}
      {upgradeAvailable && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upgrade Command</span>
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <button
                onClick={handleCopy}
                className="text-xs text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer font-medium"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </Tooltip>
          </div>
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all m-0 leading-relaxed">
            {upgradeCommand}
          </pre>
        </div>
      )}
      {upgradeError && (
        <div className="mt-2 text-xs text-amber-700">
          Upgrade command unavailable: {upgradeError}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const DeploymentTargetDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const { targetId, tab } = useParams<{ targetId: string; tab?: string }>()
  const activeTab: TabKey = (['settings', 'connectivity', 'deployments', 'events'] as TabKey[]).includes(tab as TabKey)
    ? (tab as TabKey)
    : 'settings'

  const [loading, setLoading] = useState(true)
  const [machine, setMachine] = useState<MachineDto | null>(null)
  const [agentUpgradeData, setAgentUpgradeData] = useState<GenerateKubernetesAgentUpgradeScriptData | null>(null)
  const [agentUpgradeError, setAgentUpgradeError] = useState<string | null>(null)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [accounts, setAccounts] = useState<DeploymentAccountDto[]>([])
  const [manualHealthCheckData, setManualHealthCheckData] = useState<MachineHealthCheckData | null>(null)
  const [healthCheckError, setHealthCheckError] = useState<string | null>(null)
  const [healthCheckLoading, setHealthCheckLoading] = useState(false)

  // Editable state
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openClawEnvironments, setOpenClawEnvironments] = useState<number[]>([])
  const [openClawTargetTags, setOpenClawTargetTags] = useState<string[]>([])
  const [openClawBaseUrl, setOpenClawBaseUrl] = useState('')
  const [openClawAuthMode, setOpenClawAuthMode] = useState<OpenClawAuthMode>('account')
  const [openClawSelectedAccountId, setOpenClawSelectedAccountId] = useState<string | undefined>(undefined)
  const [openClawInlineGatewayToken, setOpenClawInlineGatewayToken] = useState('')
  const [openClawInlineHooksToken, setOpenClawInlineHooksToken] = useState('')
  const [targetTagOptions, setTargetTagOptions] = useState<string[]>([])

  // Expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const toggleCard = (key: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => {
    setExpandedCards(new Set([
      'displayName', 'enabled', 'environments', 'targetTags',
      'authentication', 'kubernetesDetails', 'openClawDetails', 'containerOptions',
    ]))
  }

  useEffect(() => {
    const machineId = Number(targetId)
    if (!Number.isFinite(machineId)) {
      message.error('Invalid target ID')
      navigate(`/${space.slug}/deployment/targets`)
      return
    }

    let mounted = true
    setLoading(true)

    Promise.all([
      getMachines({ pageSize: 1000, spaceId: space.id }),
      getEnvironments({ pageSize: 1000, spaceId: space.id }),
      getDeploymentAccounts({ pageSize: 1000, spaceId: space.id }),
      getTargetTags(),
    ])
      .then(([machinesData, envData, accountData, targetTagData]) => {
        if (!mounted) return
        const found = machinesData.machines.find((m) => m.id === machineId)
        if (!found) {
          message.error('Deployment target not found')
          return
        }
        setMachine(found)
        setName(found.name)
        setEnabled(!found.isDisabled)
        setEnvironments(envData.environments ?? [])
        setAccounts(accountData.deploymentAccounts ?? [])
        setTargetTagOptions(
          (targetTagData.targetTags ?? [])
            .map((tag) => tag.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b)),
        )
        setAgentUpgradeData(null)
        setAgentUpgradeError(null)

        const endpoint = parseEndpointJson(found.endpoint || '{}')
        const authAccountId = readAuthAccountId(endpoint)
        setOpenClawEnvironments(found.environmentIds ?? [])
        setOpenClawTargetTags(found.roles ?? [])
        setOpenClawBaseUrl(readOpenClawEndpointBaseUrl(endpoint))
        setOpenClawAuthMode(authAccountId ? 'account' : 'inline')
        setOpenClawSelectedAccountId(authAccountId ? String(authAccountId) : undefined)
        setOpenClawInlineGatewayToken('')
        setOpenClawInlineHooksToken('')

        // Fetch upgrade info only for KubernetesAgent targets
        try {
          const ep = JSON.parse(found.endpoint || '{}')
          if (ep.CommunicationStyle === 'KubernetesAgent') {
            generateKubernetesAgentUpgradeScript({ machineId: found.id })
              .then((data) => {
                if (!mounted) return
                setAgentUpgradeData(data)
                setAgentUpgradeError(null)
              })
              .catch(async (err: unknown) => {
                if (!mounted) return

                if (isNotFoundError(err)) {
                  try {
                    const latest = await getLatestKubernetesAgentVersion()
                    if (!mounted) return

                    if (latest.latestVersion) {
                      const fallbackData = buildLegacyUpgradeData(found, ep as KubernetesAgentEndpoint, latest.latestVersion)
                      setAgentUpgradeData(fallbackData)
                      setAgentUpgradeError('Backend upgrade API not available; showing compatibility command.')
                      return
                    }
                  } catch {
                    // fall through to unified error display
                  }
                }

                setAgentUpgradeData(null)
                setAgentUpgradeError(err instanceof Error ? err.message : 'Failed to generate upgrade command')
              })
          }
        } catch { /* ignore parse errors */ }
      })
      .catch(() => {
        if (!mounted) return
        message.error('Failed to load deployment target')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [targetId, space.id])

  useEffect(() => {
    setManualHealthCheckData(null)
    setHealthCheckError(null)
    setHealthCheckLoading(false)
  }, [machine?.id])

  const runMachineHealthCheck = useCallback(async () => {
    if (!machine) return

    setHealthCheckLoading(true)
    setHealthCheckError(null)
    try {
      const data = await checkMachineHealth(machine.id)
      setManualHealthCheckData(data ?? null)
    } catch (error) {
      const status = (error as any)?.response?.status
      const responseData = (error as any)?.response?.data
      const detailedMessage = typeof responseData === 'string'
        ? responseData.trim()
        : (
          responseData?.message
          ?? responseData?.error
          ?? responseData?.detail
          ?? responseData?.title
          ?? null
        )
      const normalizedDetailedMessage = typeof detailedMessage === 'string' ? detailedMessage.trim() : ''
      const errorText = normalizedDetailedMessage
        ? normalizedDetailedMessage
        : status
          ? `Health check failed (${status})`
          : (error instanceof Error ? error.message : 'Health check failed')
      setHealthCheckError(errorText)
    } finally {
      setHealthCheckLoading(false)
    }
  }, [machine])

  const handleSave = async () => {
    if (!machine) return
    setSaving(true)
    try {
      const trimmedName = name.trim()
      const nextIsDisabled = !enabled
      const endpoint = parseEndpointJson(machine.endpoint || '{}')
      const openClawTarget = isOpenClawStyle((endpoint as any)?.CommunicationStyle)
      const payload = {
        machineId: machine.id,
        ...(trimmedName && trimmedName !== machine.name ? { name: trimmedName } : {}),
        ...(nextIsDisabled !== machine.isDisabled ? { isDisabled: nextIsDisabled } : {}),
      }

      if (openClawTarget) {
        const normalizedRoles = normalizeStringArray(openClawTargetTags)
        const normalizedEnvironments = normalizeNumberArray(openClawEnvironments)
        const baseUrl = openClawBaseUrl.trim()
        const existingRoles = normalizeStringArray(machine.roles ?? [])
        const existingEnvironments = normalizeNumberArray(machine.environmentIds ?? [])
        const existingBaseUrl = readOpenClawEndpointBaseUrl(endpoint).trim()
        const existingAccountId = readAuthAccountId(endpoint)

        if (!baseUrl) {
          message.warning('Please enter the OpenClaw URL')
          return
        }
        if (normalizedEnvironments.length === 0) {
          message.warning('Please select at least one environment')
          return
        }
        if (normalizedRoles.length === 0) {
          message.warning('Please add at least one target tag')
          return
        }

        if (!arraysEqual(existingRoles, normalizedRoles)) (payload as any).roles = normalizedRoles
        if (!arraysEqual(existingEnvironments, normalizedEnvironments)) (payload as any).environmentIds = normalizedEnvironments
        if (baseUrl !== existingBaseUrl) (payload as any).baseUrl = baseUrl

        if (openClawAuthMode === 'account') {
          const accountId = Number(openClawSelectedAccountId)
          if (!Number.isFinite(accountId) || accountId <= 0) {
            message.warning('Please select an OpenClaw account')
            return
          }
          if (existingAccountId !== accountId) {
            ; (payload as any).resourceReferences = [{ type: 1, resourceId: accountId }]
          }
        } else {
          const inlineGatewayToken = openClawInlineGatewayToken.trim()
          const inlineHooksToken = openClawInlineHooksToken.trim()
          if (existingAccountId && !inlineGatewayToken) {
            message.warning('Please provide an inline gateway token when switching from account mode')
            return
          }
          if (!inlineGatewayToken && inlineHooksToken) {
            message.warning('Inline gateway token is required when setting inline hooks token')
            return
          }
          if (existingAccountId) (payload as any).resourceReferences = []
          if (inlineGatewayToken) (payload as any).inlineGatewayToken = inlineGatewayToken
          if (inlineHooksToken) (payload as any).inlineHooksToken = inlineHooksToken
        }
      }

      if (Object.keys(payload).length === 1) {
        setDirty(false)
        return
      }

      const updated = await updateMachine(payload)
      setMachine(updated)
      setName(updated.name)
      setEnabled(!updated.isDisabled)
      const updatedEndpoint = parseEndpointJson(updated.endpoint || '{}')
      const updatedAccountId = readAuthAccountId(updatedEndpoint)
      setOpenClawEnvironments(updated.environmentIds ?? [])
      setOpenClawTargetTags(updated.roles ?? [])
      setOpenClawBaseUrl(readOpenClawEndpointBaseUrl(updatedEndpoint))
      setOpenClawAuthMode(updatedAccountId ? 'account' : 'inline')
      setOpenClawSelectedAccountId(updatedAccountId ? String(updatedAccountId) : undefined)
      setOpenClawInlineGatewayToken('')
      setOpenClawInlineHooksToken('')
      setDirty(false)
      message.success('Saved')
    } catch {
      message.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTabChange = (newTab: TabKey) => {
    navigate(`/${space.slug}/deployment/targets/${targetId}/${newTab}`, { replace: true })
  }

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!machine) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Deployment target not found</div>
      </div>
    )
  }

  // Derived data
  const envIds = (machine.environmentIds ?? []).map(String)
  const envNames = envIds.map((id) => {
    const env = environments.find((e) => String(e.id) === id)
    return env?.name ?? id
  })
  const roles = machine.roles ?? []
  const ep = parseEndpointJson(machine.endpoint || '{}')
  const endpointLabel = communicationStyleLabel(ep?.CommunicationStyle || 'Unknown')
  const isK8sApi = ep?.CommunicationStyle === 'KubernetesApi'
  const accountId = isK8sApi
    ? (ep as KubernetesApiEndpoint).ResourceReferences?.find((r) => r.Type === 1)?.ResourceId
    : undefined
  const account = accountId ? accounts.find((a) => a.id === accountId) ?? null : null
  const machineHealthData: MachineHealthCheckData = {
    HealthStatus: machine.HealthStatus ?? machine.healthStatus ?? null,
    HealthDetail: machine.HealthDetail ?? machine.healthDetail ?? null,
    HealthLastChecked: machine.HealthLastChecked ?? machine.healthLastChecked ?? null,
  }
  const effectiveHealthData: MachineHealthCheckData = healthCheckError
    ? {
      ...machineHealthData,
      HealthStatus: 'Unavailable',
      HealthDetail: healthCheckError,
    }
    : (manualHealthCheckData ?? machineHealthData)
  const connectivityState = resolveConnectivityHealthState(machine, effectiveHealthData)

  const tabs: { key: TabKey; label: string; extra?: React.ReactNode }[] = [
    { key: 'settings', label: 'Settings' },
    {
      key: 'connectivity',
      label: 'Connectivity',
      extra: (
        connectivityState === 'Healthy' ? <HealthyIcon size={14} />
          : connectivityState === 'Unavailable' ? <UnavailableIcon size={14} />
            : connectivityState === 'Unhealthy' ? <UnhealthyIcon size={14} />
            : <UnknownHealthIcon size={14} />
      ),
    },
    { key: 'deployments', label: 'Deployments' },
    { key: 'events', label: 'Events' },
  ]

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-4 pb-4 border-b border-gray-200">
            {/* Breadcrumb */}
            <div className="mb-3">
              <button
                onClick={() => navigate(`/${space.slug}/deployment/targets`)}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer p-0"
              >
                <BackArrow />
                <span>Deployment Targets</span>
              </button>
            </div>

            {/* Title row */}
            <div className="flex items-center gap-3">
              <MachineTypeIcon machineType={endpointLabel} isDisabled={machine.isDisabled} />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 m-0 leading-tight">{machine.name}</h2>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="text-gray-300">|</span>
                <FilledChip
                  label={endpointLabel}
                  bgColor="var(--colorChipFilledBackgroundPrimary, #e0e7ff)"
                  textColor="var(--colorChipFilledTextPrimary, #3730a3)"
                />
                {ep?.CommunicationStyle === 'KubernetesAgent' && agentUpgradeData && (() => {
                  if (agentUpgradeData.needsUpgrade) {
                    return <FilledChip label={`Update available: ${agentUpgradeData.latestVersion}`} bgColor="#fef3c7" textColor="#92400e" />
                  }
                  if (machine.agentVersion) {
                    return <FilledChip label="Up to date" bgColor="#d1fae5" textColor="#065f46" />
                  }
                  return null
                })()}
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="border-b border-gray-200">
            <div className="flex px-6">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 bg-transparent cursor-pointer transition-colors
                    ${activeTab === t.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {t.label}
                  {t.extra}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'settings' && (
              <SettingsTab
                machine={machine}
                agentUpgradeData={agentUpgradeData}
                agentUpgradeError={agentUpgradeError}
                name={name}
                setName={(v) => { setName(v); setDirty(true) }}
                enabled={enabled}
                setEnabled={(v) => { setEnabled(v); setDirty(true) }}
                isOpenClawTarget={isOpenClawStyle(ep?.CommunicationStyle)}
                environments={environments}
                accounts={accounts}
                targetTagOptions={targetTagOptions}
                openClawEnvironments={openClawEnvironments}
                setOpenClawEnvironments={(v) => { setOpenClawEnvironments(v); setDirty(true) }}
                openClawTargetTags={openClawTargetTags}
                setOpenClawTargetTags={(v) => { setOpenClawTargetTags(v); setDirty(true) }}
                openClawBaseUrl={openClawBaseUrl}
                setOpenClawBaseUrl={(v) => { setOpenClawBaseUrl(v); setDirty(true) }}
                openClawAuthMode={openClawAuthMode}
                setOpenClawAuthMode={(v) => { setOpenClawAuthMode(v); setDirty(true) }}
                openClawSelectedAccountId={openClawSelectedAccountId}
                setOpenClawSelectedAccountId={(v) => { setOpenClawSelectedAccountId(v); setDirty(true) }}
                openClawInlineGatewayToken={openClawInlineGatewayToken}
                setOpenClawInlineGatewayToken={(v) => { setOpenClawInlineGatewayToken(v); setDirty(true) }}
                openClawInlineHooksToken={openClawInlineHooksToken}
                setOpenClawInlineHooksToken={(v) => { setOpenClawInlineHooksToken(v); setDirty(true) }}
                envNames={envNames}
                roles={roles}
                ep={ep}
                account={account}
                expandedCards={expandedCards}
                toggleCard={toggleCard}
                expandAll={expandAll}
                dirty={dirty}
                saving={saving}
                onSave={handleSave}
                spaceSlug={space.slug}
                navigate={navigate}
              />
            )}
            {activeTab === 'connectivity' && (
              <ConnectivityTab
                healthCheckData={effectiveHealthData}
                healthState={connectivityState}
                healthCheckLoading={healthCheckLoading}
                onCheckHealth={runMachineHealthCheck}
              />
            )}
            {activeTab === 'deployments' && (
              <PlaceholderTab title="Deployments" />
            )}
            {activeTab === 'events' && (
              <PlaceholderTab title="Events" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({
  machine,
  agentUpgradeData,
  agentUpgradeError,
  name,
  setName,
  enabled,
  setEnabled,
  isOpenClawTarget,
  environments,
  accounts,
  targetTagOptions,
  openClawEnvironments,
  setOpenClawEnvironments,
  openClawTargetTags,
  setOpenClawTargetTags,
  openClawBaseUrl,
  setOpenClawBaseUrl,
  openClawAuthMode,
  setOpenClawAuthMode,
  openClawSelectedAccountId,
  setOpenClawSelectedAccountId,
  openClawInlineGatewayToken,
  setOpenClawInlineGatewayToken,
  openClawInlineHooksToken,
  setOpenClawInlineHooksToken,
  envNames,
  roles,
  ep,
  account,
  expandedCards,
  toggleCard,
  expandAll,
  dirty,
  saving,
  onSave,
  spaceSlug,
  navigate,
}: {
  machine: MachineDto
  agentUpgradeData: GenerateKubernetesAgentUpgradeScriptData | null
  agentUpgradeError: string | null
  name: string
  setName: (v: string) => void
  enabled: boolean
  setEnabled: (v: boolean) => void
  isOpenClawTarget: boolean
  environments: EnvironmentDto[]
  accounts: DeploymentAccountDto[]
  targetTagOptions: string[]
  openClawEnvironments: number[]
  setOpenClawEnvironments: (v: number[]) => void
  openClawTargetTags: string[]
  setOpenClawTargetTags: (v: string[]) => void
  openClawBaseUrl: string
  setOpenClawBaseUrl: (v: string) => void
  openClawAuthMode: OpenClawAuthMode
  setOpenClawAuthMode: (v: OpenClawAuthMode) => void
  openClawSelectedAccountId?: string
  setOpenClawSelectedAccountId: (v: string | undefined) => void
  openClawInlineGatewayToken: string
  setOpenClawInlineGatewayToken: (v: string) => void
  openClawInlineHooksToken: string
  setOpenClawInlineHooksToken: (v: string) => void
  envNames: string[]
  roles: string[]
  ep: MachineEndpoint | null
  account: DeploymentAccountDto | null
  expandedCards: Set<string>
  toggleCard: (key: string) => void
  expandAll: () => void
  dirty: boolean
  saving: boolean
  onSave: () => void
  spaceSlug: string
  navigate: (path: string) => void
}) {
  const slug = slugify(name)
  const environmentOptions = environments.map((env) => ({ value: env.id, label: env.name }))
  const openClawAccountOptions = accounts
    .filter((acc) => acc.accountType === DeploymentAccountType.OpenClawGateway)
    .map((acc) => ({ value: String(acc.id), label: acc.name }))
  const targetTagSelectOptions = targetTagOptions.map((tag) => ({ value: tag, label: tag }))
  const overflowItems: MenuProps['items'] = [
    {
      key: 'toggle-enabled',
      label: enabled ? 'Disable' : 'Enable',
    },
    {
      key: 'delete',
      label: <span className="text-red-600">Delete</span>,
    },
    { type: 'divider' },
    {
      key: 'audit-trail',
      label: (
        <a
          href={`#/${spaceSlug}/configuration/audit?regardingAny=Machines-${machine.id}`}
          className="block text-gray-700 hover:text-gray-900"
        >
          Audit Trail
        </a>
      ),
    },
  ]

  const handleOverflowClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'toggle-enabled') {
      setEnabled(!enabled)
      return
    }

    if (key === 'delete') {
      Modal.confirm({
        title: 'Delete Deployment Target',
        content: `Are you sure you want to delete "${machine.name}"? This action cannot be undone.`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        centered: true,
        onOk: async () => {
          try {
            const result = await deleteMachines({ ids: [machine.id] })
            if ((result.failIds ?? []).includes(machine.id)) {
              message.error('Failed to delete deployment target')
              return
            }
            message.success('Deployment target deleted')
            navigate(`/${spaceSlug}/deployment/targets`)
          } catch {
            message.error('Failed to delete deployment target')
          }
        },
      })
    }
  }

  const openClawEnvironmentNames = openClawEnvironments
    .map((id) => environments.find((env) => env.id === id)?.name ?? String(id))
    .filter(Boolean)

  return (
    <div>
      {/* Settings header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">Settings</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate(`/${spaceSlug}/deployment/targets/add`)}
            className="!border-gray-300 !text-gray-700 hover:!border-gray-400 hover:!text-gray-800"
          >
            Add another
          </Button>
          <Button
            type="primary"
            disabled={!dirty}
            loading={saving}
            onClick={onSave}
            className={dirty
              ? '!bg-green-700 hover:!bg-green-800 !border-green-700'
              : '!bg-gray-300 !border-gray-300 !text-gray-600'}
          >
            Save
          </Button>
          <Dropdown menu={{ items: overflowItems, onClick: handleOverflowClick }} placement="bottomRight" trigger={['click']}>
            <Button icon={<MoreOutlined />} aria-label="Overflow Menu" />
          </Dropdown>
        </div>
      </div>

      {/* Expand all */}
      <div className="mb-3 text-right">
        <button
          onClick={expandAll}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer uppercase tracking-wide"
        >
          Expand All
        </button>
      </div>

      {/* Display Name */}
      <ExpandableCard
        title="Display Name"
        summary={
          <>
            <span>{name}</span>
            <span className="text-gray-400">{slug}</span>
          </>
        }
        expanded={expandedCards.has('displayName')}
        onToggle={() => toggleCard('displayName')}
      >
        <div className="pt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-0 border-b border-gray-300 px-0 py-2 text-base outline-none focus:border-blue-500 bg-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Slug: {slug}</p>
        </div>
      </ExpandableCard>

      {/* Enabled */}
      <ExpandableCard
        title="Enabled"
        summary={<span>{enabled ? 'Yes' : 'No'}</span>}
        expanded={expandedCards.has('enabled')}
        onToggle={() => toggleCard('enabled')}
      >
        <div className="pt-3 flex items-center gap-3">
          <Switch checked={enabled} onChange={setEnabled} />
          <span className="text-sm text-gray-700">{enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </ExpandableCard>

      {/* Deployment section */}
      <SectionHeading>Deployment</SectionHeading>

      {/* Environments */}
      <ExpandableCard
        title="Environments"
        summary={
          (isOpenClawTarget ? openClawEnvironmentNames : envNames).length > 0
            ? (isOpenClawTarget ? openClawEnvironmentNames : envNames).map((env) => <Chip key={env} icon={<EnvChipIcon />} label={env} />)
            : <span className="text-gray-400 italic">No environments</span>
        }
        expanded={expandedCards.has('environments')}
        onToggle={() => toggleCard('environments')}
      >
        <div className="pt-3">
          {isOpenClawTarget ? (
            <div>
              <Select
                mode="multiple"
                value={openClawEnvironments}
                onChange={(values) => setOpenClawEnvironments(values.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))}
                options={environmentOptions}
                className="w-full"
                placeholder="Select environments"
                optionFilterProp="label"
              />
              <p className="text-xs text-gray-500 mt-1 mb-0">Choose at least one environment for this OpenClaw target.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {envNames.map((env) => (
                  <Chip key={env} icon={<EnvChipIcon />} label={env} />
                ))}
              </div>
              {envNames.length === 0 && (
                <span className="text-sm text-gray-400 italic">No environments assigned</span>
              )}
            </>
          )}
        </div>
      </ExpandableCard>

      {/* Target Tags */}
      <ExpandableCard
        title="Target Tags"
        summary={
          (isOpenClawTarget ? openClawTargetTags : roles).length > 0
            ? (isOpenClawTarget ? openClawTargetTags : roles).map((tag) => <Chip key={tag} icon={<RoleChipIcon />} label={tag} />)
            : <span className="text-gray-400 italic">No target tags</span>
        }
        expanded={expandedCards.has('targetTags')}
        onToggle={() => toggleCard('targetTags')}
      >
        <div className="pt-3">
          {isOpenClawTarget ? (
            <div>
              <Select
                mode="tags"
                value={openClawTargetTags}
                onChange={(values) => setOpenClawTargetTags(normalizeStringArray(values))}
                options={targetTagSelectOptions}
                className="w-full"
                placeholder="Add target tags"
                tokenSeparators={[',']}
              />
              <p className="text-xs text-gray-500 mt-1 mb-0">At least one target tag is required.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {roles.map((tag) => (
                  <Chip key={tag} icon={<RoleChipIcon />} label={tag} />
                ))}
              </div>
              {roles.length === 0 && (
                <span className="text-sm text-gray-400 italic">No target tags</span>
              )}
            </>
          )}
        </div>
      </ExpandableCard>

      {/* Communication section */}
      <SectionHeading>Communication</SectionHeading>

      {/* Authentication */}
      <ExpandableCard
        title="Authentication"
        summary={<span>{isOpenClawTarget ? (openClawAuthMode === 'account' ? 'OpenClaw Account' : 'Inline Token') : (account?.name ?? 'No account')}</span>}
        expanded={expandedCards.has('authentication')}
        onToggle={() => toggleCard('authentication')}
      >
        <div className="pt-3">
          {isOpenClawTarget ? (
            <div className="space-y-3">
              <Radio.Group
                value={openClawAuthMode}
                onChange={(event) => setOpenClawAuthMode(event.target.value as OpenClawAuthMode)}
              >
                <Radio value="account">OpenClaw Account</Radio>
                <Radio value="inline">Inline Token</Radio>
              </Radio.Group>

              {openClawAuthMode === 'account' ? (
                <div>
                  <Select
                    value={openClawSelectedAccountId}
                    onChange={(value) => setOpenClawSelectedAccountId(value)}
                    options={openClawAccountOptions}
                    className="w-full"
                    placeholder="Select OpenClaw account"
                    optionFilterProp="label"
                    allowClear
                  />
                  <p className="text-xs text-gray-500 mt-1 mb-0">Only OpenClaw Gateway accounts can be selected.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Inline Gateway Token *</label>
                    <Input.Password
                      value={openClawInlineGatewayToken}
                      onChange={(event) => setOpenClawInlineGatewayToken(event.target.value)}
                      placeholder="Required when setting inline auth. Leave empty to keep existing token."
                    />
                    <p className="text-xs text-gray-500 mt-2 mb-0">
                      Required. Used for <code>/tools/invoke</code> and <code>/v1/chat/completions</code>.
                    </p>
                    <p className="text-xs text-gray-500 mt-1 mb-0">
                      Get it: <code>openclaw config get gateway.auth.token</code>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Inline Hooks Token (Optional)</label>
                    <Input.Password
                      value={openClawInlineHooksToken}
                      onChange={(event) => setOpenClawInlineHooksToken(event.target.value)}
                      placeholder="Leave empty to keep existing token"
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
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              {account ? (
                <div>
                  <span className="font-medium">Account:</span> {account.name}
                  <span className="ml-2 text-gray-400">({account.slug})</span>
                </div>
              ) : (
                <span className="text-gray-400 italic">No authentication account configured</span>
              )}
            </div>
          )}
        </div>
      </ExpandableCard>

      {isOpenClawTarget && (
        <ExpandableCard
          title="OpenClaw Details"
          summary={openClawBaseUrl ? <span>{openClawBaseUrl}</span> : <span className="text-gray-400 italic">Not configured</span>}
          expanded={expandedCards.has('openClawDetails')}
          onToggle={() => toggleCard('openClawDetails')}
        >
          <div className="pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">OpenClaw URL</label>
            <Input
              value={openClawBaseUrl}
              onChange={(event) => setOpenClawBaseUrl(event.target.value)}
              placeholder="https://claw.example.com:18789"
            />
            <p className="text-xs text-gray-500 mt-1 mb-0">Use an absolute URL including port.</p>
          </div>
        </ExpandableCard>
      )}

      {/* Kubernetes Details (only for Kubernetes endpoints) */}
      {ep?.CommunicationStyle === 'KubernetesApi' && (() => {
        const apiEp = ep as KubernetesApiEndpoint
        return (
          <ExpandableCard
            title="Kubernetes Details"
            summary={
              apiEp.ClusterUrl ? (
                <span>
                  Connecting to cluster at <strong>{apiEp.ClusterUrl}</strong>
                  {apiEp.ClusterCertificatePath ? <span> with a custom certificate</span> : null}
                </span>
              ) : (
                <span className="text-gray-400 italic">Not configured</span>
              )
            }
            expanded={expandedCards.has('kubernetesDetails')}
            onToggle={() => toggleCard('kubernetesDetails')}
          >
            <div className="pt-3 space-y-3">
              {apiEp.ClusterUrl && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Cluster URL:</span>
                  <div className="text-sm text-gray-600 mt-0.5 break-all">{apiEp.ClusterUrl}</div>
                </div>
              )}
              {apiEp.Namespace && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Default Namespace:</span>
                  <div className="text-sm text-gray-600 mt-0.5">{apiEp.Namespace}</div>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">Skip TLS Verification:</span>
                <span className="text-sm text-gray-600 ml-2">{apiEp.SkipTlsVerification === 'True' ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </ExpandableCard>
        )
      })()}

      {ep?.CommunicationStyle === 'KubernetesAgent' && (() => {
        const agentEp = ep as KubernetesAgentEndpoint
        return (
          <ExpandableCard
            title="Kubernetes Agent Details"
            summary={
              agentEp.Namespace
                ? <span>Namespace: <strong>{agentEp.Namespace}</strong></span>
                : <span className="text-gray-400 italic">Not configured</span>
            }
            expanded={expandedCards.has('kubernetesDetails')}
            onToggle={() => toggleCard('kubernetesDetails')}
          >
            <div className="pt-3 space-y-3">
              <AgentVersionInfo
                agentVersion={machine.agentVersion ?? null}
                upgradeData={agentUpgradeData}
                upgradeError={agentUpgradeError}
              />
              {agentEp.Namespace && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Namespace:</span>
                  <div className="text-sm text-gray-600 mt-0.5">{agentEp.Namespace}</div>
                </div>
              )}
              {agentEp.SubscriptionId && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Subscription ID:</span>
                  <div className="text-sm text-gray-600 mt-0.5 font-mono text-xs break-all">{agentEp.SubscriptionId}</div>
                </div>
              )}
            </div>
          </ExpandableCard>
        )
      })()}

      {/* Container Options */}
      <ExpandableCard
        title="Container Options"
        summary={<span className="text-gray-400 italic">No container options</span>}
        expanded={expandedCards.has('containerOptions')}
        onToggle={() => toggleCard('containerOptions')}
      >
        <div className="pt-3">
          <span className="text-sm text-gray-500">No container options configured.</span>
        </div>
      </ExpandableCard>

    </div>
  )
}

// ── Connectivity Tab ──────────────────────────────────────────────────────────

function ConnectivityTab({
  healthCheckData,
  healthState,
  healthCheckLoading,
  onCheckHealth,
}: {
  healthCheckData: MachineHealthCheckData | null
  healthState: ConnectivityHealthState
  healthCheckLoading: boolean
  onCheckHealth: () => void
}) {
  const mappedHealthStatus = getHealthStatusValue(healthCheckData) ?? healthState
  const mappedHealthDetail = getHealthDetailValue(healthCheckData)
  const mappedHealthLastChecked = getHealthLastCheckedValue(healthCheckData)
  const healthDetailText = mappedHealthDetail ?? (healthCheckData ? 'No health check detail available' : 'No health check has been run yet')
  const healthLastCheckedText = formatHealthLastCheckedRelative(mappedHealthLastChecked)
  const isFailureState = ['Unavailable', 'Unhealthy'].includes(String(mappedHealthStatus))
  const stateLabelClass = healthState === 'Healthy'
    ? 'text-emerald-700'
    : healthState === 'Unavailable'
      ? 'text-rose-700'
    : healthState === 'Unhealthy'
      ? 'text-rose-700'
      : healthState === 'Disabled'
        ? 'text-gray-700'
        : 'text-slate-700'

  const stateIcon = healthState === 'Healthy'
    ? <HealthyIcon size={20} />
    : healthState === 'Unavailable'
      ? <UnavailableIcon size={20} />
    : healthState === 'Unhealthy'
      ? <UnhealthyIcon size={20} />
      : <UnknownHealthIcon size={20} />

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">Connectivity</h1>
        <Button
          type="primary"
          loading={healthCheckLoading}
          onClick={onCheckHealth}
          className="!bg-green-700 hover:!bg-green-800 !border-green-700"
        >
          Check health
        </Button>
      </div>

      <div className="border border-gray-200 rounded-md bg-white p-6">
        {isFailureState ? (
          <div className="mb-5 rounded border border-rose-200 bg-rose-50 px-4 py-3" role="alert">
            <div className="flex items-start gap-3">
              <div className="pt-0.5">
                {healthState === 'Unhealthy' ? <UnhealthyIcon size={24} /> : <UnavailableIcon size={24} />}
              </div>
              <div>
                <div className="text-base font-semibold text-rose-800">{mappedHealthStatus}</div>
                <div className="text-sm text-rose-700 mt-1 whitespace-pre-wrap break-words">{healthDetailText}</div>
                <div className="text-sm text-rose-700 mt-2">{healthLastCheckedText}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              {stateIcon}
              <span className={`text-lg font-medium ${stateLabelClass}`}>{mappedHealthStatus}</span>
            </div>
            <div className="mb-5 text-sm text-gray-600">
              <div>{healthDetailText}</div>
              <div className="mt-2">{healthLastCheckedText}</div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── Placeholder Tab ───────────────────────────────────────────────────────────

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 m-0 mb-6">{title}</h1>
      <div className="border border-gray-200 rounded-md bg-white p-12 text-center text-gray-400 text-sm">
        No {title.toLowerCase()} to display.
      </div>
    </div>
  )
}

export default DeploymentTargetDetailPage
