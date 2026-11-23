import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Input, Modal, Spin, Tag } from 'antd'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { usePermissions } from 'contexts/PermissionContext'
import { copyRunbook, deleteRunbook, getRunbook, getRunbookApiErrorDetails, type RunbookDto, type RunbookPublishedSnapshotDto } from 'pages/apis/runbook'
import RunbookPageShell, { OUTLINE_BLUE_CLASS, PRIMARY_GREEN_CLASS, type RunbookTab } from './RunbookPageShell'
import RunbookPublishAction from './RunbookPublishAction'
import { buildRunbookPath, buildRunbookProcessPath, buildRunbooksPath, parsePositiveId, upsertProjectLookupCache } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'
import { useRunbookProcessState, type RunbookProcessState } from './useRunbookProcessState'
import { useRunbookPreview } from './runbookPreview'

export type RunbookDetailOutletContext = {
  runbook: RunbookDto
  setRunbook: (runbook: RunbookDto) => void
  reloadRunbook: () => Promise<void>
  canEdit: boolean
  processState: RunbookProcessState
  preview: ReturnType<typeof useRunbookPreview>[0]
  setPreview: ReturnType<typeof useRunbookPreview>[1]
  registerSettingsActions: (actions: RunbookSettingsActions | null) => void
}

export type RunbookSettingsActions = {
  dirty: boolean
  saving: boolean
  save: () => Promise<void>
}

const TAB_PATHS: Record<RunbookTab, string> = {
  overview: '',
  runs: 'runs',
  process: 'process',
  settings: 'settings',
}

function resolveTab(section: string | undefined): RunbookTab {
  if (section === 'run' || section === 'runs') return 'runs'
  if (section === 'process' || section === 'publish') return 'process'
  if (section === 'settings') return 'settings'
  return 'overview'
}

export default function RunbookDetailLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { runbookId: routeRunbookId } = useParams<{ runbookId: string }>()
  const runbookId = parsePositiveId(routeRunbookId)
  const { spaceId, projectName, project, loading: projectLoading, error: projectError } = useProjectRunbookContext()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [runbook, setRunbookState] = useState<RunbookDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [copying, setCopying] = useState(false)
  const [settingsActions, setSettingsActions] = useState<RunbookSettingsActions | null>(null)
  const canEdit = !permissionsLoading && hasPermission('RunbookEdit')
  const canPublish = !permissionsLoading && hasPermission('RunbookPublish')
  const processState = useRunbookProcessState(project?.id ?? null, runbook)
  const [preview, setPreview] = useRunbookPreview(runbook)
  const [, section, subPage] = location.pathname.match(/\/operations\/runbooks\/\d+(?:\/([^/]+))?(?:\/([^/]+))?/) ?? []
  const activeTab = resolveTab(section)
  const isWorkflowPage = section === 'run' || section === 'publish' || section === 'audit' || (section === 'runs' && Boolean(subPage))

  useEffect(() => {
    if (!canEdit || !runbook || !(location.state as { openCopy?: boolean } | null)?.openCopy) return
    setCopyName(`${runbook.name} copy`)
    setCopyOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [canEdit, location.pathname, location.state, navigate, runbook])

  const load = useCallback(async () => {
    if (!project || !runbookId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const loaded = await getRunbook(runbookId, project.id, project.spaceId)
      setRunbookState(loaded)
    } catch (caught) {
      setRunbookState(null)
      setError(getRunbookApiErrorDetails(caught).message)
    } finally {
      setLoading(false)
    }
  }, [project, runbookId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (project) upsertProjectLookupCache(project)
  }, [project])

  const setRunbook = useCallback((next: RunbookDto) => {
    // Metadata updates do not return the published snapshot details.
    setRunbookState((current) => current?.id === next.id
      ? { ...next, publishedSnapshotId: current.publishedSnapshotId, publishedSnapshot: current.publishedSnapshot }
      : current)
    setError(null)
  }, [])

  const recordPublication = useCallback((snapshot: RunbookPublishedSnapshotDto) => {
    setRunbookState((current) => current?.id === snapshot.runbookId
      ? { ...current, publishedSnapshotId: snapshot.id, publishedSnapshot: snapshot }
      : current)
  }, [])

  const registerSettingsActions = useCallback((actions: RunbookSettingsActions | null) => {
    setSettingsActions(actions)
  }, [])

  useEffect(() => {
    if (activeTab !== 'settings') setSettingsActions(null)
  }, [activeTab])

  const confirmDelete = async () => {
    if (!canEdit || !project || !runbook || deleteConfirmation !== runbook.name) return
    setDeleting(true)
    try {
      await deleteRunbook({ id: runbook.id, projectId: project.id, spaceId: project.spaceId })
      navigate(buildRunbooksPath(spaceId, projectName ?? ''), { replace: true })
    } catch (caught) {
      setError(getRunbookApiErrorDetails(caught).message)
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const confirmCopy = async () => {
    if (!canEdit || !project || !runbook || !copyName.trim()) return
    setCopying(true)
    try {
      const copied = await copyRunbook({
        sourceRunbookId: runbook.id,
        projectId: project.id,
        spaceId: project.spaceId,
        name: copyName,
      })
      setCopyOpen(false)
      navigate(buildRunbookPath(spaceId, projectName ?? '', copied.id))
    } catch (caught) {
      setError(getRunbookApiErrorDetails(caught).message)
      setCopyOpen(false)
    } finally {
      setCopying(false)
    }
  }

  const outletContext: RunbookDetailOutletContext | null = runbook
    ? { runbook, setRunbook, reloadRunbook: load, canEdit, processState, preview, setPreview, registerSettingsActions }
    : null

  if (projectLoading || loading) {
    return <PageContainer><div className="flex min-h-[420px] items-center justify-center"><Spin /></div></PageContainer>
  }

  if (projectError || !project) {
    return <PageContainer><Alert type="error" showIcon message={projectError ?? 'Project not found.'} /></PageContainer>
  }

  if (!runbookId) {
    return <PageContainer><Alert type="error" showIcon message="Invalid Runbook identifier." /></PageContainer>
  }

  if (error || !runbook) {
    return (
      <PageContainer>
        <Alert
          type="error"
          showIcon
          message="Failed to load Runbook."
          description={error}
          action={<Button size="small" onClick={() => void load()}>Retry</Button>}
        />
      </PageContainer>
    )
  }

  const basePath = buildRunbookPath(spaceId, projectName ?? '', runbook.id)
  const processPath = buildRunbookProcessPath(spaceId, projectName ?? '', runbook.id)
  const showWorkflowActions = !isWorkflowPage && !subPage && activeTab !== 'settings'
  const publishAction = showWorkflowActions && canPublish
    ? <RunbookPublishAction key={runbook.id} runbook={runbook} onPublished={recordPublication} />
    : null
  const primaryActions = activeTab === 'settings' && canEdit ? (
    <Button
      className={PRIMARY_GREEN_CLASS}
      loading={settingsActions?.saving}
      disabled={!settingsActions?.dirty || settingsActions.saving}
      onClick={() => void settingsActions?.save()}
    >
      Save
    </Button>
  ) : showWorkflowActions && (processState.hasProcess || preview.snapshot) ? (
    <>
      {canEdit && processState.hasProcess ? <Link className={OUTLINE_BLUE_CLASS} to={`${basePath}/publish`}>Publish...</Link> : null}
      <Link to={`${basePath}/run`} className={PRIMARY_GREEN_CLASS}>Run...</Link>
    </>
  ) : showWorkflowActions && activeTab !== 'process' && canEdit && !processState.processLoading && !processState.processUnavailable ? (
    <Link to={processPath} className={PRIMARY_GREEN_CLASS}>Define your Runbook Process</Link>
  ) : undefined

  return (
    <PageContainer className="!flex !h-full !min-h-0 !max-w-[1680px] !flex-col !py-4">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <RunbookPageShell
          runbook={runbook}
          spaceId={spaceId}
          projectName={projectName ?? ''}
          activeTab={activeTab}
          defaultAction={null}
          renderShell={false}
          forceAside={!isWorkflowPage && activeTab === 'overview'}
          hideProcessAside={isWorkflowPage}
          actions={<>{publishAction}{primaryActions}</>}
          menuItems={canEdit ? [
            { key: 'clone', label: 'Clone' },
            { key: 'audit', label: 'Audit Trail' },
            { type: 'divider' },
            { key: 'delete', label: 'Delete Runbook', danger: true },
          ] : [
            { key: 'audit', label: 'Audit Trail' },
          ]}
          onMenuClick={(key) => {
            if (key === 'clone') {
              setCopyName(`${runbook.name} copy`)
              setCopyOpen(true)
              return
            }
            if (key === 'audit') {
              navigate(`${basePath}/audit`)
              return
            }
            if (key === 'delete') {
              setDeleteConfirmation('')
              setDeleteOpen(true)
            }
          }}
        >
          {!isWorkflowPage && activeTab === 'process' && !subPage && preview.snapshot ? (
            <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-700">
              <Tag color="blue">Preview snapshot</Tag> {preview.snapshot.name}
            </div>
          ) : null}
          <Outlet key={runbook.id} context={outletContext} />
        </RunbookPageShell>
      </div>

      <Modal
        open={deleteOpen}
        title={`Delete ${runbook.name}?`}
        okText="Delete"
        okButtonProps={{ danger: true, disabled: deleteConfirmation !== runbook.name, loading: deleting }}
        onOk={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteOpen(false)}
        centered
      >
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="This is a destructive action"
          description="The Runbook and its owned draft process will be permanently deleted."
        />
        <label className="mb-2 block text-sm text-slate-700">
          Type <strong>{runbook.name}</strong> to confirm.
        </label>
        <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoFocus />
      </Modal>

      <Modal
        open={copyOpen}
        title="Copy Runbook"
        okText="Copy"
        confirmLoading={copying}
        okButtonProps={{ disabled: !copyName.trim() }}
        onOk={() => void confirmCopy()}
        onCancel={() => !copying && setCopyOpen(false)}
        centered
      >
        <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
        <Input aria-label="Runbook copy name" value={copyName} maxLength={200} onChange={(event) => setCopyName(event.target.value)} autoFocus />
      </Modal>
    </PageContainer>
  )
}

export { TAB_PATHS }
