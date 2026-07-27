import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Input, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import {
  createDeploymentStep,
  updateDeploymentStep,
} from 'pages/apis/deploymentProcess'
import { getExternalFeeds, type ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { StepConditionsSection } from '../shared/StepConditionsSection'
import type { StepEditorHandle, StepEditorProps } from '../shared/StepEditorTypes'
import {
  ACTION_TYPE,
  DEFAULT_STEP_NAME,
  buildDeployPackageStepDto,
  normalizeDeployPackageForm,
  validateDeployPackageForm,
  type InstallationDirectoryMode,
  type StartTriggerMode,
} from './deploy-package-model'
import { usePackageSearch } from './use-package-search'
import { PackageSection } from './sections/package-section'
import { ConfigurationRewriteSections } from './sections/configuration-rewrite-sections'
import { InstallationOptionsSection } from './sections/installation-options-section'
import {
  ExecutionLocationSection,
  RetriesAndTimeoutSection,
  RollingDeploymentControl,
  StartTriggerControl,
  TargetTagsSection,
} from './sections/execution-controls-section'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

export const DeployPackageEditor = forwardRef<StepEditorHandle, StepEditorProps>(
  function DeployPackageEditor({ step, processId, projectId, spaceId, stepIndex, onSave, onStepNameChange }, ref) {
    const initial = useMemo(() => normalizeDeployPackageForm(step), [step])
    const [stepName, setStepName] = useState(initial.stepName)
    const [feedId, setFeedId] = useState<number | null>(initial.feedId)
    const [feedType, setFeedType] = useState<string | null>(initial.feedType ?? null)
    const [packageId, setPackageId] = useState(initial.packageId)
    const [targetRoles, setTargetRoles] = useState<string[]>(initial.targetRoles)
    const [installationDirectoryMode, setInstallationDirectoryMode] = useState<InstallationDirectoryMode>(
      initial.installationDirectoryMode,
    )
    const [customInstallationDirectory, setCustomInstallationDirectory] = useState(
      initial.customInstallationDirectory,
    )
    const [startTrigger, setStartTrigger] = useState<StartTriggerMode>(initial.startTrigger)
    const [conditions, setConditions] = useState(initial.conditions)
    const [retriesEnabled, setRetriesEnabled] = useState(initial.retriesEnabled)
    const [retryCount, setRetryCount] = useState(initial.retryCount)
    const [maxParallelism, setMaxParallelism] = useState(initial.maxParallelism)
    const [packageVersion, setPackageVersion] = useState(initial.packageVersion)
    const [timeoutMinutes, setTimeoutMinutes] = useState(initial.timeoutMinutes)
    const [configurationVariablesEnabled, setConfigurationVariablesEnabled] = useState(
      initial.configurationVariablesEnabled,
    )
    const [configurationTransformsEnabled, setConfigurationTransformsEnabled] = useState(
      initial.configurationTransformsEnabled,
    )
    const [configurationTransformsEnvironmentName, setConfigurationTransformsEnvironmentName] = useState(
      initial.configurationTransformsEnvironmentName,
    )
    const [additionalTransforms, setAdditionalTransforms] = useState(initial.additionalTransforms)
    const [substituteInFilesEnabled, setSubstituteInFilesEnabled] = useState(initial.substituteInFilesEnabled)
    const [substituteInFilesTargetFiles, setSubstituteInFilesTargetFiles] = useState(
      initial.substituteInFilesTargetFiles,
    )
    const [substituteFailOnUnresolved, setSubstituteFailOnUnresolved] = useState(
      initial.substituteFailOnUnresolved,
    )
    const [structuredConfigEnabled, setStructuredConfigEnabled] = useState(initial.structuredConfigEnabled)
    const [structuredConfigTargets, setStructuredConfigTargets] = useState(initial.structuredConfigTargets)
    const [purgeBeforeInstall, setPurgeBeforeInstall] = useState(initial.purgeBeforeInstall)
    const [preservePaths, setPreservePaths] = useState(initial.preservePaths)
    const [skipIfAlreadyInstalled, setSkipIfAlreadyInstalled] = useState(initial.skipIfAlreadyInstalled)
    const [retentionCount, setRetentionCount] = useState(initial.retentionCount)
    const [useCurrentPointer, setUseCurrentPointer] = useState(initial.useCurrentPointer)
    const [rollbackOnFailure, setRollbackOnFailure] = useState(initial.rollbackOnFailure)

    const [feeds, setFeeds] = useState<ExternalFeedDto[]>([])
    const packageSearch = usePackageSearch(feedId)

    useEffect(() => {
      if (initial.packageId) packageSearch.setQuery(initial.packageId)
      // only seed once from initial package id on mount/step switch
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial.packageId])

    useEffect(() => {
      getExternalFeeds({ pageSize: 1000 })
        .then((res) => setFeeds(res.externalFeeds ?? []))
        .catch(() => setFeeds([]))
    }, [])

    useEffect(() => {
      if (!feedId) {
        setFeedType(null)
        return
      }
      const matched = feeds.find((f) => f.id === feedId)
      if (matched) setFeedType(matched.feedType ?? null)
    }, [feedId, feeds])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    const handleSave = useCallback(async () => {
      const form = {
        stepName,
        feedId,
        feedType,
        packageId,
        packageVersion,
        targetRoles,
        installationDirectoryMode,
        customInstallationDirectory,
        executionLocation: 'DeploymentTarget' as const,
        startTrigger,
        retriesEnabled,
        retryCount,
        maxParallelism,
        timeoutMinutes,
        conditions,
        configurationVariablesEnabled,
        configurationTransformsEnabled,
        configurationTransformsEnvironmentName,
        additionalTransforms,
        substituteInFilesEnabled,
        substituteInFilesTargetFiles,
        substituteFailOnUnresolved,
        structuredConfigEnabled,
        structuredConfigTargets,
        purgeBeforeInstall,
        preservePaths,
        skipIfAlreadyInstalled,
        retentionCount,
        useCurrentPointer,
        rollbackOnFailure,
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
      feedType,
      packageId,
      packageVersion,
      targetRoles,
      installationDirectoryMode,
      customInstallationDirectory,
      startTrigger,
      retriesEnabled,
      retryCount,
      maxParallelism,
      timeoutMinutes,
      conditions,
      configurationVariablesEnabled,
      configurationTransformsEnabled,
      configurationTransformsEnvironmentName,
      additionalTransforms,
      substituteInFilesEnabled,
      substituteInFilesTargetFiles,
      substituteFailOnUnresolved,
      structuredConfigEnabled,
      structuredConfigTargets,
      purgeBeforeInstall,
      preservePaths,
      skipIfAlreadyInstalled,
      retentionCount,
      useCurrentPointer,
      rollbackOnFailure,
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
              <div className="text-xs leading-tight text-slate-400">Deploy a Package</div>
              <div className="flex items-center gap-1.5">
                {stepIndex != null ? <span className="text-sm font-medium text-slate-400">{stepIndex + 1}.</span> : null}
                <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded border border-slate-300 px-3 py-[5px] text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => message.info('Package features are not available in V2.')}
            >
              Configure features
            </button>
            <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100" aria-label="More Step Actions">
              <MoreOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <CollapsibleSection title="Step Name" subtitle="A short, memorable, unique name for this step." defaultOpen>
            <Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder={DEFAULT_STEP_NAME} />
          </CollapsibleSection>

          <ExecutionLocationSection />
          <TargetTagsSection targetRoles={targetRoles} onTargetRolesChange={setTargetRoles} />

          <PackageSection
            feeds={feeds}
            feedId={feedId}
            feedType={feedType}
            packageId={packageId}
            packageVersion={packageVersion}
            packageQuery={packageSearch.query}
            packageOptions={packageSearch.options}
            packageSearchLoading={packageSearch.loading}
            onFeedChange={(nextFeedId, nextFeedType) => {
              setFeedId(nextFeedId)
              setFeedType(nextFeedType)
              packageSearch.clear()
              setPackageId('')
              setPackageVersion('')
            }}
            onPackageQueryChange={packageSearch.setQuery}
            onPackageIdChange={setPackageId}
            onPackageVersionChange={setPackageVersion}
          />

          <InstallationOptionsSection
            installationDirectoryMode={installationDirectoryMode}
            customInstallationDirectory={customInstallationDirectory}
            purgeBeforeInstall={purgeBeforeInstall}
            preservePaths={preservePaths}
            skipIfAlreadyInstalled={skipIfAlreadyInstalled}
            retentionCount={retentionCount}
            useCurrentPointer={useCurrentPointer}
            rollbackOnFailure={rollbackOnFailure}
            onInstallationDirectoryModeChange={setInstallationDirectoryMode}
            onCustomInstallationDirectoryChange={setCustomInstallationDirectory}
            onPurgeBeforeInstallChange={setPurgeBeforeInstall}
            onPreservePathsChange={setPreservePaths}
            onSkipIfAlreadyInstalledChange={setSkipIfAlreadyInstalled}
            onRetentionCountChange={setRetentionCount}
            onUseCurrentPointerChange={setUseCurrentPointer}
            onRollbackOnFailureChange={setRollbackOnFailure}
          />

          <ConfigurationRewriteSections
            configurationVariablesEnabled={configurationVariablesEnabled}
            configurationTransformsEnabled={configurationTransformsEnabled}
            configurationTransformsEnvironmentName={configurationTransformsEnvironmentName}
            additionalTransforms={additionalTransforms}
            substituteInFilesEnabled={substituteInFilesEnabled}
            substituteInFilesTargetFiles={substituteInFilesTargetFiles}
            substituteFailOnUnresolved={substituteFailOnUnresolved}
            structuredConfigEnabled={structuredConfigEnabled}
            structuredConfigTargets={structuredConfigTargets}
            onConfigurationVariablesEnabledChange={setConfigurationVariablesEnabled}
            onConfigurationTransformsEnabledChange={setConfigurationTransformsEnabled}
            onConfigurationTransformsEnvironmentNameChange={setConfigurationTransformsEnvironmentName}
            onAdditionalTransformsChange={setAdditionalTransforms}
            onSubstituteInFilesEnabledChange={setSubstituteInFilesEnabled}
            onSubstituteInFilesTargetFilesChange={setSubstituteInFilesTargetFiles}
            onSubstituteFailOnUnresolvedChange={setSubstituteFailOnUnresolved}
            onStructuredConfigEnabledChange={setStructuredConfigEnabled}
            onStructuredConfigTargetsChange={setStructuredConfigTargets}
          />

          <StepConditionsSection
            value={conditions}
            onChange={setConditions}
            projectId={projectId}
            hideRootSection
            hidePackageRequirement
            hideDisabled
            afterChannels={(
              <RollingDeploymentControl
                maxParallelism={maxParallelism}
                onMaxParallelismChange={setMaxParallelism}
              />
            )}
            afterRunCondition={(
              <StartTriggerControl startTrigger={startTrigger} onStartTriggerChange={setStartTrigger} />
            )}
          />

          <RetriesAndTimeoutSection
            retriesEnabled={retriesEnabled}
            retryCount={retryCount}
            timeoutMinutes={timeoutMinutes}
            onRetriesEnabledChange={setRetriesEnabled}
            onRetryCountChange={setRetryCount}
            onTimeoutMinutesChange={setTimeoutMinutes}
          />
        </div>
      </div>
    )
  },
)
