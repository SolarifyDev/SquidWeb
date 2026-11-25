import { useEffect, useState } from 'react'
import { Button, Input, Spin } from 'antd'
import { getPackageVersionRule, setPackageVersionRule } from 'pages/apis/builtInPackages'
import { apiErrorMessage, VERSION_PRESETS } from './packageUi'

interface VersionRuleEditorProps {
  feedId: number
  packageId: string
  canEdit: boolean
  onSaved?: (template: string) => void
}

/** The version template that numbers this package's uploads when no version is typed. */
export function VersionRuleEditor({ feedId, packageId, canEdit, onSaved }: VersionRuleEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [template, setTemplate] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    getPackageVersionRule(feedId, packageId)
      .then((rule) => {
        if (cancelled) return
        setSaved(rule.versionTemplate)
        setTemplate(rule.versionTemplate)
        setIsDefault(rule.isDefault)
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not load the version rule.')))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [feedId, packageId])

  const choosePreset = (preset: string) => {
    setTemplate(preset)
    setError(null)
    setJustSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setJustSaved(false)

    try {
      const rule = await setPackageVersionRule(feedId, packageId, template.trim())
      setSaved(rule.versionTemplate)
      setTemplate(rule.versionTemplate)
      setIsDefault(false)
      setJustSaved(true)
      onSaved?.(rule.versionTemplate)
    } catch (err) {
      setError(apiErrorMessage(err, 'The template was not accepted.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spin size="small" />

  return (
    <div data-testid="version-rule-editor">
      <div className="mb-2 text-sm text-gray-600">
        {isDefault ? 'This package uses the default template until you set one.' : 'Used to number an upload when no version is typed.'}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {VERSION_PRESETS.map((preset) => (
          <Button key={preset.key} size="small" disabled={!canEdit} title={preset.hint} onClick={() => choosePreset(preset.template)}>
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="Version template"
          value={template}
          disabled={!canEdit}
          status={error ? 'error' : undefined}
          onChange={(event) => {
            setTemplate(event.target.value)
            setError(null)
            setJustSaved(false)
          }}
          onPressEnter={() => canEdit && template.trim() && void save()}
        />
        {canEdit && (
          <Button type="primary" loading={saving} disabled={!template.trim() || template.trim() === saved} onClick={() => void save()}>
            Save
          </Button>
        )}
      </div>
      {error && (
        <div role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}
      {justSaved && <div className="mt-1 text-sm text-green-600">Saved.</div>}
    </div>
  )
}
