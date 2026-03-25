import React, { useEffect, useMemo, useState } from 'react'
import { Button, Input, Spin } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getDeploymentSteps, type DeploymentStepDto } from 'pages/apis/deploymentProcess'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { getMachines, type MachineDto } from 'pages/apis/machine'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import {
  GetVariableSet,
  GetVariableSets,
  VariableScopeType,
  VariableSetOwnerType,
  type VariableDto,
  type VariableScopeDto,
  type VariableSetDto,
} from 'pages/apis/variableSet'

interface AllVariableRow {
  key: string
  name: string
  value: string
  isSensitive: boolean
  scopes: VariableScopeDto[]
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

const normalizeText = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase()

const toIdFromScope = (scopeValue: string): number | null => {
  const parsed = Number(scopeValue)
  return Number.isFinite(parsed) ? parsed : null
}

function formatActionScopeLabel(stepOrder: number, stepName: string, actionName: string, actionId: number): string {
  const normalizedStepName = (stepName ?? '').trim()
  const normalizedActionName = (actionName ?? '').trim()
  const safeStepOrder = Number.isFinite(stepOrder) && stepOrder > 0 ? stepOrder : 0
  const orderPrefix = safeStepOrder > 0 ? `${safeStepOrder}. ` : ''

  if (!normalizedActionName || normalizedActionName.toLowerCase() === normalizedStepName.toLowerCase()) {
    return `${orderPrefix}${normalizedStepName || `Action #${actionId}`}`.trim()
  }

  if (!normalizedStepName) return `${orderPrefix}${normalizedActionName}`.trim()
  return `${orderPrefix}${normalizedStepName} / ${normalizedActionName}`.trim()
}

const getScopes = (variable: VariableDto) => {
  const deduped = new Map<string, VariableScopeDto>()

  for (const scope of (variable.scopes ?? [])) {
    const scopeValue = (scope.scopeValue ?? '').trim()
    const dedupeKey = `${scope.scopeType}:${scopeValue}`
    if (deduped.has(dedupeKey)) continue
    deduped.set(dedupeKey, { ...scope, scopeValue })
  }

  return Array.from(deduped.values())
}

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
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [steps, setSteps] = useState<DeploymentStepDto[]>([])
  const [machines, setMachines] = useState<MachineDto[]>([])
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
          setChannels([])
          setEnvironments([])
          setSteps([])
          setMachines([])
          setRows([])
          return
        }

        const [channelsRes, environmentsRes, stepsRes, machinesRes] = await Promise.all([
          getChannels({ projectId: foundProject.id, pageSize: 1000 }).catch(() => ({ channels: [] as ChannelDto[], count: 0 })),
          getEnvironments({ pageSize: 1000, spaceId: foundProject.spaceId }).catch(() => ({ environments: [] as EnvironmentDto[], count: 0 })),
          getDeploymentSteps({ processId: foundProject.deploymentProcessId, pageIndex: 1, pageSize: 2000 }).catch(() => ({ steps: [] as DeploymentStepDto[], count: 0 })),
          getMachines({ pageSize: 2000, spaceId: foundProject.spaceId }).catch(() => ({ machines: [] as MachineDto[], count: 0 })),
        ])

        const nextChannels = [...(channelsRes.channels ?? [])]
          .filter((channel) => channel.projectId === foundProject.id)
          .sort((a, b) => a.name.localeCompare(b.name))
        const nextEnvironments = [...(environmentsRes.environments ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
        const nextSteps = [...(stepsRes.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder)
        const nextMachines = [...(machinesRes.machines ?? [])]
          .filter((machine) => !machine.isDisabled)
          .sort((a, b) => a.name.localeCompare(b.name))

        setChannels(nextChannels)
        setEnvironments(nextEnvironments)
        setSteps(nextSteps)
        setMachines(nextMachines)

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
              scopes: getScopes(variable),
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

  const environmentMap = useMemo(() => new Map(environments.map((item) => [item.id, item])), [environments])
  const channelMap = useMemo(() => new Map(channels.map((item) => [item.id, item])), [channels])
  const stepMap = useMemo(() => new Map(steps.map((item) => [item.id, item])), [steps])
  const machineMap = useMemo(() => new Map(machines.map((item) => [item.id, item])), [machines])
  const actionNameById = useMemo(
    () =>
      new Map(
        steps.flatMap((step) =>
          (step.actions ?? []).map((action) => [
            String(action.id),
            formatActionScopeLabel(step.stepOrder, step.name, action.name, action.id),
          ] as const),
        ),
      ),
    [steps],
  )
  const processNameById = useMemo(
    () => new Map(project ? [[String(project.deploymentProcessId), `${project.name} deployment process`]] : []),
    [project],
  )

  const resolveScopeLabel = (scope: VariableScopeDto) => {
    const rawValue = scope.scopeValue?.trim() || ''
    const parsedId = toIdFromScope(rawValue)

    if (scope.scopeType === VariableScopeType.Environment) {
      if (parsedId != null && environmentMap.has(parsedId)) return environmentMap.get(parsedId)?.name || rawValue
      const matched = environments.find(
        (env) => normalizeText(env.name) === normalizeText(rawValue) || normalizeText(env.slug) === normalizeText(rawValue),
      )
      return matched?.name || rawValue
    }

    if (scope.scopeType === VariableScopeType.Channel) {
      if (parsedId != null && channelMap.has(parsedId)) return channelMap.get(parsedId)?.name || rawValue
      const matched = channels.find(
        (channel) => normalizeText(channel.name) === normalizeText(rawValue) || normalizeText(channel.slug) === normalizeText(rawValue),
      )
      return matched?.name || rawValue
    }

    if (scope.scopeType === VariableScopeType.Action) {
      if (actionNameById.has(rawValue)) return actionNameById.get(rawValue) || rawValue
      if (parsedId != null && stepMap.has(parsedId)) {
        const step = stepMap.get(parsedId)
        return step ? `${step.stepOrder + 1}. ${step.name}` : rawValue
      }
      const matched = steps.find((step) => normalizeText(step.name) === normalizeText(rawValue))
      return matched ? `${matched.stepOrder + 1}. ${matched.name}` : rawValue
    }

    if (scope.scopeType === VariableScopeType.Machine) {
      if (parsedId != null && machineMap.has(parsedId)) return machineMap.get(parsedId)?.name || rawValue
      const matched = machines.find((machine) => normalizeText(machine.name) === normalizeText(rawValue))
      return matched?.name || rawValue
    }

    if (scope.scopeType === VariableScopeType.Role) return rawValue || '-'
    if (scope.scopeType === VariableScopeType.Process) return processNameById.get(rawValue) ?? (rawValue || '-')
    return rawValue || '-'
  }

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) =>
      row.name.toLowerCase().includes(keyword)
      || row.value.toLowerCase().includes(keyword)
      || row.sourceLabel.toLowerCase().includes(keyword)
      || row.scopes.some((scope) => {
        const resolved = resolveScopeLabel(scope).toLowerCase()
        const raw = (scope.scopeValue ?? '').toLowerCase()
        return resolved.includes(keyword) || raw.includes(keyword)
      }),
    )
  }, [
    actionNameById,
    channelMap,
    channels,
    environmentMap,
    environments,
    machineMap,
    machines,
    processNameById,
    rows,
    searchText,
    stepMap,
    steps,
  ])

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
                              <ScopeChip key={`${row.key}-scope-${scope.scopeType}-${scope.scopeValue}-${scopeIndex}`} label={resolveScopeLabel(scope)} />
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
