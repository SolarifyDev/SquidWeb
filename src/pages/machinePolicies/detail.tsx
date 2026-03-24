import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, InputNumber, Modal, Radio, Spin, Tag, message } from 'antd'
import { ArrowLeftOutlined, DownOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { MachineDto } from 'pages/apis/machine'
import { getMachines } from 'pages/apis/machine'
import {
  AgentUpdateBehavior,
  CalamariUpdateBehavior,
  DeleteMachinesBehavior,
  HealthCheckScheduleType,
  MachineConnectivityBehavior,
  MachinePolicyDto,
  PolicyHealthCheckType,
  ScriptPolicyDto,
  ScriptPolicyRunType,
  deleteMachinePolicy,
  getMachinePolicy,
  saveMachinePolicy,
} from 'pages/apis/machinePolicy'
import { useSpace } from 'contexts/SpaceContext'

type DurationField = 'days' | 'hours' | 'minutes' | 'seconds'

interface DurationParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface DurationEditorProps {
  valueSeconds?: number | null
  fields: DurationField[]
  onChange: (value: number) => void
}

interface FormSectionCardProps {
  title: string
  subtitle?: React.ReactNode
  subtitlePlaceholder?: boolean
  expanded: boolean
  onToggle: () => void
  hasBorder?: boolean
  children: React.ReactNode
}

const HEALTH_CHECK_TYPE_OPTIONS: PolicyHealthCheckType[] = ['RunScript', 'OnlyConnectivity']
const RUN_TYPE_OPTIONS: ScriptPolicyRunType[] = ['InheritFromDefault', 'CustomScript']
const CONNECTIVITY_BEHAVIOR_OPTIONS: MachineConnectivityBehavior[] = ['ExpectedToBeOnline', 'MayBeOfflineAndCanBeSkipped']
const DELETE_BEHAVIOR_OPTIONS: DeleteMachinesBehavior[] = ['DoNotDelete', 'DeleteUnavailableMachines']
const CALAMARI_UPDATE_OPTIONS: CalamariUpdateBehavior[] = ['UpdateOnDeployment', 'UpdateOnNewMachine', 'UpdateAlways']
const AGENT_UPDATE_OPTIONS: AgentUpdateBehavior[] = ['NeverUpdate', 'Update']

function clampNonNegativeInt(value: number | null | undefined, fallback: number = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

function splitDuration(totalSeconds: number | null | undefined, includeDays: boolean): DurationParts {
  const safeSeconds = clampNonNegativeInt(totalSeconds, 0)
  let remainder = safeSeconds
  const days = includeDays ? Math.floor(remainder / 86400) : 0
  if (includeDays) remainder -= days * 86400
  const hours = Math.floor(remainder / 3600)
  remainder -= hours * 3600
  const minutes = Math.floor(remainder / 60)
  const seconds = remainder - minutes * 60
  return { days, hours, minutes, seconds }
}

function composeDuration(parts: DurationParts, includeDays: boolean, includeSeconds: boolean): number {
  const days = includeDays ? clampNonNegativeInt(parts.days) : 0
  const hours = Math.min(23, clampNonNegativeInt(parts.hours))
  const minutes = Math.min(59, clampNonNegativeInt(parts.minutes))
  const seconds = includeSeconds ? Math.min(59, clampNonNegativeInt(parts.seconds)) : 0
  return days * 86400 + hours * 3600 + minutes * 60 + seconds
}

function fieldLabel(field: DurationField): string {
  switch (field) {
    case 'days':
      return 'Days'
    case 'hours':
      return 'Hours'
    case 'minutes':
      return 'Minutes'
    case 'seconds':
      return 'Seconds'
    default:
      return field
  }
}

function fieldMax(field: DurationField): number {
  switch (field) {
    case 'days':
      return 3650
    case 'hours':
      return 23
    case 'minutes':
    case 'seconds':
      return 59
    default:
      return 9999
  }
}

function fieldWidthClass(field: DurationField): string {
  if (field === 'days') return 'w-[92px]'
  return 'w-[80px]'
}

function createDefaultMachinePolicy(spaceId: number): MachinePolicyDto {
  return {
    id: 0,
    spaceId,
    name: '',
    description: '',
    isDefault: false,
    machineHealthCheckPolicy: {
      healthCheckScheduleType: 'Interval',
      healthCheckIntervalSeconds: 3600,
      healthCheckCronExpression: null,
      healthCheckType: 'RunScript',
      scriptPolicies: {
        Bash: {
          runType: 'InheritFromDefault',
          scriptBody: null,
        },
        PowerShell: {
          runType: 'InheritFromDefault',
          scriptBody: null,
        },
      },
    },
    machineConnectivityPolicy: {
      machineConnectivityBehavior: 'ExpectedToBeOnline',
      connectTimeoutSeconds: 60,
      retryAttempts: 5,
      retryWaitIntervalSeconds: 1,
      retryTimeLimitSeconds: 300,
      pollingRequestQueueTimeoutSeconds: 600,
    },
    machineCleanupPolicy: {
      deleteMachinesBehavior: 'DoNotDelete',
      deleteMachinesAfterSeconds: 86400,
    },
    machineUpdatePolicy: {
      calamariUpdateBehavior: 'UpdateOnDeployment',
      tentacleUpdateBehavior: 'NeverUpdate',
      kubernetesAgentUpdateBehavior: 'NeverUpdate',
      tentacleUpdateAccountId: null,
    },
    machineRpcCallRetryPolicy: {
      enabled: true,
      deploymentRetryDurationSeconds: 150,
      healthCheckRetryDurationSeconds: 150,
    },
  }
}

function normalizePolicy(policy: MachinePolicyDto, spaceId: number): MachinePolicyDto {
  const fallback = createDefaultMachinePolicy(spaceId)
  return {
    ...fallback,
    ...policy,
    spaceId,
    machineHealthCheckPolicy: {
      ...fallback.machineHealthCheckPolicy,
      ...(policy.machineHealthCheckPolicy ?? {}),
      scriptPolicies: {
        ...fallback.machineHealthCheckPolicy.scriptPolicies,
        ...(policy.machineHealthCheckPolicy?.scriptPolicies ?? {}),
      },
    },
    machineConnectivityPolicy: {
      ...fallback.machineConnectivityPolicy,
      ...(policy.machineConnectivityPolicy ?? {}),
    },
    machineCleanupPolicy: {
      ...fallback.machineCleanupPolicy,
      ...(policy.machineCleanupPolicy ?? {}),
    },
    machineUpdatePolicy: {
      ...fallback.machineUpdatePolicy,
      ...(policy.machineUpdatePolicy ?? {}),
    },
    machineRpcCallRetryPolicy: {
      ...fallback.machineRpcCallRetryPolicy,
      ...(policy.machineRpcCallRetryPolicy ?? {}),
    },
  }
}

function parseMachinePolicyId(raw?: string): number | null {
  if (!raw || raw.toLowerCase() === 'new') return null
  if (/^\d+$/.test(raw)) return Number(raw)
  const matched = raw.match(/(\d+)$/)
  if (!matched) return null
  const parsed = Number(matched[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getScriptPolicy(policy: MachinePolicyDto, syntax: 'Bash' | 'PowerShell'): ScriptPolicyDto {
  return policy.machineHealthCheckPolicy.scriptPolicies?.[syntax] ?? {
    runType: 'InheritFromDefault',
    scriptBody: null,
  }
}

const DurationEditor: React.FC<DurationEditorProps> = ({ valueSeconds, fields, onChange }) => {
  const includeDays = fields.includes('days')
  const includeSeconds = fields.includes('seconds')
  const parts = useMemo(() => splitDuration(valueSeconds, includeDays), [valueSeconds, includeDays])

  const updateField = (field: DurationField, value: number | null) => {
    const nextParts: DurationParts = { ...parts, [field]: clampNonNegativeInt(value, 0) }
    onChange(composeDuration(nextParts, includeDays, includeSeconds))
  }

  const getValueByField = (field: DurationField): number => {
    if (field === 'days') return parts.days
    if (field === 'hours') return parts.hours
    if (field === 'minutes') return parts.minutes
    return parts.seconds
  }

  return (
    <div className="flex flex-wrap gap-3">
      {fields.map((field) => (
        <div key={field} className={fieldWidthClass(field)}>
          <label className="block text-sm text-gray-600 mb-1">{fieldLabel(field)}</label>
          <InputNumber
            className="w-full"
            min={0}
            max={fieldMax(field)}
            value={getValueByField(field)}
            onChange={(value) => updateField(field, value)}
          />
        </div>
      ))}
    </div>
  )
}

const FormSectionCard: React.FC<FormSectionCardProps> = ({
  title,
  subtitle,
  subtitlePlaceholder = false,
  expanded,
  onToggle,
  hasBorder = true,
  children,
}) => (
  <div className={hasBorder ? 'border-b border-gray-200' : ''}>
    <div
      className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
      style={{ gridTemplateColumns: '260px 1fr auto' }}
      onClick={onToggle}
    >
      <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
      <div className={subtitlePlaceholder ? 'text-sm text-gray-400 pt-0.5' : 'text-sm text-gray-500 pt-0.5'}>{subtitle}</div>
      <button
        type="button"
        aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <DownOutlined className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
      </button>
    </div>
    {expanded && (
      <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div />
        <div>{children}</div>
      </div>
    )}
  </div>
)

const MachinePolicyDetail: React.FC = () => {
  const navigate = useNavigate()
  const { policyId } = useParams<{ policyId: string }>()
  const { space } = useSpace()
  const policiesBasePath = `/${space.slug}/infrastructure/machinepolicies`

  const parsedPolicyId = useMemo(() => parseMachinePolicyId(policyId), [policyId])
  const isCreate = parsedPolicyId == null

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'usage'>('details')
  const [draft, setDraft] = useState<MachinePolicyDto>(createDefaultMachinePolicy(space.id))
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageMachines, setUsageMachines] = useState<MachineDto[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    name: true,
    description: true,
    scheduleType: true,
    timeBetweenChecks: true,
    healthCheckType: true,
    powershellScript: true,
    bashScript: true,
    machineConnectivity: true,
    connectTimeout: true,
    retryAttempts: true,
    retryWaitInterval: true,
    retryTimeLimit: true,
    pollingTimeout: true,
    calamariUpdates: true,
    tentacleUpdates: true,
    tentacleUpdateAccount: true,
    kubernetesUpdates: true,
    rpcManage: true,
    rpcDeploymentRetry: true,
    rpcHealthRetry: true,
    cleanupBehavior: true,
    cleanupAfter: true,
  })

  useEffect(() => {
    let mounted = true
    if (isCreate) {
      setDraft(createDefaultMachinePolicy(space.id))
      return () => {
        mounted = false
      }
    }

    setLoading(true)
    getMachinePolicy(parsedPolicyId)
      .then((policy) => {
        if (!mounted) return
        setDraft(normalizePolicy(policy, space.id))
      })
      .catch(() => {
        if (!mounted) return
        message.error('Failed to load machine policy')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [isCreate, parsedPolicyId, space.id])

  useEffect(() => {
    if (activeTab !== 'usage' || isCreate) return
    const currentPolicyId = draft.id ?? parsedPolicyId
    if (!currentPolicyId) return
    let mounted = true
    setUsageLoading(true)
    getMachines({ pageIndex: 1, pageSize: 1000, spaceId: space.id })
      .then((response) => {
        if (!mounted) return
        const filtered = (response.machines ?? [])
          .filter((machine) => machine.machinePolicyId === currentPolicyId)
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
        setUsageMachines(filtered)
      })
      .catch(() => {
        if (!mounted) return
        setUsageMachines([])
        message.error('Failed to load machine policy usage')
      })
      .finally(() => {
        if (mounted) setUsageLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [activeTab, draft.id, isCreate, parsedPolicyId, space.id])

  const toggleCard = (key: string) => {
    setExpandedCards((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  const setScriptRunType = (syntax: 'Bash' | 'PowerShell', runType: ScriptPolicyRunType) => {
    setDraft((previous) => {
      const existing = getScriptPolicy(previous, syntax)
      return {
        ...previous,
        machineHealthCheckPolicy: {
          ...previous.machineHealthCheckPolicy,
          scriptPolicies: {
            ...(previous.machineHealthCheckPolicy.scriptPolicies ?? {}),
            [syntax]: {
              ...existing,
              runType,
              scriptBody: runType === 'CustomScript' ? (existing.scriptBody ?? '') : null,
            },
          },
        },
      }
    })
  }

  const setScriptBody = (syntax: 'Bash' | 'PowerShell', scriptBody: string) => {
    setDraft((previous) => {
      const existing = getScriptPolicy(previous, syntax)
      return {
        ...previous,
        machineHealthCheckPolicy: {
          ...previous.machineHealthCheckPolicy,
          scriptPolicies: {
            ...(previous.machineHealthCheckPolicy.scriptPolicies ?? {}),
            [syntax]: {
              ...existing,
              scriptBody,
            },
          },
        },
      }
    })
  }

  const handleSave = async () => {
    const name = draft.name.trim()
    if (!name) {
      message.warning('Policy name is required')
      return
    }

    const payload: MachinePolicyDto = {
      ...draft,
      id: isCreate ? 0 : (draft.id ?? parsedPolicyId ?? 0),
      spaceId: space.id,
      name,
      description: draft.description?.trim() || '',
    }

    setSaving(true)
    try {
      const saved = await saveMachinePolicy({ machinePolicy: payload })
      message.success(isCreate ? 'Machine policy created' : 'Machine policy updated')
      if (isCreate) {
        navigate(`${policiesBasePath}/MachinePolicies-${saved.id}`)
        return
      }
      setDraft(normalizePolicy(saved, space.id))
    } catch (error: any) {
      const apiMessage = error?.response?.data?.msg ?? error?.message
      message.error(apiMessage || 'Failed to save machine policy')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!draft.id || draft.isDefault) return

    setDeleting(true)
    try {
      await deleteMachinePolicy({ id: draft.id, spaceId: space.id })
      message.success('Machine policy deleted')
      navigate(policiesBasePath)
    } catch (error: any) {
      const apiMessage = error?.response?.data?.msg ?? error?.message
      message.error(apiMessage || 'Failed to delete machine policy')
    } finally {
      setDeleting(false)
    }
  }

  const bashPolicy = getScriptPolicy(draft, 'Bash')
  const powershellPolicy = getScriptPolicy(draft, 'PowerShell')
  const allExpanded = Object.values(expandedCards).every(Boolean)

  const detailContent = (
    <>
      <FormSectionCard
        title="Name"
        subtitle="A short, memorable, unique name for this machine policy."
        expanded={expandedCards.name}
        onToggle={() => toggleCard('name')}
      >
        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <Input value={draft.name} onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))} placeholder="Machine policy name" />
      </FormSectionCard>

      <FormSectionCard
        title="Description"
        subtitle="This summary will appear on the machine policy overview page."
        subtitlePlaceholder={!(draft.description ?? '').trim()}
        expanded={expandedCards.description}
        onToggle={() => toggleCard('description')}
      >
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <Input.TextArea rows={4} value={draft.description ?? ''} onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))} />
        <Button type="link" className="!px-0 !mt-1">
          Show markdown controls
        </Button>
      </FormSectionCard>

      <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">Health Checks</div>

      <FormSectionCard
        title="Schedule Type"
        subtitle="Select the schedule that the health check should run on."
        expanded={expandedCards.scheduleType}
        onToggle={() => toggleCard('scheduleType')}
      >
        <Radio.Group
          value={draft.machineHealthCheckPolicy.healthCheckScheduleType}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineHealthCheckPolicy: {
                ...previous.machineHealthCheckPolicy,
                healthCheckScheduleType: event.target.value as HealthCheckScheduleType,
              },
            }))
          }}
        >
          <div className="space-y-3">
            <div>
              <Radio value="Never">Never</Radio>
              <div className="text-sm text-gray-500 ml-6 mt-1">No automatic health checks will be performed.</div>
            </div>
            <div>
              <Radio value="Interval">Interval</Radio>
              <div className="text-sm text-gray-500 ml-6 mt-1">Automatic health checks will be scheduled a set duration apart.</div>
            </div>
            <div>
              <Radio value="Cron">Cron expression</Radio>
              <div className="text-sm text-gray-500 ml-6 mt-1">Automatic health checks will run on a cron expression schedule.</div>
            </div>
          </div>
        </Radio.Group>

        {draft.machineHealthCheckPolicy.healthCheckScheduleType === 'Cron' ? (
          <div className="mt-4 max-w-[420px]">
            <label className="block text-sm text-gray-600 mb-1">Cron Expression</label>
            <Input
              value={draft.machineHealthCheckPolicy.healthCheckCronExpression ?? ''}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  machineHealthCheckPolicy: {
                    ...previous.machineHealthCheckPolicy,
                    healthCheckCronExpression: event.target.value,
                  },
                }))
              }}
              placeholder="0 */6 * * *"
            />
          </div>
        ) : null}
      </FormSectionCard>

      {draft.machineHealthCheckPolicy.healthCheckScheduleType === 'Interval' ? (
        <FormSectionCard
          title="Time Between Checks"
          subtitle="Select the time between automatic health checks."
          expanded={expandedCards.timeBetweenChecks}
          onToggle={() => toggleCard('timeBetweenChecks')}
        >
          <DurationEditor
            fields={['days', 'hours', 'minutes']}
            valueSeconds={draft.machineHealthCheckPolicy.healthCheckIntervalSeconds}
            onChange={(value) => {
              setDraft((previous) => ({
                ...previous,
                machineHealthCheckPolicy: {
                  ...previous.machineHealthCheckPolicy,
                  healthCheckIntervalSeconds: value,
                },
              }))
            }}
          />
        </FormSectionCard>
      ) : null}

      <FormSectionCard
        title="Health Check Type"
        subtitle="Select the type of health check to perform."
        expanded={expandedCards.healthCheckType}
        onToggle={() => toggleCard('healthCheckType')}
      >
        <Radio.Group
          value={draft.machineHealthCheckPolicy.healthCheckType}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineHealthCheckPolicy: {
                ...previous.machineHealthCheckPolicy,
                healthCheckType: event.target.value as PolicyHealthCheckType,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {HEALTH_CHECK_TYPE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>
                  {option === 'RunScript' ? 'Run health check scripts (default)' : 'Only perform connection test'}
                </Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      <FormSectionCard
        title="PowerShell Script Policy"
        subtitle="Select the script policy for endpoints running PowerShell."
        expanded={expandedCards.powershellScript}
        onToggle={() => toggleCard('powershellScript')}
      >
        <Radio.Group value={powershellPolicy.runType} onChange={(event) => setScriptRunType('PowerShell', event.target.value as ScriptPolicyRunType)}>
          <div className="space-y-2 mb-3">
            {RUN_TYPE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>{option === 'InheritFromDefault' ? 'Inherit from default machine policy' : 'Use custom script'}</Radio>
              </div>
            ))}
          </div>
        </Radio.Group>

        {powershellPolicy.runType === 'CustomScript' ? (
          <>
            <div className="flex gap-2 mb-2">
              <Button type="text" className="!px-1">Copy to clipboard</Button>
              <Button type="text" className="!px-1">Enter full screen</Button>
            </div>
            <Input.TextArea rows={8} value={powershellPolicy.scriptBody ?? ''} onChange={(event) => setScriptBody('PowerShell', event.target.value)} placeholder="Type PowerShell script..." />
          </>
        ) : null}
      </FormSectionCard>

      <FormSectionCard
        title="Bash Script Policy"
        subtitle="Select the script policy for endpoints running bash."
        expanded={expandedCards.bashScript}
        onToggle={() => toggleCard('bashScript')}
      >
        <Radio.Group value={bashPolicy.runType} onChange={(event) => setScriptRunType('Bash', event.target.value as ScriptPolicyRunType)}>
          <div className="space-y-2 mb-3">
            {RUN_TYPE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>{option === 'InheritFromDefault' ? 'Inherit from default machine policy' : 'Use custom script'}</Radio>
              </div>
            ))}
          </div>
        </Radio.Group>

        {bashPolicy.runType === 'CustomScript' ? (
          <>
            <div className="flex gap-2 mb-2">
              <Button type="text" className="!px-1">Copy to clipboard</Button>
              <Button type="text" className="!px-1">Enter full screen</Button>
            </div>
            <Input.TextArea rows={8} value={bashPolicy.scriptBody ?? ''} onChange={(event) => setScriptBody('Bash', event.target.value)} placeholder="Type shell script..." />
          </>
        ) : null}
      </FormSectionCard>

      <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">Machine Connectivity</div>

      <FormSectionCard
        title="During Health Checks"
        subtitle="Select the behavior for machine connectivity."
        expanded={expandedCards.machineConnectivity}
        onToggle={() => toggleCard('machineConnectivity')}
      >
        <Radio.Group
          value={draft.machineConnectivityPolicy.machineConnectivityBehavior}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                machineConnectivityBehavior: event.target.value as MachineConnectivityBehavior,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {CONNECTIVITY_BEHAVIOR_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>
                  {option === 'ExpectedToBeOnline'
                    ? 'Unavailable deployment targets cause health checks to fail'
                    : 'Unavailable deployment targets will not cause health checks to fail'}
                </Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      <FormSectionCard
        title="Connect Timeout"
        subtitle="The amount of time to wait for a listening Tentacle or SSH target to respond."
        expanded={expandedCards.connectTimeout}
        onToggle={() => toggleCard('connectTimeout')}
      >
        <DurationEditor
          fields={['hours', 'minutes', 'seconds']}
          valueSeconds={draft.machineConnectivityPolicy.connectTimeoutSeconds}
          onChange={(value) => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                connectTimeoutSeconds: value,
              },
            }))
          }}
        />
      </FormSectionCard>

      <FormSectionCard
        title="Retry Attempts"
        subtitle="The number of times the connection should be retried if it fails."
        expanded={expandedCards.retryAttempts}
        onToggle={() => toggleCard('retryAttempts')}
      >
        <div className="max-w-[240px]">
          <label className="block text-sm text-gray-600 mb-1">Retry Attempts</label>
          <InputNumber
            className="w-full"
            min={0}
            value={draft.machineConnectivityPolicy.retryAttempts}
            onChange={(value) => {
              setDraft((previous) => ({
                ...previous,
                machineConnectivityPolicy: {
                  ...previous.machineConnectivityPolicy,
                  retryAttempts: clampNonNegativeInt(value, 0),
                },
              }))
            }}
          />
        </div>
      </FormSectionCard>

      <FormSectionCard
        title="Retry Wait Interval"
        subtitle="The amount of time to wait between connection attempts."
        expanded={expandedCards.retryWaitInterval}
        onToggle={() => toggleCard('retryWaitInterval')}
      >
        <DurationEditor
          fields={['hours', 'minutes', 'seconds']}
          valueSeconds={draft.machineConnectivityPolicy.retryWaitIntervalSeconds}
          onChange={(value) => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                retryWaitIntervalSeconds: value,
              },
            }))
          }}
        />
      </FormSectionCard>

      <FormSectionCard
        title="Retry Time Limit"
        subtitle="Maximum time to keep retrying even if retry count was not reached."
        expanded={expandedCards.retryTimeLimit}
        onToggle={() => toggleCard('retryTimeLimit')}
      >
        <DurationEditor
          fields={['hours', 'minutes', 'seconds']}
          valueSeconds={draft.machineConnectivityPolicy.retryTimeLimitSeconds}
          onChange={(value) => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                retryTimeLimitSeconds: value,
              },
            }))
          }}
        />
      </FormSectionCard>

      <FormSectionCard
        title="Polling Request Queue Timeout"
        subtitle="How long the server waits for a polling Tentacle to collect its next request."
        expanded={expandedCards.pollingTimeout}
        onToggle={() => toggleCard('pollingTimeout')}
      >
        <DurationEditor
          fields={['hours', 'minutes', 'seconds']}
          valueSeconds={draft.machineConnectivityPolicy.pollingRequestQueueTimeoutSeconds}
          onChange={(value) => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                pollingRequestQueueTimeoutSeconds: value,
              },
            }))
          }}
        />
        <Button
          type="link"
          className="!px-0 !mt-1"
          onClick={() => {
            setDraft((previous) => ({
              ...previous,
              machineConnectivityPolicy: {
                ...previous.machineConnectivityPolicy,
                pollingRequestQueueTimeoutSeconds: 600,
              },
            }))
          }}
        >
          Reset to default timeout
        </Button>
      </FormSectionCard>

      <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">Machine Updates</div>

      <FormSectionCard
        title="Calamari"
        subtitle="Select the behavior for Calamari updates."
        expanded={expandedCards.calamariUpdates}
        onToggle={() => toggleCard('calamariUpdates')}
      >
        <Radio.Group
          value={draft.machineUpdatePolicy.calamariUpdateBehavior}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineUpdatePolicy: {
                ...previous.machineUpdatePolicy,
                calamariUpdateBehavior: event.target.value as CalamariUpdateBehavior,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {CALAMARI_UPDATE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>
                  {option === 'UpdateOnDeployment'
                    ? 'Automatically update on deployment (default)'
                    : option === 'UpdateOnNewMachine'
                      ? 'Automatically update first deployment to new machine, then on deployment'
                      : 'Always keep Calamari up to date'}
                </Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      <FormSectionCard
        title="Tentacle"
        subtitle="Select the behavior for Tentacle updates."
        expanded={expandedCards.tentacleUpdates}
        onToggle={() => toggleCard('tentacleUpdates')}
      >
        <Radio.Group
          value={draft.machineUpdatePolicy.tentacleUpdateBehavior}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineUpdatePolicy: {
                ...previous.machineUpdatePolicy,
                tentacleUpdateBehavior: event.target.value as AgentUpdateBehavior,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {AGENT_UPDATE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>{option === 'NeverUpdate' ? 'Manually - from Deployment Targets' : 'Automatically'}</Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      <FormSectionCard
        title="Tentacle Update Account"
        subtitle="Select the account ID to use for Tentacle updates."
        expanded={expandedCards.tentacleUpdateAccount}
        onToggle={() => toggleCard('tentacleUpdateAccount')}
      >
        <div className="max-w-[320px]">
          <label className="block text-sm text-gray-600 mb-1">Account ID</label>
          <InputNumber
            className="w-full"
            min={0}
            value={draft.machineUpdatePolicy.tentacleUpdateAccountId ?? null}
            onChange={(value) => {
              setDraft((previous) => ({
                ...previous,
                machineUpdatePolicy: {
                  ...previous.machineUpdatePolicy,
                  tentacleUpdateAccountId: value == null ? null : clampNonNegativeInt(value),
                },
              }))
            }}
          />
        </div>
        <div className="text-sm text-gray-500 mt-2">Only Username/Password accounts are valid for Tentacle update credentials.</div>
      </FormSectionCard>

      <FormSectionCard
        title="Kubernetes"
        subtitle="Select the behavior for Kubernetes agent updates."
        expanded={expandedCards.kubernetesUpdates}
        onToggle={() => toggleCard('kubernetesUpdates')}
      >
        <Radio.Group
          value={draft.machineUpdatePolicy.kubernetesAgentUpdateBehavior}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineUpdatePolicy: {
                ...previous.machineUpdatePolicy,
                kubernetesAgentUpdateBehavior: event.target.value as AgentUpdateBehavior,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {AGENT_UPDATE_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>{option === 'NeverUpdate' ? 'Manually' : 'Automatically'}</Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
        Recover from Communication Errors with Tentacle
      </div>

      <FormSectionCard
        title="Manage"
        subtitle="Allow Squid to re-attempt failed communications with Tentacle."
        expanded={expandedCards.rpcManage}
        onToggle={() => toggleCard('rpcManage')}
      >
        <Radio.Group
          value={draft.machineRpcCallRetryPolicy.enabled ? 'enabled' : 'disabled'}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineRpcCallRetryPolicy: {
                ...previous.machineRpcCallRetryPolicy,
                enabled: event.target.value === 'enabled',
              },
            }))
          }}
        >
          <div className="space-y-2 mb-3">
            <div><Radio value="disabled">Disabled</Radio></div>
            <div><Radio value="enabled">Enabled</Radio></div>
          </div>
        </Radio.Group>
        {draft.machineRpcCallRetryPolicy.enabled ? (
          <Alert
            type="info"
            showIcon
            message="When enabled, Squid will retry failed Tentacle communication for the configured duration below."
          />
        ) : null}
      </FormSectionCard>

      {draft.machineRpcCallRetryPolicy.enabled ? (
        <>
          <FormSectionCard
            title="During a Deployment or Runbook Run"
            subtitle="Maximum time to re-attempt failed communication with Tentacle."
            expanded={expandedCards.rpcDeploymentRetry}
            onToggle={() => toggleCard('rpcDeploymentRetry')}
          >
            <DurationEditor
              fields={['minutes', 'seconds']}
              valueSeconds={draft.machineRpcCallRetryPolicy.deploymentRetryDurationSeconds}
              onChange={(value) => {
                setDraft((previous) => ({
                  ...previous,
                  machineRpcCallRetryPolicy: {
                    ...previous.machineRpcCallRetryPolicy,
                    deploymentRetryDurationSeconds: value,
                  },
                }))
              }}
            />
          </FormSectionCard>

          <FormSectionCard
            title="During a Health Check"
            subtitle="Maximum time to re-attempt failed communication with Tentacle."
            expanded={expandedCards.rpcHealthRetry}
            onToggle={() => toggleCard('rpcHealthRetry')}
          >
            <DurationEditor
              fields={['minutes', 'seconds']}
              valueSeconds={draft.machineRpcCallRetryPolicy.healthCheckRetryDurationSeconds}
              onChange={(value) => {
                setDraft((previous) => ({
                  ...previous,
                  machineRpcCallRetryPolicy: {
                    ...previous.machineRpcCallRetryPolicy,
                    healthCheckRetryDurationSeconds: value,
                  },
                }))
              }}
            />
          </FormSectionCard>
        </>
      ) : null}

      <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
        Cleaning Up Unavailable Deployment Targets
      </div>

      <FormSectionCard
        title="Behavior"
        subtitle="Select how unavailable deployment targets should be handled."
        expanded={expandedCards.cleanupBehavior}
        onToggle={() => toggleCard('cleanupBehavior')}
      >
        <Radio.Group
          value={draft.machineCleanupPolicy.deleteMachinesBehavior}
          onChange={(event) => {
            setDraft((previous) => ({
              ...previous,
              machineCleanupPolicy: {
                ...previous.machineCleanupPolicy,
                deleteMachinesBehavior: event.target.value as DeleteMachinesBehavior,
              },
            }))
          }}
        >
          <div className="space-y-2">
            {DELETE_BEHAVIOR_OPTIONS.map((option) => (
              <div key={option}>
                <Radio value={option}>
                  {option === 'DoNotDelete'
                    ? 'Do not delete deployment targets automatically'
                    : 'Delete unavailable deployment targets automatically'}
                </Radio>
              </div>
            ))}
          </div>
        </Radio.Group>
      </FormSectionCard>

      {draft.machineCleanupPolicy.deleteMachinesBehavior === 'DeleteUnavailableMachines' ? (
        <FormSectionCard
          title="Delete Unavailable After"
          subtitle="Set how long a deployment target can stay unavailable before being deleted."
          expanded={expandedCards.cleanupAfter}
          onToggle={() => toggleCard('cleanupAfter')}
          hasBorder={false}
        >
          <DurationEditor
            fields={['days', 'hours', 'minutes']}
            valueSeconds={draft.machineCleanupPolicy.deleteMachinesAfterSeconds}
            onChange={(value) => {
              setDraft((previous) => ({
                ...previous,
                machineCleanupPolicy: {
                  ...previous.machineCleanupPolicy,
                  deleteMachinesAfterSeconds: value,
                },
              }))
            }}
          />
        </FormSectionCard>
      ) : (
        <div className="border-b border-gray-200" />
      )}
    </>
  )

  const usageContent = (
    <div className="px-6 py-8 text-sm text-gray-500">
      <Spin spinning={usageLoading}>
        {isCreate ? (
          <div>Create and save this machine policy first to see usage.</div>
        ) : usageMachines.length === 0 ? (
          <div>No deployment targets are currently using this machine policy.</div>
        ) : (
          <ul className="m-0 p-0 list-none space-y-2 text-gray-800">
            {usageMachines.map((machine) => (
              <li key={machine.id} className="flex items-center justify-between border border-gray-100 rounded px-3 py-2">
                <span className="text-sm text-gray-800">{machine.name}</span>
                <Button type="link" onClick={() => navigate(`/${space.slug}/deployment/targets/${machine.id}`)}>
                  Open target
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Spin>
    </div>
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-4 pb-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => navigate(policiesBasePath)}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer p-0 mb-2"
            >
              <ArrowLeftOutlined />
              <span>Machine Policies</span>
            </button>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-gray-900 m-0 flex items-center gap-2 flex-wrap">
                  <span className="break-all">{isCreate ? 'New Machine Policy' : draft.name || 'Machine Policy'}</span>
                  {draft.isDefault ? <Tag className="m-0 !rounded-full !border-gray-300 !bg-gray-100 !text-gray-700">default</Tag> : null}
                </h1>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isCreate && !draft.isDefault ? (
                  <Button
                    danger
                    loading={deleting}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Delete machine policy',
                        content: `Delete policy "${draft.name}"?`,
                        okText: 'Delete',
                        okButtonProps: { danger: true },
                        cancelText: 'Cancel',
                        onOk: handleDelete,
                      })
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
                <Button type="primary" loading={saving} className="!bg-green-700 hover:!bg-green-800 !border-green-700" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const next = !allExpanded
                  setExpandedCards({
                    name: next,
                    description: next,
                    scheduleType: next,
                    timeBetweenChecks: next,
                    healthCheckType: next,
                    powershellScript: next,
                    bashScript: next,
                    machineConnectivity: next,
                    connectTimeout: next,
                    retryAttempts: next,
                    retryWaitInterval: next,
                    retryTimeLimit: next,
                    pollingTimeout: next,
                    calamariUpdates: next,
                    tentacleUpdates: next,
                    tentacleUpdateAccount: next,
                    kubernetesUpdates: next,
                    rpcManage: next,
                    rpcDeploymentRetry: next,
                    rpcHealthRetry: next,
                    cleanupBehavior: next,
                    cleanupAfter: next,
                  })
                }}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <div className="px-6 pt-3 border-b border-gray-200">
            <div className="flex">
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-0 bg-transparent cursor-pointer ${
                  activeTab === 'details'
                    ? 'text-gray-900 border-b-2 border-squid-blue'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-0 bg-transparent cursor-pointer ${
                  activeTab === 'usage'
                    ? 'text-gray-900 border-b-2 border-squid-blue'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('usage')}
              >
                Usage
              </button>
            </div>
          </div>

          <div>
            <Spin spinning={loading}>
              {activeTab === 'details' ? detailContent : usageContent}
            </Spin>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MachinePolicyDetail
