import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Select, Radio, Spin, message, Checkbox } from 'antd'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getReleases, type ReleaseDto } from 'pages/apis/release'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getEnvironments, type EnvironmentDto } from 'pages/apis/environment'
import { getProjectProgression, type ProjectProgression } from 'pages/apis/projectProgression'
import { getMachines, type MachineDto } from 'pages/apis/machine'
import { getDeploymentSteps, type DeploymentStepDto } from 'pages/apis/deploymentProcess'
import {
  createDeployment,
  previewDeployment,
  type DeploymentPreviewResult,
  type DeploymentRequestPayload,
  type DeploymentPreviewStepResult,
} from 'pages/apis/deployment'

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

function parseEnvironmentToken(raw: string): number | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const matched = text.match(/(\d+)$/)
  if (!matched) return null
  const value = Number(matched[1])
  return Number.isFinite(value) ? value : null
}

function toIsoOrUndefined(localDateTime: string): string | undefined {
  const text = String(localDateTime ?? '').trim()
  if (!text) return undefined
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function mergeBlockingReasonsByEnvironment(
  envName: string,
  reasons: string[],
): string[] {
  if (!reasons || reasons.length === 0) return [`${envName}: deployment preview failed`]
  return reasons.map((reason) => `${envName}: ${reason}`)
}

interface StepCandidate {
  stepId: number
  stepOrder: number
  name: string
  isRequired: boolean
  actionIds: number[]
}

type DeploymentTargetMode = 'AllApplicable' | 'IncludeSpecific' | 'ExcludeSpecific'
type FailureMode = 'Off' | 'EnvironmentDefault' | 'On'

// ── Expandable form card (matches ExpandableFormCard in add.tsx) ─────────────

function ExpandableFormCard({
  title,
  subtitle,
  expanded,
  onToggle,
  contentLayout = 'indented',
  hasBorder = true,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  contentLayout?: 'indented' | 'full'
  hasBorder?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={hasBorder ? 'border-b border-gray-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '240px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="text-sm text-gray-500 pt-0.5">{subtitle}</div>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          <DownOutlined className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
        </button>
      </div>
      {expanded && (
        contentLayout === 'full'
          ? <div className="pl-6 pr-6 pb-5">{children}</div>
          : (
            <div
              className="grid pl-6 pr-6 pb-5"
              style={{ gridTemplateColumns: '240px 1fr' }}
            >
              <div />
              <div>{children}</div>
            </div>
          )
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DeployCreate: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName, version } = useParams<{
    spaceId: string
    projectName: string
    version: string
  }>()
  const [searchParams] = useSearchParams()
  const preselectedEnvIds = useMemo(() => {
    const tokens: string[] = []
    const envIdsParams = searchParams.getAll('environmentIds')
    envIdsParams.forEach((value) => {
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((token) => tokens.push(token))
    })

    // Backward compatibility: old query key.
    const legacyEnvironmentId = searchParams.get('environmentId')
    if (legacyEnvironmentId) tokens.push(legacyEnvironmentId)

    const parsed: number[] = []
    const seen = new Set<number>()
    tokens.forEach((token) => {
      const value = parseEnvironmentToken(token)
      if (value == null || seen.has(value)) return
      seen.add(value)
      parsed.push(value)
    })

    return parsed
  }, [searchParams])

  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [release, setRelease] = useState<ReleaseDto | null>(null)
  const [progression, setProgression] = useState<ProjectProgression | null>(null)
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [machines, setMachines] = useState<MachineDto[]>([])
  const [steps, setSteps] = useState<DeploymentStepDto[]>([])
  const [availableEnvIds, setAvailableEnvIds] = useState<number[]>([])
  const [selectedEnvIds, setSelectedEnvIds] = useState<number[]>([])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [queueTimeInput, setQueueTimeInput] = useState('')
  const [queueTimeExpiryInput, setQueueTimeExpiryInput] = useState('')
  const [specificMachineIdsByEnvironment, setSpecificMachineIdsByEnvironment] = useState<Record<number, string[]>>({})
  const [excludedMachineIdsByEnvironment, setExcludedMachineIdsByEnvironment] = useState<Record<number, string[]>>({})
  const [deploymentTargetModeByEnvironment, setDeploymentTargetModeByEnvironment] = useState<Record<number, DeploymentTargetMode>>({})
  const [deploymentTargetsExpandedByEnvironment, setDeploymentTargetsExpandedByEnvironment] = useState<Record<number, boolean>>({})
  const [excludedStepIds, setExcludedStepIds] = useState<number[]>([])
  const [stepFilterText, setStepFilterText] = useState('')
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationReasons, setValidationReasons] = useState<string[]>([])
  const [validationMessage, setValidationMessage] = useState('')
  const [validationPassed, setValidationPassed] = useState(false)
  const [validationByEnvironment, setValidationByEnvironment] = useState<Record<number, DeploymentPreviewResult>>({})
  const [envsExpanded, setEnvsExpanded] = useState(true)
  const [whenExpanded, setWhenExpanded] = useState(false)
  const [excludedStepsExpanded, setExcludedStepsExpanded] = useState(false)
  const [failureModeExpanded, setFailureModeExpanded] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(true)
  const [expandedPreviewRows, setExpandedPreviewRows] = useState<number[]>([])
  const [failureMode, setFailureMode] = useState<FailureMode>('Off')

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

        const [chanRes, progRes, envRes, machineRes, stepRes] = await Promise.all([
          getChannels({ projectId: foundProject.id, pageSize: 1000 }).catch(() => null),
          getProjectProgression(foundProject.id).catch(() => null),
          getEnvironments({ pageSize: 1000 }).catch(() => null),
          getMachines({ pageSize: 2000, spaceId: foundProject.spaceId }).catch(() => null),
          getDeploymentSteps({ processId: foundProject.deploymentProcessId, pageIndex: 1, pageSize: 2000 }).catch(() => null),
        ])

        const channels = chanRes?.channels.filter((c) => c.projectId === foundProject.id) ?? []
        const decodedVersion = decodeURIComponent(version!)
        const foundRelease = await findRelease(foundProject.id, channels, decodedVersion)
        setRelease(foundRelease)
        setProgression(progRes ?? null)
        setEnvironments(envRes?.environments ?? [])
        setMachines(machineRes?.machines ?? [])
        setSteps(stepRes?.steps ?? [])

        const relProg = progRes?.releases.find((rp) => rp.release.version === decodedVersion)
        const nextEnvIds = relProg?.nextDeployments ?? []
        setAvailableEnvIds(nextEnvIds)

        const validRequestedEnvIds = preselectedEnvIds.filter((id) => nextEnvIds.includes(id))
        if (validRequestedEnvIds.length > 0) {
          setSelectedEnvIds(validRequestedEnvIds)
        } else if (nextEnvIds.length > 0) {
          setSelectedEnvIds([nextEnvIds[0]])
        } else {
          setSelectedEnvIds([])
        }
      } catch {
        message.error('Failed to load deployment data.')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName, version, preselectedEnvIds])

  const envMap = useMemo(
    () => new Map(environments.map((e) => [e.id, e])),
    [environments],
  )

  const envOptions = useMemo(
    () => availableEnvIds.map((id) => ({ value: id, label: envMap.get(id)?.name ?? `Environment ${id}` })),
    [availableEnvIds, envMap],
  )

  const machineOptionsByEnvironment = useMemo<Record<number, { value: string, label: string }[]>>(() => {
    const enabledMachines = machines
      .filter((machine) => !machine.isDisabled)
      .sort((a, b) => a.name.localeCompare(b.name))

    const result: Record<number, { value: string, label: string }[]> = {}

    selectedEnvIds.forEach((envId) => {
      result[envId] = enabledMachines
        .filter((machine) => machine.environmentIds.includes(envId))
        .map((machine) => ({
          value: String(machine.id),
          label: machine.name,
        }))
    })

    return result
  }, [machines, selectedEnvIds])

  useEffect(() => {
    setSpecificMachineIdsByEnvironment((prev) => {
      let changed = false
      const next: Record<number, string[]> = {}

      selectedEnvIds.forEach((envId) => {
        const allowedValues = new Set((machineOptionsByEnvironment[envId] ?? []).map((option) => option.value))
        const current = prev[envId] ?? []
        const filtered = current.filter((id) => allowedValues.has(id))
        next[envId] = filtered
        if (filtered.length !== current.length) changed = true
      })

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true
      return changed ? next : prev
    })

    setExcludedMachineIdsByEnvironment((prev) => {
      let changed = false
      const next: Record<number, string[]> = {}

      selectedEnvIds.forEach((envId) => {
        const allowedValues = new Set((machineOptionsByEnvironment[envId] ?? []).map((option) => option.value))
        const current = prev[envId] ?? []
        const filtered = current.filter((id) => allowedValues.has(id))
        next[envId] = filtered
        if (filtered.length !== current.length) changed = true
      })

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true
      return changed ? next : prev
    })
  }, [machineOptionsByEnvironment, selectedEnvIds])

  useEffect(() => {
    setDeploymentTargetModeByEnvironment((prev) => {
      let changed = false
      const next: Record<number, DeploymentTargetMode> = {}

      selectedEnvIds.forEach((envId) => {
        const specific = specificMachineIdsByEnvironment[envId] ?? []
        const excluded = excludedMachineIdsByEnvironment[envId] ?? []
        const inferred: DeploymentTargetMode =
          specific.length > 0 ? 'IncludeSpecific' : excluded.length > 0 ? 'ExcludeSpecific' : 'AllApplicable'
        const mode = prev[envId] ?? inferred
        next[envId] = mode
        if (prev[envId] !== mode) changed = true
      })

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true
      return changed ? next : prev
    })

    setDeploymentTargetsExpandedByEnvironment((prev) => {
      let changed = false
      const next: Record<number, boolean> = {}

      selectedEnvIds.forEach((envId) => {
        const expanded = prev[envId] ?? false
        next[envId] = expanded
        if (prev[envId] !== expanded) changed = true
      })

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true
      return changed ? next : prev
    })
  }, [selectedEnvIds, specificMachineIdsByEnvironment, excludedMachineIdsByEnvironment])

  const stepCandidates = useMemo<StepCandidate[]>(
    () =>
      [...steps]
        .sort((a, b) => a.stepOrder - b.stepOrder)
        .map((step) => {
          const activeActions = step.actions.filter((action) => !action.isDisabled)
          return {
            stepId: step.id,
            stepOrder: step.stepOrder,
            name: step.name,
            isRequired: step.isRequired,
            actionIds: activeActions.map((action) => action.id),
          }
        }),
    [steps],
  )

  const filteredStepCandidates = useMemo(() => {
    const keyword = stepFilterText.trim().toLowerCase()
    if (!keyword) return stepCandidates
    return stepCandidates.filter((step) => step.name.toLowerCase().includes(keyword))
  }, [stepCandidates, stepFilterText])

  const skipActionIds = useMemo(() => {
    const selected = stepCandidates.filter((step) => excludedStepIds.includes(step.stepId))
    const ids = new Set<number>()
    selected.forEach((step) => {
      step.actionIds.forEach((id) => ids.add(id))
    })
    return Array.from(ids)
  }, [stepCandidates, excludedStepIds])

  const currentReleaseVersionByEnvironment = useMemo(() => {
    const currentMap = new Map<number, string>()
    if (!progression) return currentMap

    for (const releaseProgress of progression.releases) {
      Object.entries(releaseProgress.deployments ?? {}).forEach(([envIdText, deployments]) => {
        const envId = Number(envIdText)
        if (!Number.isFinite(envId) || currentMap.has(envId)) return
        const currentDeployment = deployments.find((item) => item.isCurrent)
        if (currentDeployment) {
          currentMap.set(envId, currentDeployment.releaseVersion)
          return
        }
        if (deployments.length > 0) {
          currentMap.set(envId, deployments[0].releaseVersion)
        }
      })
    }

    return currentMap
  }, [progression])

  const machineNameById = useMemo(
    () => new Map(machines.map((machine) => [String(machine.id), machine.name])),
    [machines],
  )

  const queueTime = useMemo(
    () => (scheduleMode === 'later' ? toIsoOrUndefined(queueTimeInput) : undefined),
    [scheduleMode, queueTimeInput],
  )
  const queueTimeExpiry = useMemo(
    () => (scheduleMode === 'later' ? toIsoOrUndefined(queueTimeExpiryInput) : undefined),
    [scheduleMode, queueTimeExpiryInput],
  )

  const overlappingMachineIdsByEnvironment = useMemo(() => {
    const result: Record<number, string[]> = {}
    selectedEnvIds.forEach((envId) => {
      const specific = specificMachineIdsByEnvironment[envId] ?? []
      const excludedSet = new Set(excludedMachineIdsByEnvironment[envId] ?? [])
      result[envId] = specific.filter((id) => excludedSet.has(id))
    })
    return result
  }, [selectedEnvIds, specificMachineIdsByEnvironment, excludedMachineIdsByEnvironment])

  const buildDeploymentRequestPayloadForEnvironment = useCallback(
    (environmentId: number): DeploymentRequestPayload => {
      const mode = deploymentTargetModeByEnvironment[environmentId] ?? 'AllApplicable'
      const specificMachineIds = mode === 'IncludeSpecific'
        ? (specificMachineIdsByEnvironment[environmentId] ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
        : []
      const excludedMachineIds = mode === 'ExcludeSpecific'
        ? (excludedMachineIdsByEnvironment[environmentId] ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
        : []
      const environmentName = envMap.get(environmentId)?.name ?? `Environment ${environmentId}`
      const useGuidedFailure = failureMode === 'On'
        ? true
        : failureMode === 'Off'
          ? false
          : undefined

      return {
        releaseId: release?.id ?? 0,
        environmentId,
        name: `Deploy to ${environmentName}`,
        comments: '',
        forcePackageDownload: false,
        forcePackageRedeployment: false,
        useGuidedFailure,
        queueTime,
        queueTimeExpiry,
        formValues: {},
        specificMachineIds,
        excludedMachineIds,
        skipActionIds,
      }
    },
    [
      release?.id,
      failureMode,
      queueTime,
      queueTimeExpiry,
      deploymentTargetModeByEnvironment,
      specificMachineIdsByEnvironment,
      excludedMachineIdsByEnvironment,
      skipActionIds,
      envMap,
    ],
  )

  const runEnvironmentValidation = useCallback(
    async (environmentIds: number[], signal?: AbortSignal) => {
      if (!release || environmentIds.length === 0) {
        return {
          isValid: false,
          reasons: ['Please select at least one environment.'],
          message: 'Deployment preview failed.',
          byEnvironment: {} as Record<number, DeploymentPreviewResult>,
        }
      }

      const reasons: string[] = []
      let validCount = 0
      const byEnvironment: Record<number, DeploymentPreviewResult> = {}

      for (const envId of environmentIds) {
        const envName = envMap.get(envId)?.name ?? `Environment ${envId}`
        const payload = buildDeploymentRequestPayloadForEnvironment(envId)
        const result = await previewDeployment({ deploymentRequestPayload: payload }, { signal })
        byEnvironment[envId] = result

        if (result.canDeploy) {
          validCount += 1
          continue
        }

        reasons.push(...mergeBlockingReasonsByEnvironment(envName, result.blockingReasons))
      }

      return {
        isValid: reasons.length === 0 && validCount === environmentIds.length,
        reasons,
        message: reasons.length === 0 ? 'Deployment preview passed.' : reasons.join('; '),
        byEnvironment,
      }
    },
    [release, envMap, buildDeploymentRequestPayloadForEnvironment],
  )

  useEffect(() => {
    if (!release || selectedEnvIds.length === 0) {
      setValidationPassed(false)
      setValidationReasons([])
      setValidationMessage('')
      setValidationByEnvironment({})
      setValidationLoading(false)
      return
    }

    setValidationLoading(true)
    setValidationPassed(false)
    setValidationReasons([])
    setValidationMessage('')
    setValidationByEnvironment({})

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await runEnvironmentValidation(selectedEnvIds, controller.signal)
        if (controller.signal.aborted) return
        setValidationPassed(result.isValid)
        setValidationReasons(result.reasons)
        setValidationMessage(result.message)
        setValidationByEnvironment(result.byEnvironment)
      } catch (error: any) {
        if (controller.signal.aborted) return
        setValidationPassed(false)
        setValidationReasons([error?.message || 'Failed to load deployment preview.'])
        setValidationMessage('Deployment preview failed.')
        setValidationByEnvironment({})
      } finally {
        if (!controller.signal.aborted) {
          setValidationLoading(false)
        }
      }
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    release?.id,
    selectedEnvIds,
    queueTime,
    queueTimeExpiry,
    deploymentTargetModeByEnvironment,
    specificMachineIdsByEnvironment,
    excludedMachineIdsByEnvironment,
    skipActionIds,
    runEnvironmentValidation,
  ])

  const handleDeploy = async () => {
    if (!release || selectedEnvIds.length === 0) {
      message.error('Please select at least one environment.')
      return
    }

    setDeploying(true)
    try {
      const finalValidation = await runEnvironmentValidation(selectedEnvIds)
      if (!finalValidation.isValid) {
        setValidationPassed(false)
        setValidationReasons(finalValidation.reasons)
        setValidationMessage(finalValidation.message)
        setValidationByEnvironment(finalValidation.byEnvironment)
        message.error('Deployment preview failed. Please review the reasons.')
        return
      }

      setValidationByEnvironment(finalValidation.byEnvironment)

      const createTasks = selectedEnvIds.map(async (envId) => {
        const env = envMap.get(envId)
        const payload = buildDeploymentRequestPayloadForEnvironment(envId)

        const result = await createDeployment({
          releaseId: payload.releaseId,
          environmentId: payload.environmentId,
          name: `Deploy to ${env?.name ?? envId}`,
          comments: '',
          forcePackageDownload: false,
          forcePackageRedeployment: false,
          useGuidedFailure: payload.useGuidedFailure,
          formValues: {},
          queueTime: payload.queueTime,
          queueTimeExpiry: payload.queueTimeExpiry,
          specificMachineIds: (payload.specificMachineIds ?? []).map((id) => String(id)),
          excludedMachineIds: (payload.excludedMachineIds ?? []).map((id) => String(id)),
          skipActionIds: payload.skipActionIds,
        })

        return {
          environmentId: envId,
          deploymentId: result.deployment.id,
          taskId: result.taskId,
        }
      })

      const settled = await Promise.allSettled(createTasks)
      const succeededDeployments: Array<{
        environmentId: number
        deploymentId: number
        taskId: number
      }> = []
      const failedEnvironmentIds: number[] = []

      settled.forEach((item, index) => {
        const environmentId = selectedEnvIds[index]
        if (item.status === 'fulfilled') {
          succeededDeployments.push(item.value)
        } else {
          failedEnvironmentIds.push(environmentId)
        }
      })

      if (failedEnvironmentIds.length === 0) {
        const envNames = succeededDeployments
          .map((item) => envMap.get(item.environmentId)?.name)
          .filter(Boolean)
          .join(', ')

        message.success(`Deployment to ${envNames} created.`)
        if (succeededDeployments.length === 1) {
          const only = succeededDeployments[0]
          navigate(
            `${basePath}/releases/${encodeURIComponent(release.version)}/deployments/${only.deploymentId}`,
            { state: { taskId: only.taskId, environmentId: only.environmentId } },
          )
          return
        }

        navigate(`${basePath}/releases/${encodeURIComponent(release.version)}?releaseId=${release.id}`)
        return
      }

      const failedEnvironmentNames = failedEnvironmentIds
        .map((id) => envMap.get(id)?.name ?? `Environment ${id}`)
        .join(', ')

      if (succeededDeployments.length > 0) {
        setSelectedEnvIds(failedEnvironmentIds)
        message.warning(
          `Created ${succeededDeployments.length} deployment(s), failed ${failedEnvironmentIds.length}: ${failedEnvironmentNames}.`,
        )
        return
      }

      message.error(`Failed to create deployments: ${failedEnvironmentNames}.`)
    } catch (error: any) {
      message.error(error?.message || 'Failed to create deployment.')
    } finally {
      setDeploying(false)
    }
  }

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

  const envSubtitle = selectedEnvIds.length > 0
    ? selectedEnvIds.map((id) => envMap.get(id)?.name).filter(Boolean).join(', ')
    : undefined
  const excludedStepsSubtitle = excludedStepIds.length > 0
    ? `${excludedStepIds.length} step(s) excluded`
    : 'No steps excluded'
  const failureModeSubtitle = failureMode === 'Off'
    ? 'Do not use guided failure mode'
    : failureMode === 'On'
      ? 'Use guided failure mode'
      : 'Use the default setting from the target environment'
  const hasPreviewSection = selectedEnvIds.length > 0
  const previewSubtitle = selectedEnvIds.length === 1
    ? '1 deployment will be created. Preview and customize it below.'
    : `${selectedEnvIds.length} deployments will be created. Preview and customize them below.`
  const allFormCardsExpanded = envsExpanded
    && whenExpanded
    && excludedStepsExpanded
    && failureModeExpanded
    && (!hasPreviewSection || previewExpanded)
  const canDeploy = selectedEnvIds.length > 0 && validationPassed && !validationLoading && !deploying
  const togglePreviewRow = (envId: number) => {
    setExpandedPreviewRows((prev) =>
      prev.includes(envId) ? prev.filter((id) => id !== envId) : [...prev, envId],
    )
  }
  const setDeploymentTargetMode = (envId: number, mode: DeploymentTargetMode) => {
    setDeploymentTargetModeByEnvironment((prev) => ({
      ...prev,
      [envId]: mode,
    }))

    if (mode === 'AllApplicable') {
      setSpecificMachineIdsByEnvironment((prev) => ({ ...prev, [envId]: [] }))
      setExcludedMachineIdsByEnvironment((prev) => ({ ...prev, [envId]: [] }))
      return
    }

    if (mode === 'IncludeSpecific') {
      setExcludedMachineIdsByEnvironment((prev) => ({ ...prev, [envId]: [] }))
      return
    }

    setSpecificMachineIdsByEnvironment((prev) => ({ ...prev, [envId]: [] }))
  }

  return (
    <div className="bg-white min-h-full">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white">
          {/* ── Header ── */}
          <div className="sticky top-0 z-10 bg-white rounded-t-md border-b border-gray-200 px-6 pt-5 pb-0">
            <nav className="mb-3">
              <ol className="flex items-center gap-1 text-sm">
                <li>
                  <Link to={`${basePath}/releases`} className="text-squid-blue hover:underline">
                    Releases
                  </Link>
                </li>
                <li><span className="text-slate-300 mx-1">/</span></li>
                <li>
                  <Link
                    to={`${basePath}/releases/${encodeURIComponent(release.version)}?releaseId=${release.id}`}
                    className="text-squid-blue hover:underline"
                  >
                    {release.version}
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="flex items-center justify-between gap-3 mb-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">
                Deploy release {release.version}
              </h1>
              <button
                type="button"
                className="inline-flex items-center px-4 py-[6px] text-sm font-medium rounded bg-green-700 hover:bg-green-800 text-white border border-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canDeploy}
                onClick={handleDeploy}
              >
                {deploying ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
            <div className="flex justify-end pb-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const next = !allFormCardsExpanded
                  setEnvsExpanded(next)
                  setWhenExpanded(next)
                  setExcludedStepsExpanded(next)
                  setFailureModeExpanded(next)
                  setPreviewExpanded(next)
                }}
              >
                {allFormCardsExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          {/* ── Cards ── */}
          <div className="flex-1">
        {validationLoading && (
          <div className="mx-6 mt-3 mb-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Building deployment preview...
          </div>
        )}
        {!validationLoading && validationReasons.length > 0 && (
          <div className="mx-6 mt-3 mb-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="text-sm font-semibold text-amber-800 mb-1">Deployment preview failed</div>
            <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
              {validationReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
        {/* Environments */}
        <ExpandableFormCard
          title="Environments"
          subtitle={envsExpanded ? 'Select one or many environments' : envSubtitle}
          expanded={envsExpanded}
          onToggle={() => setEnvsExpanded((v) => !v)}
        >
          <div className="mb-5">
            <Select
              mode="multiple"
              className="w-full"
              variant="borderless"
              size="large"
              showSearch
              allowClear
              maxTagCount="responsive"
              value={selectedEnvIds}
              onChange={setSelectedEnvIds}
              options={envOptions}
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Select environments"
              aria-label="Environments that this release will be deployed to"
              style={{ borderBottom: '1px solid #9e9e9e', fontSize: 16 }}
            />
          </div>
        </ExpandableFormCard>

        {/* When */}
        <ExpandableFormCard
          title="When"
          subtitle={whenExpanded ? 'Choose when to start deployment' : (scheduleMode === 'now' ? 'Now' : 'Later')}
          expanded={whenExpanded}
          onToggle={() => setWhenExpanded((v) => !v)}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule</label>
            <Radio.Group
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value)}
              className="flex flex-col gap-1"
            >
              <Radio value="now"><span className="text-sm">Now <span className="text-gray-400">(default)</span></span></Radio>
              <Radio value="later"><span className="text-sm">Later</span></Radio>
            </Radio.Group>
            {scheduleMode === 'later' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Queue Time</label>
                  <input
                    type="datetime-local"
                    value={queueTimeInput}
                    onChange={(e) => setQueueTimeInput(e.target.value)}
                    className="w-full border-0 border-b border-slate-300 focus:border-squid-blue focus:outline-none px-0 py-2 text-sm text-slate-700 bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Queue Time Expiry</label>
                  <input
                    type="datetime-local"
                    value={queueTimeExpiryInput}
                    onChange={(e) => setQueueTimeExpiryInput(e.target.value)}
                    className="w-full border-0 border-b border-slate-300 focus:border-squid-blue focus:outline-none px-0 py-2 text-sm text-slate-700 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </ExpandableFormCard>

        {/* Excluded steps */}
        <ExpandableFormCard
          title="Excluded steps"
          subtitle={!excludedStepsExpanded ? excludedStepsSubtitle : 'Select steps to exclude.'}
          expanded={excludedStepsExpanded}
          onToggle={() => setExcludedStepsExpanded((v) => !v)}
          hasBorder
        >
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-2 border-b border-slate-300 pb-1.5"
              style={{ maxWidth: '16rem' }}
            >
              <SearchOutlined className="text-slate-400 flex-shrink-0" />
              <input
                type="search"
                value={stepFilterText}
                onChange={(e) => setStepFilterText(e.target.value)}
                placeholder="Filter by name..."
                aria-label="Filter by name..."
                className="flex-1 border-0 outline-none text-sm text-slate-700 placeholder-slate-400 bg-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-squid-blue text-sm bg-transparent border-0 cursor-pointer px-0"
                title="Excludes all steps"
                onClick={() => setExcludedStepIds(stepCandidates.filter((step) => !step.isRequired).map((step) => step.stepId))}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-squid-blue text-sm bg-transparent border-0 cursor-pointer px-0"
                title="Clears all excluded steps"
                onClick={() => setExcludedStepIds([])}
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="mb-3 text-sm text-slate-500">
            {excludedStepIds.length === 0
              ? 'No steps are currently excluded.'
              : `${excludedStepIds.length} ${excludedStepIds.length === 1 ? 'step is' : 'steps are'} currently excluded.`}
          </div>

          <div className="space-y-2">
            {filteredStepCandidates.map((step) => {
              const isExcluded = excludedStepIds.includes(step.stepId)

              return (
                <div key={step.stepId} className="py-1">
                  <label className={`flex items-start gap-2 ${step.isRequired ? 'text-slate-400' : 'text-slate-700'}`}>
                    <Checkbox
                      checked={isExcluded}
                      disabled={step.isRequired}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setExcludedStepIds((prev) => {
                          if (checked) return Array.from(new Set([...prev, step.stepId]))
                          return prev.filter((id) => id !== step.stepId)
                        })
                      }}
                    />
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className={isExcluded ? 'font-medium' : ''}>
                        <span className={isExcluded ? 'line-through decoration-slate-500' : ''}>
                          {step.stepOrder}. {step.name}
                        </span>
                        {isExcluded && <span className="text-slate-500"> (excluded)</span>}
                      </span>
                    </span>
                  </label>
                  {step.isRequired && (
                    <div className="text-xs text-slate-500 pl-8 mt-1">This step is marked as required</div>
                  )}
                </div>
              )
            })}
            {filteredStepCandidates.length === 0 && (
              <div className="text-sm text-slate-500">No matching steps.</div>
            )}
          </div>
        </ExpandableFormCard>

        {/* Failure mode */}
        <ExpandableFormCard
          title="Failure mode"
          subtitle={!failureModeExpanded ? failureModeSubtitle : 'Choose what will happen when a deployment error occurs'}
          expanded={failureModeExpanded}
          onToggle={() => setFailureModeExpanded((v) => !v)}
          hasBorder={hasPreviewSection}
        >
          <div className="space-y-3">
            <Radio.Group
              value={failureMode}
              onChange={(e) => setFailureMode(e.target.value)}
              className="flex flex-col gap-2"
            >
              <Radio value="Off">
                <span className="text-sm">
                  Do not use guided failure mode <span className="text-slate-400">(default)</span>
                </span>
              </Radio>
              <Radio value="EnvironmentDefault">
                <span className="text-sm">
                  Use the default setting from the target environment
                </span>
              </Radio>
              <Radio value="On">
                <span className="text-sm">Use guided failure mode</span>
              </Radio>
            </Radio.Group>

            <div className="text-sm text-slate-500">
              When guided failure mode is enabled, if an error is encountered during deployment,
              Squid will pause and allow you to correct the error before proceeding. Otherwise,
              any errors encountered will cause the deployment to fail.
            </div>
          </div>
        </ExpandableFormCard>
        </div>

        {/* Preview */}
        {hasPreviewSection && (
          <ExpandableFormCard
            title="Preview and customize"
            subtitle={previewExpanded ? previewSubtitle : `${selectedEnvIds.length} deployment(s)`}
            expanded={previewExpanded}
            onToggle={() => setPreviewExpanded((v) => !v)}
            contentLayout="full"
            hasBorder={false}
          >
            <div className="text-sm text-slate-700 mb-3">
              <b>{selectedEnvIds.length}</b> deployments will be created. These deployments can be configured and previewed below.
            </div>

            <div className="border border-gray-200 bg-white overflow-hidden">
              <div className="overflow-hidden">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/70">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Environment</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Current Version</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Process</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Targets</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Target Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEnvIds.map((envId, index) => {
                      const env = envMap.get(envId)
                      if (!env) return null

                      const rowExpanded = expandedPreviewRows.includes(envId)
                      const isLastRow = index === selectedEnvIds.length - 1
                      const currentVersion = currentReleaseVersionByEnvironment.get(envId) ?? '-'
                      const includedSteps = stepCandidates.filter((step) => !excludedStepIds.includes(step.stepId))
                      const preview = validationByEnvironment[envId]
                      const previewSteps = preview?.steps ?? []
                      const applicablePreviewSteps = previewSteps.filter((step) => step.isApplicable)
                      const processSummary = preview
                        ? `${applicablePreviewSteps.length} steps`
                        : `${includedSteps.length} steps`
                      const machineOptions = machineOptionsByEnvironment[envId] ?? []
                      const specificMachineIdsForEnvironment = specificMachineIdsByEnvironment[envId] ?? []
                      const excludedMachineIdsForEnvironment = excludedMachineIdsByEnvironment[envId] ?? []
                      const targetMode = deploymentTargetModeByEnvironment[envId]
                        ?? (specificMachineIdsForEnvironment.length > 0
                          ? 'IncludeSpecific'
                          : excludedMachineIdsForEnvironment.length > 0
                            ? 'ExcludeSpecific'
                            : 'AllApplicable')
                      const overlappingMachineIds = overlappingMachineIdsByEnvironment[envId] ?? []
                      const targetSummary = targetMode === 'IncludeSpecific'
                        ? (specificMachineIdsForEnvironment.length > 0 ? `${specificMachineIdsForEnvironment.length} specific target(s)` : 'Specific targets')
                        : targetMode === 'ExcludeSpecific'
                          ? (excludedMachineIdsForEnvironment.length > 0 ? `${excludedMachineIdsForEnvironment.length} excluded target(s)` : 'Excluded targets')
                          : 'All included'
                      const candidateTargets = preview?.candidateTargets ?? []
                      const uniqueCandidateTargets = candidateTargets.filter(
                        (target, targetIndex, allTargets) => allTargets.findIndex((item) => item.machineId === target.machineId) === targetIndex,
                      )
                      const matchedTargetsAcrossSteps = preview
                        ? preview.steps
                          .filter((step) => step.isApplicable)
                          .flatMap((step) => step.matchedTargets)
                        : []
                      const uniqueMatchedTargetsAcrossSteps = matchedTargetsAcrossSteps.filter(
                        (target, targetIndex, allTargets) => allTargets.findIndex((item) => item.machineId === target.machineId) === targetIndex,
                      )
                      const effectiveAvailableTargets = uniqueMatchedTargetsAcrossSteps.length > 0
                        ? uniqueMatchedTargetsAcrossSteps
                        : uniqueCandidateTargets
                      const availableMachineCount = preview
                        ? (effectiveAvailableTargets.length > 0
                          ? effectiveAvailableTargets.length
                          : preview.availableMachineCount)
                        : 0
                      const availableMachineNames = effectiveAvailableTargets
                        .map((target) => target.machineName)
                        .filter((name): name is string => Boolean(name))
                      const previewTargetNames = availableMachineNames.slice(0, 5)
                      const hiddenPreviewTargetNameCount = Math.max(availableMachineNames.length - previewTargetNames.length, 0)
                      const statusText = preview
                        ? availableMachineCount > 0
                          ? `${availableMachineCount} available`
                          : preview.canDeploy
                            ? 'No targets required'
                            : 'No available targets'
                        : validationLoading
                          ? 'Checking...'
                          : '-'
                      const statusClass = preview
                        ? preview.canDeploy
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                        : 'text-slate-500'
                      const deploymentTargetsExpanded = deploymentTargetsExpandedByEnvironment[envId] ?? false

                      return (
                        <React.Fragment key={envId}>
                        <tr
                          className={[
                            !isLastRow || rowExpanded ? 'border-b border-gray-100' : '',
                            'cursor-pointer hover:bg-slate-50/50',
                          ].join(' ')}
                          onClick={() => togglePreviewRow(envId)}
                        >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                {env.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{currentVersion}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{processSummary}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{targetSummary}</td>
                            <td className={`px-4 py-3 text-sm ${statusClass}`}>{statusText}</td>
                            <td className="px-2 py-3 text-gray-500">
                              <DownOutlined className={`transition-transform duration-200 ${rowExpanded ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
                            </td>
                          </tr>
                          {rowExpanded && (
                          <tr className={isLastRow ? '' : 'border-b border-gray-100'}>
                              <td colSpan={6} className="px-4 py-4 bg-gray-50/40">
                                <div className="space-y-3">
                                  <div className="border border-gray-200 bg-white overflow-hidden">
                                    <div
                                      className="grid items-start py-4 pl-5 pr-5 cursor-pointer select-none"
                                      style={{ gridTemplateColumns: '220px 1fr auto' }}
                                      onClick={() =>
                                        setDeploymentTargetsExpandedByEnvironment((prev) => ({
                                          ...prev,
                                          [envId]: !(prev[envId] ?? false),
                                        }))
                                      }
                                    >
                                      <div className="text-sm font-bold text-gray-900">Deployment Targets</div>
                                      <div className="text-sm text-slate-600">
                                        {deploymentTargetsExpanded ? 'Select deployment targets for this environment' : targetSummary}
                                      </div>
                                      <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors">
                                        <DownOutlined className={`transition-transform duration-200 ${deploymentTargetsExpanded ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
                                      </button>
                                    </div>

                                    {deploymentTargetsExpanded && (
                                      <div className="grid px-5 pb-4" style={{ gridTemplateColumns: '220px 1fr' }}>
                                        <div />
                                        <div className="space-y-2">
                                          <Radio.Group
                                            value={targetMode}
                                            onChange={(e) => setDeploymentTargetMode(envId, e.target.value)}
                                            className="flex flex-col gap-2"
                                          >
                                            <Radio value="AllApplicable">
                                              Include all applicable deployment targets <span className="text-slate-400">(default)</span>
                                            </Radio>
                                            <Radio value="IncludeSpecific">Include specific deployment targets</Radio>
                                            {targetMode === 'IncludeSpecific' && (
                                              <div className="pl-7 pb-1">
                                                <Select
                                                  mode="multiple"
                                                  className="w-full"
                                                  variant="borderless"
                                                  size="large"
                                                  value={specificMachineIdsForEnvironment}
                                                  onChange={(values) =>
                                                    setSpecificMachineIdsByEnvironment((prev) => ({
                                                      ...prev,
                                                      [envId]: values,
                                                    }))
                                                  }
                                                  options={machineOptions}
                                                  optionFilterProp="label"
                                                  filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                                  placeholder="Select targets"
                                                  style={{ borderBottom: '1px solid #9e9e9e', fontSize: 16 }}
                                                />
                                              </div>
                                            )}
                                            <Radio value="ExcludeSpecific">Exclude specific deployment targets</Radio>
                                            {targetMode === 'ExcludeSpecific' && (
                                              <div className="pl-7 pb-1">
                                                <Select
                                                  mode="multiple"
                                                  className="w-full"
                                                  variant="borderless"
                                                  size="large"
                                                  value={excludedMachineIdsForEnvironment}
                                                  onChange={(values) =>
                                                    setExcludedMachineIdsByEnvironment((prev) => ({
                                                      ...prev,
                                                      [envId]: values,
                                                    }))
                                                  }
                                                  options={machineOptions}
                                                  optionFilterProp="label"
                                                  filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                                  placeholder="Select targets"
                                                  style={{ borderBottom: '1px solid #9e9e9e', fontSize: 16 }}
                                                />
                                              </div>
                                            )}
                                          </Radio.Group>

                                          {overlappingMachineIds.length > 0 && (
                                            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                              Specific and Excluded targets overlap: {overlappingMachineIds.map((id) => machineNameById.get(id) ?? id).join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="border border-gray-200 bg-white px-4 py-3">
                                    <div className="text-sm font-semibold text-slate-800 mb-2">Deployment steps preview</div>
                                    {preview && (
                                      <div className="mb-3 text-xs text-slate-600">
                                        {availableMachineNames.length > 0
                                          ? (
                                              <>
                                                Available targets for this deployment: {previewTargetNames.join(', ')}
                                                {hiddenPreviewTargetNameCount > 0 ? ` +${hiddenPreviewTargetNameCount} more` : ''}
                                              </>
                                            )
                                          : (preview.canDeploy
                                            ? 'No deployment targets required for selected steps.'
                                            : 'No available targets for this environment.')}
                                      </div>
                                    )}
                                    <div className="space-y-1">
                                      {preview?.steps.map((step: DeploymentPreviewStepResult) => {
                                        const matchedTargetNames = step.matchedTargets
                                          .map((target) => target.machineName)
                                          .filter(Boolean)
                                        const stepStatusClass = step.isApplicable
                                          ? matchedTargetNames.length > 0
                                            ? 'text-emerald-700'
                                            : 'text-amber-700'
                                          : 'text-slate-500'
                                        const stepStatusText = step.isApplicable
                                          ? matchedTargetNames.length > 0
                                            ? `${matchedTargetNames.length} target(s) matched`
                                            : step.reason || 'No matched targets'
                                          : step.reason || 'Not applicable'

                                        return (
                                          <div key={`preview-step-${envId}-${step.stepId}`} className="border border-gray-200 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="text-sm text-slate-700">
                                                {step.stepOrder}. {step.stepName}
                                              </div>
                                              <div className={`text-xs font-medium ${stepStatusClass}`}>
                                                {stepStatusText}
                                              </div>
                                            </div>
                                            {step.requiredRoles.length > 0 && (
                                              <div className="mt-1 text-xs text-slate-500">
                                                Roles: {step.requiredRoles.join(', ')}
                                              </div>
                                            )}
                                            {matchedTargetNames.length > 0 && (
                                              <div className="mt-1 text-xs text-slate-600">
                                                Targets: {matchedTargetNames.join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                      {!preview && (
                                        <div className="text-sm text-slate-500">
                                          {validationLoading ? 'Loading preview...' : 'No preview data.'}
                                        </div>
                                      )}
                                      {preview && preview.steps.length === 0 && (
                                        <div className="text-sm text-slate-500">No steps available in deployment preview.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </ExpandableFormCard>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeployCreate
