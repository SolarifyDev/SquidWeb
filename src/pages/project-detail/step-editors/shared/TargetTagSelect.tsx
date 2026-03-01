import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Select, message } from 'antd'
import { getTargetTags, createTargetTag } from 'pages/apis/targetTag'
import { useSpace } from 'contexts/SpaceContext'

interface TargetTagSelectProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TargetTagSelect({ value, onChange, placeholder = 'Add target tags...' }: TargetTagSelectProps) {
  const { space } = useSpace()
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const creatingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    getTargetTags()
      .then((res) => {
        setOptions(res.targetTags.map((t) => ({ value: t.name, label: t.name })))
      })
      .catch(() => message.error('Failed to load target tags'))
      .finally(() => setLoading(false))
  }, [])

  const upsertOption = useCallback((name: string) => {
    setOptions((prev) => {
      const trimmed = name.trim()
      if (!trimmed) return prev

      const exists = prev.some((o) => o.label.trim().toLowerCase() === trimmed.toLowerCase())
      if (exists) return prev

      return [...prev, { value: trimmed, label: trimmed }]
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    })
  }, [])

  const createTagIfNeeded = useCallback(async (rawName: string): Promise<string | null> => {
    const trimmed = rawName.trim()
    if (!trimmed) return null

    const key = trimmed.toLowerCase()
    const existing = options.find((o) => o.label.trim().toLowerCase() === key)
    if (existing) return existing.label
    if (creatingRef.current.has(key)) return null

    creatingRef.current.add(key)
    try {
      const created = await createTargetTag({ name: trimmed, spaceId: space.id })
      upsertOption(created.name)
      return created.name?.trim() || trimmed
    } catch {
      message.error(`Failed to create target tag "${trimmed}"`)
      return null
    } finally {
      creatingRef.current.delete(key)
    }
  }, [options, space.id, upsertOption])

  const normalize = useCallback((values: string[]): string[] => {
    const existingByKey = new Map(options.map((o) => [o.label.trim().toLowerCase(), o.label]))
    const seen = new Set<string>()
    const result: string[] = []

    for (const raw of values) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const canonical = existingByKey.get(trimmed.toLowerCase()) ?? trimmed
      const key = canonical.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(canonical)
    }

    return result
  }, [options])

  const handleChange = useCallback(async (newValues: string[]) => {
    const normalized = normalize(newValues)
    const existingKeys = new Set(options.map((o) => o.label.trim().toLowerCase()))
    const known = normalized.filter((t) => existingKeys.has(t.toLowerCase()))
    const unknown = normalized.filter((t) => !existingKeys.has(t.toLowerCase()))

    let current = known
    onChange(current)

    for (const tag of unknown) {
      // eslint-disable-next-line no-await-in-loop
      const created = await createTagIfNeeded(tag)
      if (created) {
        current = normalize([...current, created])
        onChange(current)
      }
    }
  }, [createTagIfNeeded, normalize, onChange, options])

  const handleCreateFromSearch = useCallback(async (rawName: string) => {
    const trimmed = rawName.trim()
    if (!trimmed) return

    setSearchValue('')
    const created = await createTagIfNeeded(trimmed)
    if (created) {
      onChange(normalize([...value, created]))
    }
  }, [createTagIfNeeded, normalize, onChange, value])

  const trimmedSearch = searchValue.trim()
  const hasMatch = trimmedSearch.length === 0
    ? true
    : options.some((o) => o.label.toLowerCase().includes(trimmedSearch.toLowerCase()))
  const canCreate = trimmedSearch.length > 0 && !hasMatch

  return (
    <Select
      mode="multiple"
      className="w-full"
      value={value}
      onChange={handleChange}
      options={options}
      loading={loading}
      placeholder={placeholder}
      searchValue={searchValue}
      onSearch={setSearchValue}
      optionFilterProp="label"
      filterOption={(input, option) =>
        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      notFoundContent={
        canCreate ? (
          <div className="px-2 py-2 text-sm text-slate-600">
            Press Enter to create <code>"{trimmedSearch}"</code>
          </div>
        ) : undefined
      }
      onInputKeyDown={(e) => {
        if (!canCreate || e.key !== 'Enter') return
        e.preventDefault()
        void handleCreateFromSearch(trimmedSearch)
      }}
    />
  )
}
