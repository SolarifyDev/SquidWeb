import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Dropdown, Empty, Input, Spin, Tag } from 'antd'
import { MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { getRunbookApiErrorDetails, getRunbooks, type RunbookDto } from 'pages/apis/runbook'
import { buildRunbookPath, buildRunbooksPath } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'
import { useRunbookAccess } from './useRunbookAccess'

const PRIMARY_GREEN_CLASS =
  '!inline-flex !items-center !justify-center !rounded !border !border-squid-green !bg-squid-green !px-3.5 !py-1.5 !text-[13px] !font-semibold !text-white !shadow-none hover:!border-[#00874d] hover:!bg-[#00874d] disabled:!border-slate-200 disabled:!bg-slate-100 disabled:!text-slate-400'

const RUN_BUTTON_CLASS =
  '!inline-flex !items-center !justify-center !rounded !border !border-squid-blue/45 !bg-white !px-3.5 !py-1 !text-[13px] !font-medium !text-squid-blue !shadow-none hover:!border-squid-blue hover:!bg-blue-50 disabled:!border-slate-200 disabled:!text-slate-400'

export default function RunbooksListPage() {
  const navigate = useNavigate()
  const { spaceId, projectName, project, loading: projectLoading, error: projectError } = useProjectRunbookContext()
  const access = useRunbookAccess(project?.id ?? null, project?.spaceId ?? null)
  const [runbooks, setRunbooks] = useState<RunbookDto[]>([])
  const [count, setCount] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const basePath = buildRunbooksPath(spaceId, projectName ?? '')

  const load = useCallback(async () => {
    if (!project) return
    setLoading(true)
    setLoadError(null)
    try {
      const response = await getRunbooks({
        projectId: project.id,
        spaceId: project.spaceId,
        pageIndex: 1,
        pageSize: 500,
      })
      setRunbooks(response.runbooks ?? [])
      setCount(response.count ?? 0)
    } catch (caught) {
      setRunbooks([])
      setCount(0)
      setLoadError(getRunbookApiErrorDetails(caught).message)
    } finally {
      setLoading(false)
    }
  }, [project])

  useEffect(() => {
    if (!projectLoading && project) void load()
  }, [load, project, projectLoading])

  useEffect(() => {
    if (!project || access.permissionsLoading || access.probeLoading) return
    if (access.canView || access.permissionsKnown) return
    void access.probeViewAccess()
  }, [access, project])

  const filter = keyword.trim().toLowerCase()
  const visibleRunbooks = filter
    ? runbooks.filter((runbook) =>
      runbook.name.toLocaleLowerCase().includes(filter)
      || runbook.description.toLocaleLowerCase().includes(filter)
      || runbook.tags.some((tag) => tag.toLocaleLowerCase().includes(filter)))
    : runbooks

  if (projectLoading) {
    return <PageContainer><div className="flex min-h-[320px] items-center justify-center"><Spin /></div></PageContainer>
  }

  if (projectError || !project) {
    return <PageContainer><Alert type="error" showIcon message={projectError ?? 'Project not found.'} /></PageContainer>
  }

  const accessDenied = access.probeDenied && !access.probeLoading && !access.permissionsLoading
  const accessUnavailable = !access.canView && !access.probeLoading && !access.permissionsLoading

  return (
    <PageContainer className="!max-w-[1600px] !py-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-6">
          <div>
            <h1 className="m-0 text-[20px] font-semibold text-slate-900">Runbooks</h1>
            <p className="mb-0 mt-1 text-sm text-slate-500">
              Runbooks let you automate routine operations against your project.
            </p>
          </div>
          <Button
            className={PRIMARY_GREEN_CLASS}
            icon={<PlusOutlined />}
            disabled={!access.canEdit}
            onClick={() => navigate(`${basePath}/create`)}
          >
            Add Runbook
          </Button>
        </header>

        {access.permissionsError ? (
          <div className="px-6 pb-4">
            <Alert type="warning" showIcon message="Unable to confirm Runbook permissions." description={access.permissionsError} />
          </div>
        ) : null}

        {accessDenied ? (
          <div className="px-6 pb-6 pt-2">
            <Alert
              type="warning"
              showIcon
              message={access.probeError ?? 'RunbookView is required to view Runbooks in this project.'}
              action={<Button size="small" onClick={() => void access.probeViewAccess()}>Retry</Button>}
            />
          </div>
        ) : accessUnavailable ? (
          <div className="px-6 pb-6 pt-2">
            <Alert
              type="error"
              showIcon
              message="Unable to verify access to Runbooks."
              description={access.probeError}
              action={<Button size="small" onClick={() => void access.probeViewAccess()}>Retry</Button>}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 px-4 py-3 sm:px-6">
              <div className="flex w-full max-w-[420px] items-center gap-2 border-b border-slate-400 pb-1.5 focus-within:border-squid-blue">
                <SearchOutlined className="text-slate-500" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Filter by name..."
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  aria-label="Filter Runbooks by name"
                />
              </div>
              <div className="text-xs text-slate-500">
                {count > 0 ? `${count} Runbook${count === 1 ? '' : 's'}` : 'No Runbooks'}
                {!access.canEdit && access.permissionsKnown ? ' · Read-only access' : ''}
              </div>
            </div>

            {loadError ? (
              <div className="p-6">
                <Alert
                  type="error"
                  showIcon
                  message="Failed to load Runbooks."
                  description={loadError}
                  action={<Button size="small" onClick={() => void load()}>Retry</Button>}
                />
              </div>
            ) : loading || access.probeLoading || access.permissionsLoading ? (
              <div className="flex min-h-[260px] items-center justify-center"><Spin /></div>
            ) : visibleRunbooks.length === 0 ? (
              <div className="px-6 py-12">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={filter ? 'No Runbooks match this filter.' : 'No Runbooks in this project yet.'}
                >
                  {!filter && access.canEdit ? (
                    <Button className={PRIMARY_GREEN_CLASS} icon={<PlusOutlined />} onClick={() => navigate(`${basePath}/create`)}>
                      Add Runbook
                    </Button>
                  ) : null}
                </Empty>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {visibleRunbooks.map((runbook) => (
                  <li key={runbook.id} className="border-b border-slate-200 last:border-b-0">
                    <div className="flex flex-wrap items-start gap-3 px-4 py-4 transition-colors hover:bg-slate-50/60 sm:flex-nowrap sm:gap-4 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={buildRunbookPath(spaceId, projectName ?? '', runbook.id)}
                          className="break-words text-[15px] font-semibold text-squid-blue hover:underline"
                        >
                          {runbook.name}
                        </Link>
                        {runbook.description ? (
                          <p className="mb-0 mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
                            {runbook.description}
                          </p>
                        ) : null}
                        {(runbook.tags ?? []).length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {runbook.tags.map((tag) => (
                              <Tag key={tag} className="m-0 border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                                {tag}
                              </Tag>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2 pt-0.5 sm:ml-auto">
                        <Button className={RUN_BUTTON_CLASS} disabled title="Runbook execution is not available in this version">
                          Run...
                        </Button>
                        <Dropdown
                          trigger={['click']}
                          placement="bottomRight"
                          menu={{
                            items: [
                              { key: 'open', label: 'Open' },
                              { key: 'process', label: 'Edit Process' },
                            ],
                            onClick: ({ key }) => {
                              const target = key === 'process'
                                ? `${buildRunbookPath(spaceId, projectName ?? '', runbook.id)}/process`
                                : buildRunbookPath(spaceId, projectName ?? '', runbook.id)
                              navigate(target)
                            },
                          }}
                        >
                          <Button
                            type="text"
                            icon={<MoreOutlined />}
                            className="!h-8 !w-8 !p-0 !text-slate-600"
                            aria-label={`Actions for ${runbook.name}`}
                          />
                        </Dropdown>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
