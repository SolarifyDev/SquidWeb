import React from 'react'
import { AutoComplete, Input, Select } from 'antd'
import type { ExternalFeedDto } from 'pages/apis/externalFeed'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { isUnsupportedDeployPackageFeedType } from '../deploy-package-model'

interface PackageSectionProps {
  feeds: ExternalFeedDto[]
  feedId: number | null
  feedType: string | null
  packageId: string
  packageVersion: string
  packageQuery: string
  packageOptions: string[]
  packageSearchLoading: boolean
  onFeedChange: (feedId: number, feedType: string | null) => void
  onPackageQueryChange: (value: string) => void
  onPackageIdChange: (value: string) => void
  onPackageVersionChange: (value: string) => void
}

export function PackageSection({
  feeds,
  feedId,
  feedType,
  packageId,
  packageVersion,
  packageQuery,
  packageOptions,
  packageSearchLoading,
  onFeedChange,
  onPackageQueryChange,
  onPackageIdChange,
  onPackageVersionChange,
}: PackageSectionProps) {
  return (
    <CollapsibleSection title='Package' subtitle='Select the package containing your application.' defaultOpen>
      <div className='space-y-4'>
        <div>
          <div className='mb-1 text-sm text-slate-700'>Package feed</div>
          <Select
            className='w-full'
            showSearch
            optionFilterProp='label'
            placeholder='Select a feed'
            value={feedId ?? undefined}
            options={feeds.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(value) => {
              const selected = feeds.find((f) => f.id === value)
              onFeedChange(value, selected?.feedType ?? null)
            }}
          />
          {feedId && isUnsupportedDeployPackageFeedType(feedType) ? (
            <div className='mt-1 text-xs text-amber-600'>
              This feed type cannot be installed by Deploy a Package. Use an archive-capable feed (NuGet/GitHub/HTTP).
            </div>
          ) : null}
        </div>
        <div>
          <div className='mb-1 text-sm text-slate-700'>Package ID</div>
          <AutoComplete
            className='w-full'
            disabled={!feedId}
            placeholder={feedId ? 'Search or enter a package ID' : 'Select a feed first'}
            value={packageId}
            options={packageOptions.map((value) => ({ value }))}
            onSearch={onPackageQueryChange}
            onSelect={(value) => {
              onPackageQueryChange(value)
              onPackageIdChange(value)
            }}
            onChange={(value) => {
              onPackageQueryChange(value)
              onPackageIdChange(value)
              if (!value) onPackageVersionChange('')
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
          <div className='mb-1 text-sm text-slate-700'>Version (optional)</div>
          <Input
            value={packageVersion}
            onChange={(e) => onPackageVersionChange(e.target.value)}
            placeholder='Leave empty to choose during release creation'
            disabled={!feedId || !packageId}
          />
          <div className='mt-1 text-xs text-slate-500'>
            Optional default for release creation. If set, the package can still be overridden when creating a release.
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
