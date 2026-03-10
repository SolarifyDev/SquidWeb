import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin, message } from 'antd'
import {
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  FileZipOutlined,
  FilterOutlined,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import {
  getReleaseVariableSnapshot,
  getReleases,
  updateReleaseVariables,
  type ReleaseDto,
} from 'pages/apis/release'
import { getProjectProgression, type ReleaseProgression, type DeploymentState } from 'pages/apis/projectProgression'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getLifecycles, type LifecycleDto, type LifecyclePhaseDto } from 'pages/apis/lifecycle'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { getPackageReferences, type PackageReferenceItem } from 'pages/apis/deploymentProcess'
import {
  GetVariableSet,
  VariableScopeType,
  type VariableDto,
  type VariableScopeDto,
} from 'pages/apis/variableSet'

// ── Data loading ─────────────────────────────────────────────────────────────

async function findRelease(projectId: number, channels: ChannelDto[], version: string): Promise<ReleaseDto | null> {
  const res = await getReleases({ projectId, pageSize: 200 }).catch(() => null)
  const match = res?.releases.find((r) => r.version === version)
  if (match) return match

  if (channels.length === 0) return null

  const responses = await Promise.all(
    channels.map((ch) =>
      getReleases({ projectId, channelId: ch.id, pageSize: 200 }).catch(() => null),
    ),
  )

  for (const r of responses) {
    const found = r?.releases.find((rel) => rel.version === version)
    if (found) return found
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stateColor(state: DeploymentState): string {
  switch (state) {
    case 'Success':    return '#00874d'
    case 'Failed':
    case 'TimedOut':   return '#ef4444'
    case 'Executing':  return '#3b82f6'
    case 'Pending':    return '#9ca3af'
    case 'Cancelling': return '#f97316'
    case 'Cancelled':  return '#6b7280'
    default:           return '#9ca3af'
  }
}

type PhaseStatus = 'done' | 'current' | 'pending'

function phaseStatusColor(status: PhaseStatus): string {
  switch (status) {
    case 'done':    return '#00874d'
    case 'current': return '#3b82f6'
    case 'pending': return '#d1d5db'
  }
}

function toEnvironmentToken(environmentId: number): string {
  return `Environments-${environmentId}`
}

function buildEnvironmentIdsQuery(environmentIds: number[]): string {
  const params = new URLSearchParams()
  environmentIds.forEach((id) => params.append('environmentIds', toEnvironmentToken(id)))
  return params.toString()
}

function formatVariableScope(scope: VariableScopeDto): string {
  return scope.scopeValue
}

function toOrdinal(day: number): string {
  const remainder10 = day % 10
  const remainder100 = day % 100
  if (remainder10 === 1 && remainder100 !== 11) return `${day}st`
  if (remainder10 === 2 && remainder100 !== 12) return `${day}nd`
  if (remainder10 === 3 && remainder100 !== 13) return `${day}rd`
  return `${day}th`
}

function formatTaskSummaryDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  return `${month} ${toOrdinal(date.getDate())} ${date.getFullYear()}`
}

function renderTaskStatusIcon(state: DeploymentState) {
  if (state === 'Success') {
    return <CheckOutlined style={{ fontSize: 14 }} />
  }
  if (state === 'Executing' || state === 'Pending' || state === 'Cancelling') {
    return <LoadingOutlined style={{ fontSize: 14 }} />
  }
  if (state === 'Failed' || state === 'TimedOut' || state === 'Cancelled') {
    return <CloseOutlined style={{ fontSize: 14 }} />
  }
  return <CheckOutlined style={{ fontSize: 14 }} />
}

// ── Section heading (matches CollapsibleSection header style) ────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="w-full flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-t-lg text-left">
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ReleaseDetail: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName, version } = useParams<{
    spaceId: string
    projectName: string
    version: string
  }>()

  const [loading, setLoading] = useState(true)
  const [deployMenuOpen, setDeployMenuOpen] = useState(false)
  const [deployFilterText, setDeployFilterText] = useState('')
  const [showVariableSnapshot, setShowVariableSnapshot] = useState(false)
  const [snapshotInitDone, setSnapshotInitDone] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotLoaded, setSnapshotLoaded] = useState(false)
  const [snapshotFilterText, setSnapshotFilterText] = useState('')
  const [snapshotNotice, setSnapshotNotice] = useState('')
  const [updatingVariables, setUpdatingVariables] = useState(false)
  const [snapshotRows, setSnapshotRows] = useState<
    Array<{
      key: string
      name: string
      value: string
      isSensitive: boolean
      scopes: string[]
      sourceLabel: string
      sourceHref?: string
      sourceKind: 'project' | 'library' | 'snapshot'
    }>
  >([])
  const deployMenuRef = useRef<HTMLDivElement>(null)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [release, setRelease] = useState<ReleaseDto | null>(null)
  const [progression, setProgression] = useState<ReleaseProgression | null>(null)
  const [channel, setChannel] = useState<ChannelDto | null>(null)
  const [lifecycle, setLifecycle] = useState<LifecycleDto | null>(null)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [packageReferences, setPackageReferences] = useState<PackageReferenceItem[]>([])

  const encodedProjectName = encodeURIComponent(projectName ?? '')
  const basePath = `/${spaceId}/projects/${encodedProjectName}`

  useEffect(() => {
    if (!projectName || !version) {
      setLoading(false)
      return
    }
    setLoading(true)

    ;(async () => {
      try {
        const projRes = await getProjects({ pageSize: 500 })
        const foundProject = projRes.projects.find(
          (p) => p.slug === projectName || p.name === projectName,
        ) ?? null
        setProject(foundProject)
        if (!foundProject) return

        const [progRes, chanRes, lcRes, envRes, pkgRefRes] = await Promise.all([
          getProjectProgression(foundProject.id).catch(() => null),
          getChannels({ projectId: foundProject.id, pageSize: 1000 }).catch(() => null),
          getLifecycles({ pageSize: 100 }).catch(() => null),
          getEnvironments({ pageSize: 1000 }).catch(() => null),
          getPackageReferences(foundProject.id).catch(() => null),
        ])

        const channels = chanRes?.channels.filter((c) => c.projectId === foundProject.id) ?? []
        const decodedVersion = decodeURIComponent(version!)

        let foundRelease = await findRelease(foundProject.id, channels, decodedVersion)
        setRelease(foundRelease)

        const foundProgression = progRes?.releases.find(
          (rp) => rp.release.version === decodedVersion,
        ) ?? null
        setProgression(foundProgression)

        setEnvironments(envRes?.environments ?? [])
        setPackageReferences(pkgRefRes?.packageReferences ?? [])

        if (foundRelease) {
          const foundChannel = channels.find((c) => c.id === foundRelease.channelId) ?? null
          setChannel(foundChannel)

          // channel.lifecycleId is null for default channels → fall back to project.lifecycleId
          const effectiveLifecycleId = foundChannel?.lifecycleId ?? foundProject.lifecycleId
          const foundLifecycle = lcRes?.lifecycles.find((lc) => lc.id === effectiveLifecycleId) ?? null
          setLifecycle(foundLifecycle)
        }
      } catch {
        message.error('Failed to load release details.')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName, version])

  useEffect(() => {
    if (!deployMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (deployMenuRef.current && !deployMenuRef.current.contains(e.target as Node)) {
        setDeployMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [deployMenuOpen])

  useEffect(() => {
    if (!deployMenuOpen) setDeployFilterText('')
  }, [deployMenuOpen])

  const envMap = useMemo(
    () => new Map(environments.map((e) => [e.id, e])),
    [environments],
  )

  const phases = lifecycle?.phases?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []

  const releasePackages = useMemo(() => {
    const sortedReferences = [...packageReferences].sort((a, b) => {
      const byAction = (a.actionName ?? '').localeCompare(b.actionName ?? '')
      if (byAction !== 0) return byAction

      const byReference = (a.packageReferenceName ?? '').localeCompare(b.packageReferenceName ?? '')
      if (byReference !== 0) return byReference

      return (a.packageId ?? '').localeCompare(b.packageId ?? '')
    })

    return sortedReferences.map((pkg, index) => {
      const packageRef = pkg.packageReferenceName?.trim()
      const displayName = packageRef
        ? `${pkg.actionName}:${packageRef}(${pkg.packageId})`
        : `${pkg.actionName}:${pkg.packageId}`

      return {
        key: `${pkg.actionName}-${pkg.packageReferenceName}-${pkg.packageId}-${index}`,
        title: `${pkg.packageId || 'Package'} from feed ${pkg.feedName || 'Unknown feed'}`,
        displayName,
        version: release?.version || '',
        published: release?.assembled || '',
        packageId: pkg.packageId,
        feedName: pkg.feedName,
        packageReferenceName: pkg.packageReferenceName,
        isHealthy: Boolean(pkg.packageId && release?.version),
      }
    })
  }, [packageReferences, release?.assembled, release?.version])

  const phaseRows = useMemo(() => {
    if (!progression || phases.length === 0) return []

    let previousBlockingPhasesCompleted = true

    return phases.map((phase) => {
      const envIds = Array.from(
        new Set([...phase.automaticDeploymentTargetIds, ...phase.optionalDeploymentTargetIds]),
      )
      const envNames = envIds.map((id) => envMap.get(id)?.name ?? `Env #${id}`).join(', ')

      const deployments = envIds.flatMap((envId) => {
        const deps = progression.deployments[envId] ?? []
        return deps
          .filter((d) => d.releaseVersion === progression.release.version)
          .map((d) => ({ ...d, environmentId: envId }))
      })

      const deploymentsSorted = [...deployments].sort((a, b) => {
        const aTs = Date.parse(a.completedTime ?? a.created)
        const bTs = Date.parse(b.completedTime ?? b.created)
        const safeATs = Number.isFinite(aTs) ? aTs : 0
        const safeBTs = Number.isFinite(bTs) ? bTs : 0
        return safeBTs - safeATs
      })

      const latestDeployment = deploymentsSorted[0] ?? null
      const latestByEnvironment = new Map<number, (typeof deploymentsSorted)[number]>()
      deploymentsSorted.forEach((deployment) => {
        if (!latestByEnvironment.has(deployment.environmentId)) {
          latestByEnvironment.set(deployment.environmentId, deployment)
        }
      })

      const successfulEnvironmentCount = envIds.reduce((count, envId) => {
        const latest = latestByEnvironment.get(envId)
        return latest?.state === 'Success' ? count + 1 : count
      }, 0)

      const minimumRequired = phase.minimumEnvironmentsBeforePromotion ?? 0
      const requiredSuccessCount = phase.isOptionalPhase
        ? 0
        : minimumRequired > 0
          ? Math.min(minimumRequired, envIds.length)
          : envIds.length
      const phaseCompleted = phase.isOptionalPhase
        ? successfulEnvironmentCount > 0
        : requiredSuccessCount > 0 && successfulEnvironmentCount >= requiredSuccessCount

      const deployableEnvIds = previousBlockingPhasesCompleted
        ? envIds.filter((id) => progression.nextDeployments.includes(id))
        : []
      const canDeploy = deployableEnvIds.length > 0
      const hasActiveDeployment = Boolean(
        latestDeployment && (latestDeployment.state === 'Executing' || latestDeployment.state === 'Pending' || latestDeployment.state === 'Cancelling'),
      )

      let status: PhaseStatus = 'pending'
      if (phaseCompleted) status = 'done'
      else if (canDeploy || hasActiveDeployment) {
        status = 'current'
      }

      if (!phase.isOptionalPhase) {
        previousBlockingPhasesCompleted = previousBlockingPhasesCompleted && phaseCompleted
      }

      return { phase, envIds, envNames, latestDeployment, deployableEnvIds, canDeploy, status, phaseCompleted }
    })
  }, [progression, phases, envMap])

  const nextDeployEnvIds = progression?.nextDeployments ?? []
  const filteredNextDeployEnvIds = useMemo(() => {
    const keyword = deployFilterText.trim().toLowerCase()
    if (!keyword) return nextDeployEnvIds
    return nextDeployEnvIds.filter((envId) => {
      const envName = envMap.get(envId)?.name ?? ''
      return envName.toLowerCase().includes(keyword)
    })
  }, [deployFilterText, envMap, nextDeployEnvIds])

  const deployAllLabel = useMemo(() => {
    if (nextDeployEnvIds.length === 2) return 'Deploy to both environments...'
    return 'Deploy to all environments...'
  }, [nextDeployEnvIds.length])

  const filteredSnapshotRows = useMemo(() => {
    const keyword = snapshotFilterText.trim().toLowerCase()
    if (!keyword) return snapshotRows
    return snapshotRows.filter((row) =>
      row.name.toLowerCase().includes(keyword)
      || row.value.toLowerCase().includes(keyword)
      || row.sourceLabel.toLowerCase().includes(keyword),
    )
  }, [snapshotFilterText, snapshotRows])

  const buildSnapshotRowsFromSet = (
    variableSetId: number,
    variables: VariableDto[],
    sourceLabel: string,
    sourceHref: string | undefined,
    sourceKind: 'project' | 'library' | 'snapshot',
  ) => {
    return (variables ?? []).map((v, index) => ({
      key: `${variableSetId}-${v.id || index}-${v.name}`,
      name: v.name || '-',
      value: v.value || '',
      isSensitive: Boolean(v.isSensitive),
      scopes: (v.scopes ?? []).map(formatVariableScope),
      sourceLabel,
      sourceHref,
      sourceKind,
    }))
  }

  const loadVariableSnapshot = async (force = false) => {
    if (!project || !release) return
    if (snapshotLoading) return
    if (snapshotLoaded && !force) return

    setSnapshotLoading(true)
    setSnapshotNotice('')

    try {
      const rows: Array<{
        key: string
        name: string
        value: string
        isSensitive: boolean
        scopes: string[]
        sourceLabel: string
        sourceHref?: string
        sourceKind: 'project' | 'library' | 'snapshot'
      }> = []

      let usedFallback = false

      try {
        const snapshotResponse = await getReleaseVariableSnapshot(release.id)
        const snapshotVariables = snapshotResponse?.variableSnapshot?.data?.variables ?? []
        if (snapshotVariables.length > 0) {
          const sourceBySetId = new Map<number, {
            sourceLabel: string
            sourceHref?: string
            sourceKind: 'project' | 'library' | 'snapshot'
          }>()

          if (project.variableSetId > 0) {
            sourceBySetId.set(project.variableSetId, {
              sourceLabel: project.name || 'Project Variables',
              sourceHref: `${basePath}/variables`,
              sourceKind: 'project',
            })
          }

          const variableSetIds = Array.from(
            new Set(
              snapshotVariables
                .map((v) => v.variableSetId)
                .filter((id): id is number => Number.isFinite(id) && id > 0),
            ),
          )
          const missingSetIds = variableSetIds.filter((id) => !sourceBySetId.has(id))
          const setDetails = await Promise.all(
            missingSetIds.map((id) => GetVariableSet(id).catch(() => null)),
          )

          setDetails.forEach((set, index) => {
            const setId = missingSetIds[index]
            if (!set) {
              sourceBySetId.set(setId, {
                sourceLabel: `Variable Set #${setId}`,
                sourceHref: spaceId ? `/${spaceId}/library/variables/${setId}` : undefined,
                sourceKind: 'library',
              })
              return
            }

            const isProjectVariables = set.id === project.variableSetId
            sourceBySetId.set(set.id, {
              sourceLabel: isProjectVariables
                ? (project.name || 'Project Variables')
                : ((set.name ?? '').trim() || `Variable Set #${set.id}`),
              sourceHref: isProjectVariables
                ? `${basePath}/variables`
                : (spaceId ? `/${spaceId}/library/variables/${set.id}` : undefined),
              sourceKind: isProjectVariables ? 'project' : 'library',
            })
          })

          rows.push(
            ...snapshotVariables.map((v, index) => {
              const source = sourceBySetId.get(v.variableSetId)
              return {
                key: `${v.variableSetId}-${v.id || index}-${v.name}`,
                name: v.name || '-',
                value: v.value || '',
                isSensitive: Boolean(v.isSensitive),
                scopes: (v.scopes ?? []).map(formatVariableScope),
                sourceLabel: source?.sourceLabel ?? 'Snapshot',
                sourceHref: source?.sourceHref,
                sourceKind: source?.sourceKind ?? 'snapshot',
              }
            }),
          )
        } else {
          usedFallback = true
        }
      } catch {
        usedFallback = true
      }

      if (rows.length === 0) {
        const setIds = Array.from(
          new Set(
            [project.variableSetId, ...(project.includedLibraryVariableSetIds ?? [])]
              .filter((id): id is number => Number.isFinite(id) && id > 0),
          ),
        )

        const sets = await Promise.all(setIds.map((id) => GetVariableSet(id).catch(() => null)))
        for (const set of sets) {
          if (!set) continue
          const isProjectVariables = set.id === project.variableSetId
          const sourceLabel = isProjectVariables
            ? (project.name || 'Project Variables')
            : ((set.name ?? '').trim() || `VariableSet-${set.id}`)
          const sourceHref = isProjectVariables
            ? `${basePath}/variables`
            : (spaceId ? `/${spaceId}/library/variables/${set.id}` : undefined)

          rows.push(
            ...buildSnapshotRowsFromSet(
              set.id,
              set.variables ?? [],
              sourceLabel,
              sourceHref,
              isProjectVariables ? 'project' : 'library',
            ),
          )
        }

        if (usedFallback) {
          setSnapshotNotice('Snapshot endpoint is not available. Showing current project variables.')
        }
      }

      rows.sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        if (byName !== 0) return byName
        return a.sourceLabel.localeCompare(b.sourceLabel, undefined, { sensitivity: 'base' })
      })

      setSnapshotRows(rows)
      if (rows.length === 0) {
        setSnapshotNotice('No variables found.')
      }
    } catch {
      message.error('Failed to load variable snapshot.')
    } finally {
      setSnapshotLoaded(true)
      setSnapshotLoading(false)
    }
  }

  const handleUpdateVariables = async () => {
    if (!release?.id || !project?.id) return

    setUpdatingVariables(true)
    try {
      await updateReleaseVariables({ releaseId: release.id })

      const refreshed = await getReleases({
        pageIndex: 1,
        pageSize: 200,
        projectId: project.id,
      }).catch(() => null)
      const refreshedRelease = refreshed?.releases.find((r) => r.version === release.version) ?? null
      if (refreshedRelease) {
        setRelease(refreshedRelease)
      }

      setSnapshotLoaded(false)
      message.success('Variable snapshot updated.')

      if (showVariableSnapshot) {
        await loadVariableSnapshot(true)
      }
    } catch {
      message.error('Failed to update variable snapshot.')
    } finally {
      setUpdatingVariables(false)
    }
  }

  useEffect(() => {
    if (!project?.id || !release?.id) return

    let cancelled = false
    setSnapshotInitDone(false)

    ;(async () => {
      await loadVariableSnapshot(true)
      if (!cancelled) {
        setSnapshotInitDone(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [release?.id, project?.id])

  useEffect(() => {
    if (!showVariableSnapshot) return
    loadVariableSnapshot()
  }, [showVariableSnapshot, release?.id, project?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  if (!release) {
    return (
      <div className="p-6">
        <div className="text-slate-500">Release not found.</div>
      </div>
    )
  }

  const deployCreatePath = `${basePath}/releases/${encodeURIComponent(release.version)}/deployments/create`

  return (
    <div className="rounded-xl border border-slate-200 overflow-visible flex flex-col min-h-full max-w-5xl mx-auto w-full">
      {/* ── Header ── */}
      <div className="relative z-40 px-6 pt-5 pb-4 border-b border-slate-200">
        <Link
          to={`${basePath}/releases`}
          className="inline-flex items-center text-sm text-squid-blue hover:underline mb-2"
        >
          Releases
        </Link>

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">
            Release {release.version}
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue text-squid-blue bg-white hover:bg-blue-50 transition-colors"
              onClick={() => {
                const defaultTarget = nextDeployEnvIds[0]
                const query = defaultTarget != null ? buildEnvironmentIdsQuery([defaultTarget]) : ''
                navigate(query ? `${deployCreatePath}?${query}` : deployCreatePath)
              }}
            >
              Deploy
            </button>

            <div ref={deployMenuRef} className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-[5px] text-[13px] font-medium rounded bg-green-600 hover:bg-green-700 text-white border border-green-600 transition-colors"
                onClick={() => setDeployMenuOpen((v) => !v)}
                disabled={nextDeployEnvIds.length === 0}
              >
                Deploy to...
                <DownOutlined style={{ fontSize: 10 }} />
              </button>

              {deployMenuOpen && nextDeployEnvIds.length > 0 && (
                <div className="absolute left-0 top-full mt-2 z-50 w-[280px] max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                  {nextDeployEnvIds.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setDeployMenuOpen(false)
                          const query = buildEnvironmentIdsQuery(nextDeployEnvIds)
                          navigate(query ? `${deployCreatePath}?${query}` : deployCreatePath)
                        }}
                      >
                        {deployAllLabel}
                      </button>
                      <hr className="my-1 border-slate-200" />
                    </>
                  )}

                  <div className="px-3 pt-1 pb-2">
                    <div className="flex items-center gap-1.5 border-b border-slate-300 pb-1">
                      <SearchOutlined className="text-slate-400 text-xs" />
                      <input
                        type="search"
                        value={deployFilterText}
                        onChange={(e) => setDeployFilterText(e.target.value)}
                        placeholder="Filter..."
                        aria-label="Filter environments"
                        className="w-full border-0 outline-none bg-transparent text-xs text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {filteredNextDeployEnvIds.map((envId) => {
                    const env = envMap.get(envId)
                    if (!env) return null
                    return (
                      <button
                        key={envId}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setDeployMenuOpen(false)
                          const query = buildEnvironmentIdsQuery([envId])
                          navigate(`${deployCreatePath}?${query}`)
                        }}
                      >
                        {env.name}
                      </button>
                    )
                  })}
                  {filteredNextDeployEnvIds.length === 0 && (
                    <div className="px-3 py-1.5 text-xs text-slate-400">No matching environments.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-0 flex-1 px-6 py-5">

        {/* ── Progression section ── */}
        <SectionHeading title="Progression" />

        <div className="border border-slate-200 border-t-0 rounded-b-lg bg-white mb-6">
          {/* Lifecycle / Channel info row */}
          <div className="px-5 py-3 border-b border-slate-100">
            <span className="text-sm text-slate-700">
              Lifecycle: <b className="mr-4">{lifecycle?.name ?? '—'}</b>
            </span>
            <span className="text-sm text-slate-700">
              Channel:{' '}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 align-middle ml-1">
                {channel?.name ?? '—'}
              </span>
            </span>
          </div>

          {/* Phases table */}
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-2.5">
                  Lifecycle
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-2.5">
                  Task
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-2.5">
                  When
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-2.5" />
              </tr>
            </thead>
            {phaseRows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                    No lifecycle phases configured.
                  </td>
                </tr>
              </tbody>
            ) : (
              phaseRows.map(({ phase, envNames, latestDeployment, deployableEnvIds, canDeploy, status }) => (
                <tbody key={phase.id} className="border-b border-slate-100 last:border-b-0">
                  <tr>
                    {/* Phase name + icon */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {status === 'done' ? (
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] text-white flex-shrink-0"
                            style={{ backgroundColor: phaseStatusColor(status) }}
                          >
                            <CheckOutlined style={{ fontSize: 9 }} />
                          </span>
                        ) : (
                          <span
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0 border-2"
                            style={{
                              borderColor: phaseStatusColor(status),
                              backgroundColor: 'transparent',
                            }}
                          />
                        )}
                        <span className="text-sm font-medium text-slate-800">
                          {phase.name}
                          {phase.isOptionalPhase && (
                            <small className="text-slate-400 font-normal ml-1">(optional)</small>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Task */}
                    <td className="px-5 py-3">
                      {latestDeployment ? (
                        <Link
                          to={`${basePath}/releases/${encodeURIComponent(release.version)}/deployments/${latestDeployment.deploymentId}`}
                          className="inline-flex items-center rounded-md px-1 py-0.5 text-inherit hover:bg-slate-50 transition-colors"
                          aria-label={`View deployment task for ${phase.name}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-white flex-shrink-0"
                              style={{ backgroundColor: stateColor(latestDeployment.state) }}
                            >
                              {renderTaskStatusIcon(latestDeployment.state)}
                            </span>
                            <span className="min-w-0 flex flex-col">
                              <span className="text-sm text-slate-700 leading-5 truncate">
                                {`Deploy to ${envMap.get(latestDeployment.environmentId)?.name ?? phase.name}`}
                              </span>
                              <span className="text-xs text-slate-500 leading-4">
                                {formatTaskSummaryDate(latestDeployment.completedTime ?? latestDeployment.created)}
                              </span>
                            </span>
                          </div>
                        </Link>
                      ) : null}
                    </td>

                    {/* When */}
                    <td className="px-5 py-3">
                      {latestDeployment ? (
                        <span className="text-sm text-slate-500">
                          {formatDate(latestDeployment.completedTime ?? latestDeployment.created)}
                        </span>
                      ) : null}
                    </td>

                    {/* Deploy action */}
                    <td className="px-5 py-3 text-right">
                      {canDeploy && (
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue text-squid-blue bg-white hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            if (deployableEnvIds.length === 0) return
                            const query = buildEnvironmentIdsQuery(deployableEnvIds)
                            navigate(query ? `${deployCreatePath}?${query}` : deployCreatePath)
                          }}
                        >
                          {latestDeployment && deployableEnvIds.length === 1 ? 'Redeploy...' : 'Deploy...'}
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              ))
            )}
          </table>
        </div>

        {/* ── Packages section ── */}
        <SectionHeading title="Packages" />

        <div className="border border-slate-200 border-t-0 rounded-b-lg bg-white mb-6">
          {releasePackages.length === 0 ? (
            <div className="px-5 py-5 text-sm text-slate-500">
              No package information is available for this release.
            </div>
          ) : (
            <>
              <div className="px-5 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                Package versions are currently shown using the release version. Per-package selected version details are not available yet.
              </div>
              <ul className="list-none m-0 p-0 divide-y divide-slate-200">
                {releasePackages.map((pkg) => (
                  <li key={pkg.key} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600">
                        <FileZipOutlined style={{ fontSize: 15 }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 leading-6 break-words">
                          <dfn title={pkg.title} className="not-italic">
                            {pkg.displayName} version {pkg.version || '-'}
                          </dfn>
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1.5 text-xs">
                          <CheckCircleFilled
                            style={{ fontSize: 13 }}
                            className={pkg.isHealthy ? 'text-emerald-500' : 'text-amber-500'}
                          />
                          <span className={pkg.isHealthy ? 'text-emerald-700' : 'text-amber-700'}>
                            {pkg.isHealthy ? 'Package reference resolved' : 'Package information incomplete'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Published: {formatDate(pkg.published) || '-'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                          <p className="m-0">Feed: {pkg.feedName || '—'}</p>
                          <p className="m-0">Package: {pkg.packageId || '—'}</p>
                          <p className="m-0">Reference: {pkg.packageReferenceName || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {release.releaseNote ? (
            <div className="px-5 py-4 border-t border-slate-200">
              <div className="text-sm font-medium text-slate-700 mb-1">Release notes</div>
              <div className="text-sm text-slate-600 whitespace-pre-wrap">
                {release.releaseNote}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Variable Snapshot section ── */}
        <SectionHeading title="Variable Snapshot" />

        <div className="border border-slate-200 border-t-0 rounded-b-lg bg-white mb-6">
          <div className="px-5 py-4 border-b border-slate-200">
            <p className="text-sm text-slate-600 m-0">
              When this release was created, a snapshot of the project variables was taken.
              You can overwrite the variable snapshot by re-importing the variables from the project.
            </p>
            {snapshotNotice ? (
              <p className="text-xs text-amber-600 mt-2 mb-0">{snapshotNotice}</p>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              {snapshotInitDone ? (
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  onClick={() => setShowVariableSnapshot((v) => !v)}
                >
                  {showVariableSnapshot ? 'Hide Snapshot' : 'Show Snapshot'}
                </button>
              ) : (
                <span className="text-xs text-slate-400">Loading snapshot...</span>
              )}
              <button
                type="button"
                className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue text-squid-blue bg-white hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleUpdateVariables}
                disabled={updatingVariables}
              >
                {updatingVariables ? 'Updating...' : 'Update Variables'}
              </button>
            </div>
          </div>

          {showVariableSnapshot ? (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="w-full max-w-sm">
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-1.5">
                    <SearchOutlined className="text-slate-400 text-sm" />
                    <input
                      type="search"
                      value={snapshotFilterText}
                      onChange={(e) => setSnapshotFilterText(e.target.value)}
                      placeholder="By variable name"
                      aria-label="By variable name"
                      className="w-full border-0 outline-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-[5px] text-[13px] font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  title="Show advanced filters"
                >
                  <FilterOutlined style={{ fontSize: 12 }} />
                  Show advanced filters
                </button>
              </div>

              <div className="border border-gray-200 rounded-md overflow-auto max-h-[460px] bg-white">
                <div className="grid grid-cols-[24%_38%_23%_15%] border-b border-gray-200 bg-white">
                  <div className="px-3 py-2 text-sm font-medium text-gray-700 flex items-center">Name</div>
                  <div className="px-3 py-2 text-sm font-medium text-gray-700 flex items-center">Value</div>
                  <div className="px-3 py-2 text-sm font-medium text-gray-700 flex items-center">Scope</div>
                  <div className="px-3 py-2 text-sm font-medium text-gray-700 flex items-center">Source</div>
                </div>

                {snapshotLoading ? (
                  <div className="px-3 py-6 text-sm text-slate-400 text-center">
                    Loading variable snapshot...
                  </div>
                ) : filteredSnapshotRows.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-slate-400 text-center">
                    No variables match the current filter.
                  </div>
                ) : (
                  <div>
                    {filteredSnapshotRows.map((row, rowIndex) => {
                      const showName =
                        rowIndex === 0 || filteredSnapshotRows[rowIndex - 1].name !== row.name

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
                                {row.scopes.map((scope, idx) => (
                                  <span
                                    key={`${row.key}-scope-${idx}`}
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
                          <div className="w-full">
                            {row.sourceHref ? (
                              <Link
                                to={row.sourceHref}
                                className="text-squid-blue hover:underline"
                                target="_self"
                              >
                                {row.sourceLabel}
                              </Link>
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
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ReleaseDetail
