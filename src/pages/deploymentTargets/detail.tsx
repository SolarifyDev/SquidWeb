import React, { useEffect, useState } from 'react'
import { Button, Spin, Switch, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { getMachines, MachineDto } from 'pages/apis/machine'
import { getEnvironments, EnvironmentDto } from 'pages/apis/environment'
import { getDeploymentAccounts, DeploymentAccountDto } from 'pages/apis/deploymentAccount'
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
}

type MachineEndpoint = KubernetesApiEndpoint | KubernetesAgentEndpoint

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

function communicationStyleLabel(style: string): string {
  const map: Record<string, string> = {
    KubernetesApi: 'Kubernetes API',
    KubernetesAgent: 'Kubernetes Agent',
    TentaclePassive: 'Listening Tentacle',
    TentacleActive: 'Polling Tentacle',
    Ssh: 'SSH Connection',
  }
  return map[style] || style
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
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [accounts, setAccounts] = useState<DeploymentAccountDto[]>([])

  // Editable state
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

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
      'authentication', 'kubernetesDetails', 'workerPool',
      'healthCheckImage', 'containerOptions',
      'tenantedDeployments', 'associatedTenants',
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
    ])
      .then(([machinesData, envData, accountData]) => {
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

  const handleSave = async () => {
    if (!machine) return
    setSaving(true)
    try {
      // TODO: Backend does not yet have a machine update endpoint
      message.warning('Save is not yet supported by the backend')
      setDirty(false)
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
  const envIds = machine.environmentIds ? machine.environmentIds.split(',').filter(Boolean) : []
  const envNames = envIds.map((id) => {
    const env = environments.find((e) => String(e.id) === id)
    return env?.name ?? id
  })
  const roles = machine.roles ? machine.roles.split(',').map((r) => r.trim()).filter(Boolean) : []
  const ep = parseEndpointJson(machine.endpoint || '{}')
  const endpointLabel = communicationStyleLabel(ep?.CommunicationStyle || 'Unknown')
  const isK8sApi = ep?.CommunicationStyle === 'KubernetesApi'
  const accountId = isK8sApi
    ? (ep as KubernetesApiEndpoint).ResourceReferences?.find((r) => r.Type === 1)?.ResourceId
    : undefined
  const account = accountId ? accounts.find((a) => a.id === accountId) ?? null : null

  const tabs: { key: TabKey; label: string; extra?: React.ReactNode }[] = [
    { key: 'settings', label: 'Settings' },
    {
      key: 'connectivity',
      label: 'Connectivity',
      extra: <HealthyIcon size={14} />,
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
                name={name}
                setName={(v) => { setName(v); setDirty(true) }}
                enabled={enabled}
                setEnabled={(v) => { setEnabled(v); setDirty(true) }}
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
              <ConnectivityTab machine={machine} />
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
  name,
  setName,
  enabled,
  setEnabled,
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
  name: string
  setName: (v: string) => void
  enabled: boolean
  setEnabled: (v: boolean) => void
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

  return (
    <div>
      {/* Settings header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/${spaceSlug}/deployment/targets/add`)}
            className="text-sm text-blue-600 hover:text-blue-800 bg-transparent border-0 cursor-pointer"
          >
            Add another
          </button>
          <Button
            type="primary"
            disabled={!dirty}
            loading={saving}
            onClick={onSave}
            className="!bg-green-700 hover:!bg-green-800 !border-green-700"
          >
            Save
          </Button>
          <Button icon={<MoreOutlined />} />
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
          envNames.length > 0
            ? envNames.map((env) => <Chip key={env} icon={<EnvChipIcon />} label={env} />)
            : <span className="text-gray-400 italic">No environments</span>
        }
        expanded={expandedCards.has('environments')}
        onToggle={() => toggleCard('environments')}
      >
        <div className="pt-3">
          <div className="flex flex-wrap gap-2">
            {envNames.map((env) => (
              <Chip key={env} icon={<EnvChipIcon />} label={env} />
            ))}
          </div>
          {envNames.length === 0 && (
            <span className="text-sm text-gray-400 italic">No environments assigned</span>
          )}
        </div>
      </ExpandableCard>

      {/* Target Tags */}
      <ExpandableCard
        title="Target Tags"
        summary={
          roles.length > 0
            ? roles.map((tag) => <Chip key={tag} icon={<RoleChipIcon />} label={tag} />)
            : <span className="text-gray-400 italic">No target tags</span>
        }
        expanded={expandedCards.has('targetTags')}
        onToggle={() => toggleCard('targetTags')}
      >
        <div className="pt-3">
          <div className="flex flex-wrap gap-2">
            {roles.map((tag) => (
              <Chip key={tag} icon={<RoleChipIcon />} label={tag} />
            ))}
          </div>
          {roles.length === 0 && (
            <span className="text-sm text-gray-400 italic">No target tags</span>
          )}
        </div>
      </ExpandableCard>

      {/* Communication section */}
      <SectionHeading>Communication</SectionHeading>

      {/* Authentication */}
      <ExpandableCard
        title="Authentication"
        summary={<span>{account?.name ?? 'No account'}</span>}
        expanded={expandedCards.has('authentication')}
        onToggle={() => toggleCard('authentication')}
      >
        <div className="pt-3">
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
        </div>
      </ExpandableCard>

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
              agentEp.Thumbprint
                ? <span>Thumbprint: <strong>{agentEp.Thumbprint}</strong></span>
                : <span className="text-gray-400 italic">Not configured</span>
            }
            expanded={expandedCards.has('kubernetesDetails')}
            onToggle={() => toggleCard('kubernetesDetails')}
          >
            <div className="pt-3 space-y-3">
              {agentEp.Thumbprint && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Thumbprint:</span>
                  <div className="text-sm text-gray-600 mt-0.5 font-mono text-xs break-all">{agentEp.Thumbprint}</div>
                </div>
              )}
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

      {/* Worker Pool */}
      <ExpandableCard
        title="Worker Pool"
        summary={<span className="text-gray-400 italic">No pool selected - default pool</span>}
        expanded={expandedCards.has('workerPool')}
        onToggle={() => toggleCard('workerPool')}
      >
        <div className="pt-3">
          <span className="text-sm text-gray-500">Using the default worker pool.</span>
        </div>
      </ExpandableCard>

      {/* Health Check Container Image */}
      <ExpandableCard
        title="Health Check Container Image"
        summary={<span>Runs directly on a <strong>worker</strong></span>}
        expanded={expandedCards.has('healthCheckImage')}
        onToggle={() => toggleCard('healthCheckImage')}
      >
        <div className="pt-3">
          <span className="text-sm text-gray-600">Health checks run directly on a worker.</span>
        </div>
      </ExpandableCard>

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

      {/* Restrictions section */}
      <SectionHeading>Restrictions</SectionHeading>

      {/* Tenanted Deployments */}
      <ExpandableCard
        title="Tenanted Deployments"
        summary={
          <span>Available for both untenanted deployments, and deployments to the associated tenants</span>
        }
        expanded={expandedCards.has('tenantedDeployments')}
        onToggle={() => toggleCard('tenantedDeployments')}
      >
        <div className="pt-3">
          <span className="text-sm text-gray-600">
            This target is available for both untenanted deployments, and deployments to the associated tenants.
          </span>
        </div>
      </ExpandableCard>

      {/* Associated Tenants */}
      <ExpandableCard
        title="Associated Tenants"
        summary={<span className="text-gray-400 italic">No associated tenants</span>}
        expanded={expandedCards.has('associatedTenants')}
        onToggle={() => toggleCard('associatedTenants')}
      >
        <div className="pt-3">
          <span className="text-sm text-gray-500">No tenants are associated with this target.</span>
        </div>
      </ExpandableCard>
    </div>
  )
}

// ── Connectivity Tab ──────────────────────────────────────────────────────────

function ConnectivityTab({ machine }: { machine: MachineDto }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 m-0 mb-6">Connectivity</h1>

      <div className="border border-gray-200 rounded-md bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <HealthyIcon size={20} />
          <span className="text-lg font-medium text-gray-900">Healthy</span>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          {machine.uri && (
            <div>
              <span className="font-medium text-gray-700">URI:</span>
              <span className="ml-2 break-all">{machine.uri}</span>
            </div>
          )}
          {machine.thumbprint && (
            <div>
              <span className="font-medium text-gray-700">Thumbprint:</span>
              <span className="ml-2 font-mono text-xs">{machine.thumbprint}</span>
            </div>
          )}
          {machine.operatingSystem && (
            <div>
              <span className="font-medium text-gray-700">Operating System:</span>
              <span className="ml-2">{machine.operatingSystem}</span>
            </div>
          )}
          {machine.shellName && (
            <div>
              <span className="font-medium text-gray-700">Shell:</span>
              <span className="ml-2">{machine.shellName} {machine.shellVersion}</span>
            </div>
          )}
        </div>
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
