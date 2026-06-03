import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Spin, message } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  FilterOutlined,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import {
  getReleaseVariableSnapshot,
  getRelease,
  getReleaseLifecycleProgression,
  getReleases,
  updateReleaseVariables,
  type ReleaseLifecycleProgressionDto,
  type ReleaseDto,
  type ReleaseSelectedPackageDto,
} from 'pages/apis/release'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getLifecycles, type LifecycleDto } from 'pages/apis/lifecycle'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import {
  getDeploymentSteps,
  getPackageReferences,
  type DeploymentStepDto,
  type PackageReferenceItem,
} from 'pages/apis/deploymentProcess'
import { getMachines, type MachineDto } from 'pages/apis/machine'
import { getTargetTags, type TargetTagDto } from 'pages/apis/targetTag'
import {
  GetVariableSet,
  VariableScopeType,
  type VariableDto,
  type VariableScopeDto,
} from 'pages/apis/variableSet'
import {
  getExternalFeedPackageNotes,
  type ExternalFeedPackageNotesItem,
} from 'pages/apis/externalFeed'
import DeploymentHistory from './DeploymentHistory'

// ── Data loading ─────────────────────────────────────────────────────────────

async function findRelease(
  projectId: number,
  version: string,
  channels: ChannelDto[],
): Promise<ReleaseDto | null> {
  const targetVersion = version.trim()
  if (!targetVersion) return null

  const pageSize = 200
  const maxPages = 50

  const findInScope = async (channelId?: number): Promise<ReleaseDto | null> => {
    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const response = await getReleases({
        projectId,
        pageIndex,
        pageSize,
        ...(typeof channelId === 'number' ? { channelId } : {}),
      }).catch(() => null)
      if (!response) return null

      const found = (response.releases ?? []).find((release) => release.version?.trim() === targetVersion)
      if (found) return found

      const totalCount = Number.isFinite(response.count) ? response.count : 0
      if (totalCount <= pageIndex * pageSize) break
      if ((response.releases ?? []).length === 0) break
    }

    return null
  }

  if (channels.length > 0) {
    for (const channel of channels) {
      const found = await findInScope(channel.id)
      if (found) return found
    }
  }

  return findInScope()
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

function stateColor(state: string): string {
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

function renderPhaseIcon(status: PhaseStatus, isOptional: boolean) {
  const color = phaseStatusColor(status)

  if (isOptional) {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 flex-shrink-0"
        style={{
          borderColor: color,
          backgroundColor: 'transparent',
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: color,
            opacity: status === 'pending' ? 0.55 : 1,
          }}
        />
      </span>
    )
  }

  if (status === 'done') {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <CheckOutlined style={{ fontSize: 9 }} />
      </span>
    )
  }

  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0 border-2"
      style={{
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
  )
}

function toEnvironmentToken(environmentId: number): string {
  return `Environments-${environmentId}`
}

function buildEnvironmentIdsQuery(environmentIds: number[]): string {
  const params = new URLSearchParams()
  environmentIds.forEach((id) => params.append('environmentIds', toEnvironmentToken(id)))
  return params.toString()
}

function buildPackageNoteLookupKey(feedId: number, packageId: string, version: string): string {
  return `${feedId}::${packageId}::${version}`
}

function buildSelectedPackageLookupKey(actionName: string, packageReferenceName: string): string {
  return `${actionName.trim().toLowerCase()}::${packageReferenceName.trim().toLowerCase()}`
}

function buildFeedPackageLookupKey(feedId: number, packageId: string): string {
  return `${feedId}::${packageId}`
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

function resolveScopeLookupKey(raw: string): string {
  const normalized = raw.trim()
  if (!normalized) return ''

  const tokenMatch = normalized.match(/^[A-Za-z]+-(\d+)$/)
  if (tokenMatch) return tokenMatch[1]

  return normalized
}

function resolveScopeLabel(raw: string, labelsById: Map<string, string>): string {
  const normalized = raw.trim()
  if (!normalized) return ''
  return labelsById.get(normalized) ?? labelsById.get(resolveScopeLookupKey(normalized)) ?? normalized
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

function renderTaskStatusIcon(state: string) {
  if (state === 'Success') {
    return <CheckOutlined />
  }
  if (state === 'Executing' || state === 'Pending' || state === 'Cancelling') {
    return <LoadingOutlined />
  }
  if (state === 'Failed' || state === 'TimedOut' || state === 'Cancelled') {
    return <CloseOutlined />
  }
  return <CheckOutlined />
}

// ── Section heading (matches CollapsibleSection header style) ────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="w-full flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-t-lg text-left">
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
  )
}

function PackageSuccessIcon() {
  return (
    <svg
      viewBox="0 0 178 148"
      aria-hidden="true"
      role="img"
      aria-label="Package successful"
      className="w-7 h-auto flex-shrink-0"
    >
      <g id="package" transform="translate(1 1)">
        <g id="success" transform="translate(95 80.333)">
          <path
            d="M59.158 47.515c5.763-9.884 5.763-22.131.015-31.99A29.743 29.743 0 0 0 48.01 4.35 31.141 31.141 0 0 0 32.02.012h-.052a31.519 31.519 0 0 0-15.909 4.314C1.07 13.096-3.988 32.426 4.784 47.415a30.356 30.356 0 0 0 11.185 11.27c9.867 5.752 22.114 5.753 31.973.006a29.725 29.725 0 0 0 11.216-11.176"
            fill="#00874d"
          />
        </g>
        <polygon
          points="146.128 92.031 120.031 118.207 107.812 105.909 101.883 111.838 120.027 130.165 152.042 98.138"
          fill="#FFFFFF"
        />
        <path
          d="M36 0a26.51 26.51 0 0 0-9.75 2.25L2.47 13.83a.21.21 0 0 0 .09.41h56.98L72.516 0H36zm116.9 13.79L129.23 2.25A26.51 26.51 0 0 0 119.48 0H82.924L96.04 14.24h56.75a.239.239 0 0 0 .234-.246.242.242 0 0 0-.124-.204M97 21.11v38.11H58.24V21.11H0v112.94a3.44 3.44 0 0 0 3.44 3.44h96.519a36.022 36.022 0 0 1-5.12-6.886c-5.002-8.548-6.381-18.566-3.866-28.18 2.515-9.615 8.625-17.673 17.201-22.693a37.24 37.24 0 0 1 18.793-5.096c.082-.002.165 0 .248 0a36.638 36.638 0 0 1 18.659 5.109 35.289 35.289 0 0 1 9.316 7.693V21.11H97z"
          fill="#2E3748"
        />
      </g>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ReleaseDetail: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { spaceId, projectName, version } = useParams<{
    spaceId: string
    projectName: string
    version: string
  }>()
  const releaseIdFromQuery = useMemo(() => {
    const raw = (searchParams.get('releaseId') ?? '').trim()
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])

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
  const [releaseProgression, setReleaseProgression] = useState<ReleaseLifecycleProgressionDto | null>(null)
  const [projectChannels, setProjectChannels] = useState<ChannelDto[]>([])
  const [channel, setChannel] = useState<ChannelDto | null>(null)
  const [lifecycle, setLifecycle] = useState<LifecycleDto | null>(null)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [machines, setMachines] = useState<MachineDto[]>([])
  const [targetTags, setTargetTags] = useState<TargetTagDto[]>([])
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStepDto[]>([])
  const [packageReferences, setPackageReferences] = useState<PackageReferenceItem[]>([])
  const [packageNotesLoading, setPackageNotesLoading] = useState(false)
  const [packageNotesByLookupKey, setPackageNotesByLookupKey] = useState<Map<string, ExternalFeedPackageNotesItem>>(new Map())
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

        const [chanRes, lcRes, envRes, machineRes, tagRes, stepRes, releaseFromId] = await Promise.all([
          getChannels({ projectId: foundProject.id, pageSize: 1000 }).catch(() => null),
          getLifecycles({ pageSize: 100 }).catch(() => null),
          getEnvironments({ pageSize: 1000 }).catch(() => null),
          getMachines({ pageIndex: 1, pageSize: 1000, spaceId: foundProject.spaceId }).catch(() => null),
          getTargetTags().catch(() => null),
          getDeploymentSteps({ processId: foundProject.deploymentProcessId, pageIndex: 1, pageSize: 1000 }).catch(() => null),
          releaseIdFromQuery ? getRelease(releaseIdFromQuery).catch(() => null) : Promise.resolve(null),
        ])

        const channels = chanRes?.channels.filter((c) => c.projectId === foundProject.id) ?? []
        const decodedVersion = decodeURIComponent(version!)

        const foundRelease = (
          releaseFromId
          && releaseFromId.projectId === foundProject.id
        )
          ? releaseFromId
          : await findRelease(foundProject.id, decodedVersion, channels)
        setRelease(foundRelease)
        setReleaseProgression(null)

        setProjectChannels(channels)
        setEnvironments((envRes?.environments ?? []).filter((environment) => environment.spaceId === foundProject.spaceId))
        setMachines((machineRes?.machines ?? []).filter((machine) => machine.spaceId === foundProject.spaceId))
        setTargetTags((tagRes?.targetTags ?? []).filter((tag) => tag.spaceId === foundProject.spaceId))
        setDeploymentSteps(stepRes?.steps ?? [])

        const pkgRefRes = await getPackageReferences(
          foundProject.id,
          foundRelease ? { channelId: foundRelease.channelId } : undefined,
        ).catch(() => null)
        setPackageReferences(pkgRefRes?.packageReferences ?? [])

        if (foundRelease) {
          const foundReleaseProgression = await getReleaseLifecycleProgression(foundRelease.id).catch(() => null)
          setReleaseProgression(foundReleaseProgression)

          const foundChannel = channels.find((c) => c.id === foundRelease.channelId) ?? null
          setChannel(foundChannel)

          // channel.lifecycleId is null for default channels → fall back to project.lifecycleId
          const effectiveLifecycleId = foundReleaseProgression?.lifecycleId
            ?? foundChannel?.lifecycleId
            ?? foundProject.lifecycleId
          const foundLifecycle = lcRes?.lifecycles.find((lc) => lc.id === effectiveLifecycleId) ?? null
          setLifecycle(foundLifecycle)
        } else {
          setChannel(null)
          setLifecycle(null)
        }
      } catch {
        message.error('Failed to load release details.')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName, releaseIdFromQuery, version])

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

  useEffect(() => {
  }, [release?.id])

  const envMap = useMemo(
    () => new Map(environments.map((e) => [e.id, e])),
    [environments],
  )
  const environmentNameById = useMemo(
    () => new Map(environments.map((environment) => [String(environment.id), environment.name])),
    [environments],
  )
  const machineNameById = useMemo(
    () => new Map(machines.map((machine) => [String(machine.id), machine.name])),
    [machines],
  )
  const roleNameByValue = useMemo(
    () =>
      new Map(
        targetTags.flatMap((targetTag) => [
          [String(targetTag.id), targetTag.name] as const,
          [targetTag.name.trim(), targetTag.name] as const,
        ]),
      ),
    [targetTags],
  )
  const channelNameById = useMemo(
    () => new Map(projectChannels.map((channelItem) => [String(channelItem.id), channelItem.name])),
    [projectChannels],
  )
  const actionNameById = useMemo(
    () =>
      new Map(
        deploymentSteps.flatMap((step) =>
          (step.actions ?? []).map((action) => [
            String(action.id),
            formatActionScopeLabel(step.stepOrder, step.name, action.name, action.id),
          ] as const),
        ),
      ),
    [deploymentSteps],
  )
  const processNameById = useMemo(
    () => new Map(project ? [[String(project.deploymentProcessId), `${project.name} deployment process`]] : []),
    [project],
  )
  const selectedPackageVersions = useMemo(() => {
    const selectedPackages: ReleaseSelectedPackageDto[] = release?.selectedPackages ?? []
    const byActionPackage = new Map<string, string>()
    const byFeedPackage = new Map<string, string>()
    const directRequests: Array<{ feedId: number; packageId: string; version: string }> = []
    const directDedupe = new Set<string>()

    selectedPackages.forEach((selectedPackage) => {
      const selectedVersion = (selectedPackage.version ?? '').trim()
      if (!selectedVersion) return

      const actionName = (selectedPackage.actionName ?? '').trim()
      const packageReferenceName = (selectedPackage.packageReferenceName ?? '').trim()
      if (actionName || packageReferenceName) {
        byActionPackage.set(buildSelectedPackageLookupKey(actionName, packageReferenceName), selectedVersion)
      }

      const selectedFeedId = Number(selectedPackage.feedId)
      const selectedPackageId = (selectedPackage.packageId ?? '').trim()
      if (!Number.isFinite(selectedFeedId) || selectedFeedId <= 0 || !selectedPackageId) return

      byFeedPackage.set(buildFeedPackageLookupKey(selectedFeedId, selectedPackageId), selectedVersion)

      const directLookupKey = buildPackageNoteLookupKey(selectedFeedId, selectedPackageId, selectedVersion)
      if (directDedupe.has(directLookupKey)) return
      directDedupe.add(directLookupKey)
      directRequests.push({
        feedId: selectedFeedId,
        packageId: selectedPackageId,
        version: selectedVersion,
      })
    })

    return { byActionPackage, byFeedPackage, directRequests }
  }, [release?.selectedPackages])

  const getSnapshotScopeLabel = (scope: VariableScopeDto): string => {
    const raw = (scope.scopeValue ?? '').trim()
    if (!raw) return ''

    if (scope.scopeType === VariableScopeType.Environment) return resolveScopeLabel(raw, environmentNameById)
    if (scope.scopeType === VariableScopeType.Machine) return resolveScopeLabel(raw, machineNameById)
    if (scope.scopeType === VariableScopeType.Role) return resolveScopeLabel(raw, roleNameByValue)
    if (scope.scopeType === VariableScopeType.Channel) return resolveScopeLabel(raw, channelNameById)
    if (scope.scopeType === VariableScopeType.Action) return resolveScopeLabel(raw, actionNameById)
    if (scope.scopeType === VariableScopeType.Process) return resolveScopeLabel(raw, processNameById)

    return raw
  }

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
      const selectedVersion = (pkg.lastReleaseVersion ?? '').trim()
      const normalizedPackageId = (pkg.packageId ?? '').trim()
      const selectedReleaseVersion =
        selectedPackageVersions.byActionPackage.get(
          buildSelectedPackageLookupKey(pkg.actionName ?? '', pkg.packageReferenceName ?? ''),
        )
        ?? (
          Number.isFinite(pkg.feedId) && pkg.feedId > 0 && normalizedPackageId
            ? selectedPackageVersions.byFeedPackage.get(buildFeedPackageLookupKey(pkg.feedId, normalizedPackageId))
            : undefined
        )
        ?? ''
      const displayName = packageRef
        ? `${pkg.actionName}:${packageRef}(${pkg.packageId})`
        : `${pkg.actionName}:${pkg.packageId}`
      const noteLookupKey =
        Number.isFinite(pkg.feedId)
        && pkg.feedId > 0
        && normalizedPackageId.length > 0
        && selectedReleaseVersion.length > 0
          ? buildPackageNoteLookupKey(pkg.feedId, normalizedPackageId, selectedReleaseVersion)
          : ''

      return {
        key: `${pkg.actionName}-${pkg.packageReferenceName}-${pkg.packageId}-${index}`,
        title: `${pkg.packageId || 'Package'} from feed ${pkg.feedName || 'Unknown feed'}`,
        displayName,
        version: selectedReleaseVersion || '-',
        lastReleaseVersion: selectedVersion || '-',
        resolvedVersion: selectedReleaseVersion,
        feedId: pkg.feedId,
        noteLookupKey,
        published: pkg.published ?? null,
        platform: pkg.platform ?? null,
        packageId: normalizedPackageId,
        feedName: pkg.feedName,
        packageReferenceName: pkg.packageReferenceName,
      }
    })
  }, [packageReferences, selectedPackageVersions.byActionPackage, selectedPackageVersions.byFeedPackage])

  const packageNoteRequests = useMemo(() => {
    const dedupe = new Set<string>()
    const requests: Array<{ feedId: number; packageId: string; version: string }> = []

    selectedPackageVersions.directRequests.forEach((item) => {
      const lookupKey = buildPackageNoteLookupKey(item.feedId, item.packageId, item.version)
      if (dedupe.has(lookupKey)) return
      dedupe.add(lookupKey)
      requests.push(item)
    })

    releasePackages.forEach((pkg) => {
      if (!pkg.noteLookupKey) return
      if (dedupe.has(pkg.noteLookupKey)) return
      dedupe.add(pkg.noteLookupKey)
      requests.push({
        feedId: pkg.feedId,
        packageId: pkg.packageId,
        version: pkg.resolvedVersion,
      })
    })

    return requests
  }, [releasePackages, selectedPackageVersions.directRequests])

  useEffect(() => {
    let cancelled = false

    if (packageNoteRequests.length === 0) {
      setPackageNotesByLookupKey(new Map())
      setPackageNotesLoading(false)
      return
    }

    setPackageNotesLoading(true)

    getExternalFeedPackageNotes({
      spaceId: project?.spaceId ?? release?.spaceId,
      packages: packageNoteRequests,
    })
      .then((response) => {
        if (cancelled) return

        const nextMap = new Map<string, ExternalFeedPackageNotesItem>()
        ;(response.packages ?? []).forEach((item) => {
          const normalizedPackageId = (item.packageId ?? '').trim()
          const normalizedVersion = (item.version ?? '').trim()
          if (!Number.isFinite(item.feedId) || item.feedId <= 0 || !normalizedPackageId || !normalizedVersion) return
          nextMap.set(
            buildPackageNoteLookupKey(item.feedId, normalizedPackageId, normalizedVersion),
            {
              ...item,
              packageId: normalizedPackageId,
              version: normalizedVersion,
            },
          )
        })

        setPackageNotesByLookupKey(nextMap)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load package notes', error)
        setPackageNotesByLookupKey(new Map())
        message.warning('Failed to load package notes.')
      })
      .finally(() => {
        if (!cancelled) setPackageNotesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [packageNoteRequests, project?.spaceId, release?.spaceId])

  const phaseRows = useMemo(() => {
    if (!releaseProgression) return []

    const phases = [...(releaseProgression.phases ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    return phases.map((phase) => {
      const environments = phase.environments ?? []
      const envIds = environments.map((env) => env.environmentId)
      const envNames = environments.map((env) => env.environmentName || `Env #${env.environmentId}`).join(', ')
      const deployableEnvIds = environments.filter((env) => env.canDeploy).map((env) => env.environmentId)
      const canDeploy = deployableEnvIds.length > 0

      const latestDeployment = environments
        .filter((env) => env.deployment != null)
        .map((env) => ({
          ...env.deployment!,
          environmentId: env.environmentId,
        }))
        .sort((a, b) => {
          const aTs = Date.parse(a.completedTime ?? a.created)
          const bTs = Date.parse(b.completedTime ?? b.created)
          const safeATs = Number.isFinite(aTs) ? aTs : 0
          const safeBTs = Number.isFinite(bTs) ? bTs : 0
          return safeBTs - safeATs
        })[0] ?? null

      const status: PhaseStatus = phase.progress === 'Complete'
        ? 'done'
        : phase.progress === 'Current'
          ? 'current'
          : 'pending'

      return {
        phase: {
          id: phase.phaseId,
          name: phase.phaseName,
          isOptionalPhase: phase.isOptional,
        },
        envIds,
        envNames,
        latestDeployment,
        deployableEnvIds,
        canDeploy,
        status,
        phaseCompleted: phase.isComplete,
      }
    })
  }, [releaseProgression])

  const nextDeployEnvIds = useMemo(() => {
    if (!releaseProgression) return []
    const orderedEnvIds: number[] = []
    for (const phase of [...(releaseProgression.phases ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
      for (const environment of phase.environments ?? []) {
        if (!environment.canDeploy) continue
        if (!orderedEnvIds.includes(environment.environmentId)) {
          orderedEnvIds.push(environment.environmentId)
        }
      }
    }
    return orderedEnvIds
  }, [releaseProgression])
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
      scopes: (v.scopes ?? []).map(getSnapshotScopeLabel),
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
                scopes: (v.scopes ?? []).map(getSnapshotScopeLabel),
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
    <div className="rounded-xl border border-slate-200 overflow-visible flex flex-col min-h-full max-w-7xl mx-auto w-full">
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
              className="inline-flex items-center px-3 py-[5px] text-[13px] font-medium rounded border border-squid-blue text-squid-blue bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={nextDeployEnvIds.length === 0}
              onClick={() => {
                const defaultTarget = nextDeployEnvIds[0]
                if (defaultTarget == null) return
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
              Lifecycle: <b className="mr-4">{releaseProgression?.lifecycleName ?? lifecycle?.name ?? '—'}</b>
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
                        {renderPhaseIcon(status, phase.isOptionalPhase)}
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
                              <span className="inline-flex items-center justify-center text-[14px] leading-none">
                                {renderTaskStatusIcon(latestDeployment.state)}
                              </span>
                            </span>
                            <span className="min-w-0 flex flex-col justify-center">
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
              <ul className="list-none m-0 p-0 divide-y divide-slate-200">
                {releasePackages.map((pkg) => {
                  const packageNote = pkg.noteLookupKey ? packageNotesByLookupKey.get(pkg.noteLookupKey) : null
                  const published = packageNote?.succeeded ? packageNote.published : pkg.published
                  const showLoadingNotes = packageNotesLoading && Boolean(pkg.noteLookupKey) && !packageNote

                  return (
                    <li key={pkg.key} className="px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <PackageSuccessIcon />
                          <div className="min-w-0 text-sm font-semibold text-slate-800 leading-6 break-words">
                            <dfn title={pkg.title} className="not-italic">
                              {pkg.displayName} version {pkg.version || '-'}
                            </dfn>
                          </div>
                        </div>
                        <div className="ml-10 mt-1 text-xs text-emerald-600">
                          Package reference resolved
                        </div>
                        {showLoadingNotes ? (
                          <div className="ml-10 mt-1 text-sm text-slate-500">Loading package notes...</div>
                        ) : null}
                        {packageNote?.succeeded && packageNote.notes ? (
                          <div className="ml-10 mt-1 text-sm text-slate-600 whitespace-pre-wrap break-words">
                            {packageNote.notes}
                          </div>
                        ) : null}
                        {packageNote && !packageNote.succeeded && packageNote.failureReason ? (
                          <div className="ml-10 mt-1 text-sm text-amber-600">
                            {packageNote.failureReason}
                          </div>
                        ) : null}
                        <div className="ml-10 mt-1 text-sm text-slate-600">
                          Published: {formatDate(published) || '-'}
                        </div>
                      </div>
                    </li>
                  )
                })}
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

        {/* ── Deployment History section ── */}
        <SectionHeading title="Deployment history" />

        <DeploymentHistory
          releaseId={release.id}
          releaseVersion={release.version}
          projectName={project?.name ?? 'Project'}
          basePath={basePath}
        />
      </div>
    </div>
  )
}

export default ReleaseDetail
