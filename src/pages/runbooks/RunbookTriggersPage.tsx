import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, Input, Modal, Select, Spin, Switch, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { usePermissions } from 'contexts/PermissionContext'
import { getRunbooks, type RunbookDto } from 'pages/apis/runbook'
import { OUTLINE_BLUE_CLASS, PRIMARY_GREEN_CLASS } from './RunbookPageShell'
import { PREVIEW_ENVIRONMENTS, useSessionPreview } from './runbookPreview'
import { buildRunbooksPath, parsePositiveId } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'

const SCHEDULES = [
  { value: 'Once', label: 'Once' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
]

interface TriggerPreview {
  id: string
  name: string
  runbookId: number
  environment: string
  interval: string
  startAt: string
  enabled: boolean
}

const EMPTY_TRIGGERS: TriggerPreview[] = []

export default function RunbookTriggersPage() {
  const { spaceId, projectName, project, error, loading } = useProjectRunbookContext()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [search, setSearch] = useSearchParams()
  const selectedRunbookId = parsePositiveId(search.get('runbook') ?? undefined)
  const canEdit = !permissionsLoading && hasPermission('RunbookEdit')
  const [triggers, setTriggers] = useSessionPreview(`squid.runbook-triggers.v1:${project?.spaceId}:${project?.id}`, EMPTY_TRIGGERS)
  const [runbooks, setRunbooks] = useState<RunbookDto[]>([])
  const [loadError, setLoadError] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [draft, setDraft] = useState<TriggerPreview | null>(null)
  const [formError, setFormError] = useState('')
  const listPath = buildRunbooksPath(spaceId, projectName ?? '')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!project) return
    let active = true
    setListLoading(true)
    setLoadError(false)
    void getRunbooks({ projectId: project.id, spaceId: project.spaceId, pageSize: 500 })
      .then((response) => { if (active) setRunbooks(response.runbooks ?? []) })
      .catch(() => {
        if (!active) return
        setRunbooks([])
        setLoadError(true)
      })
      .finally(() => { if (active) setListLoading(false) })
    return () => { active = false }
  }, [project, reloadKey])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])
  const openEditor = (trigger: TriggerPreview) => {
    setFormError('')
    setDraft(trigger)
  }
  const changeDraft = (change: Partial<TriggerPreview>) => {
    setDraft((current) => current ? { ...current, ...change } : null)
    setFormError('')
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || !draft) return
    if (!draft.name.trim() || !runbooks.some((runbook) => runbook.id === draft.runbookId) || !draft.environment || !draft.startAt) {
      setFormError('Enter a name, Runbook, environment, and start time.')
      return
    }
    if (!draft.id && !(new Date(draft.startAt).getTime() > Date.now())) {
      setFormError('Choose a start time in the future.')
      return
    }
    const updated = { ...draft, name: draft.name.trim(), id: draft.id || crypto.randomUUID() }
    setTriggers([updated, ...triggers.filter((trigger) => trigger.id !== updated.id)])
    setDraft(null)
    if (selectedRunbookId && updated.runbookId !== selectedRunbookId) setSearch({ runbook: String(updated.runbookId) })
  }

  if (loading) return <PageContainer><Spin /></PageContainer>
  if (!project || error) return <PageContainer><Alert type="error" showIcon message={error ?? 'Project not found.'} /></PageContainer>

  const options = runbooks.map((runbook) => ({ value: runbook.id, label: runbook.name }))
  if (selectedRunbookId && !options.some((option) => option.value === selectedRunbookId)) {
    options.push({ value: selectedRunbookId, label: `Runbook #${selectedRunbookId}` })
  }
  const visibleTriggers = triggers.filter((trigger) => !selectedRunbookId || trigger.runbookId === selectedRunbookId)

  return (
    <PageContainer className="!max-w-[1600px] !py-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <Link to={listPath} className="text-sm font-medium text-squid-blue hover:underline">Runbooks</Link>
            <h1 className="mb-0 mt-2 text-xl font-semibold text-slate-900">Runbook Triggers</h1>
          </div>
          <Button icon={<PlusOutlined />} className={PRIMARY_GREEN_CLASS} disabled={!canEdit || listLoading || !runbooks.length}
            onClick={() => openEditor({ id: '', name: '', runbookId: selectedRunbookId ?? 0, environment: '', interval: 'Daily', startAt: '', enabled: true })}>
            Add Scheduled Trigger
          </Button>
        </header>
        <div className="space-y-4 px-5 py-4 sm:px-7">
          <Alert type="info" showIcon message="Preview schedules are saved in this tab. They never enqueue runs." />
          {loadError ? (
            <Alert type="error" showIcon message="Unable to load Runbooks."
              action={<Button size="small" onClick={reload}>Retry</Button>} />
          ) : null}
          {listLoading ? <Spin /> : (
            <>
              <Select className="w-full max-w-xs" aria-label="Filter triggers by Runbook" placeholder="All Runbooks"
                allowClear value={selectedRunbookId ?? undefined} options={options}
                onChange={(id) => setSearch(id ? { runbook: String(id) } : {})} />
              {visibleTriggers.length ? (
                <ul className="m-0 list-none divide-y divide-slate-200 rounded border border-slate-200 p-0">
                  {visibleTriggers.map((trigger) => (
                    <li key={trigger.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <div className="font-semibold text-slate-900">{trigger.name}</div>
                        <p className="mb-0 mt-1 text-sm text-slate-500">
                          {options.find((option) => option.value === trigger.runbookId)?.label ?? `Runbook #${trigger.runbookId}`}
                          {' · '}{trigger.environment}{' · '}{trigger.interval}{' · '}{trigger.startAt.replace('T', ' ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Tag color={trigger.enabled ? 'green' : 'default'}>{trigger.enabled ? 'Enabled' : 'Disabled'}</Tag>
                        <Switch checked={trigger.enabled} disabled={!canEdit} aria-label={`Enable ${trigger.name}`}
                          onChange={(enabled) => setTriggers(triggers.map((item) => item.id === trigger.id ? { ...item, enabled } : item))} />
                        <Button className={OUTLINE_BLUE_CLASS} disabled={!canEdit} onClick={() => openEditor(trigger)}>Edit</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <div className="rounded border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-500">No scheduled triggers.</div>}
            </>
          )}
        </div>
      </div>

      <Modal open={Boolean(draft)} title={draft?.id ? 'Edit Scheduled Trigger' : 'Add Scheduled Trigger'} onCancel={() => setDraft(null)}
        okText="Save" okButtonProps={{ form: 'runbook-trigger-form', htmlType: 'submit', disabled: !canEdit }}>
        {draft ? (
          <form id="runbook-trigger-form" onSubmit={submit} className="grid gap-3 py-3">
            {formError ? <Alert type="error" showIcon message={formError} /> : null}
            <label>Name<Input maxLength={100} value={draft.name} onChange={(event) => changeDraft({ name: event.target.value })} /></label>
            <div>
              <label htmlFor="trigger-runbook">Runbook</label>
              <Select id="trigger-runbook" className="w-full" value={draft.runbookId || undefined}
                options={runbooks.map((runbook) => ({ value: runbook.id, label: runbook.name }))}
                onChange={(runbookId) => changeDraft({ runbookId })} />
            </div>
            <div>
              <label htmlFor="trigger-environment">Environment</label>
              <Select id="trigger-environment" className="w-full" value={draft.environment || undefined}
                options={PREVIEW_ENVIRONMENTS.map((environment) => ({ value: environment, label: environment }))}
                onChange={(environment) => changeDraft({ environment })} />
            </div>
            <div>
              <label htmlFor="trigger-schedule">Schedule</label>
              <Select id="trigger-schedule" className="w-full" value={draft.interval}
                options={SCHEDULES} onChange={(interval) => changeDraft({ interval })} />
            </div>
            <label>Start time (local)<Input type="datetime-local" value={draft.startAt}
              onChange={(event) => changeDraft({ startAt: event.target.value })} /></label>
          </form>
        ) : null}
      </Modal>
    </PageContainer>
  )
}
