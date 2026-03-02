import React, { useEffect, useMemo, useState } from 'react'
import { Button, Input, Spin } from 'antd'
import { DownOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import {
  GetVariableSet,
  GetVariableSets,
  VariableSetDto,
  VariableSetOwnerType,
  VariableDto,
} from 'pages/apis/variableSet'

interface VariableSetSection {
  id: number
  name: string
  variables: VariableDto[]
}

const getDisplayName = (set: VariableSetDto) => {
  const name = (set.name ?? set.Name ?? '').trim()
  return name || `Variable Set #${set.id}`
}

const getScopeLabel = (variable: VariableDto) => {
  if (!variable.scopes || variable.scopes.length === 0) return '-'
  return Array.from(
    new Set(
      variable.scopes
        .map((s) => s.scopeValue?.trim())
        .filter((value): value is string => !!value),
    ),
  ).join(', ')
}

const sanitizeVariables = (variables: VariableDto[]) =>
  (variables ?? []).filter((item) => {
    const key = (item.name ?? '').trim().toLowerCase()
    return key !== 'name' && key !== 'description'
  })

const ProjectVariableSets: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>()

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [sections, setSections] = useState<VariableSetSection[]>([])
  const [expandedBySetId, setExpandedBySetId] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 500 })
        const foundProject =
          projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null
        setProject(foundProject)

        if (!foundProject) {
          setSections([])
          setExpandedBySetId({})
          return
        }

        const includedRaw = (foundProject.includedLibraryVariableSetIds ?? '').trim()
        const includedIds = Array.from(
          new Set(
            includedRaw
              .split(',')
              .map((id) => Number(id.trim()))
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        )

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

        const librarySetById = new Map<number, VariableSetDto>(
          (librarySetsRes.variableSets ?? []).map((set) => [set.id, set]),
        )
        const librarySetByOwnerId = new Map<number, VariableSetDto>(
          (librarySetsRes.variableSets ?? []).map((set) => [set.ownerId, set]),
        )

        const resolvedSetIds = includedIds.map((includeId) => {
          const byId = librarySetById.get(includeId)
          if (byId) return byId.id
          const byOwnerId = librarySetByOwnerId.get(includeId)
          if (byOwnerId) return byOwnerId.id
          return includeId
        })

        const detailResults = await Promise.all(
          resolvedSetIds.map(async (setId) => {
            try {
              const detail = await GetVariableSet(setId)
              return detail
            } catch {
              return null
            }
          }),
        )

        const nextSections = detailResults
          .filter((set): set is VariableSetDto => !!set)
          .map((set) => ({
            id: set.id,
            name: getDisplayName(set),
            variables: sanitizeVariables(set.variables ?? []),
          }))

        setSections(nextSections)
        setExpandedBySetId(
          Object.fromEntries(nextSections.map((section) => [section.id, false])),
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

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
    <div className="flex flex-col min-h-full p-6 gap-4 bg-white">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-800 m-0">Variable Sets</h1>
          <Button type="primary">Include Variable Sets</Button>
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
                return (
                  <div key={section.id} className="border-b border-slate-200 last:border-b-0">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                      <h3 className="m-0 text-sm font-semibold text-slate-800">{section.name}</h3>
                      <Button
                        type="text"
                        size="small"
                        icon={<DownOutlined className={expanded ? '' : '-rotate-90'} />}
                        onClick={() =>
                          setExpandedBySetId((prev) => ({
                            ...prev,
                            [section.id]: !expanded,
                          }))
                        }
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      />
                    </div>

                    {expanded ? (
                      <div>
                        {section.variables.length === 0 ? (
                          <div className="px-3 py-6 text-sm text-slate-400">No variables in this set.</div>
                        ) : (
                          section.variables.map((variable) => (
                            <div
                              key={variable.id}
                              className="grid grid-cols-[24%_38%_23%_15%] border-t border-slate-100 text-sm"
                            >
                              <div className="px-3 py-2 font-mono text-slate-700 break-all">
                                {variable.name || '-'}
                              </div>
                              <div className="px-3 py-2 font-mono text-slate-700 break-all">
                                {variable.value || '-'}
                              </div>
                              <div className="px-3 py-2 text-slate-600 break-all">
                                {getScopeLabel(variable)}
                              </div>
                              <div className="px-3 py-2 text-slate-500 break-all">{section.name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </Spin>
      </div>
    </div>
  )
}

export default ProjectVariableSets
