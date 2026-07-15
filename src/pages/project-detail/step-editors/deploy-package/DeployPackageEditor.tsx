import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Input, Radio, Select, message } from 'antd'
import {
  createDeploymentStep,
  updateDeploymentStep,
} from 'pages/apis/deploymentProcess'
import { getExternalFeeds, searchExternalFeedPackages, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection } from '../shared/StepConditionsSection'
import { TargetTagSelect } from '../shared/TargetTagSelect'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import {
  ACTION_TYPE,
  DEFAULT_STEP_NAME,
  buildDeployPackageStepDto,
  isNuGetFeedType,
  normalizeDeployPackageForm,
  validateDeployPackageForm,
  type InstallationDirectoryMode,
} from './deploy-package-model'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

export const DeployPackageEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function DeployPackageEditor({ step, processId, spaceId, onSave, onStepNameChange }, ref) {
    const initial = useMemo(() => normalizeDeployPackageForm(step), [step])
    const [stepName, setStepName] = useState(initial.stepName)
    const [feedId, setFeedId] = useState<number | null>(initial.feedId)
    const [packageId, setPackageId] = useState(initial.packageId)
    const [targetRoles, setTargetRoles] = useState<string[]>(initial.targetRoles)
    const [installationDirectoryMode, setInstallationDirectoryMode] = useState<InstallationDirectoryMode>(
      initial.installationDirectoryMode,
    )
    const [customInstallationDirectory, setCustomInstallationDirectory] = useState(
      initial.customInstallationDirectory,
    )
    const [conditions, setConditions] = useState(initial.conditions)
    const [startTrigger] = useState(initial.startTrigger)

    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const [packageOptions, setPackageOptions] = useState<string[]>([])
    const [packageQuery, setPackageQuery] = useState(initial.packageId)
    const searchSeq = useRef(0)

    useEffect(() => {
      getExternalFeeds({ pageSize: 1000 })
        .then((res) => setFeeds((res.externalFeeds ?? []).filter((f) => isNuGetFeedType(f.feedType))))
        .catch(() => setFeeds([]))
    }, [])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    useEffect(() => {
      if (!feedId) {
        setPackageOptions([])
        return
      }
      const query = packageQuery.trim()
      if (!query) {
        setPackageOptions([])
        return
      }
      const seq = ++searchSeq.current
      const timer = window.setTimeout(() => {
        searchExternalFeedPackages({ feedId, query, take: 20 })
          .then((res: any) => {
            if (seq !== searchSeq.current) return
            const names = (res.packages ?? []).map((p: any) => p.packageId || p.id || p.name).filter(Boolean)
            setPackageOptions(Array.from(new Set(names as string[])))
          })
          .catch(() => {
            if (seq === searchSeq.current) setPackageOptions([])
          })
      }, 250)
      return () => window.clearTimeout(timer)
    }, [feedId, packageQuery])

    const handleSave = useCallback(async () => {
      const form = {
        stepName,
        feedId,
        packageId,
        targetRoles,
        installationDirectoryMode,
        customInstallationDirectory,
        conditions,
        startTrigger,
      }
      const validation = validateDeployPackageForm(form)
      if (!validation.ok) {
        message.warning(validation.message)
        return
      }

      const nextStep = buildDeployPackageStepDto({
        form,
        processId,
        existingStep: step,
      })

      try {
        const saved = step
          ? await updateDeploymentStep({ id: step.id, step: nextStep })
          : await createDeploymentStep({ processId, step: nextStep })
        message.success(step ? 'Step updated' : 'Step created')
        onSave(saved)
      } catch {
        message.error('Failed to save step')
      }
    }, [
      stepName,
      feedId,
      packageId,
      targetRoles,
      installationDirectoryMode,
      customInstallationDirectory,
      conditions,
      startTrigger,
      processId,
      step,
      onSave,
    ])

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

    const logoUrl = `${API_BASE}/${spaceId}/actiontemplates/${ACTION_TYPE}/logo`
    const displayName = stepName.trim() || DEFAULT_STEP_NAME

    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain"
                onError={(event) => {
                  ;(event.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900">{displayName}</div>
              <div className="text-xs text-slate-500">Deploy a Package</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CollapsibleSection title="Step Name" defaultOpen>
            <Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder={DEFAULT_STEP_NAME} />
          </CollapsibleSection>

          <CollapsibleSection title="Package" defaultOpen>
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-sm text-slate-700">NuGet Feed</div>
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select a NuGet feed"
                  value={feedId ?? undefined}
                  options={feeds.map((f) => ({ value: f.id, label: f.name }))}
                  onChange={(value) => {
                    setFeedId(value)
                    setPackageId('')
                    setPackageQuery('')
                    setPackageOptions([])
                  }}
                />
              </div>
              <div>
                <div className="mb-1 text-sm text-slate-700">Package ID</div>
                <Select
                  className="w-full"
                  showSearch
                  disabled={!feedId}
                  placeholder={feedId ? 'Search package' : 'Select a feed first'}
                  value={packageId || undefined}
                  searchValue={packageQuery}
                  onSearch={setPackageQuery}
                  onChange={(value) => {
                    setPackageId(value)
                    setPackageQuery(value)
                  }}
                  options={packageOptions.map((name) => ({ value: name, label: name }))}
                  notFoundContent={feedId ? 'No packages' : 'Select a feed first'}
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Target Roles" defaultOpen>
            <TargetTagSelect value={targetRoles} onChange={setTargetRoles} />
          </CollapsibleSection>

          <CollapsibleSection title="Installation Directory" defaultOpen>
            <Radio.Group
              value={installationDirectoryMode}
              onChange={(e) => setInstallationDirectoryMode(e.target.value)}
              className="mb-3"
            >
              <Radio value="Versioned">Use default versioned directory</Radio>
              <Radio value="Custom">Use custom absolute directory</Radio>
            </Radio.Group>
            {installationDirectoryMode === 'Custom' ? (
              <div className="space-y-2">
                <Input
                  value={customInstallationDirectory}
                  onChange={(e) => setCustomInstallationDirectory(e.target.value)}
                  placeholder="/opt/apps/myapp or C:\\apps\\myapp"
                />
                <div className="text-xs text-slate-500">V1 不会删除包中不存在的旧文件。</div>
              </div>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection title="Conditions" defaultOpen>
            <StepConditionsSection value={conditions} onChange={setConditions} />
          </CollapsibleSection>
        </div>
      </div>
    )
  },
)
