import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Input, Modal, Spin, message } from 'antd'
import { DownOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getChannel, getChannelVersionRules, getChannels, type ChannelDto } from 'pages/apis/channel'
import { getPackageReferences, type PackageReferenceItem } from 'pages/apis/deploymentProcess'
import { listExternalFeedPackageVersions } from 'pages/apis/externalFeed'
import { createRelease, getReleases, type ReleaseDto } from 'pages/apis/release'

type SectionKey = 'channel' | 'version' | 'packages' | 'notes'
type PackageMode = 'latest' | 'last' | 'specific'

interface PackageTarget {
  key: string
  actionName: string
  packageReferenceName: string
  packageId: string
  feedId: number
  feedName: string
  lastReleaseVersion: string
}

interface PackageSelection {
  actionName: string
  packageReferenceName: string
  packageId: string
  version: string
}

interface NormalizedChannelVersionRule {
  actionNames?: string[]
  versionRange?: string
  preReleaseTag?: string
  sortOrder?: number
}

interface VersionRuleViolation {
  actionName: string
  packageReferenceName: string
  version: string
  reason: string
}

interface FormPanelProps {
  title: string
  description?: string
  isOpen: boolean
  onToggle: () => void
  hasBorder?: boolean
  children: React.ReactNode
}

function FormPanel({
  title,
  description,
  isOpen,
  onToggle,
  hasBorder = true,
  children,
}: FormPanelProps) {
  return (
    <div style={hasBorder ? { borderBottom: '1px solid #e5e7eb' } : {}}>
      <div
        className="grid items-start py-4 pl-6 pr-10 cursor-pointer select-none"
        style={{ gridTemplateColumns: '240px 1fr' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="flex items-start justify-between gap-4">
          {description && <div className="text-sm text-gray-500 flex-1">{description}</div>}
          <DownOutlined
            style={{ fontSize: 11 }}
            className={`text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {isOpen ? (
        <div className="grid pl-6 pr-10 pb-5" style={{ gridTemplateColumns: '240px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

const nextVersionFromLatest = (latest?: string) => {
  if (!latest) return ''
  const base = latest.split('-')[0]
  const parts = base.split('.')
  if (parts.length < 2) return ''
  if (!parts.every((p) => /^\d+$/.test(p))) return ''
  const nums = parts.map((p) => Number(p))
  nums[nums.length - 1] += 1
  return nums.join('.')
}

const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase()

const readString = (source: Record<string, unknown> | null, keys: string[]) => {
  if (!source) return undefined
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

const readNumber = (source: Record<string, unknown> | null, keys: string[]) => {
  if (!source) return undefined
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value)
  }
  return undefined
}

const hasOwn = (source: Record<string, unknown> | null, key: string) =>
  !!source && Object.prototype.hasOwnProperty.call(source, key)

interface ParsedSemVersion {
  numbers: number[]
  preRelease: string
}

const parseSemVersion = (value: string): ParsedSemVersion | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const withoutMetadata = normalized.split('+')[0]
  const match = withoutMetadata.match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) return null
  const numbers = match[1].split('.').map((part) => Number(part))
  if (numbers.some((part) => Number.isNaN(part))) return null
  return {
    numbers,
    preRelease: (match[2] ?? '').trim(),
  }
}

const compareNumericVersions = (left: number[], right: number[]) => {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }
  return 0
}

const comparePreRelease = (left: string, right: string) => {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  const leftParts = left.split('.')
  const rightParts = right.split('.')
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart == null) return -1
    if (rightPart == null) return 1
    if (leftPart === rightPart) continue

    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)
    if (leftNumeric && rightNumeric) {
      const leftNumber = Number(leftPart)
      const rightNumber = Number(rightPart)
      if (leftNumber > rightNumber) return 1
      if (leftNumber < rightNumber) return -1
      continue
    }
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

const compareSemVersion = (left: ParsedSemVersion, right: ParsedSemVersion) => {
  const numericComparison = compareNumericVersions(left.numbers, right.numbers)
  if (numericComparison !== 0) return numericComparison
  return comparePreRelease(left.preRelease, right.preRelease)
}

const matchesVersionRange = (version: ParsedSemVersion, versionRange?: string) => {
  const range = (versionRange ?? '').trim()
  if (!range) return true

  const exactBracketMatch = range.match(/^\[([^\],]+)\]$/)
  if (exactBracketMatch) {
    const exactVersion = parseSemVersion(exactBracketMatch[1].trim())
    if (!exactVersion) return true
    return compareSemVersion(version, exactVersion) === 0
  }

  const intervalMatch = range.match(/^(\[|\()([^,]*),(.*?)(\]|\))$/)
  if (intervalMatch) {
    const [, leftToken, rawLeftBound, rawRightBound, rightToken] = intervalMatch
    const leftBound = rawLeftBound.trim()
    const rightBound = rawRightBound.trim()
    if (leftBound) {
      const leftVersion = parseSemVersion(leftBound)
      if (!leftVersion) return true
      const comparison = compareSemVersion(version, leftVersion)
      if (leftToken === '[' && comparison < 0) return false
      if (leftToken === '(' && comparison <= 0) return false
    }
    if (rightBound) {
      const rightVersion = parseSemVersion(rightBound)
      if (!rightVersion) return true
      const comparison = compareSemVersion(version, rightVersion)
      if (rightToken === ']' && comparison > 0) return false
      if (rightToken === ')' && comparison >= 0) return false
    }
    return true
  }

  const exactVersion = parseSemVersion(range)
  if (!exactVersion) return true
  return compareSemVersion(version, exactVersion) === 0
}

const matchesPreReleaseTag = (version: ParsedSemVersion, preReleaseTag?: string) => {
  const tagPattern = (preReleaseTag ?? '').trim()
  if (!tagPattern) return true
  if (!version.preRelease) return false

  try {
    return new RegExp(tagPattern).test(version.preRelease)
  } catch {
    return true
  }
}

const normalizeChannelVersionRules = (channel: ChannelDto | null): NormalizedChannelVersionRule[] => {
  if (!channel) return []

  const channelRecord = channel as unknown as Record<string, unknown>
  const rawRules = channelRecord.versionRules ?? channelRecord.VersionRules
  if (!Array.isArray(rawRules)) return []

  return rawRules
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const ruleRecord = item as Record<string, unknown>
      const actionPackageValue = ruleRecord.actionPackage ?? ruleRecord.ActionPackage
      const actionPackage = actionPackageValue && typeof actionPackageValue === 'object'
        ? (actionPackageValue as Record<string, unknown>)
        : null

      const hasExplicitActionNames = hasOwn(ruleRecord, 'actionNames') || hasOwn(ruleRecord, 'ActionNames')
      const actionNamesRawValue = hasOwn(ruleRecord, 'actionNames')
        ? ruleRecord.actionNames
        : ruleRecord.ActionNames
      const actionNamesRaw = typeof actionNamesRawValue === 'string' ? actionNamesRawValue.trim() : null
      const legacyActionName =
        readString(ruleRecord, ['actionName', 'ActionName'])
        ?? readString(actionPackage, ['actionName', 'ActionName', 'deploymentAction', 'DeploymentAction'])
      const actionNames = hasExplicitActionNames
        ? (actionNamesRaw ?? '')
            .split(',')
            .map((name) => normalizeText(name))
            .filter(Boolean)
        : actionNamesRaw
          ? actionNamesRaw
              .split(',')
              .map((name) => normalizeText(name))
              .filter(Boolean)
        : legacyActionName
          ? [normalizeText(legacyActionName)]
          : []

      const rule: NormalizedChannelVersionRule = {
        actionNames,
        versionRange: readString(ruleRecord, ['versionRange', 'VersionRange']),
        preReleaseTag: readString(ruleRecord, ['preReleaseTag', 'PreReleaseTag', 'tag', 'Tag']),
        sortOrder: readNumber(ruleRecord, ['sortOrder', 'SortOrder']) ?? 0,
      }

      if (!rule.versionRange && !rule.preReleaseTag && (!rule.actionNames || rule.actionNames.length === 0)) {
        return null
      }

      return rule
    })
    .filter((rule): rule is NormalizedChannelVersionRule => rule != null)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
}

const ruleAppliesToPackage = (rule: NormalizedChannelVersionRule, pkg: PackageSelection) => {
  if (!rule.actionNames || rule.actionNames.length === 0) return true
  return rule.actionNames.includes(normalizeText(pkg.actionName))
}

const findVersionRuleViolations = (packages: PackageSelection[], rules: NormalizedChannelVersionRule[]): VersionRuleViolation[] => {
  if (!rules.length) return []

  const violations: VersionRuleViolation[] = []
  for (const pkg of packages) {
    if (!pkg.version.trim()) continue
    const parsedVersion = parseSemVersion(pkg.version)
    if (!parsedVersion) continue

    const applicableRules = rules.filter((rule) => ruleAppliesToPackage(rule, pkg))
    if (!applicableRules.length) continue

    for (const rule of applicableRules) {
      if (rule.versionRange && !matchesVersionRange(parsedVersion, rule.versionRange)) {
        violations.push({
          actionName: pkg.actionName,
          packageReferenceName: pkg.packageReferenceName,
          version: pkg.version,
          reason: `version ${pkg.version} violates range ${rule.versionRange}`,
        })
      }
      if (rule.preReleaseTag && !matchesPreReleaseTag(parsedVersion, rule.preReleaseTag)) {
        violations.push({
          actionName: pkg.actionName,
          packageReferenceName: pkg.packageReferenceName,
          version: pkg.version,
          reason: `version ${pkg.version} violates pre-release tag /${rule.preReleaseTag}/`,
        })
      }
    }
  }

  return violations
}

const normalizePackageVersion = (value?: string | null) => (value ?? '').trim()
const normalizePackageVersionFilter = (value?: string | null) => (value ?? '').trim()
const buildPackageVersionsCacheKey = (targetKey: string, includePreRelease: boolean, filter?: string) =>
  `${targetKey}|${includePreRelease ? '1' : '0'}|${normalizeText(filter)}`

const withDockerLatestTagLabel = (version: string) => (
  normalizeText(version) === 'latest' ? `${version} (tag)` : version
)

const ReleasesCreate: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [selectedChannelWithRules, setSelectedChannelWithRules] = useState<ChannelDto | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [channelReleases, setChannelReleases] = useState<ReleaseDto[]>([])
  const [packageReferences, setPackageReferences] = useState<PackageReferenceItem[]>([])
  const [version, setVersion] = useState('')
  const [versionTouched, setVersionTouched] = useState(false)
  const [showVersionHelp, setShowVersionHelp] = useState(false)
  const [releaseNote, setReleaseNote] = useState('')
  const [ignoreChannelRules, setIgnoreChannelRules] = useState(false)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    channel: true,
    version: true,
    packages: true,
    notes: true,
  })
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false)
  const [packageModeByKey, setPackageModeByKey] = useState<Record<string, PackageMode>>({})
  const [packageSpecificVersionByKey, setPackageSpecificVersionByKey] = useState<Record<string, string>>({})
  const [packageVersionsByKey, setPackageVersionsByKey] = useState<Record<string, string[]>>({})
  const [packageVersionsLoadingByKey, setPackageVersionsLoadingByKey] = useState<Record<string, boolean>>({})
  const [versionPickerTargetKey, setVersionPickerTargetKey] = useState<string | null>(null)
  const [versionPickerOpen, setVersionPickerOpen] = useState(false)
  const [versionPickerValue, setVersionPickerValue] = useState('')
  const [showPreReleaseVersions, setShowPreReleaseVersions] = useState(false)
  const [versionSearchText, setVersionSearchText] = useState('')
  const channelMenuRef = useRef<HTMLDivElement | null>(null)

  const basePath = `/${spaceId}/projects/${projectName}/releases`

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
          setChannels([])
          return
        }

        const [channelRes, pkgRefRes] = await Promise.all([
          getChannels({ pageSize: 1000 }),
          getPackageReferences(foundProject.id).catch(() => ({ packageReferences: [] })),
        ])

        setPackageReferences(pkgRefRes.packageReferences ?? [])

        const projectChannels = channelRes.channels
          .filter((c) => c.projectId === foundProject.id)
          .sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1
            if (!a.isDefault && b.isDefault) return 1
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          })

        setChannels(projectChannels)
        setSelectedChannelId(projectChannels.find((c) => c.isDefault)?.id ?? projectChannels[0]?.id ?? null)
      } catch {
        setChannels([])
      } finally {
        setLoading(false)
      }
    })()
  }, [projectName])

  useEffect(() => {
    if (!project?.id || !selectedChannelId) {
      setChannelReleases([])
      return
    }

    ;(async () => {
      try {
        const releaseRes = await getReleases({
          pageIndex: 1,
          pageSize: 100,
          projectId: project.id,
          channelId: selectedChannelId,
        })
        const sorted = (releaseRes.releases ?? [])
          .filter((r) => r.projectId === project.id && r.channelId === selectedChannelId)
          .sort((a, b) => new Date(b.assembled).getTime() - new Date(a.assembled).getTime())
        setChannelReleases(sorted)
      } catch {
        setChannelReleases([])
      }
    })()
  }, [project?.id, selectedChannelId])

  useEffect(() => {
    setIgnoreChannelRules(false)
  }, [project?.id, selectedChannelId])

  useEffect(() => {
    if (!selectedChannelId) {
      setSelectedChannelWithRules(null)
      return
    }

    let cancelled = false
    const fallbackChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null
    setSelectedChannelWithRules(fallbackChannel)

    ;(async () => {
      try {
        const detail = await getChannel(selectedChannelId)
        if (!cancelled && (!Array.isArray(detail.versionRules) || detail.versionRules.length === 0)) {
          const rules = await getChannelVersionRules(selectedChannelId)
          if (!cancelled && rules.length > 0) {
            setSelectedChannelWithRules({ ...detail, versionRules: rules })
            return
          }
        }
        if (!cancelled) {
          setSelectedChannelWithRules(detail)
        }
      } catch {
        if (!cancelled) {
          setSelectedChannelWithRules(fallbackChannel)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [channels, selectedChannelId])

  const latestRelease = channelReleases[0]
  const latestReleaseVersionLabel = latestRelease?.version ?? ''

  useEffect(() => {
    if (versionTouched) return
    setVersion(nextVersionFromLatest(latestReleaseVersionLabel))
  }, [latestReleaseVersionLabel, versionTouched])

  const packageTargets = useMemo<PackageTarget[]>(() => {
    return packageReferences.map((ref, index) => ({
      key: `${ref.actionName}-${ref.packageReferenceName}-${ref.feedId}-${index}`,
      actionName: ref.actionName,
      packageReferenceName: ref.packageReferenceName,
      packageId: ref.packageId,
      feedId: ref.feedId,
      feedName: ref.feedName,
      lastReleaseVersion: normalizePackageVersion(ref.lastReleaseVersion),
    }))
  }, [packageReferences])

  const packageTargetByKey = useMemo(
    () => new Map(packageTargets.map((target) => [target.key, target])),
    [packageTargets],
  )

  const versionPickerTarget = useMemo(
    () => (versionPickerTargetKey ? packageTargetByKey.get(versionPickerTargetKey) ?? null : null),
    [packageTargetByKey, versionPickerTargetKey],
  )
  const versionPickerFilter = useMemo(
    () => normalizePackageVersionFilter(versionSearchText),
    [versionSearchText],
  )
  const versionPickerQueryKey = useMemo(
    () => (
      versionPickerTarget
        ? buildPackageVersionsCacheKey(versionPickerTarget.key, showPreReleaseVersions, versionPickerFilter)
        : ''
    ),
    [showPreReleaseVersions, versionPickerFilter, versionPickerTarget],
  )
  const versionPickerVersions = useMemo(
    () => (versionPickerQueryKey ? (packageVersionsByKey[versionPickerQueryKey] ?? []) : []),
    [packageVersionsByKey, versionPickerQueryKey],
  )
  const isVersionPickerLoading = useMemo(
    () => (!!versionPickerQueryKey && !!packageVersionsLoadingByKey[versionPickerQueryKey]),
    [packageVersionsLoadingByKey, versionPickerQueryKey],
  )

  const loadPackageVersions = useCallback(async (
    target: PackageTarget,
    options?: { includePreRelease?: boolean; filter?: string; take?: number },
    force = false,
  ) => {
    const includePreRelease = options?.includePreRelease ?? false
    const filter = normalizePackageVersionFilter(options?.filter)
    const cacheKey = buildPackageVersionsCacheKey(target.key, includePreRelease, filter)
    if (!force && packageVersionsByKey[cacheKey]) return packageVersionsByKey[cacheKey]
    if (packageVersionsLoadingByKey[cacheKey]) return packageVersionsByKey[cacheKey] ?? []

    setPackageVersionsLoadingByKey((prev) => ({ ...prev, [cacheKey]: true }))
    try {
      const response = await listExternalFeedPackageVersions({
        feedId: target.feedId,
        packageId: target.packageId,
        includePreRelease,
        filter: filter || undefined,
        take: options?.take ?? 30,
      })
      const versions = Array.from(
        new Set((response.versions ?? []).map((item) => item.trim()).filter(Boolean)),
      )
      setPackageVersionsByKey((prev) => ({ ...prev, [cacheKey]: versions }))
      return versions
    } catch {
      setPackageVersionsByKey((prev) => ({ ...prev, [cacheKey]: [] }))
      message.error(`Failed to load versions for ${target.packageId}`)
      return []
    } finally {
      setPackageVersionsLoadingByKey((prev) => ({ ...prev, [cacheKey]: false }))
    }
  }, [packageVersionsByKey, packageVersionsLoadingByKey])

  useEffect(() => {
    setPackageModeByKey((prev) => {
      const next: Record<string, PackageMode> = {}
      for (const target of packageTargets) {
        next[target.key] = prev[target.key] ?? (target.lastReleaseVersion ? 'last' : 'latest')
      }
      return next
    })
    setPackageSpecificVersionByKey((prev) => {
      const next: Record<string, string> = {}
      for (const target of packageTargets) {
        if (prev[target.key]) next[target.key] = prev[target.key]
      }
      return next
    })
  }, [packageTargets])

  useEffect(() => {
    packageTargets.forEach((target) => {
      if (target.lastReleaseVersion) return
      const defaultQueryKey = buildPackageVersionsCacheKey(target.key, false)
      if (packageVersionsByKey[defaultQueryKey]) return
      void loadPackageVersions(target)
    })
  }, [loadPackageVersions, packageTargets, packageVersionsByKey])

  useEffect(() => {
    packageTargets.forEach((target) => {
      const mode = packageModeByKey[target.key] ?? (target.lastReleaseVersion ? 'last' : 'latest')
      if (mode !== 'latest') return
      const defaultQueryKey = buildPackageVersionsCacheKey(target.key, false)
      if (packageVersionsByKey[defaultQueryKey]) return
      void loadPackageVersions(target)
    })
  }, [loadPackageVersions, packageModeByKey, packageTargets, packageVersionsByKey])

  useEffect(() => {
    if (!versionPickerOpen || !versionPickerTarget) return undefined
    const timer = window.setTimeout(() => {
      void loadPackageVersions(versionPickerTarget, {
        includePreRelease: showPreReleaseVersions,
        filter: versionPickerFilter || undefined,
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [loadPackageVersions, showPreReleaseVersions, versionPickerFilter, versionPickerOpen, versionPickerTarget])

  const latestVersionByKey = useMemo(() => {
    const next: Record<string, string> = {}
    packageTargets.forEach((target) => {
      const defaultQueryKey = buildPackageVersionsCacheKey(target.key, false)
      next[target.key] = normalizePackageVersion(packageVersionsByKey[defaultQueryKey]?.[0])
    })
    return next
  }, [packageTargets, packageVersionsByKey])

  const allExpanded = Object.values(expanded).every(Boolean)
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  )
  const channelForRules = selectedChannelWithRules ?? selectedChannel
  const selectedChannelLabel = selectedChannel?.name ?? ''

  const selectedPackages = useMemo<PackageSelection[]>(
    () =>
      packageTargets.map((target) => {
        const mode = packageModeByKey[target.key] ?? (target.lastReleaseVersion ? 'last' : 'latest')
        const latestVersion = latestVersionByKey[target.key]
        const value =
          mode === 'specific'
            ? normalizePackageVersion(packageSpecificVersionByKey[target.key])
            : mode === 'last'
              ? target.lastReleaseVersion
              : latestVersion

        return {
          actionName: target.actionName,
          packageReferenceName: target.packageReferenceName,
          packageId: target.packageId,
          version: value,
        }
      }),
    [latestVersionByKey, packageModeByKey, packageSpecificVersionByKey, packageTargets],
  )

  const hasEmptySpecificVersion = useMemo(
    () =>
      packageTargets.some((target) => {
        const mode = packageModeByKey[target.key] ?? (target.lastReleaseVersion ? 'last' : 'latest')
        return mode === 'specific' && !normalizePackageVersion(packageSpecificVersionByKey[target.key])
      }),
    [packageModeByKey, packageSpecificVersionByKey, packageTargets],
  )
  const hasUnresolvedPackageVersion = useMemo(
    () => selectedPackages.some((pkg) => !normalizePackageVersion(pkg.version)),
    [selectedPackages],
  )

  const channelVersionRules = useMemo(
    () => normalizeChannelVersionRules(channelForRules),
    [channelForRules],
  )
  const versionRuleViolations = useMemo(
    () => findVersionRuleViolations(selectedPackages, channelVersionRules),
    [channelVersionRules, selectedPackages],
  )
  const hasVersionRuleViolation = versionRuleViolations.length > 0
  const canForceVersionSelection = hasVersionRuleViolation && !!project?.allowIgnoreChannelRules
  const isSaveBlockedByChannelRules = hasVersionRuleViolation && (!canForceVersionSelection || !ignoreChannelRules)

  useEffect(() => {
    if (!hasVersionRuleViolation) {
      setIgnoreChannelRules(false)
    }
  }, [hasVersionRuleViolation])

  const setAllPackageMode = (mode: PackageMode) => {
    setPackageModeByKey((prev) => {
      const next = { ...prev }
      for (const target of packageTargets) {
        next[target.key] = mode === 'last' && !target.lastReleaseVersion ? 'latest' : mode
      }
      return next
    })
  }

  const openVersionPicker = async (target: PackageTarget) => {
    setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'specific' }))
    setVersionPickerTargetKey(target.key)
    setVersionPickerOpen(true)
    setShowPreReleaseVersions(false)
    setVersionSearchText('')

    const versions = await loadPackageVersions(target)
    const manualValue = normalizePackageVersion(packageSpecificVersionByKey[target.key])
    const preferred =
      manualValue
      || target.lastReleaseVersion
      || versions[0]
      || ''
    setVersionPickerValue(preferred)
  }

  const applyVersionPickerValue = () => {
    if (!versionPickerTarget) return
    const value = normalizePackageVersion(versionPickerValue)
    if (!value) {
      message.warning('Please select or enter a version')
      return
    }
    setPackageModeByKey((prev) => ({ ...prev, [versionPickerTarget.key]: 'specific' }))
    setPackageSpecificVersionByKey((prev) => ({ ...prev, [versionPickerTarget.key]: value }))
    setVersionPickerOpen(false)
    setVersionPickerTargetKey(null)
    setVersionPickerValue('')
  }

  useEffect(() => {
    if (!isChannelMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!channelMenuRef.current) return
      if (!channelMenuRef.current.contains(event.target as Node)) {
        setIsChannelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isChannelMenuOpen])

  const handleSave = async () => {
    if (!project?.id || !selectedChannelId) {
      message.error('Please select a channel.')
      return
    }
    if (!version.trim()) {
      message.error('Version is required.')
      return
    }
    if (!/^\d+\.\d+/.test(version.trim())) {
      message.error('Version must contain at least two parts, e.g. 1.0')
      return
    }

    if (hasEmptySpecificVersion) {
      message.error('Specific package version cannot be empty.')
      return
    }
    if (hasUnresolvedPackageVersion) {
      message.error('Please resolve package versions before creating the release.')
      return
    }
    if (hasVersionRuleViolation && !canForceVersionSelection) {
      message.error('所選版本違反 channel version rules，請修改版本')
      return
    }
    if (canForceVersionSelection && !ignoreChannelRules) {
      message.warning('請勾選 Force Version Selection 以繼續')
      return
    }

    setSaving(true)
    try {
      const createdRelease = await createRelease({
        version: version.trim(),
        channelId: selectedChannelId,
        projectId: project.id,
        releaseNote: releaseNote.trim(),
        selectedPackages: selectedPackages.map((item) => ({
          actionName: item.actionName,
          packageReferenceName: item.packageReferenceName,
          version: item.version,
        })),
        ...(canForceVersionSelection && ignoreChannelRules
          ? { ignoreChannelRules: true }
          : {}),
      })
      message.success('Release created.')
      const createdVersion = (createdRelease?.version ?? version.trim()).trim()
      navigate(`${basePath}/${encodeURIComponent(createdVersion)}`)
    } catch (error: any) {
      message.error(error?.message || 'Failed to create release.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden min-h-full bg-white">
      <div className="max-w-[1320px] mx-auto px-4 lg:px-8 py-4">
        <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 pt-4 pb-2">
            <Link to={basePath} className="inline-flex items-center text-sm text-squid-blue hover:underline mb-2">
              Releases
            </Link>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">
                Create release for {project?.name || projectName}
              </h1>
              <Button
                type="primary"
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                loading={saving}
                disabled={isSaveBlockedByChannelRules}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
            <div className="flex justify-end pb-1">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => {
                  const next = !allExpanded
                  setExpanded({
                    channel: next,
                    version: next,
                    packages: next,
                    notes: next,
                  })
                }}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <Spin spinning={loading}>
            <FormPanel
              title="Channel"
              description="Select a channel for this release"
              isOpen={expanded.channel}
              onToggle={() => setExpanded((p) => ({ ...p, channel: !p.channel }))}
            >
              <label className="block text-sm text-gray-700 mb-1.5">Channel</label>
              <div ref={channelMenuRef} className="relative w-full max-w-[360px]">
                <button
                  type="button"
                  className="w-full h-10 bg-transparent border-0 border-b border-slate-400 rounded-none pl-0 pr-8 text-sm text-slate-700 text-left flex items-center justify-between focus:outline-none focus:border-squid-blue disabled:opacity-50"
                  onClick={() => setIsChannelMenuOpen((open) => !open)}
                  disabled={loading || channels.length === 0}
                  aria-haspopup="listbox"
                  aria-expanded={isChannelMenuOpen}
                >
                  <span className="truncate">{selectedChannelLabel || 'Select a channel'}</span>
                  <DownOutlined className={`text-xs text-slate-500 transition-transform ${isChannelMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isChannelMenuOpen ? (
                  <div className="absolute left-0 top-full mt-1 z-30 w-[600px] max-w-[calc(100vw-6rem)] bg-white border border-slate-200 rounded shadow-lg">
                    <div className="max-h-64 overflow-auto py-1" role="listbox" aria-label="Channel options">
                      {channels.map((channel) => {
                        const selected = channel.id === selectedChannelId
                        return (
                          <button
                            key={channel.id}
                            type="button"
                            className={[
                              'w-full text-left px-4 py-2 text-sm transition-colors',
                              selected
                                ? 'bg-blue-50 text-squid-blue font-medium'
                                : 'text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                            onClick={() => {
                              setSelectedChannelId(channel.id)
                              setVersionTouched(false)
                              setIgnoreChannelRules(false)
                              setIsChannelMenuOpen(false)
                            }}
                          >
                            {channel.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </FormPanel>

            <FormPanel
              title="Version"
              description="Enter a unique version number for this release with at least two parts."
              isOpen={expanded.version}
              onToggle={() => setExpanded((p) => ({ ...p, version: !p.version }))}
            >
              <label className="block text-sm text-gray-700 mb-1.5">Version</label>
              <Input
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value)
                  setVersionTouched(true)
                }}
                placeholder="Version"
                className="max-w-[360px] octo-underline-input"
              />
              {latestRelease ? (
                <div className="mt-3 text-sm text-slate-600">
                  Most recent release:{' '}
                  <a
                    className="text-squid-blue hover:underline"
                    href={`/${spaceId}/projects/${projectName}/releases/${encodeURIComponent(
                      latestRelease.version,
                    )}`}
                  >
                    {latestRelease.version}
                  </a>
                </div>
              ) : null}
              <div className="mt-2 text-sm">
                <button
                  type="button"
                  className="text-squid-blue hover:underline"
                  onClick={() => setShowVersionHelp((v) => !v)}
                >
                  {showVersionHelp ? 'Hide more information' : 'Show more information'}
                </button>
              </div>
              {showVersionHelp ? (
                <div className="mt-2 text-sm text-slate-600 leading-6">
                  You can use versions like <code>2.3</code>, <code>2.3.16</code>, <code>2.3.16.384</code>,
                  semantic tags like <code>2.3.16-beta</code>, or increment patterns like <code>1.i</code>.
                </div>
              ) : null}
            </FormPanel>

            <FormPanel
              title="Packages"
              description="Select package(s) for this release"
              isOpen={expanded.packages}
              onToggle={() => setExpanded((p) => ({ ...p, packages: !p.packages }))}
            >
              {packageTargets.length === 0 ? (
                <div className="text-sm text-slate-400 py-4">No package steps found.</div>
              ) : (
                <div>
                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2">Step / Package</th>
                          <th className="text-center px-3 py-2">
                            Latest
                            <div className="text-xs font-normal mt-1">
                              <button
                                type="button"
                                className="text-squid-blue hover:underline"
                                onClick={() => setAllPackageMode('latest')}
                              >
                                Select all
                              </button>
                            </div>
                          </th>
                          <th className="text-center px-3 py-2">
                            Last
                            <div className="text-xs font-normal mt-1">
                              <button
                                type="button"
                                className="text-squid-blue hover:underline"
                                onClick={() => setAllPackageMode('last')}
                              >
                                Select all
                              </button>
                            </div>
                          </th>
                          <th className="text-left px-3 py-2">
                            Specific
                            <div className="text-xs font-normal mt-1">
                              <button
                                type="button"
                                className="text-squid-blue hover:underline"
                                onClick={() => {
                                  setAllPackageMode('specific')
                                  setPackageSpecificVersionByKey((prev) => {
                                    const next = { ...prev }
                                    for (const target of packageTargets) {
                                      if (!next[target.key]) next[target.key] = version
                                    }
                                    return next
                                  })
                                }}
                              >
                                Select current release version
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {packageTargets.map((target) => {
                          const mode = packageModeByKey[target.key] ?? (target.lastReleaseVersion ? 'last' : 'latest')
                          const latestVersion = latestVersionByKey[target.key]
                          const lastVersion = target.lastReleaseVersion
                          const defaultQueryKey = buildPackageVersionsCacheKey(target.key, false)
                          const versions = packageVersionsByKey[defaultQueryKey] ?? []
                          const loadingVersions = !!packageVersionsLoadingByKey[defaultQueryKey]
                          const specificVersion = packageSpecificVersionByKey[target.key] ?? ''
                          return (
                            <tr key={target.key} className="border-b border-slate-100 last:border-b-0">
                              <td className="align-top px-3 py-3">
                                <div className="font-medium text-slate-700">
                                  {target.actionName}
                                  <span className="text-slate-400">/{target.packageReferenceName}</span>
                                </div>
                                <div className="text-xs text-slate-500">{target.packageId} ({target.feedName})</div>
                              </td>
                              <td className="align-middle px-3 py-3 text-center">
                                <label className="inline-flex items-center justify-center gap-2">
                                  <input
                                    type="radio"
                                    checked={mode === 'latest'}
                                    onChange={async () => {
                                      setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'latest' }))
                                      await loadPackageVersions(target)
                                    }}
                                  />
                                  <span>{loadingVersions ? 'Loading...' : (latestVersion ? withDockerLatestTagLabel(latestVersion) : '-')}</span>
                                </label>
                              </td>
                              <td className="align-middle px-3 py-3 text-center">
                                <label className="inline-flex items-center justify-center gap-2">
                                  <input
                                    type="radio"
                                    checked={mode === 'last'}
                                    disabled={!lastVersion}
                                    onChange={() =>
                                      setPackageModeByKey((prev) => ({ ...prev, [target.key]: lastVersion ? 'last' : 'latest' }))
                                    }
                                  />
                                  <span>{lastVersion || '-'}</span>
                                </label>
                              </td>
                              <td className="align-top px-3 py-3">
                                <div className="inline-flex items-center gap-2">
                                  <input
                                    type="radio"
                                    checked={mode === 'specific'}
                                    onChange={() =>
                                      setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'specific' }))
                                    }
                                  />
                                  <Input
                                    value={specificVersion}
                                    placeholder="Enter a version"
                                    className="w-[190px]"
                                    onFocus={() =>
                                      setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'specific' }))
                                    }
                                    onChange={(e) =>
                                      setPackageSpecificVersionByKey((prev) => ({
                                        ...prev,
                                        [target.key]: e.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    size="middle"
                                    className="!h-9 !px-4 !rounded-md !border-squid-blue !text-squid-blue !bg-white hover:!border-blue-700 hover:!text-blue-700"
                                    onClick={() => { void openVersionPicker(target) }}
                                  >
                                    Select Version
                                  </Button>
                                </div>
                                {mode === 'specific' && versions.length === 0 && !loadingVersions ? (
                                  <div className="mt-1 text-xs text-slate-500">No versions found. You can type manually.</div>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {hasVersionRuleViolation ? (
                    <div className="mt-4">
                      {canForceVersionSelection ? (
                        <div className="space-y-3">
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            所選 package 版本違反 channel rules。若要強制使用此版本，請勾選下方選項。
                          </div>
                          <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
                            {versionRuleViolations.slice(0, 5).map((violation, index) => (
                              <li key={`${violation.actionName}-${violation.packageReferenceName}-${violation.version}-${index}`}>
                                {violation.actionName}/{violation.packageReferenceName}: {violation.reason}
                              </li>
                            ))}
                          </ul>
                          <Checkbox checked={ignoreChannelRules} onChange={(event) => setIgnoreChannelRules(event.target.checked)}>
                            Force Version Selection
                          </Checkbox>
                        </div>
                      ) : (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-2">
                          <div>所選版本違反 channel version rules，請修改版本</div>
                          <ul className="list-disc pl-5 text-xs text-red-800 space-y-1">
                            {versionRuleViolations.slice(0, 5).map((violation, index) => (
                              <li key={`${violation.actionName}-${violation.packageReferenceName}-${violation.version}-${index}`}>
                                {violation.actionName}/{violation.packageReferenceName}: {violation.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </FormPanel>

            <FormPanel
              title="Release Notes"
              description="Enter a summary of what has changed in this release."
              isOpen={expanded.notes}
              onToggle={() => setExpanded((p) => ({ ...p, notes: !p.notes }))}
              hasBorder={false}
            >
              <label className="block text-sm text-gray-700 mb-1.5">Release notes</label>
              <Input.TextArea
                rows={3}
                value={releaseNote}
                onChange={(e) => setReleaseNote(e.target.value)}
                placeholder="Release notes"
                className="max-w-[760px]"
              />
            </FormPanel>
          </Spin>
        </div>
      </div>

      <Modal
        title={versionPickerTarget ? `${versionPickerTarget.packageId} previous versions` : 'Select package version'}
        open={versionPickerOpen}
        onOk={applyVersionPickerValue}
        onCancel={() => {
          setVersionPickerOpen(false)
          setVersionPickerTargetKey(null)
          setVersionPickerValue('')
          setShowPreReleaseVersions(false)
          setVersionSearchText('')
        }}
        width={900}
        okText="Ok"
        cancelText="Cancel"
      >
        {versionPickerTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 m-0">
              Prior versions of package {versionPickerTarget.packageId} from feed {versionPickerTarget.feedName}
            </p>

            <div className="flex items-center justify-between gap-3">
              <Checkbox
                checked={showPreReleaseVersions}
                onChange={(event) => {
                  const checked = event.target.checked
                  setShowPreReleaseVersions(checked)
                  void loadPackageVersions(versionPickerTarget, {
                    includePreRelease: checked,
                    filter: versionPickerFilter || undefined,
                  }, true)
                }}
              >
                Pre-release packages
              </Checkbox>
              <Button
                type="default"
                icon={<ReloadOutlined />}
                className="!h-9 !px-4 !rounded-md !border-squid-blue !text-squid-blue !bg-transparent hover:!border-blue-700 hover:!text-blue-700 hover:!bg-transparent"
                onClick={() => {
                  void (async () => {
                    const versions = await loadPackageVersions(versionPickerTarget, {
                      includePreRelease: showPreReleaseVersions,
                      filter: versionPickerFilter || undefined,
                    }, true)
                    if (!normalizePackageVersion(versionPickerValue) && versions[0]) {
                      setVersionPickerValue(versions[0])
                    }
                  })()
                }}
              >
                Refresh
              </Button>
            </div>

            <div className="max-w-[360px] mb-2">
              <Input
                type="search"
                value={versionSearchText}
                onChange={(event) => setVersionSearchText(event.target.value)}
                placeholder="Search versions..."
                prefix={<SearchOutlined style={{ color: '#757575' }} />}
              />
            </div>

            <div className="mt-4 border border-slate-200 rounded overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {isVersionPickerLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500">Loading versions...</td>
                    </tr>
                  ) : versionPickerVersions.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500">No versions found</td>
                    </tr>
                  ) : (
                    versionPickerVersions.map((rawVersion) => {
                      const version = normalizePackageVersion(rawVersion)
                      const isLastUsed = normalizeText(version) === normalizeText(versionPickerTarget.lastReleaseVersion)
                      return (
                        <tr key={version} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-3 cursor-pointer">
                              <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                              <input
                                type="radio"
                                name="version-picker-radio"
                                checked={normalizeText(versionPickerValue) === normalizeText(version)}
                                onChange={() => setVersionPickerValue(version)}
                              />
                              <span>{withDockerLatestTagLabel(version)}</span>
                              {isLastUsed ? (
                                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-squid-blue">
                                  Last used
                                </span>
                              ) : null}
                            </label>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default ReleasesCreate
