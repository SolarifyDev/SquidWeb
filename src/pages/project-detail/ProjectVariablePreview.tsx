import React, { useEffect, useMemo, useState } from 'react'
import { Checkbox, Input, Select, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
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

interface PreviewVariableRow {
  key: string
  name: string
  value: string
  isSensitive: boolean
  scopes: VariableScopeDto[]
  sortOrder: number
}

const parseIncludedIds = (includedRaw: number[] | undefined | null) =>
  Array.from(new Set((includedRaw ?? []).filter((id) => Number.isInteger(id) && id > 0)))

const getDisplayName = (set: VariableSetDto) => {
  const name = (set.name ?? set.Name ?? '').trim()
  return name || `Variable Set #${set.id}`
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

const normalizeText = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase()

const isSystemVariable = (name: string) => {
  const normalized = normalizeText(name)
  return normalized.startsWith('octopus.')
    || normalized.startsWith('squid.')
    || normalized.startsWith('system.')
    || normalized.startsWith('internal.')
}

const toIdFromScope = (scopeValue: string): number | null => {
  const parsed = Number(scopeValue)
  return Number.isFinite(parsed) ? parsed : null
}

const summaryChipClass = 'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700'

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

const ProjectVariablePreview: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>()

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [steps, setSteps] = useState<DeploymentStepDto[]>([])
  const [machines, setMachines] = useState<MachineDto[]>([])
  const [rows, setRows] = useState<PreviewVariableRow[]>([])

  const [searchText, setSearchText] = useState('')
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<number | undefined>(undefined)
  const [selectedStepId, setSelectedStepId] = useState<number | undefined>(undefined)
  const [selectedChannelId, setSelectedChannelId] = useState<number | undefined>(undefined)
  const [selectedTargetId, setSelectedTargetId] = useState<number | undefined>(undefined)
  const [showSystemVariables, setShowSystemVariables] = useState(false)
  const [filterEmptyValues, setFilterEmptyValues] = useState(false)

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

        setSelectedEnvironmentId((previous) => {
          if (previous && nextEnvironments.some((env) => env.id === previous)) return previous
          return nextEnvironments[0]?.id
        })
        setSelectedStepId((previous) => {
          if (previous && nextSteps.some((step) => step.id === previous)) return previous
          return nextSteps[0]?.id
        })
        setSelectedChannelId((previous) => {
          if (previous && nextChannels.some((channel) => channel.id === previous)) return previous
          const defaultChannel = nextChannels.find((channel) => channel.isDefault)
          return (defaultChannel ?? nextChannels[0])?.id
        })
        setSelectedTargetId(undefined)

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

        const nextRows: PreviewVariableRow[] = []
        details.forEach((set) => {
          if (!set) return
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
              scopes: variable.scopes ?? [],
              sortOrder: Number.isFinite(variable.sortOrder) ? variable.sortOrder : index,
            })
          })
        })

        nextRows.sort((a, b) => {
          const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          if (byName !== 0) return byName
          return a.sortOrder - b.sortOrder
        })
        setRows(nextRows)
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  const environmentMap = useMemo(() => new Map(environments.map((item) => [item.id, item])), [environments])
  const channelMap = useMemo(() => new Map(channels.map((item) => [item.id, item])), [channels])
  const stepMap = useMemo(() => new Map(steps.map((item) => [item.id, item])), [steps])
  const machineMap = useMemo(() => new Map(machines.map((item) => [item.id, item])), [machines])

  const selectedEnvironment = selectedEnvironmentId != null ? environmentMap.get(selectedEnvironmentId) : undefined
  const selectedChannel = selectedChannelId != null ? channelMap.get(selectedChannelId) : undefined
  const selectedStep = selectedStepId != null ? stepMap.get(selectedStepId) : undefined

  const selectedEnvironmentKeys = useMemo(
    () => [selectedEnvironment?.id, selectedEnvironment?.name, selectedEnvironment?.slug]
      .map((value) => normalizeText(value ?? ''))
      .filter(Boolean),
    [selectedEnvironment],
  )
  const selectedChannelKeys = useMemo(
    () => [selectedChannel?.id, selectedChannel?.name, selectedChannel?.slug]
      .map((value) => normalizeText(value ?? ''))
      .filter(Boolean),
    [selectedChannel],
  )
  const selectedStepKeys = useMemo(
    () => [selectedStep?.id, selectedStep?.name, selectedStep ? selectedStep.stepOrder + 1 : undefined]
      .map((value) => normalizeText(value ?? ''))
      .filter(Boolean),
    [selectedStep],
  )

  const targetOptions = useMemo(() => {
    if (!selectedEnvironmentId) return []
    return machines
      .filter((machine) => machine.environmentIds.includes(selectedEnvironmentId))
      .map((machine) => ({ label: machine.name, value: machine.id }))
  }, [machines, selectedEnvironmentId])

  useEffect(() => {
    if (selectedTargetId == null) return
    if (!targetOptions.some((target) => target.value === selectedTargetId)) {
      setSelectedTargetId(undefined)
    }
  }, [selectedTargetId, targetOptions])

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

    if (scope.scopeType === VariableScopeType.Role) return `Role: ${rawValue}`
    if (scope.scopeType === VariableScopeType.Process) return `Process: ${rawValue || 'Scoped'}`
    return rawValue || '-'
  }

  const hasScopeMatch = (scopeValue: string, selectedKeys: string[]) => {
    const normalizedScopeValue = normalizeText(scopeValue)
    return selectedKeys.some((candidate) => candidate === normalizedScopeValue)
  }

  const matchesScenario = (row: PreviewVariableRow) => {
    const machineOrRoleScoped = row.scopes.some(
      (scope) => scope.scopeType === VariableScopeType.Machine || scope.scopeType === VariableScopeType.Role,
    )
    if (machineOrRoleScoped) return false

    const envScopes = row.scopes.filter((scope) => scope.scopeType === VariableScopeType.Environment)
    if (envScopes.length > 0 && !envScopes.some((scope) => hasScopeMatch(scope.scopeValue, selectedEnvironmentKeys))) return false

    const stepScopes = row.scopes.filter((scope) => scope.scopeType === VariableScopeType.Action)
    if (stepScopes.length > 0 && !stepScopes.some((scope) => hasScopeMatch(scope.scopeValue, selectedStepKeys))) return false

    const channelScopes = row.scopes.filter((scope) => scope.scopeType === VariableScopeType.Channel)
    if (channelScopes.length > 0 && !channelScopes.some((scope) => hasScopeMatch(scope.scopeValue, selectedChannelKeys))) return false

    return true
  }

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return rows.filter((row) => {
      if (keyword && !row.name.toLowerCase().includes(keyword)) return false
      if (!showSystemVariables && isSystemVariable(row.name)) return false
      if (filterEmptyValues && row.value.trim().length === 0) return false
      if (!matchesScenario(row)) return false
      return true
    })
  }, [
    filterEmptyValues,
    rows,
    searchText,
    selectedChannelKeys,
    selectedEnvironmentKeys,
    selectedStepKeys,
    showSystemVariables,
  ])

  const summaryStepLabel = selectedStep ? `${selectedStep.stepOrder + 1}. ${selectedStep.name}` : 'None'
  const summaryChannelLabel = selectedChannel?.name || 'None'
  const summaryEnvironmentLabel = selectedEnvironment?.name || 'None'

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-full p-6 gap-4 bg-white">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-semibold text-slate-800 m-0">Variable Preview</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="max-w-[360px]">
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="By variable name"
            prefix={<SearchOutlined className="text-slate-400" />}
            allowClear
          />
        </div>
        <div className="mt-3 text-sm text-slate-600 leading-6">
          Showing variables available during deployment using{' '}
          <span className={summaryChipClass}>{summaryChannelLabel}</span>
          {' '}when running step{' '}
          <span className={summaryChipClass}>{summaryStepLabel}</span>
          {' '}in environment{' '}
          <span className={summaryChipClass}>{summaryEnvironmentLabel}</span>
          . Variables scoped to deployment targets are not currently shown.
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex-1 min-h-[620px]">
        <div className="grid grid-cols-[320px_1fr] h-full">
          <aside className="border-r border-slate-200 p-5">
              <h4 className="m-0 text-base font-semibold text-slate-900">Select Deployment Scenario</h4>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Environment</label>
                  <Select
                    value={selectedEnvironmentId}
                    onChange={setSelectedEnvironmentId}
                    options={environments.map((env) => ({ label: env.name, value: env.id }))}
                    className="w-full"
                    placeholder="Select environment"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Deployment step</label>
                  <Select
                    value={selectedStepId}
                    onChange={setSelectedStepId}
                    options={steps.map((step) => ({ label: `${step.stepOrder + 1}. ${step.name}`, value: step.id }))}
                    className="w-full"
                    placeholder="Select deployment step"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
                  <Select
                    value={selectedChannelId}
                    onChange={setSelectedChannelId}
                    options={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                    className="w-full"
                    placeholder="Select channel"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Deployment target</label>
                  <Select
                    value={selectedTargetId}
                    onChange={setSelectedTargetId}
                    options={targetOptions}
                    className="w-full"
                    placeholder="Select deployment target"
                    allowClear
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <Checkbox
                    checked={showSystemVariables}
                    onChange={(event) => setShowSystemVariables(event.target.checked)}
                  >
                    Show system variables
                  </Checkbox>
                  <Checkbox
                    checked={filterEmptyValues}
                    onChange={(event) => setFilterEmptyValues(event.target.checked)}
                  >
                    Filter empty values
                  </Checkbox>
                </div>
              </div>
            </aside>

          <main className="overflow-hidden">
            <Spin spinning={loading}>
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-[16.6667%_66.6667%_16.6667%] border-b border-slate-200 bg-white text-sm font-semibold text-slate-700">
                  <div className="px-3 py-2">Name</div>
                  <div className="px-3 py-2">Value</div>
                  <div className="px-3 py-2">Scope</div>
                </div>

                {!project ? (
                  <div className="py-12 text-center text-sm text-slate-400">Project not found.</div>
                ) : filteredRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">
                    {rows.length === 0 ? 'No variables found.' : 'No variables match the current filter.'}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    {filteredRows.map((row, rowIndex) => {
                      const showName = rowIndex === 0 || filteredRows[rowIndex - 1].name !== row.name
                      return (
                        <div
                          key={row.key}
                          className="grid grid-cols-[16.6667%_66.6667%_16.6667%] border-b border-slate-100 last:border-b-0 text-sm min-h-[48px]"
                        >
                          <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                            <div className="w-full">{showName ? (row.name || '-') : <div className="h-5" />}</div>
                          </div>
                          <div className="px-3 py-2 font-mono text-slate-700 break-all flex items-center">
                            <div className="w-full">{row.isSensitive ? '********' : (row.value || '-')}</div>
                          </div>
                          <div className="px-3 py-2 text-slate-600 break-all flex items-center">
                            <div className="w-full">
                              {row.scopes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.scopes.map((scope, index) => (
                                    <ScopeChip
                                      key={`${row.key}-scope-${index}`}
                                      label={resolveScopeLabel(scope)}
                                    />
                                  ))}
                                </div>
                              ) : (
                                '-'
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Spin>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ProjectVariablePreview
