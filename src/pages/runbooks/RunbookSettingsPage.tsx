import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Alert, InputNumber, Radio, Select } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { useOutletContext } from 'react-router-dom'
import {
  getRunbookApiErrorDetails,
  updateRunbook,
} from 'pages/apis/runbook'
import { RunbookMetadataFields, type RunbookFieldName, type RunbookMetadataValue } from './RunbookMetadataFields'
import type { RunbookDetailOutletContext } from './RunbookDetailLayout'
import { FAILURE_MODES, PREVIEW_ENVIRONMENTS, type RunSettings } from './runbookPreview'
import { resolveRunbookValidationField, validateRunbookMetadata } from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'

export default function RunbookSettingsPage() {
  const { runbook, setRunbook, canEdit, registerSettingsActions, preview, setPreview } = useOutletContext<RunbookDetailOutletContext>()
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
  const [settings, setSettings] = useState(preview.settings)
  const metadataDirty = metadata.name !== runbook.name
    || metadata.description !== (runbook.description ?? '')
    || metadata.tags.join('\u0000') !== (runbook.tags ?? []).join('\u0000')
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(preview.settings)
  const dirty = metadataDirty || settingsDirty

  useEffect(() => {
    setMetadata({
      name: runbook.name,
      description: runbook.description ?? '',
      tags: runbook.tags ?? [],
    })
    setSettings(preview.settings)
  }, [runbook, preview.settings])

  const resetMetadata = () => {
    setMetadata({ name: runbook.name, description: runbook.description ?? '', tags: runbook.tags ?? [] })
    setSettings(preview.settings)
    setFieldErrors({})
    setFormError(null)
  }

  const save = useCallback(async () => {
    if (!project || !canEdit) return
    const validation = validateRunbookMetadata(metadata)
    if (validation) {
      setFieldErrors({ [validation.field]: validation.message })
      setOpenSections((current) => ({ ...current, [validation.field]: true }))
      setFormError(validation.message)
      return
    }
    if (settings.scope === 'specific' && !settings.environments.length) {
      setOpenSections((current) => ({ ...current, scope: true }))
      setFormError('Select at least one allowed environment.')
      return
    }
    if (settings.retention === 'custom' && (!Number.isInteger(settings.retainCount) || settings.retainCount < 1)) {
      setOpenSections((current) => ({ ...current, retention: true }))
      setFormError('Enter a positive number of runs to retain.')
      return
    }

    setSaving(true)
    setFieldErrors({})
    setFormError(null)
    try {
      if (metadataDirty) {
        const updated = await updateRunbook({
          id: runbook.id,
          projectId: project.id,
          spaceId: project.spaceId,
          name: metadata.name,
          description: metadata.description,
          tags: metadata.tags,
        })
        setRunbook(updated)
      }
      if (settingsDirty) setPreview({ ...preview, settings })
    } catch (caught) {
      const details = getRunbookApiErrorDetails(caught)
      const field = resolveRunbookValidationField(details)
      setFieldErrors(field ? { [field]: details.message } : {})
      if (field) setOpenSections((current) => ({ ...current, [field]: true }))
      setFormError(details.message)
    } finally {
      setSaving(false)
    }
  }, [canEdit, metadata, metadataDirty, preview, project, runbook.id, setPreview, setRunbook, settings, settingsDirty])

  useEffect(() => {
    registerSettingsActions({
      dirty,
      saving,
      save,
    })
    return () => registerSettingsActions(null)
  }, [dirty, registerSettingsActions, save, saving])

  const toggleSection = (key: string) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  const changeSetting = <K extends keyof RunSettings>(key: K, value: RunSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
    setFormError(null)
  }
  const sectionKeys = ['name', 'description', 'tags', ...RUN_SETTING_ROWS.map(({ key }) => key)]
  const allExpanded = sectionKeys.every((key) => openSections[key])

  return (
    <div className="min-h-full bg-white">
      <div className="flex justify-end border-b border-slate-200 px-4 py-1.5 sm:px-5">
        <button
          type="button"
          onClick={() => setOpenSections(allExpanded ? {} : Object.fromEntries(sectionKeys.map((key) => [key, true])))}
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-200 bg-slate-100 px-4 py-1.5 text-sm text-slate-700 sm:px-5">
        <span className="font-semibold">Run Settings</span>
        <span className="text-xs text-slate-500">Preview settings are saved in this tab</span>
      </div>

      {RUN_SETTING_ROWS.map(({ key, label, options }) => {
        let summary = options.find((option) => option.value === settings[key])?.label ?? ''
        if (key === 'scope' && settings.scope === 'specific' && settings.environments.length) {
          summary = settings.environments.join(', ')
        }
        if (key === 'retention' && settings.retention === 'custom') summary = `Keep ${settings.retainCount} runs per environment`
        const disabled = !canEdit || saving
        return (
          <SettingsSection key={key} label={label} summary={summary} open={Boolean(openSections[key])} onToggle={() => toggleSection(key)}>
            <div className="grid max-w-lg gap-3">
              <Radio.Group className="grid gap-2" aria-label={label} disabled={disabled} value={settings[key]} options={options}
                onChange={(event) => changeSetting(key, event.target.value)} />
              {key === 'scope' && settings.scope === 'specific' ? (
                <Select mode="multiple" aria-label="Allowed environments" placeholder="Select sample environments" value={settings.environments}
                  options={PREVIEW_ENVIRONMENTS.map((name) => ({ label: name, value: name }))}
                  disabled={disabled} onChange={(value) => changeSetting('environments', value)} />
              ) : null}
              {key === 'retention' && settings.retention === 'custom' ? (
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  Runs to keep per environment
                  <InputNumber min={1} precision={0} disabled={disabled} value={settings.retainCount}
                    onChange={(value) => changeSetting('retainCount', value ?? 0)} />
                </label>
              ) : null}
            </div>
          </SettingsSection>
        )
      })}

      {dirty && canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 sm:px-5">
          <span className="text-xs text-slate-500">You have unsaved settings changes.</span>
          <button type="button" disabled={saving} onClick={resetMetadata} className="border-0 bg-transparent text-sm font-medium text-squid-blue hover:underline">
            Discard changes
          </button>
        </div>
      ) : null}
    </div>
  )
}

const RUN_SETTING_ROWS = [
  { key: 'scope', label: 'Environments', options: [
    { value: 'all', label: 'Run in any environment (default)' },
    { value: 'specific', label: 'Run in specific environments' },
  ] },
  { key: 'tenancy', label: 'Multi-tenancy', options: [
    { value: 'untenanted', label: 'Run without a tenant (default)' },
    { value: 'tenanted', label: 'Run against tenants only' },
    { value: 'both', label: 'Run with or without a tenant' },
  ] },
  { key: 'targetStatus', label: 'Deployment Target Status', options: [
    { value: 'fail', label: 'Fail when a target is unavailable (default)' },
    { value: 'skip', label: 'Skip unavailable targets' },
  ] },
  { key: 'failureMode', label: 'Default Failure Mode', options: [...FAILURE_MODES] },
  { key: 'retention', label: 'Retention Policy', options: [
    { value: 'default', label: 'Use default retention policy' },
    { value: 'custom', label: 'Set a custom number of runs to retain' },
  ] },
  { key: 'packageDownload', label: 'Force Package Download', options: [
    { value: 'cached', label: 'Use cached packages when available (default)' },
    { value: 'force', label: 'Always download packages' },
  ] },
  { key: 'targetDiscovery', label: 'Fail Target Discovery', options: [
    { value: 'skip', label: 'Skip steps with no matching targets (default)' },
    { value: 'fail', label: 'Fail when no matching targets are discovered' },
  ] },
] satisfies { key: keyof RunSettings; label: string; options: { value: string; label: string }[] }[]

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
