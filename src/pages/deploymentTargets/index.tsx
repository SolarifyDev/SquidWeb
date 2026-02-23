import React, { useState, useEffect } from 'react'
import { Button, Checkbox, Collapse, Modal, Tabs, Spin, Input, Select } from 'antd'
import { SearchOutlined, FilterOutlined, MoreOutlined, PlusOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons'
import { getMachines, MachineDto } from 'pages/apis/machine'
import { useSpace } from 'contexts/SpaceContext'

const { Panel } = Collapse

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeploymentTarget {
  id: number
  name: string
  type: string
  url: string
  environments: number
  environmentList?: string[]
  tags: string[]
  status?: string
}

interface DeploymentData {
  healthy: DeploymentTarget[]
  disabled: DeploymentTarget[]
}

function mapMachineToTarget(m: MachineDto): DeploymentTarget {
  const envIds = m.environmentIds ? m.environmentIds.split(',').filter(Boolean) : []
  const rolesList = m.roles ? m.roles.split(',').map((r) => r.trim()).filter(Boolean) : []
  return {
    id: m.id,
    name: m.name,
    type: m.endpoint || 'Unknown',
    url: m.uri,
    environments: envIds.length,
    environmentList: envIds,
    tags: rolesList,
    status: m.isDisabled ? 'Disabled' : 'Healthy',
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

// ── Machine type icon ──────────────────────────────────────────────────────────

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

// ── Deployment Targets header icon ────────────────────────────────────────────

function DeploymentTargetsSvg() {
  return (
    <svg viewBox="0 0 200 200" width="20" height="20" fill="#111A23" style={{ flexShrink: 0 }}>
      <path d="M119.19 70.52h6.54a27 27 0 0 0-18-18V59a3.87 3.87 0 0 1-3.84 3.84h-7.73A3.87 3.87 0 0 1 92.32 59v-6.53a27 27 0 0 0-18 18h6.54a3.86 3.86 0 0 1 3.83 3.84V82a3.86 3.86 0 0 1-3.83 3.84h-6.59a27 27 0 0 0 18 18.05v-6.5a3.87 3.87 0 0 1 3.84-3.84h7.68a3.87 3.87 0 0 1 3.84 3.84v6.54a27 27 0 0 0 18-18.05h-6.54a3.86 3.86 0 0 1-3.73-3.88v-7.64a3.86 3.86 0 0 1 3.83-3.84z" />
      <path d="M170.17 16.15H29.83A3.82 3.82 0 0 0 26 20v116.71a3.82 3.82 0 0 0 3.83 3.82h65.34v15.74a14.92 14.92 0 0 0-9.3 9.3H42a4.83 4.83 0 1 0 0 9.66h43.87a14.92 14.92 0 0 0 28.26 0H158a4.83 4.83 0 1 0 0-9.66h-43.87a14.92 14.92 0 0 0-9.3-9.3v-15.74h65.34a3.82 3.82 0 0 0 3.83-3.82V20a3.82 3.82 0 0 0-3.83-3.85zM146.07 82a3.87 3.87 0 0 1-3.84 3.84h-8.58a34.59 34.59 0 0 1-26 26v8.58a3.87 3.87 0 0 1-3.84 3.84h-7.65a3.87 3.87 0 0 1-3.84-3.84v-8.58a34.59 34.59 0 0 1-26-26h-8.55A3.87 3.87 0 0 1 53.93 82v-7.64a3.87 3.87 0 0 1 3.84-3.84h8.58a34.59 34.59 0 0 1 26-26V36a3.87 3.87 0 0 1 3.84-3.84h7.68a3.87 3.87 0 0 1 3.81 3.84v8.58a34.59 34.59 0 0 1 26 26h8.58a3.87 3.87 0 0 1 3.84 3.84z" />
    </svg>
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
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <Input
        variant="borderless"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-0 rounded-none"
        style={{ borderBottom: '1px solid #9e9e9e', borderRadius: 0 }}
      />
      {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
    </div>
  )
}

function MultiSelectField({
  label,
  helper,
  options,
  value,
  onChange,
}: {
  label: string
  helper?: React.ReactNode
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <Select
        mode="multiple"
        className="w-full"
        variant="borderless"
        value={value}
        onChange={onChange}
        options={options}
        style={{ borderBottom: '1px solid #9e9e9e' }}
      />
      {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
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
  const { space } = useSpace();
  // API data
  const [deploymentData, setDeploymentData] = useState<DeploymentData>({ healthy: [], disabled: [] })
  const [loadingTargets, setLoadingTargets] = useState(false)

  useEffect(() => {
    setLoadingTargets(true)
    getMachines({ pageSize: 1000, spaceId: space.id })
      .then((res) => {
        const healthy: DeploymentTarget[] = []
        const disabled: DeploymentTarget[] = []
        res.machines.forEach((m) => {
          const target = mapMachineToTarget(m)
          if (m.isDisabled) disabled.push(target)
          else healthy.push(target)
        })
        setDeploymentData({ healthy, disabled })
      })
      .catch(() => {})
      .finally(() => setLoadingTargets(false))
  }, [])

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

  const closeModal = () => {
    setShowAddModal(false)
    setAgentFormView(null)
  }

  // Filter options
  const filterOptions = {
    environments: ['DEV', 'TEST', 'UAT', 'PRD', 'STAGE', 'QA'],
    tags: ['aws-eks', 'aws-eks-us', 'SJUSAKS', 'Aliyun-HK-AI', 'DotnetCore', 'protonk8s'],
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
  const filteredHealthy = deploymentData.healthy.filter((t) =>
    t.name.toLowerCase().includes(searchText.toLowerCase()) ||
    t.type.toLowerCase().includes(searchText.toLowerCase())
  )
  const filteredDisabled = deploymentData.disabled.filter((t) =>
    t.name.toLowerCase().includes(searchText.toLowerCase()) ||
    t.type.toLowerCase().includes(searchText.toLowerCase())
  )
  const displayHealthy = disabledOnly ? [] : filteredHealthy
  const displayDisabled = filteredDisabled
  const total = displayHealthy.length + displayDisabled.length

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

  const renderMachineRow = (target: DeploymentTarget, isDisabled: boolean, isLast: boolean) => {
    const isExpanded = expandedTargets.has(target.id)
    const visibleTags = isExpanded ? target.tags : target.tags.slice(0, 2)
    const hasMore = target.tags.length > 2

    return (
      <li
        key={target.id}
        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isLast ? '' : 'border-b border-gray-100'}`}
      >
        {/* Machine type icon */}
        <MachineTypeIcon machineType={target.type} isDisabled={isDisabled} />

        {/* Name / type / URL */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 leading-snug">{target.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{target.type}</div>
          {target.url && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">{target.url}</div>
          )}
        </div>

        {/* Health icon */}
        <div className="flex-shrink-0">
          {isDisabled ? <DisabledIcon size={16} /> : <HealthyIcon size={16} />}
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap" style={{ maxWidth: 380 }}>
          {target.environments > 0 && (
            <MachineChip
              icon={<EnvChipIcon />}
              label={target.environments === 1 && target.environmentList?.[0]
                ? target.environmentList[0]
                : `${target.environments} environments`}
            />
          )}

          {visibleTags.map((tag, idx) => (
            <MachineChip key={idx} icon={<RoleChipIcon />} label={tag} />
          ))}

          {hasMore && (
            <button
              onClick={() => toggleExpand(target.id)}
              className="text-xs text-gray-600 hover:underline bg-transparent border-0 cursor-pointer px-1 whitespace-nowrap"
            >
              {isExpanded ? 'Show summary' : 'Show all'}
            </button>
          )}
        </div>
      </li>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white min-h-screen">
      {/* Page header */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Deployment Targets</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="!bg-green-700 hover:!bg-green-800 !border-green-700"
            onClick={() => setShowAddModal(true)}
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
        <div className="flex-1 px-8 pb-8">
          <Spin spinning={loadingTargets}>
            <div className="border border-gray-200 rounded-md overflow-hidden bg-white">

              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <DeploymentTargetsSvg />
                  <span className="text-sm font-semibold text-gray-800">Deployment targets</span>
                  <span className="text-sm text-gray-500">({total})</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded bg-transparent border-0 cursor-pointer transition-colors">
                    <HealthyIcon size={14} />
                    {displayHealthy.length} healthy
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded bg-transparent border-0 cursor-pointer transition-colors">
                    <DisabledIcon size={14} />
                    {displayDisabled.length} disabled
                  </button>
                  <Button size="small" type="text" icon={<MoreOutlined />} />
                </div>
              </div>

              {/* Healthy section */}
              {displayHealthy.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <HealthyIcon size={14} />
                    <span className="text-xs font-medium text-gray-700">Healthy</span>
                    <span className="text-xs text-gray-500">({displayHealthy.length})</span>
                  </div>
                  <ul className="list-none m-0 p-0">
                    {displayHealthy.map((t, i) =>
                      renderMachineRow(t, false, i === displayHealthy.length - 1 && displayDisabled.length === 0)
                    )}
                  </ul>
                </>
              )}

              {/* Disabled section */}
              {displayDisabled.length > 0 && (
                <>
                  <div className={`flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 ${displayHealthy.length > 0 ? 'border-t border-gray-200' : ''}`}>
                    <DisabledIcon size={14} />
                    <span className="text-xs font-medium text-gray-700">Disabled</span>
                    <span className="text-xs text-gray-500">({displayDisabled.length})</span>
                  </div>
                  <ul className="list-none m-0 p-0">
                    {displayDisabled.map((t, i) =>
                      renderMachineRow(t, true, i === displayDisabled.length - 1)
                    )}
                  </ul>
                </>
              )}

              {/* Empty state */}
              {total === 0 && !loadingTargets && (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                  No deployment targets found.
                </div>
              )}
            </div>
          </Spin>
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
        width={agentFormView ? 900 : 1000}
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
          <div className="flex" style={{ height: 620 }}>

            {/* Left: form */}
            <div className="flex flex-col flex-1 min-w-0" style={{ borderRadius: '4px 0 0 4px' }}>
              <div className="flex-1 overflow-y-auto px-8 pt-7 pb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Add New Kubernetes Agent</h2>

                <FormField
                  label="Name"
                  helper="You can use the same name as your Kubernetes cluster"
                  value={agentName}
                  onChange={setAgentName}
                />

                <MultiSelectField
                  label="Environments"
                  helper="Select at least one environment"
                  options={mockEnvironmentOptions}
                  value={agentEnvironments}
                  onChange={setAgentEnvironments}
                />

                <MultiSelectField
                  label="Target tags"
                  helper="Add at least one target tag"
                  options={[
                    { value: 'aws-eks', label: 'aws-eks' },
                    { value: 'k8s', label: 'k8s' },
                    { value: 'linux', label: 'linux' },
                  ]}
                  value={agentTags}
                  onChange={setAgentTags}
                />

                <button
                  onClick={() => setShowOptional(!showOptional)}
                  className="text-sm text-squid-blue hover:underline bg-transparent border-0 cursor-pointer p-0 mb-5"
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
                      label="Octopus Deploy Server URL"
                      helper="Provide the full URL to your Octopus Deploy instance."
                      value={agentServerUrl}
                      onChange={setAgentServerUrl}
                    />
                    <FormField
                      label="Octopus Deploy Server Communications URL"
                      helper="The URL of the Octopus Server that the Agent will poll for work."
                      value={agentCommsUrl}
                      onChange={setAgentCommsUrl}
                    />
                  </>
                )}
              </div>

              {/* Footer buttons */}
              <div className="border-t border-gray-200 px-8 py-4 flex justify-end gap-3 flex-shrink-0">
                <Button onClick={() => setAgentFormView(null)}>Cancel</Button>
                <Button type="primary" className="!bg-green-700 hover:!bg-green-800 !border-green-700">
                  Next
                </Button>
              </div>
            </div>

            {/* Right: help panel */}
            {helpPanelVisible ? (
              <div
                className="flex flex-col border-l border-gray-200 bg-gray-50 flex-shrink-0"
                style={{ width: 300, borderRadius: '0 4px 4px 0' }}
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
                  <h2 className="text-base font-semibold text-gray-900 mb-3">
                    Connect seamlessly to Kubernetes
                  </h2>
                  <p className="text-sm text-gray-600 mb-3">
                    Installing the Kubernetes agent in your cluster eliminates the need for firewall adjustments or extra authentication.
                  </p>
                  <p className="text-sm text-gray-600">
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
    </div>
  )
}

export default DeploymentTargets
