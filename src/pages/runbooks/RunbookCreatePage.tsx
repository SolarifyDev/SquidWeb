import { useState } from 'react'
import { Alert, Button, Input, Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import { createRunbook, getRunbookApiErrorDetails, type RunbookDto } from 'pages/apis/runbook'
import { RunbookMetadataFields, type RunbookFieldName, type RunbookMetadataValue } from './RunbookMetadataFields'
import { OUTLINE_BLUE_CLASS, PRIMARY_GREEN_CLASS } from './RunbookPageShell'
import {
  buildRunbookPath,
  buildRunbooksPath,
  resolveRunbookValidationField,
  validateRunbookMetadata,
} from './shared'
import { useProjectRunbookContext } from './useProjectRunbookContext'
import { useRunbookAccess } from './useRunbookAccess'

const emptyMetadata: RunbookMetadataValue = { name: '', description: '', tags: [] }

export default function RunbookCreatePage() {
  const navigate = useNavigate()
  const { spaceId, projectName, project, loading, error } = useProjectRunbookContext()
  const { canEdit, canView, permissionsLoading, probeViewAccess } = useRunbookAccess(project?.id ?? null, project?.spaceId ?? null)
  const [metadata, setMetadata] = useState<RunbookMetadataValue>(emptyMetadata)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RunbookFieldName, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const listPath = buildRunbooksPath(spaceId, projectName ?? '')

  const save = async () => {
    if (!project) return
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
      const created: RunbookDto = await createRunbook({
        projectId: project.id,
        spaceId: project.spaceId,
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
      })
      navigate(buildRunbookPath(spaceId, projectName ?? '', created.id))
    } catch (caught) {
      const details = getRunbookApiErrorDetails(caught)
      const field = resolveRunbookValidationField(details)
      setFieldErrors(field ? { [field]: details.message } : {})
      setFormError(details.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || permissionsLoading) {
    return <PageContainer><div className="flex min-h-[320px] items-center justify-center"><Spin /></div></PageContainer>
  }

  if (error || !project) {
    return <PageContainer><Alert type="error" showIcon message={error ?? 'Project not found.'} /></PageContainer>
  }

  if (!canEdit && !canView) {
    return (
      <PageContainer>
        <Alert
          type="warning"
          showIcon
          message="You do not have permission to view Runbooks in this project."
          description={<Button onClick={() => void probeViewAccess()}>Retry access check</Button>}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="!max-w-[1600px] !py-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <header className="border-b border-slate-200 px-6 py-4">
          <Link to={listPath} className="inline-flex items-center gap-1.5 text-sm font-medium text-squid-blue hover:underline">
            <ArrowLeftOutlined className="text-[12px]" />
            Runbooks
          </Link>
          <h1 className="m-0 mt-3 text-[20px] font-semibold text-slate-900">Add New Runbook</h1>
        </header>

        <div className="px-6 py-7">
          <div className="max-w-[760px]">
            {formError ? <Alert className="mb-5" type="error" showIcon message={formError} /> : null}
            {!canEdit ? <Alert className="mb-5" type="warning" showIcon message="RunbookEdit is required to create a Runbook." /> : null}

            <RunbookMetadataFields
              value={metadata}
              disabled={saving || !canEdit}
              fieldErrors={fieldErrors}
              onChange={(next) => {
                setMetadata(next)
                setFormError(null)
              }}
            />

            <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">
              Any description will be shown at the top of this Runbook&apos;s Overview page.
            </p>

            <div className="mt-7 flex justify-end gap-2 border-t border-slate-200 pt-5">
              <Button className={OUTLINE_BLUE_CLASS} onClick={() => navigate(listPath)} disabled={saving}>Cancel</Button>
              <Button className={PRIMARY_GREEN_CLASS} loading={saving} disabled={!canEdit} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
