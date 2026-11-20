import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Alert } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { useOutletContext } from 'react-router-dom'
import {
  getRunbookApiErrorDetails,
  updateRunbook,
} from 'pages/apis/runbook'
import { RunbookMetadataFields, type RunbookFieldName, type RunbookMetadataValue } from './RunbookMetadataFields'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { resolveRunbookValidationField, validateRunbookMetadata } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'

export default function RunbookSettingsPage() {
  const { runbook, setRunbook, canEdit, registerSettingsActions } = useOutletContext<RunbookDetailOutletContext>()
  const { project } = useProjectRunbookContext()
  const [metadata, setMetadata] = useState<RunbookMetadataValue>({
    name: runbook.name,
    description: runbook.description ?? '',
    tags: runbook.tags ?? [],
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RunbookFieldName, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMetadata({
      name: runbook.name,
      description: runbook.description ?? '',
      tags: runbook.tags ?? [],
    })
  }, [runbook])

  const resetMetadata = () => {
    setMetadata({ name: runbook.name, description: runbook.description ?? '', tags: runbook.tags ?? [] })
    setFieldErrors({})
    setFormError(null)
  }

  const save = useCallback(async () => {
    if (!project || !canEdit) return
    const validation = validateRunbookMetadata(metadata)
    if (validation) {
      setFieldErrors({ [validation.field]: validation.message })
      setFormError(validation.message)
      return
    }

    setSaving(true)
    setFieldErrors({})
    setFormError(null)
    try {
      const updated = await updateRunbook({
        id: runbook.id,
        projectId: project.id,
        spaceId: project.spaceId,
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
      })
      setRunbook(updated)
      setMetadata({ name: updated.name, description: updated.description ?? '', tags: updated.tags ?? [] })
    } catch (caught) {
      const details = getRunbookApiErrorDetails(caught)
      const field = resolveRunbookValidationField(details)
      setFieldErrors(field ? { [field]: details.message } : {})
      setFormError(details.message)
    } finally {
      setSaving(false)
    }
  }, [canEdit, metadata, project, runbook.id, setRunbook])

  const hasMetadata = metadata.name === runbook.name
    && metadata.description === (runbook.description ?? '')
    && metadata.tags.join('\u0000') === (runbook.tags ?? []).join('\u0000')

  useEffect(() => {
    registerSettingsActions({
      dirty: !hasMetadata,
      saving,
      save,
    })
    return () => registerSettingsActions(null)
  }, [hasMetadata, registerSettingsActions, save, saving])

  const toggleSection = (key: string) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  const allExpanded = ['name', 'description', 'tags'].every((key) => openSections[key])

  const summaryRows = [
    { key: 'environments', label: 'Environments', value: 'This runbook can be run in any environment (default)' },
    { key: 'multitenancy', label: 'Multi-tenancy', value: 'Runbook cannot be run against a tenant (default)' },
    { key: 'target-status', label: 'Deployment Target Status', value: 'Runbook will fail if a target is unavailable (default)' },
    { key: 'failure-mode', label: 'Default Failure Mode', value: 'Use the default setting from the target environment (default)' },
    { key: 'retention', label: 'Retention Policy', value: 'Use default retention policy' },
    { key: 'package-download', label: 'Force Package Download', value: 'Use cached packages (if available) (default)' },
    { key: 'target-discovery', label: 'Fail Target Discovery', value: 'Skip discovery steps with no matching targets (default)' },
  ]

  return (
    <div className="min-h-full bg-white">
      <div className="flex justify-end border-b border-slate-200 px-4 py-1.5 sm:px-5">
        <button
          type="button"
          onClick={() => setOpenSections(allExpanded ? {} : { name: true, description: true, tags: true })}
          className="border-0 bg-transparent px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 hover:text-squid-blue"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {formError ? <div className="px-4 py-2.5 sm:px-5"><Alert type="error" showIcon message={formError} /></div> : null}
      {!canEdit ? <div className="px-4 py-2.5 sm:px-5"><Alert type="warning" showIcon message="RunbookEdit is required to change settings." /></div> : null}

      <SettingsSection
        label="Name"
        summary={metadata.name || 'No name provided'}
        open={Boolean(openSections.name)}
        onToggle={() => toggleSection('name')}
      >
        <RunbookMetadataFields
          value={metadata}
          disabled={!canEdit || saving}
          fieldErrors={fieldErrors}
          fields={['name']}
          showFieldLabels={false}
          onChange={(next) => { setMetadata(next); setFormError(null) }}
        />
      </SettingsSection>

      <SettingsSection
        label="Description"
        summary={metadata.description || 'No description provided'}
        open={Boolean(openSections.description)}
        onToggle={() => toggleSection('description')}
      >
        <RunbookMetadataFields
          value={metadata}
          disabled={!canEdit || saving}
          fieldErrors={fieldErrors}
          fields={['description']}
          showFieldLabels={false}
          onChange={(next) => { setMetadata(next); setFormError(null) }}
        />
      </SettingsSection>

      <SettingsSection
        label="Tags"
        summary={metadata.tags.length ? metadata.tags.join(', ') : 'No tags'}
        open={Boolean(openSections.tags)}
        onToggle={() => toggleSection('tags')}
      >
        <RunbookMetadataFields
          value={metadata}
          disabled={!canEdit || saving}
          fieldErrors={fieldErrors}
          fields={['tags']}
          showFieldLabels={false}
          onChange={(next) => { setMetadata(next); setFormError(null) }}
        />
      </SettingsSection>

      <div className="border-y border-slate-200 bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700 sm:px-5">
        Run Settings
      </div>

      {summaryRows.map((row) => (
        <div
          key={row.key}
          className="grid min-h-[42px] grid-cols-[minmax(0,1fr)_20px] items-center gap-x-3 border-b border-slate-200 px-4 py-2 sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_20px] sm:gap-x-5 sm:px-5"
        >
          <span className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">{row.label}</span>
          <span className="col-start-1 row-start-2 mt-0.5 min-w-0 break-words text-sm leading-5 text-slate-600 sm:col-start-2 sm:row-start-1 sm:mt-0">
            {row.value}
          </span>
          <DownOutlined className="col-start-2 row-span-2 row-start-1 flex-shrink-0 justify-self-end text-xs text-slate-500 sm:col-start-3 sm:row-span-1" />
        </div>
      ))}

      {!hasMetadata && canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 sm:px-5">
          <span className="text-xs text-slate-500">You have unsaved settings changes.</span>
          <button type="button" onClick={resetMetadata} className="border-0 bg-transparent text-sm font-medium text-squid-blue hover:underline">
            Discard changes
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SettingsSection({
  label,
  summary,
  open = false,
  onToggle,
  compact = false,
  children,
}: {
  label: string
  summary: string
  open?: boolean
  onToggle?: () => void
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={Boolean(open)}
        disabled={!onToggle}
        className="grid min-h-[46px] w-full grid-cols-[minmax(0,1fr)_20px] items-center gap-x-3 px-4 py-2 text-left transition-colors enabled:hover:bg-slate-50 sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_20px] sm:gap-x-5 sm:px-5"
      >
        <span className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-900">{label}</span>
        <span className="col-start-1 row-start-2 mt-0.5 min-w-0 break-words text-sm leading-5 text-slate-600 sm:col-start-2 sm:row-start-1 sm:mt-0">
          {summary}
        </span>
        <DownOutlined className={`col-start-2 row-span-2 row-start-1 justify-self-end text-xs text-slate-500 transition-transform sm:col-start-3 sm:row-span-1 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className={`border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5 ${compact ? '' : 'sm:pl-[calc(1.25rem+240px+1.25rem)]'}`}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
