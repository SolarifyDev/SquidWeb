import React from 'react'
import { Checkbox, Input, Radio } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { InstallationDirectoryMode } from '../deploy-package-model'

interface InstallationOptionsSectionProps {
  installationDirectoryMode: InstallationDirectoryMode
  customInstallationDirectory: string
  purgeBeforeInstall: boolean
  preservePaths: string
  skipIfAlreadyInstalled: boolean
  retentionCount: number
  useCurrentPointer: boolean
  rollbackOnFailure: boolean
  onInstallationDirectoryModeChange: (value: InstallationDirectoryMode) => void
  onCustomInstallationDirectoryChange: (value: string) => void
  onPurgeBeforeInstallChange: (value: boolean) => void
  onPreservePathsChange: (value: string) => void
  onSkipIfAlreadyInstalledChange: (value: boolean) => void
  onRetentionCountChange: (value: number) => void
  onUseCurrentPointerChange: (value: boolean) => void
  onRollbackOnFailureChange: (value: boolean) => void
}

export function InstallationOptionsSection({
  installationDirectoryMode,
  customInstallationDirectory,
  purgeBeforeInstall,
  preservePaths,
  skipIfAlreadyInstalled,
  retentionCount,
  useCurrentPointer,
  rollbackOnFailure,
  onInstallationDirectoryModeChange,
  onCustomInstallationDirectoryChange,
  onPurgeBeforeInstallChange,
  onPreservePathsChange,
  onSkipIfAlreadyInstalledChange,
  onRetentionCountChange,
  onUseCurrentPointerChange,
  onRollbackOnFailureChange,
}: InstallationOptionsSectionProps) {
  return (
    <>
      <CollapsibleSection title="Installation Directory" subtitle="Choose where package contents are installed on the target." defaultOpen>
        <Radio.Group
          value={installationDirectoryMode}
          onChange={(e) => onInstallationDirectoryModeChange(e.target.value)}
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
              onChange={(e) => onCustomInstallationDirectoryChange(e.target.value)}
              placeholder="/opt/apps/myapp or C:\\apps\\myapp"
            />
            <div className="text-xs text-slate-500">V1 不会删除包中不存在的旧文件。</div>
          </div>
        ) : null}
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
            onChange={(event) => onSkipIfAlreadyInstalledChange(event.target.checked)}
          >
            <span className="text-sm">Skip if already installed</span>
          </Checkbox>

          <div className="space-y-2">
            <Checkbox
              checked={purgeBeforeInstall}
              onChange={(event) => onPurgeBeforeInstallChange(event.target.checked)}
            >
              <span className="text-sm">Purge files not in package</span>
            </Checkbox>
            {purgeBeforeInstall ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Preserve paths</label>
                <Input.TextArea
                  value={preservePaths}
                  onChange={(event) => onPreservePathsChange(event.target.value)}
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
                  onRetentionCountChange(0)
                  return
                }
                onRetentionCountChange(parsed)
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
              onChange={(event) => onUseCurrentPointerChange(event.target.checked)}
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
            onChange={(event) => onRollbackOnFailureChange(event.target.checked)}
          >
            <span className="text-sm">Rollback on failure</span>
          </Checkbox>
        </div>
      </CollapsibleSection>
    </>
  )
}
