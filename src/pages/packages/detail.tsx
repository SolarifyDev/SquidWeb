import { useCallback, useEffect, useState } from 'react'
import { Drawer, Spin, Table, Tag, message } from 'antd'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { useSpace } from 'contexts/SpaceContext'
import { usePermissions } from 'contexts/PermissionContext'
import {
  getRecipeRecommendations,
  listBuiltInPackages,
  listBuiltInPackageVersions,
  type BuiltInPackageVersionDto,
  type RecipeRecommendations,
} from 'pages/apis/builtInPackages'
import { UploadPanel } from './UploadPanel'
import { VersionRuleEditor } from './VersionRuleEditor'
import { FactsView, RecipesView } from './FactsView'
import { apiErrorMessage, formatBytes, formatDate, shortSha } from './packageUi'

export function VersionDetail({ packageId, version }: { packageId: string; version: string }) {
  const [recommendations, setRecommendations] = useState<RecipeRecommendations | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setRecommendations(null)
    setError(null)
    getRecipeRecommendations(packageId, version)
      .then((data) => !cancelled && setRecommendations(data))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not load this version.')))

    return () => {
      cancelled = true
    }
  }, [packageId, version])

  if (error) return <div role="alert" className="text-sm text-red-600">{error}</div>
  if (!recommendations) return <Spin />

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-base font-semibold">Facts</h3>
        <FactsView facts={recommendations.facts} inspected={recommendations.inspected} />
      </section>
      <section>
        <h3 className="mb-2 text-base font-semibold">Recommended recipes</h3>
        <RecipesView recommendations={recommendations} />
      </section>
    </div>
  )
}

const SquidPackageDetail = () => {
  const { packageId: encoded = '' } = useParams()
  const packageId = decodeURIComponent(encoded)
  const { space } = useSpace()
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const canEdit = hasPermission('FeedEdit')
  const [feedId, setFeedId] = useState<number | null>(null)
  const [versions, setVersions] = useState<BuiltInPackageVersionDto[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([listBuiltInPackageVersions(packageId), listBuiltInPackages(packageId)])
      .then(([list, packages]) => {
        setVersions(list)
        setFeedId(packages.feedId)
      })
      .catch((error) => message.error(apiErrorMessage(error, 'Failed to load versions')))
      .finally(() => setLoading(false))
  }, [packageId])

  useEffect(() => {
    if (space?.id) load()
  }, [space?.id, load])

  return (
    <PageContainer title={packageId} actions={<Link to={`/${space.slug}/library/packages`}>All packages</Link>}>
      {feedId != null && (
        <section className="mb-4 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-base font-semibold">Version rule</h2>
          <VersionRuleEditor feedId={feedId} packageId={packageId} canEdit={canEdit} />
        </section>
      )}
      <div className="mb-4">
        <UploadPanel canEdit={canEdit} feedId={feedId} spaceId={space.id} onUploaded={load} />
      </div>
      <Table<BuiltInPackageVersionDto>
        rowKey="id"
        loading={loading}
        dataSource={versions}
        pagination={false}
        locale={{ emptyText: 'No versions.' }}
        onRow={(row) => ({ onClick: () => setSelected(row.version), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Version', dataIndex: 'version', render: (value: string) => <span className="font-semibold text-squid-blue">{value}</span> },
          { title: 'Size', dataIndex: 'sizeBytes', render: (value: number) => formatBytes(value) },
          { title: 'SHA-256', dataIndex: 'sha256', render: (value: string) => <code title={value}>{shortSha(value)}</code> },
          { title: 'Published', dataIndex: 'publishedDate', render: (value: string) => formatDate(value) },
          { title: 'Source', dataIndex: 'source', render: (value: string) => <Tag>{value}</Tag> },
        ]}
      />
      <Drawer title={selected ? `${packageId} ${selected}` : ''} width={560} open={selected != null} onClose={() => setSelected(null)}>
        {selected != null && <VersionDetail packageId={packageId} version={selected} />}
      </Drawer>
    </PageContainer>
  )
}

export default SquidPackageDetail
