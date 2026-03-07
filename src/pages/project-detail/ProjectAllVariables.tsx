import React, { useEffect, useMemo, useState } from 'react'
import { Button, Input, Spin } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import {
  GetVariableSet,
  GetVariableSets,
  VariableSetOwnerType,
  type VariableDto,
  type VariableSetDto,
} from 'pages/apis/variableSet'

interface AllVariableRow {
  key: string
  name: string
  value: string
  isSensitive: boolean
  scopes: string[]
  sourceLabel: string
  sourceHref?: string
  sortOrder: number
}

const parseIncludedIds = (includedRaw: number[] | undefined | null) =>
  Array.from(new Set((includedRaw ?? []).filter((id) => Number.isInteger(id) && id > 0)))

const getDisplayName = (set: VariableSetDto) => {
  const name = (set.name ?? set.Name ?? '').trim()
  return name || `Variable Set #${set.id}`
}

const getScopeValues = (variable: VariableDto) =>
  Array.from(
    new Set(
      (variable.scopes ?? [])
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

    if (key === 'name' && normalizedName && value === normalizedName && !hasScopes) return false
    if (key === 'description' && normalizedDescription && value === normalizedDescription && !hasScopes) return false

    return true
  })
}

const ScopeChip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 max-w-full">
    <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-slate-700">
      <svg className="h-3 w-3 fill-current" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M14 30v35h172V30zm26 26H23V39h17zM14 83v35h95V83zm26 26H23V92h17zM14 134v35h172v-35zm26 26H23v-17h17z" />
      </svg>
    </span>
    <span className="break-all">{label}</span>
  </span>
)

const ProjectAllVariables: React.FC = () => {
  const { projectName, spaceId } = useParams<{ projectName: string; spaceId: string }>()

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [rows, setRows] = useState<AllVariableRow[]>([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    if (!projectName) return
    setLoading(true)

    ;(async () => {
      try {
        const projectRes = await getProjects({ pageSize: 1000, keyword: projectName })
        const foundProject =
          projectRes.projects.find((p) => p.slug === projectName || p.name === projectName) ?? null
        setProject(foundProject)

        if (!foundProject) {
          setRows([])
          return
        }

        const includedIds = parseIncludedIds(foundProject.includedLibraryVariableSetIds)
        let resolvedIncludedSetIds: number[] = []

        if (includedIds.length > 0) {
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

          resolvedIncludedSetIds = includedIds.map((includeId) => {
            const byOwnerId = librarySetByOwnerId.get(includeId)
            if (byOwnerId) return byOwnerId.id
            const byId = librarySetById.get(includeId)
            if (byId) return byId.id
            return includeId
          })
        }

        const variableSetIds = Array.from(
          new Set([foundProject.variableSetId, ...resolvedIncludedSetIds].filter((id): id is number => Number.isInteger(id) && id > 0)),
        )

        if (variableSetIds.length === 0) {
          setRows([])
          return
        }

        const details = await Promise.all(
          variableSetIds.map((id) => GetVariableSet(id).catch(() => null)),
        )

        const nextRows: AllVariableRow[] = []

        details.forEach((set) => {
          if (!set) return
          const isProjectVariables = set.id === foundProject.variableSetId
          const sourceLabel = isProjectVariables ? (foundProject.name || 'Project Variables') : getDisplayName(set)
          const sourceHref = isProjectVariables
            ? (spaceId ? `/${spaceId}/projects/${projectName}/variables` : undefined)
            : (spaceId ? `/${spaceId}/library/variables/${set.id}` : undefined)
          const visibleVariables = sanitizeVariables(
            set.variables ?? [],
            set.name ?? set.Name,
            set.description ?? set.Description,
          )

          visibleVariables.forEach((variable, index) => {
            nextRows.push({
              key: `${set.id}-${variable.id || index}-${variable.name}`,
              name: variable.name || '-',
              value: variable.value || '',
              isSensitive: Boolean(variable.isSensitive),
              scopes: getScopeValues(variable),
              sourceLabel,
              sourceHref,
              sortOrder: Number.isFinite(variable.sortOrder) ? variable.sortOrder : index,
            })
          })
        })

        nextRows.sort((a, b) => {
          const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          if (byName !== 0) return byName

          const bySource = a.sourceLabel.localeCompare(b.sourceLabel, undefined, { sensitivity: 'base' })
          if (bySource !== 0) return bySource

          return a.sortOrder - b.sortOrder
        })

        setRows(nextRows)
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName, spaceId])

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) =>
      row.name.toLowerCase().includes(keyword)
      || row.value.toLowerCase().includes(keyword)
      || row.sourceLabel.toLowerCase().includes(keyword)
      || row.scopes.some((scope) => scope.toLowerCase().includes(keyword)),
    )
  }, [rows, searchText])

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4 bg-white">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-semibold text-slate-800 m-0">All Variables</h1>
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
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {rows.length === 0 ? 'No variables found.' : 'No variables match the current filter.'}
            </div>
          ) : (
            <div>
              {filteredRows.map((row, rowIndex) => {
                const showName = rowIndex === 0 || filteredRows[rowIndex - 1].name !== row.name
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[24%_38%_23%_15%] border-b border-gray-100 last:border-b-0 text-sm min-h-[48px]"
                  >
                    <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                      <div className="w-full">
                        {showName ? (row.name || '-') : <div className="h-5" />}
                      </div>
                    </div>
                    <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                      <div className="w-full">{row.isSensitive ? '********' : (row.value || '-')}</div>
                    </div>
                    <div className="px-3 py-2 text-slate-600 break-all flex items-center">
                      <div className="w-full">
                        {row.scopes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.scopes.map((scope, scopeIndex) => (
                              <ScopeChip key={`${row.key}-scope-${scopeIndex}`} label={scope} />
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2 text-slate-500 break-all flex items-center">
                      <div className="w-full">
                        {row.sourceHref ? (
                          <RouterLink className="text-squid-blue hover:underline" to={row.sourceHref} target="_self">
                            {row.sourceLabel}
                          </RouterLink>
                        ) : (
                          row.sourceLabel
                        )}
                      </div>
                    </div>
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

export default ProjectAllVariables
