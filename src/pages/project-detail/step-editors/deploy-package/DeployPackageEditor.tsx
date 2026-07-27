import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AutoComplete, Checkbox, Input, Radio, Select, message } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
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
  DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME,
  buildDeployPackageStepDto,
  isUnsupportedDeployPackageFeedType,
  normalizeDeployPackageForm,
  validateDeployPackageForm,
  type InstallationDirectoryMode,
  type StartTriggerMode,
} from './deploy-package-model'

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
    const [packageOptions, setPackageOptions] = useState<string[]>([])
    const [packageQuery, setPackageQuery] = useState(initial.packageId)
    const [packageSearchLoading, setPackageSearchLoading] = useState(false)
    const searchSeq = useRef(0)

    useEffect(() => {
      getExternalFeeds({ pageSize: 1000 })
        .then((res) => {
          const next = res.externalFeeds ?? []
          setFeeds(next)
        })
        .catch(() => setFeeds([]))
    }, [])

    useEffect(() => {
      if (!feedId) {
        setFeedType(null)
        return
      }
      const matched = feeds.find((f) => f.id === feedId)
      if (matched) {
        setFeedType(matched.feedType ?? null)
      }
    }, [feedId, feeds])

    useEffect(() => {
      onStepNameChange?.(stepName)
    }, [stepName, onStepNameChange])

    useEffect(() => {
      if (!feedId) {
        setPackageOptions([])
        setPackageSearchLoading(false)
        return
      }
      const query = packageQuery.trim()
      if (!query) {
        setPackageOptions([])
        setPackageSearchLoading(false)
        return
      }
      const seq = ++searchSeq.current
      const timer = window.setTimeout(() => {
        setPackageSearchLoading(true)
        searchExternalFeedPackages({ feedId, query, take: 20 })
          .then((res) => {
            if (seq !== searchSeq.current) return
            const names = (res.packages ?? []).filter((p): p is string => typeof p === 'string' && p.length > 0)
            setPackageOptions(Array.from(new Set(names)))
          })
          .catch(() => {
            if (seq === searchSeq.current) setPackageOptions([])
          })
          .finally(() => {
            if (seq === searchSeq.current) setPackageSearchLoading(false)
          })
      }, 250)
      return () => window.clearTimeout(timer)
    }, [feedId, packageQuery])

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

          <CollapsibleSection title="Execution Location" subtitle="Where will Squid run this step?" defaultOpen fullWidth>
                                <div className="ml-[216px] space-y-2">
                                  <p className="m-0 text-sm text-slate-700">
                                    Run on each deployment target
                                  </p>
                                  <p className="m-0 text-xs text-slate-500">
                                    This step always runs on each deployment target matched by Target Tags.
                                  </p>
                                </div>
                              </CollapsibleSection>

          <CollapsibleSection
                      title="Target Tags"
                      subtitle="This step will deploy to deployment targets with any of these matching tags."
                      defaultOpen
                    >
                      <TargetTagSelect
                        value={targetRoles}
                        onChange={setTargetRoles}
                        placeholder="Runs on targets with tags (type to add new)"
                      />
                    </CollapsibleSection>

          <CollapsibleSection title="Package" subtitle="Choose the package to deploy." defaultOpen>
                                <div className="space-y-4">
                                  <div>
                                    <div className="mb-1 text-sm text-slate-700">Package Feed</div>
                                    <Select
                                      className="w-full"
                                      showSearch
                                      optionFilterProp="label"
                                      placeholder="Select a feed"
                                      value={feedId ?? undefined}
                                      options={feeds.map((f) => ({ value: f.id, label: f.name }))}
                                      onChange={(value) => {
                                        setFeedId(value)
                                        const selected = feeds.find((f) => f.id === value)
                                        setFeedType(selected?.feedType ?? null)
                                        setPackageId('')
                                        setPackageVersion('')
                                        setPackageQuery('')
                                        setPackageOptions([])
                                      }}
                                    />
                                    {feedId && isUnsupportedDeployPackageFeedType(feedType) ? (
                                      <div className="mt-1 text-xs text-amber-600">
                                        This feed type cannot be installed by Deploy a Package. Use an archive-capable feed (NuGet/GitHub/HTTP).
                                      </div>
                                    ) : null}
                                  </div>
                                  <div>
                                    <div className="mb-1 text-sm text-slate-700">Package ID</div>
                                    <AutoComplete
                                      className="w-full"
                                      disabled={!feedId}
                                      placeholder={feedId ? 'Search package' : 'Select a feed first'}
                                      value={packageId}
                                      options={packageOptions.map((value) => ({ value }))}
                                      onSearch={setPackageQuery}
                                      onSelect={(value) => {
                                        setPackageQuery(value)
                                        setPackageId(value)
                                      }}
                                      onChange={(value) => {
                                        setPackageQuery(value)
                                        setPackageId(value)
                                        if (!value) setPackageVersion('')
                                      }}
                                      filterOption={false}
                                      allowClear
                                      notFoundContent={
                                        feedId && packageQuery.trim()
                                          ? packageSearchLoading
                                            ? 'Searching packages...'
                                            : 'No packages found'
                                          : feedId
                                            ? null
                                            : 'Select a feed first'
                                      }
                                    />
                                  </div>
                                  <div>
                                    <div className="mb-1 text-sm text-slate-700">Version (optional)</div>
                                    <Input
                                      value={packageVersion}
                                      onChange={(e) => setPackageVersion(e.target.value)}
                                      placeholder="Leave empty to choose during release creation"
                                      disabled={!feedId || !packageId}
                                    />
                                    <div className="mt-1 text-xs text-slate-500">
                                      Used as the default package version when creating a release. You can still override it on the create release page.
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleSection>

          <CollapsibleSection title="Installation Directory" subtitle="Choose where package contents are installed on the target." defaultOpen>
                                <Radio.Group
                                  value={installationDirectoryMode}
                                  onChange={(e) => setInstallationDirectoryMode(e.target.value)}
                                  className="mb-3 flex flex-col gap-2"
                                >
                                  <Radio value="Versioned">
                                    <span className="text-sm">Use default versioned directory</span>
                                  </Radio>
                                  <Radio value="Custom">
                                    <span className="text-sm">Use custom absolute directory</span>
                                  </Radio>
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

          <CollapsibleSection
                                title=".NET Configuration Variables"
                                subtitle="If set, replace appSettings and connectionString entries in any .config files."
                                defaultOpen
                              >
                                <Checkbox
                                  checked={configurationVariablesEnabled}
                                  onChange={(event) => setConfigurationVariablesEnabled(event.target.checked)}
                                >
                                  <span className="text-sm">Replace entries in .config files</span>
                                </Checkbox>
                                <p className="mb-0 mt-1 text-xs text-slate-500">
                                  Squid will scan <code>.config</code> files and replace matching keys using step variables.
                                </p>
                              </CollapsibleSection>

          <CollapsibleSection
                                title=".NET Configuration Transforms"
                                subtitle="Configure .NET XML configuration transforms."
                                defaultOpen
                                fullWidth
                              >
                                <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
                                  <div>
                                    <Checkbox
                                      checked={configurationTransformsEnabled}
                                      onChange={(event) => setConfigurationTransformsEnabled(event.target.checked)}
                                    >
                                      <span className="text-sm">Run default XML transforms</span>
                                    </Checkbox>
                                    <p className="mb-0 mt-1 text-xs text-slate-500">
                                      Squid can run configuration transformation files. By default Squid looks for <em>*.Release.config</em>{' '}
                                      and <em>*.&lt;EnvironmentName&gt;.config</em>.
                                    </p>
                                  </div>

                                  {configurationTransformsEnabled ? (
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">Environment name token</label>
                                      <Input
                                        size="small"
                                        value={configurationTransformsEnvironmentName}
                                        onChange={(event) => setConfigurationTransformsEnvironmentName(event.target.value)}
                                        placeholder={DEFAULT_CONFIGURATION_TRANSFORMS_ENVIRONMENT_NAME}
                                      />
                                      <p className="mb-0 mt-1 text-xs text-slate-500">
                                        Picks the <code>*.&lt;name&gt;.config</code> overlay. Leave empty to apply only the Release transform.
                                      </p>
                                    </div>
                                  ) : null}

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Additional transforms</label>
                                    <Input.TextArea
                                      value={additionalTransforms}
                                      onChange={(event) => setAdditionalTransforms(event.target.value)}
                                      autoSize={{ minRows: 3, maxRows: 8 }}
                                      placeholder="Web.Release.config => Web.config"
                                    />
                                    <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
                                      <p className="mb-0">A comma- or newline-separated list of additional configuration transformation file rules. Example:</p>
                                      <pre className="mb-0 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                                        {
                                          'Web.Release.config => Web.config\n*.Foo.config => *.config\ncrossdomainpolicy.#{Squid.Environment.Name}.xml => crossdomainpolicy.xml'
                                        }
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleSection>

          <CollapsibleSection
                                title="Substitute Variables in Files"
                                subtitle="Replace #{Variable} tokens inside any text file (JSON / YAML / properties / .config / .txt)."
                                defaultOpen
                                fullWidth
                              >
                                <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
                                  <Checkbox
                                    checked={substituteInFilesEnabled}
                                    onChange={(event) => setSubstituteInFilesEnabled(event.target.checked)}
                                  >
                                    <span className="text-sm">Enable variable token replacement in files</span>
                                  </Checkbox>

                                  {substituteInFilesEnabled ? (
                                    <>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
                                        <Input.TextArea
                                          value={substituteInFilesTargetFiles}
                                          onChange={(event) => setSubstituteInFilesTargetFiles(event.target.value)}
                                          autoSize={{ minRows: 3, maxRows: 8 }}
                                          placeholder={'appsettings.json\nappsettings.#{Squid.Environment.Name}.json\n*.yml'}
                                        />
                                        <p className="mb-0 mt-1 text-xs text-slate-500">
                                          Newline-separated globs relative to the installation directory (or absolute paths). Every{' '}
                                          <code>#{'{VariableName}'}</code> token is replaced with the matching Squid variable.
                                        </p>
                                      </div>
                                      <Checkbox
                                        checked={substituteFailOnUnresolved}
                                        onChange={(event) => setSubstituteFailOnUnresolved(event.target.checked)}
                                      >
                                        <span className="text-sm">Fail deployment if any tokens cannot be resolved</span>
                                      </Checkbox>
                                    </>
                                  ) : null}
                                </div>
                              </CollapsibleSection>

          <CollapsibleSection
                                title="Structured Configuration Variables"
                                subtitle="Replace JSON leaves where the path matches a Squid variable (e.g. Logging:LogLevel:Default)."
                                defaultOpen
                                fullWidth
                              >
                                <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
                                  <Checkbox
                                    checked={structuredConfigEnabled}
                                    onChange={(event) => setStructuredConfigEnabled(event.target.checked)}
                                  >
                                    <span className="text-sm">Enable JSON leaf replacement</span>
                                  </Checkbox>

                                  {structuredConfigEnabled ? (
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">Target files</label>
                                      <Input.TextArea
                                        value={structuredConfigTargets}
                                        onChange={(event) => setStructuredConfigTargets(event.target.value)}
                                        autoSize={{ minRows: 3, maxRows: 8 }}
                                        placeholder={'appsettings.json\nappsettings.Production.json'}
                                      />
                                      <p className="mb-0 mt-1 text-xs text-slate-500">
                                        Newline-separated globs relative to the installation directory. Path forms{' '}
                                        <code>Logging.LogLevel.Default</code> and <code>Logging:LogLevel:Default</code> are both supported.
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </CollapsibleSection>

          <CollapsibleSection
                                title="Installation Options"
                                subtitle="Control purge, skip, retention, current pointer and rollback behavior."
                                defaultOpen
                                fullWidth
                              >
                                <div className="ml-[216px] w-2/3 max-w-[760px] space-y-4">
                                  <Checkbox
                                    checked={skipIfAlreadyInstalled}
                                    onChange={(event) => setSkipIfAlreadyInstalled(event.target.checked)}
                                  >
                                    <span className="text-sm">Skip if already installed</span>
                                  </Checkbox>

                                  <div className="space-y-2">
                                    <Checkbox
                                      checked={purgeBeforeInstall}
                                      onChange={(event) => setPurgeBeforeInstall(event.target.checked)}
                                    >
                                      <span className="text-sm">Purge files not in package</span>
                                    </Checkbox>
                                    {purgeBeforeInstall ? (
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-600">Preserve paths</label>
                                        <Input.TextArea
                                          value={preservePaths}
                                          onChange={(event) => setPreservePaths(event.target.value)}
                                          autoSize={{ minRows: 3, maxRows: 8 }}
                                          placeholder={'App_Data/**\nlogs/**'}
                                        />
                                        <p className="mb-0 mt-1 text-xs text-slate-500">
                                          Newline-separated paths or globs to keep when purging files not present in the package.
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Keep N previous versions</label>
                                    <Input
                                      size="small"
                                      type="number"
                                      min={0}
                                      className="max-w-[180px]"
                                      value={String(retentionCount)}
                                      onChange={(event) => {
                                        const parsed = Number.parseInt(event.target.value, 10)
                                        if (!Number.isFinite(parsed) || parsed < 0) {
                                          setRetentionCount(0)
                                          return
                                        }
                                        setRetentionCount(parsed)
                                      }}
                                    />
                                    <p className="mb-0 mt-1 text-xs text-slate-500">
                                      {installationDirectoryMode === 'Custom'
                                        ? 'No-op for Custom installation directory; the value is still saved for later Versioned use.'
                                        : '0 means do not clean previous versioned directories.'}
                                    </p>
                                  </div>

                                  <div className="space-y-1">
                                    <Checkbox
                                      checked={useCurrentPointer}
                                      onChange={(event) => setUseCurrentPointer(event.target.checked)}
                                    >
                                      <span className="text-sm">Maintain current pointer</span>
                                    </Checkbox>
                                    {installationDirectoryMode === 'Custom' ? (
                                      <p className="mb-0 text-xs text-slate-500">
                                        No-op for Custom installation directory; the value is still saved for later Versioned use.
                                      </p>
                                    ) : (
                                      <p className="mb-0 text-xs text-slate-500">
                                        Keep a stable <code>current</code> pointer to the active versioned install.
                                      </p>
                                    )}
                                  </div>

                                  <Checkbox
                                    checked={rollbackOnFailure}
                                    onChange={(event) => setRollbackOnFailure(event.target.checked)}
                                  >
                                    <span className="text-sm">Rollback on failure</span>
                                  </Checkbox>
                                </div>
                              </CollapsibleSection>

          <StepConditionsSection
            value={conditions}
            onChange={setConditions}
            projectId={projectId}
            hideRootSection
            hidePackageRequirement
            hideDisabled
            afterChannels={(
              <CollapsibleSection
                title="Rolling Deployment"
                subtitle="Configure a rolling deployment to control the number of deployment targets this step can deploy to at once."
                defaultOpen
              >
                <Checkbox
                  checked={maxParallelism > 0}
                  onChange={(event) => setMaxParallelism(event.target.checked ? Math.max(maxParallelism, 1) : 0)}
                >
                  <span className="text-sm">Configure a rolling deployment</span>
                </Checkbox>
                {maxParallelism > 0 ? (
                  <div className="mt-2 max-w-[220px]">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Maximum parallel targets</label>
                    <Input
                      size="small"
                      type="number"
                      min={1}
                      value={String(maxParallelism)}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10)
                        if (!Number.isFinite(parsed) || parsed < 1) {
                          setMaxParallelism(1)
                          return
                        }
                        setMaxParallelism(parsed)
                      }}
                    />
                  </div>
                ) : null}
              </CollapsibleSection>
            )}
            afterRunCondition={(
              <CollapsibleSection
                title="Start Trigger"
                subtitle="Control whether this step waits for the previous step to complete, or runs in parallel with it."
                defaultOpen
              >
                <Radio.Group
                  value={startTrigger}
                  onChange={(event) => setStartTrigger(event.target.value as StartTriggerMode)}
                  className="flex flex-col gap-2"
                >
                  <Radio value="StartWithPrevious">
                    <span className="text-sm">Run in parallel with the previous step</span>
                  </Radio>
                  <Radio value="StartAfterPrevious">
                    <span className="text-sm">Wait for all previous steps to complete, then start</span>
                  </Radio>
                </Radio.Group>
              </CollapsibleSection>
            )}
          />

          <CollapsibleSection title="Retries" subtitle="Upon failure, this step will automatically retry." defaultOpen>
                                  <Checkbox checked={retriesEnabled} onChange={(event) => setRetriesEnabled(event.target.checked)}>
                                    <span className="text-sm">Allow retries (max. 3)</span>
                                  </Checkbox>
                                  {retriesEnabled ? (
                                    <div className="max-w-[180px]">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">Retries</label>
                                      <Input
                                        size="small"
                                        type="number"
                                        min={1}
                                        max={3}
                                        value={String(retryCount)}
                                        onChange={(event) => {
                                          const parsed = Number.parseInt(event.target.value, 10)
                                          if (!Number.isFinite(parsed)) {
                                            setRetryCount(1)
                                            return
                                          }
                                          setRetryCount(Math.min(Math.max(parsed, 1), 3))
                                        }}
                                      />
                                    </div>
                                  ) : null}
                                </CollapsibleSection>

          <CollapsibleSection
                      title="Time out"
                      subtitle="If this step is still running after the set time has lapsed, the task will fail."
                      defaultOpen
                    >
                      <label className="mb-1 block text-xs font-medium text-slate-600">Time out after minutes (0 means never time out)</label>
                      <Input
                        size="small"
                        type="number"
                        min={0}
                        value={String(timeoutMinutes)}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10)
                          if (!Number.isFinite(parsed) || parsed < 0) {
                            setTimeoutMinutes(0)
                            return
                          }
                          setTimeoutMinutes(parsed)
                        }}
                      />
                    </CollapsibleSection>
        </div>
      </div>
    )
  },
)
