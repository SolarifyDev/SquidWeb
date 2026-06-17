import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dropdown, Input, Modal, Spin, message } from 'antd'
import { DownOutlined, FilterOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getProjects, updateProject, type ProjectDto } from 'pages/apis/project'
import {
  formatVariableSetRouteId,
  GetVariableSet,
  GetVariableSets,
  VariableSetDto,
  VariableSetOwnerType,
  VariableDto,
} from 'pages/apis/variableSet'

interface VariableSetSection {
  includeId: number
  id: number
  name: string
  variables: VariableDto[]
}

const getDisplayName = (set: VariableSetDto) => {
  const name = (set.name ?? set.Name ?? '').trim()
  return name || `Variable Set #${set.id}`
}

const getDescription = (set: VariableSetDto) => (set.description ?? set.Description ?? '').trim()

const parseIncludedIds = (includedRaw: number[] | undefined | null) =>
  Array.from(new Set((includedRaw ?? []).filter((id) => Number.isInteger(id) && id > 0)))

const getIncludeId = (set: VariableSetDto) =>
  Number.isInteger(set.ownerId) && set.ownerId > 0 ? set.ownerId : set.id

const getScopeValues = (variable: VariableDto) =>
  Array.from(
    new Set(
      variable.scopes
        .map((s) => s.scopeValue?.trim())
        .filter((value): value is string => !!value),
    ),
  )

const sanitizeVariables = (
  variables: VariableDto[],
  variableSetName?: string,
  variableSetDescription?: string,
) => {
  const normalizedName = (variableSetName ?? '').trim()
  const normalizedDescription = (variableSetDescription ?? '').trim()

  return (variables ?? []).filter((item) => {
    const key = (item.name ?? '').trim().toLowerCase()
    const value = (item.value ?? '').trim()
    const hasScopes = (item.scopes ?? []).length > 0

    // Only hide metadata rows that mirror VariableSet top-level Name/Description.
    if (key === 'name' && normalizedName && value === normalizedName && !hasScopes) {
      return false
    }

    if (key === 'description' && normalizedDescription && value === normalizedDescription && !hasScopes) {
      return false
    }

    return true
  })
}

const ProjectVariableSets: React.FC = () => {
  const { projectName, spaceId } = useParams<{ projectName: string; spaceId: string }>()

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [sections, setSections] = useState<VariableSetSection[]>([])
  const [expandedBySetId, setExpandedBySetId] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [includeModalOpen, setIncludeModalOpen] = useState(false)
  const [includeFilterText, setIncludeFilterText] = useState('')
  const [libraryVariableSets, setLibraryVariableSets] = useState<VariableSetDto[]>([])
  const [selectedIncludeIds, setSelectedIncludeIds] = useState<number[]>([])
  const [loadingIncludeSets, setLoadingIncludeSets] = useState(false)
  const [savingIncludes, setSavingIncludes] = useState(false)
  const [savingRemoveSetId, setSavingRemoveSetId] = useState<number | null>(null)

  const loadProjectVariableSets = useCallback(async () => {
    if (!projectName) return
    setLoading(true)

    try {
      const projectRes = await getProjects({ pageSize: 1000, keyword: projectName })
      const foundProject =
        projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null
      setProject(foundProject)

      if (!foundProject) {
        setSections([])
        setExpandedBySetId({})
        return
      }

      const includedIds = parseIncludedIds(foundProject.includedLibraryVariableSetIds)
      if (includedIds.length === 0) {
        setSections([])
        setExpandedBySetId({})
        return
      }

      const librarySetsRes = await GetVariableSets({
        pageIndex: 1,
        pageSize: 1000,
        ownerType: VariableSetOwnerType.LibraryVariableSet,
        spaceId: foundProject.spaceId,
      }).catch(() => ({ variableSets: [] as VariableSetDto[], count: 0 }))
      const librarySets = librarySetsRes.variableSets ?? []

      const librarySetByOwnerId = new Map<number, VariableSetDto>(
        librarySets
          .filter((set) => Number.isInteger(set.ownerId) && set.ownerId > 0)
          .map((set) => [set.ownerId, set]),
      )
      const librarySetById = new Map<number, VariableSetDto>(librarySets.map((set) => [set.id, set]))

      const resolvedSetLinks = includedIds.map((includeId) => {
        const byOwnerId = librarySetByOwnerId.get(includeId)
        if (byOwnerId) return { includeId, setId: byOwnerId.id }
        const byId = librarySetById.get(includeId)
        if (byId) return { includeId, setId: byId.id }
        return { includeId, setId: includeId }
      })

      const detailResults = await Promise.all(
        resolvedSetLinks.map(async ({ includeId, setId }) => {
          try {
            const detail = await GetVariableSet(setId)
            return { includeId, detail }
          } catch {
            return null
          }
        }),
      )

      const nextSections = detailResults
        .filter((result): result is { includeId: number; detail: VariableSetDto } => !!result?.detail)
        .map((result) => ({
          includeId: result.includeId,
          id: result.detail.id,
          name: getDisplayName(result.detail),
          variables: sanitizeVariables(
            result.detail.variables ?? [],
            result.detail.name ?? result.detail.Name,
            result.detail.description ?? result.detail.Description,
          ),
        }))

      setSections(nextSections)
      setExpandedBySetId(
        Object.fromEntries(nextSections.map((section) => [section.id, false])),
      )
    } finally {
      setLoading(false)
    }
  }, [projectName])

  useEffect(() => {
    void loadProjectVariableSets()
  }, [loadProjectVariableSets])

  const filteredSections = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return sections
    return sections
      .map((section) => ({
        ...section,
        variables: section.variables.filter((v) =>
          (v.name ?? '').toLowerCase().includes(keyword),
        ),
      }))
      .filter((section) => section.variables.length > 0)
  }, [sections, searchText])

  const filteredLibrarySets = useMemo(() => {
    const keyword = includeFilterText.trim().toLowerCase()
    if (!keyword) return libraryVariableSets
    return libraryVariableSets.filter((set) => {
      const name = getDisplayName(set).toLowerCase()
      const description = getDescription(set).toLowerCase()
      return name.includes(keyword) || description.includes(keyword)
    })
  }, [includeFilterText, libraryVariableSets])

  const selectedIncludeSet = useMemo(() => new Set(selectedIncludeIds), [selectedIncludeIds])

  const handleOpenIncludeModal = async () => {
    if (!project) return
    setIncludeModalOpen(true)
    setIncludeFilterText('')
    setLoadingIncludeSets(true)

    try {
      const librarySetsRes = await GetVariableSets({
        pageIndex: 1,
        pageSize: 1000,
        ownerType: VariableSetOwnerType.LibraryVariableSet,
        spaceId: project.spaceId,
      })
      const allSets = librarySetsRes.variableSets ?? []
      setLibraryVariableSets(allSets)

      const includedIds = parseIncludedIds(project.includedLibraryVariableSetIds)
      setSelectedIncludeIds(includedIds)
    } catch (error) {
      console.error('Failed to load library variable sets', error)
      message.error('Failed to load variable sets')
    } finally {
      setLoadingIncludeSets(false)
    }
  }

  const handleToggleIncludeSet = (checked: boolean, includeId: number) => {
    setSelectedIncludeIds((prev) => {
      if (checked) {
        if (prev.includes(includeId)) return prev
        return [...prev, includeId]
      }
      return prev.filter((id) => id !== includeId)
    })
  }

  const handleSaveIncludedVariableSets = async () => {
    if (!project) return
    setSavingIncludes(true)
    try {
      const nextIncludedIds = Array.from(new Set(selectedIncludeIds)).filter((id) => id > 0)
      await updateProject({
        id: project.id,
        project: {
          ...project,
          includedLibraryVariableSetIds: nextIncludedIds,
          lastModified: new Date().toISOString(),
        },
      })
      setIncludeModalOpen(false)
      message.success('Included variable sets updated')
      await loadProjectVariableSets()
    } catch (error) {
      console.error('Failed to update project variable sets', error)
      message.error('Failed to update included variable sets')
    } finally {
      setSavingIncludes(false)
    }
  }

  const handleRemoveIncludedVariableSet = async (section: VariableSetSection) => {
    if (!project) return
    setSavingRemoveSetId(section.id)
    try {
      const includedIds = parseIncludedIds(project.includedLibraryVariableSetIds)
      const nextIncludedIds = includedIds.filter((id) => id !== section.includeId && id !== section.id)
      await updateProject({
        id: project.id,
        project: {
          ...project,
          includedLibraryVariableSetIds: nextIncludedIds,
          lastModified: new Date().toISOString(),
        },
      })
      message.success(`Removed "${section.name}"`)
      await loadProjectVariableSets()
    } catch (error) {
      console.error('Failed to remove included variable set', error)
      message.error('Failed to remove variable set from project include list')
    } finally {
      setSavingRemoveSetId(null)
    }
  }

  const allExpanded =
    filteredSections.length > 0 &&
    filteredSections.every((section) => expandedBySetId[section.id])

  const toggleAll = () => {
    const next = !allExpanded
    setExpandedBySetId((prev) => {
      const updated = { ...prev }
      for (const section of filteredSections) {
        updated[section.id] = next
      }
      return updated
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4 bg-white">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-800 m-0">Variable Sets</h1>
          <Button type="primary" onClick={() => void handleOpenIncludeModal()} disabled={!project}>
            Include Variable Sets
          </Button>
        </div>
      </div>

      <div className="text-right">
        <button
          type="button"
          className="text-xs font-semibold tracking-wide text-squid-blue hover:underline"
          onClick={toggleAll}
          disabled={filteredSections.length === 0}
        >
          {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="By variable name"
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
            className="w-[300px]"
          />
          <Button icon={<FilterOutlined />} type="text" className="!text-slate-600 hover:!text-slate-900">
            Show advanced filters
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Spin spinning={loading}>
          <div className="grid grid-cols-[24%_38%_23%_15%] border-b border-slate-200 bg-white text-sm font-semibold text-slate-700">
            <div className="px-3 py-2">Name</div>
            <div className="px-3 py-2">Value</div>
            <div className="px-3 py-2">Scope</div>
            <div className="px-3 py-2">Source</div>
          </div>

          {!project ? (
            <div className="py-12 text-center text-sm text-slate-400">Project not found.</div>
          ) : filteredSections.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {sections.length === 0
                ? 'No included variable sets.'
                : 'No variables match the current filter.'}
            </div>
          ) : (
            <div>
              {filteredSections.map((section) => {
                const expanded = !!expandedBySetId[section.id]
                const actionItems = [
                  {
                    key: 'edit',
                    label: (
                      <RouterLink to={spaceId ? `/${spaceId}/library/variables/${formatVariableSetRouteId(section.id)}` : '/'} target="_self">
                        Edit Variable Set
                      </RouterLink>
                    ),
                  },
                  { key: 'remove', label: 'Remove', danger: true },
                ]
                return (
                  <div key={section.id} className="border-b border-slate-200 last:border-b-0">
                    <div
                      className="flex items-center justify-between bg-slate-50 px-3 py-2 cursor-pointer hover:bg-slate-100/70 transition-colors"
                      onClick={() =>
                        setExpandedBySetId((prev) => ({
                          ...prev,
                          [section.id]: !expanded,
                        }))
                      }
                    >
                      <h3 className="m-0 text-sm font-semibold text-slate-800">{section.name}</h3>
                      <div className="flex items-center">
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: actionItems,
                            onClick: ({ key, domEvent }) => {
                              domEvent.stopPropagation()
                              if (key === 'remove') {
                                void handleRemoveIncludedVariableSet(section)
                              }
                            },
                          }}
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<MoreOutlined />}
                            loading={savingRemoveSetId === section.id}
                            aria-label="Show Overflow Menu"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Dropdown>
                        <Button
                          type="text"
                          size="small"
                          icon={<DownOutlined className={expanded ? '' : '-rotate-90'} />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedBySetId((prev) => ({
                              ...prev,
                              [section.id]: !expanded,
                            }))
                          }}
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        />
                      </div>
                    </div>

                    {expanded ? (
                      <div>
                        {section.variables.length === 0 ? (
                          <div className="px-3 py-6 text-sm text-slate-400">No variables in this set.</div>
                        ) : (() => {
                          const orderedVariables = [...section.variables].sort((a, b) => {
                            const aName = (a.name ?? '').trim().toLowerCase()
                            const bName = (b.name ?? '').trim().toLowerCase()
                            const byName = aName.localeCompare(bName)
                            if (byName !== 0) return byName

                            const bySortOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                            if (bySortOrder !== 0) return bySortOrder

                            return (a.id ?? 0) - (b.id ?? 0)
                          })

                          return orderedVariables.map((variable, variableIndex) => {
                            const currentName = variable.name || '-'
                            const previousName = variableIndex > 0
                              ? (orderedVariables[variableIndex - 1].name || '-')
                              : null
                            const showName = variableIndex === 0 || previousName !== currentName
                            const scopeValues = getScopeValues(variable)

                            return (
                              <div
                                key={variable.id}
                                className="grid grid-cols-[24%_38%_23%_15%] border-t border-gray-100 text-sm min-h-[48px]"
                              >
                                <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                                  <div className="w-full">
                                    {showName ? currentName : <div className="h-5" />}
                                  </div>
                                </div>
                                <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                                  <div className="w-full">
                                    {variable.isSensitive ? '********' : (variable.value || '-')}
                                  </div>
                                </div>
                                <div className="px-3 py-2 text-slate-600 break-all flex items-center">
                                  <div className="w-full">
                                    {scopeValues.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {scopeValues.map((scope, scopeIndex) => (
                                          <span
                                            key={`${section.id}-${variable.id}-scope-${scopeIndex}`}
                                            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 max-w-full"
                                          >
                                            <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-slate-700">
                                              <svg
                                                className="h-3 w-3 fill-current"
                                                viewBox="0 0 200 200"
                                                aria-hidden="true"
                                              >
                                                <path d="M14 30v35h172V30zm26 26H23V39h17zM14 83v35h95V83zm26 26H23V92h17zM14 134v35h172v-35zm26 26H23v-17h17z" />
                                              </svg>
                                            </span>
                                            <span className="break-all">{scope}</span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </div>
                                </div>
                                <div className="px-3 py-2 text-slate-500 break-all flex items-center">
                                  {spaceId ? (
                                    <RouterLink className="text-squid-blue hover:underline" to={`/${spaceId}/library/variables/${formatVariableSetRouteId(section.id)}`} target="_self">
                                      {section.name}
                                    </RouterLink>
                                  ) : (
                                    section.name
                                  )}
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </Spin>
      </div>

      <Modal
        title="Select Variable Sets"
        open={includeModalOpen}
        width={760}
        onCancel={() => {
          if (savingIncludes) return
          setIncludeModalOpen(false)
        }}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={savingIncludes}
        onOk={() => void handleSaveIncludedVariableSets()}
      >
        <div className="mb-3 text-sm text-slate-500">
          Manage your{' '}
          <RouterLink className="text-squid-blue hover:underline" to={spaceId ? `/${spaceId}/library/variables` : '/'} target="_self">
            variable sets
          </RouterLink>
          .
        </div>

        <div className="mb-4">
          <Input
            value={includeFilterText}
            onChange={(e) => setIncludeFilterText(e.target.value)}
            placeholder="Filter by name or description"
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
          />
        </div>

        <Spin spinning={loadingIncludeSets}>
          <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-lg">
            {filteredLibrarySets.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {libraryVariableSets.length === 0 ? 'No variable sets found.' : 'No variable sets match the current filter.'}
              </div>
            ) : (
              filteredLibrarySets.map((set) => {
                const includeId = getIncludeId(set)
                const description = getDescription(set)
                return (
                  <label
                    key={`include-set-${includeId}-${set.id}`}
                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={selectedIncludeSet.has(includeId)}
                      onChange={(e) => handleToggleIncludeSet(e.target.checked, includeId)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 break-words">{getDisplayName(set)}</div>
                      {description && (
                        <div className="mt-1 text-xs text-slate-500 break-words">{description}</div>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </Spin>
      </Modal>
    </div>
  )
}

export default ProjectVariableSets
