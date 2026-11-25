import { useCallback, useEffect, useState } from 'react'
import { Input, Spin, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { useSpace } from 'contexts/SpaceContext'
import { usePermissions } from 'contexts/PermissionContext'
import { listBuiltInPackages, PACKAGE_PAGE_SIZE, type BuiltInPackageDto } from 'pages/apis/builtInPackages'
import { UploadPanel } from './UploadPanel'
import { apiErrorMessage, formatDate } from './packageUi'

const SquidPackages = () => {
  const { space } = useSpace()
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const [feedId, setFeedId] = useState<number | null>(null)
  const [packages, setPackages] = useState<BuiltInPackageDto[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    listBuiltInPackages(filter.trim() || undefined)
      .then((data) => {
        setFeedId(data.feedId)
        setPackages(data.packages ?? [])
      })
      .catch((error) => message.error(apiErrorMessage(error, 'Failed to load packages')))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    if (space?.id) load()
  }, [space?.id, load])

  return (
    <PageContainer title="Squid packages">
      <div className="mb-4 text-sm text-gray-600">Packages pushed straight to Squid, kept per space and usable by releases like any feed package.</div>
      <div className="mb-4">
        <UploadPanel canEdit={hasPermission('FeedEdit')} feedId={feedId} spaceId={space.id} onUploaded={load} />
      </div>
      <div className="mb-3">
        <Input.Search allowClear placeholder="Filter packages" style={{ maxWidth: 300 }} onSearch={setFilter} />
      </div>
      <Spin spinning={loading}>
        <div className="rounded border border-gray-200 bg-white">
          {packages.length === 0 && !loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">No packages yet.</div>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.packageId}
                data-testid="package-row"
                role="button"
                tabIndex={0}
                className="grid cursor-pointer items-center border-b border-gray-100 px-5 py-3 last:border-b-0 hover:bg-gray-50"
                style={{ gridTemplateColumns: '1fr 120px 200px' }}
                onClick={() => navigate(`/${space.slug}/library/packages/${encodeURIComponent(pkg.packageId)}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') navigate(`/${space.slug}/library/packages/${encodeURIComponent(pkg.packageId)}`)
                }}
              >
                <div className="truncate text-sm font-semibold text-squid-blue">{pkg.packageId}</div>
                <div className="text-sm text-gray-600">{pkg.versionCount} {pkg.versionCount === 1 ? 'version' : 'versions'}</div>
                <div className="text-sm text-gray-500">{formatDate(pkg.lastPublishedDate)}</div>
              </div>
            ))
          )}
        </div>
        {packages.length >= PACKAGE_PAGE_SIZE && (
          <div data-testid="truncated-note" className="mt-2 text-sm text-gray-500">
            Showing the first {PACKAGE_PAGE_SIZE} packages; there may be more. Use the filter to find a specific one.
          </div>
        )}
      </Spin>
    </PageContainer>
  )
}

export default SquidPackages
