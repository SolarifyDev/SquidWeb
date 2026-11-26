import { Input, Select } from 'antd'
import {
  RUNBOOK_DESCRIPTION_MAX_LENGTH,
  RUNBOOK_NAME_MAX_LENGTH,
  RUNBOOK_TAGS_MAX_COUNT,
  RUNBOOK_TAG_MAX_LENGTH,
} from './shared'

export type RunbookFieldName = 'name' | 'description' | 'tags'

export interface RunbookMetadataValue {
  name: string
  description: string
  tags: string[]
}

export interface RunbookMetadataFieldsProps {
  value: RunbookMetadataValue
  disabled?: boolean
  fieldErrors?: Partial<Record<RunbookFieldName, string>>
  fields?: RunbookFieldName[]
  showFieldLabels?: boolean
  onChange: (value: RunbookMetadataValue) => void
}

export function RunbookMetadataFields({
  value,
  disabled = false,
  fieldErrors = {},
  fields = ['name', 'description', 'tags'],
  showFieldLabels = true,
  onChange,
}: RunbookMetadataFieldsProps) {
  const update = <K extends keyof RunbookMetadataValue>(key: K, next: RunbookMetadataValue[K]) => {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="space-y-4">
      {fields.includes('name') ? <div>
        {showFieldLabels ? (
          <label htmlFor="runbook-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Name
          </label>
        ) : null}
        <Input
          id="runbook-name"
          value={value.name}
          disabled={disabled}
          maxLength={RUNBOOK_NAME_MAX_LENGTH}
          showCount
          status={fieldErrors.name ? 'error' : undefined}
          placeholder="Runbook name"
          onChange={(event) => update('name', event.target.value)}
          autoFocus
        />
        {fieldErrors.name ? <div className="mt-1 text-sm text-red-600">{fieldErrors.name}</div> : null}
      </div> : null}

      {fields.includes('description') ? <div>
        {showFieldLabels ? (
          <label htmlFor="runbook-description" className="mb-1.5 block text-sm font-medium text-slate-700">
            Description
          </label>
        ) : null}
        <Input.TextArea
          id="runbook-description"
          aria-label="Description"
          value={value.description}
          disabled={disabled}
          maxLength={RUNBOOK_DESCRIPTION_MAX_LENGTH}
          showCount
          autoSize={{ minRows: 4, maxRows: 8 }}
          status={fieldErrors.description ? 'error' : undefined}
          placeholder="Describe what this Runbook is for"
          onChange={(event) => update('description', event.target.value)}
        />
        {fieldErrors.description ? (
          <div className="mt-1 text-sm text-red-600">{fieldErrors.description}</div>
        ) : null}
      </div> : null}

      {fields.includes('tags') ? <div>
        {showFieldLabels ? (
          <label htmlFor="runbook-tags" className="mb-1.5 block text-sm font-medium text-slate-700">
            Tags
          </label>
        ) : null}
        <Select
          id="runbook-tags"
          aria-label="Tags"
          mode="tags"
          value={value.tags}
          disabled={disabled}
          status={fieldErrors.tags ? 'error' : undefined}
          tokenSeparators={[',']}
          maxCount={RUNBOOK_TAGS_MAX_COUNT}
          placeholder="Add tags"
          className="w-full"
          onChange={(tags) => update('tags', tags)}
          tagRender={({ label, value: tagValue, closable, onClose }) => (
            <span className="mr-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              {String(label).slice(0, RUNBOOK_TAG_MAX_LENGTH)}
              {closable ? (
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 text-slate-400 hover:text-slate-700"
                  aria-label={`Remove ${String(tagValue)}`}
                  onClick={onClose}
                >
                  ×
                </button>
              ) : null}
            </span>
          )}
        />
        {fieldErrors.tags ? <div className="mt-1 text-sm text-red-600">{fieldErrors.tags}</div> : null}
      </div> : null}
    </div>
  )
}
