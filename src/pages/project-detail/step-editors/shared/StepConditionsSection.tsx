import React, { useEffect, useMemo, useState } from 'react'
import { Checkbox, Input, Radio, Select, Spin } from 'antd'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { CollapsibleSection } from './CollapsibleSection'

export type StepEnvironmentMode = 'all' | 'include' | 'exclude'

export interface StepConditionsValue {
  environmentMode: StepEnvironmentMode
  environmentIds: number[]
  channelIds: number[]
  runCondition: string
  conditionExpression: string
  packageRequirement: string
  required: boolean
  disabled: boolean
}

interface StepConditionsSectionProps {
  value: StepConditionsValue
  onChange: (next: StepConditionsValue) => void
  projectId?: number | null
  requiredLocked?: boolean
  requiredLockedReason?: React.ReactNode
  afterRunCondition?: React.ReactNode
  hideRootSection?: boolean
}

const RUN_CONDITION_OPTIONS = [
  {
    value: 'Success',
    label: 'Success: only run when previous steps succeed (or is first step)',
  },
  {
    value: 'Always',
    label: 'Always run',
  },
  {
    value: 'Variable',
    label: 'Variable: only run when the variable expression is true',
  },
  {
    value: 'Failure',
    label: 'Failure: only run when a previous step fails',
  },
]

const PACKAGE_REQUIREMENT_OPTIONS = [
  { value: 'LetSquidDecide', label: 'Let Squid decide (default)' },
  { value: 'BeforePackageAcquisition', label: 'Before package acquisition' },
  { value: 'AfterPackageAcquisition', label: 'After package acquisition' },
]

function normalizeRequirement(value: string): string {
  if (!value) return 'LetSquidDecide'
  const matched = PACKAGE_REQUIREMENT_OPTIONS.find((item) => item.value === value)
  return matched?.value ?? value
}

export function StepConditionsSection({
  value,
  onChange,
  projectId,
  requiredLocked = false,
  requiredLockedReason,
  afterRunCondition,
  hideRootSection = false,
}: StepConditionsSectionProps) {
  const [loading, setLoading] = useState(false)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [channels, setChannels] = useState<ChannelDto[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const [envRes, channelRes] = await Promise.all([
          getEnvironments({ pageSize: 1000 }).catch(() => null),
          projectId ? getChannels({ projectId, pageSize: 1000 }).catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return

        setEnvironments([...(envRes?.environments ?? [])].sort((a, b) => a.sortOrder - b.sortOrder))
        setChannels([...(channelRes?.channels ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  const environmentOptions = useMemo(
    () => environments.map((env) => ({ label: env.name, value: env.id })),
    [environments],
  )

  const channelOptions = useMemo(
    () => channels.map((channel) => ({ label: channel.name, value: channel.id })),
    [channels],
  )

  const showEnvironmentPicker = value.environmentMode === 'include' || value.environmentMode === 'exclude'

  const body = (
    <>
      <CollapsibleSection title="Environments" subtitle="Choose which environments this step applies to." defaultOpen>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spin size="small" />
            <span>Loading environments...</span>
          </div>
        ) : (
          <>
            <Radio.Group
              value={value.environmentMode}
              onChange={(event) => {
                const mode = event.target.value as StepEnvironmentMode
                if (mode === 'all') {
                  onChange({ ...value, environmentMode: mode, environmentIds: [] })
                  return
                }
                onChange({ ...value, environmentMode: mode })
              }}
              className="flex flex-col gap-2"
            >
              <Radio value="all">
                <span className="text-sm">Run for any environment (default)</span>
              </Radio>
              <Radio value="include">
                <span className="text-sm">Run only for specific environments</span>
              </Radio>
              {value.environmentMode === 'include' ? (
                <Select
                  mode="multiple"
                  value={value.environmentIds}
                  options={environmentOptions}
                  onChange={(ids) => onChange({ ...value, environmentIds: (ids as number[]).map(Number) })}
                  placeholder="Select environments"
                  size="small"
                  className="w-full mt-2"
                />
              ) : null}
              <Radio value="exclude">
                <span className="text-sm">Skip specific environments</span>
              </Radio>
              {value.environmentMode === 'exclude' ? (
                <Select
                  mode="multiple"
                  value={value.environmentIds}
                  options={environmentOptions}
                  onChange={(ids) => onChange({ ...value, environmentIds: (ids as number[]).map(Number) })}
                  placeholder="Select environments to skip"
                  size="small"
                  className="w-full mt-2"
                />
              ) : null}
            </Radio.Group>
            {showEnvironmentPicker ? (
              <p className="text-xs text-slate-500 m-0">
                Choose the specific environments under which you want this step to run.
              </p>
            ) : null}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Channels" subtitle="Choose which channels this step applies to." defaultOpen>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spin size="small" />
            <span>Loading channels...</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 m-0">
              If nothing is selected this step will run for releases in any channel, otherwise it will only run for releases belonging to the selected channels.
            </p>
            <Select
              mode="multiple"
              value={value.channelIds}
              options={channelOptions}
              onChange={(ids) => onChange({ ...value, channelIds: (ids as number[]).map(Number) })}
              placeholder="Select channels"
              size="small"
              className="w-full"
            />
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Run Condition" subtitle="Limit when this step runs by setting a condition." defaultOpen>
        <Radio.Group
          value={value.runCondition}
          onChange={(event) => onChange({ ...value, runCondition: event.target.value })}
          className="flex flex-col gap-2"
        >
          {RUN_CONDITION_OPTIONS.map((option) => (
            <Radio key={option.value} value={option.value}>
              <span className="text-sm">{option.label}</span>
            </Radio>
          ))}
        </Radio.Group>
        {value.runCondition === 'Variable' ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">Variable expression</label>
            <Input
              value={value.conditionExpression}
              onChange={(event) => onChange({ ...value, conditionExpression: event.target.value })}
              placeholder="#{IsProduction}"
              size="small"
            />
          </div>
        ) : null}
      </CollapsibleSection>

      {afterRunCondition}

      <CollapsibleSection title="Package Requirement" subtitle="Configure package acquisition behavior for this step." defaultOpen={false}>
        <Select
          value={normalizeRequirement(value.packageRequirement)}
          options={PACKAGE_REQUIREMENT_OPTIONS}
          onChange={(next) => onChange({ ...value, packageRequirement: String(next) })}
          size="small"
          className="w-full"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Required" subtitle="Required steps cannot be skipped when deploying a release." defaultOpen>
        {requiredLockedReason ? (
          <p className="text-xs text-slate-500 m-0">{requiredLockedReason}</p>
        ) : null}
        <Checkbox
          checked={requiredLocked ? true : value.required}
          disabled={requiredLocked}
          onChange={(event) => onChange({ ...value, required: event.target.checked })}
        >
          <span className="text-sm">Prevent this step from being skipped when deploying</span>
        </Checkbox>
      </CollapsibleSection>

      <CollapsibleSection title="Disabled" subtitle="Disabled steps are skipped during deployment." defaultOpen>
        <Checkbox
          checked={value.disabled}
          onChange={(event) => onChange({ ...value, disabled: event.target.checked })}
        >
          <span className="text-sm">Disable this step</span>
        </Checkbox>
      </CollapsibleSection>
    </>
  )

  if (hideRootSection) return body

  return (
    <CollapsibleSection
      title="Conditions"
      subtitle="Configure when and where this step should run."
      defaultOpen
      fullWidth
    >
      {body}
    </CollapsibleSection>
  )
}
