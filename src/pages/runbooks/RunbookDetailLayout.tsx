import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Modal, Spin, Tooltip, message } from 'antd'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { usePermissions } from 'contexts/PermissionContext'
import { copyRunbook, deleteRunbook, getRunbook, getRunbookApiErrorDetails, type RunbookDto, type RunbookPublishedSnapshotDto } from 'pages/apis/runbook'
import { useNavigate } from 'react-router-dom'
import RunbookPageShell, { PRIMARY_GREEN_CLASS, type RunbookTab } from './RunbookPageShell'
import RunbookPublishAction from './RunbookPublishAction'
import { buildRunbookPath, buildRunbookProcessPath, buildRunbooksPath, parsePositiveId, upsertProjectLookupCache } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'
import { useRunbookProcessState, type RunbookProcessState } from './useRunbookProcessState'

export type RunbookDetailOutletContext = {
  runbook: RunbookDto
  setRunbook: (runbook: RunbookDto) => void
  reloadRunbook: () => Promise<void>
  canEdit: boolean
  processState: RunbookProcessState
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

function resolveTab(pathname: string): RunbookTab {
  if (/\/runs(?:\/|$)/.test(pathname)) return 'runs'
  if (/\/process(?:\/|$)/.test(pathname)) return 'process'
  if (/\/settings(?:\/|$)/.test(pathname)) return 'settings'
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

  useEffect(() => {
    if (!runbook || !(location.state as { openCopy?: boolean } | null)?.openCopy) return
    setCopyName(`${runbook.name} copy`)
    setCopyOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, runbook])

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
    if (resolveTab(location.pathname) !== 'settings') setSettingsActions(null)
  }, [location.pathname])

  const confirmDelete = async () => {
    if (!project || !runbook || deleteConfirmation !== runbook.name) return
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
    if (!project || !runbook || !copyName.trim()) return
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

  const outletContext = useMemo<RunbookDetailOutletContext | null>(() => (
    runbook ? { runbook, setRunbook, reloadRunbook: load, canEdit, processState, registerSettingsActions } : null
  ), [canEdit, load, processState, registerSettingsActions, runbook, setRunbook])

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

  const activeTab = resolveTab(location.pathname)
  const processPath = buildRunbookProcessPath(spaceId, projectName ?? '', runbook.id)
  const hasProcess = processState.hasProcess
  const processStateReady = !processState.loading
  const publishAction = canPublish
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
  ) : activeTab === 'overview' || activeTab === 'runs' ? (
    <>
      {publishAction}
      {!processStateReady ? (
        <div className="h-8 w-28" aria-hidden="true" />
      ) : hasProcess ? (
        <Tooltip title="Runbook execution is not available in this version">
          <Button className={PRIMARY_GREEN_CLASS} onClick={() => message.info('Runbook execution is not available in this version.')}>
            Run...
          </Button>
        </Tooltip>
      ) : (
        <Link to={processPath}>
          <Button className={PRIMARY_GREEN_CLASS}>Define your Runbook Process</Button>
        </Link>
      )}
    </>
  ) : activeTab === 'process' ? publishAction : undefined

  return (
    <PageContainer className="!flex !h-full !min-h-0 !max-w-[1680px] !flex-col !py-4">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <RunbookPageShell
          runbook={runbook}
          spaceId={spaceId}
          projectName={projectName ?? ''}
          activeTab={activeTab}
          renderShell={false}
          forceAside={activeTab === 'overview'}
          actions={primaryActions}
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
              message.info('Audit Trail is not available yet.')
              return
            }
            if (key === 'delete') {
              setDeleteConfirmation('')
              setDeleteOpen(true)
            }
          }}
        >
          <Outlet context={outletContext} />
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
