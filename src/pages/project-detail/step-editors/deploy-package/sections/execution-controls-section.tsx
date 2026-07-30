import React from 'react'
import { Checkbox, Input, Radio } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { TargetTagSelect } from '../../shared/TargetTagSelect'
import type { StartTriggerMode } from '../deploy-package-model'

interface ExecutionControlsSectionProps {
  targetRoles: string[]
  startTrigger: StartTriggerMode
  retriesEnabled: boolean
  retryCount: number
  maxParallelism: number
  timeoutMinutes: number
  onTargetRolesChange: (value: string[]) => void
  onStartTriggerChange: (value: StartTriggerMode) => void
  onRetriesEnabledChange: (value: boolean) => void
  onRetryCountChange: (value: number) => void
  onMaxParallelismChange: (value: number) => void
  onTimeoutMinutesChange: (value: number) => void
  rollingDeploymentSlot: React.ReactNode
  startTriggerSlot: React.ReactNode
}

export function ExecutionLocationSection() {
  return (
    <CollapsibleSection title='Execution Location' subtitle='Where will Squid run this step?' defaultOpen fullWidth>
      <div className='ml-[216px] space-y-2'>
        <p className='m-0 text-sm text-slate-700'>This step will run on each deployment target</p>
        <p className='m-0 text-xs text-slate-500'>Execute on each deployment target with the selected target tags.</p>
      </div>
    </CollapsibleSection>
  )
}

export function TargetTagsSection({
  targetRoles,
  onTargetRolesChange,
}: {
  targetRoles: string[]
  onTargetRolesChange: (value: string[]) => void
}) {
  return (
    <CollapsibleSection
      title='Target Tags'
      subtitle='This step will deploy to deployment targets with any of these matching tags.'
      defaultOpen
    >
      <TargetTagSelect
        value={targetRoles}
        onChange={onTargetRolesChange}
        placeholder='Runs on targets with tags (type to add new)'
      />
      {targetRoles.length === 0 ? (
        <p className='mb-0 mt-2 text-xs text-slate-500'>You need at least one tag to select matching targets.</p>
      ) : null}
    </CollapsibleSection>
  )
}

export function RollingDeploymentControl({
  maxParallelism,
  onMaxParallelismChange,
}: {
  maxParallelism: number
  onMaxParallelismChange: (value: number) => void
}) {
  return (
    <CollapsibleSection
      title='Rolling Deployment'
      subtitle='Configure a rolling deployment to control the number of deployment targets this step can deploy to at once.'
      defaultOpen
    >
      <Checkbox
        checked={maxParallelism > 0}
        onChange={(event) => onMaxParallelismChange(event.target.checked ? Math.max(maxParallelism, 1) : 0)}
      >
        <span className='text-sm'>Configure a rolling deployment</span>
      </Checkbox>
      {maxParallelism > 0 ? (
        <div className='mt-2 max-w-[220px]'>
          <label className='mb-1 block text-xs font-medium text-slate-600'>Maximum parallel targets</label>
          <Input
            size='small'
            type='number'
            min={1}
            value={String(maxParallelism)}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10)
              if (!Number.isFinite(parsed) || parsed < 1) {
                onMaxParallelismChange(1)
                return
              }
              onMaxParallelismChange(parsed)
            }}
          />
        </div>
      ) : null}
    </CollapsibleSection>
  )
}

export function StartTriggerControl({
  startTrigger,
  onStartTriggerChange,
}: {
  startTrigger: StartTriggerMode
  onStartTriggerChange: (value: StartTriggerMode) => void
}) {
  return (
    <CollapsibleSection
      title='Start Trigger'
      subtitle='Control whether this step waits for the previous step to complete, or runs in parallel with it.'
      defaultOpen
    >
      <Radio.Group
        value={startTrigger}
        onChange={(event) => onStartTriggerChange(event.target.value as StartTriggerMode)}
        className='flex flex-col gap-2'
      >
        <Radio value='StartWithPrevious'>
          <span className='text-sm'>Run in parallel with the previous step</span>
        </Radio>
        <Radio value='StartAfterPrevious'>
          <span className='text-sm'>Wait for all previous steps to complete, then start</span>
        </Radio>
      </Radio.Group>
    </CollapsibleSection>
  )
}

export function RetriesAndTimeoutSection({
  retriesEnabled,
  retryCount,
  timeoutMinutes,
  onRetriesEnabledChange,
  onRetryCountChange,
  onTimeoutMinutesChange,
}: Pick<
  ExecutionControlsSectionProps,
  | 'retriesEnabled'
  | 'retryCount'
  | 'timeoutMinutes'
  | 'onRetriesEnabledChange'
  | 'onRetryCountChange'
  | 'onTimeoutMinutesChange'
>) {
  return (
    <>
      <CollapsibleSection title='Retries' subtitle='Upon failure, this step will automatically retry' defaultOpen>
        <Checkbox checked={retriesEnabled} onChange={(event) => onRetriesEnabledChange(event.target.checked)}>
          <span className='text-sm'>Allow retries (max. 3)</span>
        </Checkbox>
        {retriesEnabled ? (
          <div className='max-w-[180px]'>
            <label className='mb-1 block text-xs font-medium text-slate-600'>Retries</label>
            <Input
              size='small'
              type='number'
              min={1}
              max={3}
              value={String(retryCount)}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10)
                if (!Number.isFinite(parsed)) {
                  onRetryCountChange(1)
                  return
                }
                onRetryCountChange(Math.min(Math.max(parsed, 1), 3))
              }}
            />
          </div>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        title='Time out'
        subtitle='If this step is still running after the set time has lapsed, we will assume the task is stuck and force failure. We recommend using this option in conjunction with retries where appropriate.'
        defaultOpen
      >
        <label className='mb-1 block text-xs font-medium text-slate-600'>
          Time out after minutes (0 means never time out)
        </label>
        <Input
          size='small'
          type='number'
          min={0}
          value={String(timeoutMinutes)}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10)
            if (!Number.isFinite(parsed) || parsed < 0) {
              onTimeoutMinutesChange(0)
              return
            }
            onTimeoutMinutesChange(parsed)
          }}
        />
        <p className='mb-0 mt-1 text-xs text-slate-500'>
          The execution timeout encompasses all processes involved in executing a step, such as connecting to a target,
          bootstrapper scripts, package cache cleanups, and install work, but is contained to each machine.
        </p>
      </CollapsibleSection>
    </>
  )
}
