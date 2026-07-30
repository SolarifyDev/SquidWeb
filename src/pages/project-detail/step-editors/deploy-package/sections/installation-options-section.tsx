import React from 'react'
import { Checkbox, Input, Radio } from 'antd'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import type { InstallationDirectoryMode } from '../deploy-package-model'

interface InstallationOptionsSectionProps {
  showInstallationDirectory: boolean
  showInstallationOptions: boolean
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
  showInstallationDirectory,
  showInstallationOptions,
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
      {showInstallationDirectory ? (
        <CollapsibleSection
          title='Installation Directory'
          subtitle='Choose where Squid extracts and installs the package on the deployment target.'
          defaultOpen
        >
          <Radio.Group
            value={installationDirectoryMode}
            onChange={(e) => onInstallationDirectoryModeChange(e.target.value)}
            className='mb-3 flex flex-col gap-2'
          >
            <Radio value='Versioned'>
              <span className='text-sm'>Use the default versioned installation directory</span>
            </Radio>
            <Radio value='Custom'>
              <span className='text-sm'>Use a custom installation directory</span>
            </Radio>
          </Radio.Group>
          {installationDirectoryMode === 'Custom' ? (
            <div className='space-y-2'>
              <Input
                value={customInstallationDirectory}
                onChange={(e) => onCustomInstallationDirectoryChange(e.target.value)}
                placeholder='/opt/apps/myapp or C:\\apps\\myapp'
              />
              <p className='mb-0 text-xs text-slate-500'>
                Files already on the target are left in place unless purge is enabled under Installation Options.
              </p>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      {showInstallationOptions ? (
        <CollapsibleSection
          title='Installation Options'
          subtitle='Control whether existing installs are skipped, purged, retained, pointed, or rolled back.'
          defaultOpen
          fullWidth
        >
          <div className='ml-[216px] w-2/3 max-w-[760px] space-y-4'>
            <Checkbox
              checked={skipIfAlreadyInstalled}
              onChange={(event) => onSkipIfAlreadyInstalledChange(event.target.checked)}
            >
              <span className='text-sm'>Skip if already installed</span>
            </Checkbox>

            <div className='space-y-2'>
              <Checkbox
                checked={purgeBeforeInstall}
                onChange={(event) => onPurgeBeforeInstallChange(event.target.checked)}
              >
                <span className='text-sm'>Purge files not in package</span>
              </Checkbox>
              {purgeBeforeInstall ? (
                <div>
                  <label className='mb-1 block text-xs font-medium text-slate-600'>Preserve paths</label>
                  <Input.TextArea
                    value={preservePaths}
                    onChange={(event) => onPreservePathsChange(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    placeholder={'App_Data/**\nlogs/**'}
                  />
                  <p className='mb-0 mt-1 text-xs text-slate-500'>
                    Newline-separated paths or globs to keep when purging files that are not present in the package.
                  </p>
                </div>
              ) : null}
            </div>

            <div>
              <label className='mb-1 block text-xs font-medium text-slate-600'>Keep N previous versions</label>
              <Input
                size='small'
                type='number'
                min={0}
                className='max-w-[180px]'
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
              <p className='mb-0 mt-1 text-xs text-slate-500'>
                {installationDirectoryMode === 'Custom'
                  ? 'Not used for a custom installation directory. The value is still saved if you switch back to the versioned directory later.'
                  : '0 keeps previous versioned directories. A positive number keeps only that many previous versions.'}
              </p>
            </div>

            <div className='space-y-1'>
              <Checkbox
                checked={useCurrentPointer}
                onChange={(event) => onUseCurrentPointerChange(event.target.checked)}
              >
                <span className='text-sm'>Maintain current pointer</span>
              </Checkbox>
              {installationDirectoryMode === 'Custom' ? (
                <p className='mb-0 text-xs text-slate-500'>
                  Not used for a custom installation directory. The value is still saved if you switch back to the
                  versioned directory later.
                </p>
              ) : (
                <p className='mb-0 text-xs text-slate-500'>
                  Maintain a stable <code>current</code> pointer to the active versioned install.
                </p>
              )}
            </div>

            <Checkbox checked={rollbackOnFailure} onChange={(event) => onRollbackOnFailureChange(event.target.checked)}>
              <span className='text-sm'>Roll back on failure</span>
            </Checkbox>
          </div>
        </CollapsibleSection>
      ) : null}
    </>
  )
}
