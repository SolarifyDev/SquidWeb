import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Spin, message } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProjects, type ProjectDto } from 'pages/apis/project'
import { getChannels, type ChannelDto } from 'pages/apis/channel'
import { getDeploymentSteps, getPackageReferences, type DeploymentStepDto, type PackageReferenceItem } from 'pages/apis/deploymentProcess'
import { createRelease, getReleases, type ReleaseDto } from 'pages/apis/release'

type SectionKey = 'channel' | 'version' | 'packages' | 'notes'
type PackageMode = 'latest' | 'last' | 'specific'

interface PackageTarget {
  key: string
  actionName: string
  packageReferenceName: string
  packageId: string
  feedName: string
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

const ReleasesCreate: React.FC = () => {
  const navigate = useNavigate()
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<ProjectDto | null>(null)
  const [channels, setChannels] = useState<ChannelDto[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [channelReleases, setChannelReleases] = useState<ReleaseDto[]>([])
  const [steps, setSteps] = useState<DeploymentStepDto[]>([])
  const [packageReferences, setPackageReferences] = useState<PackageReferenceItem[]>([])
  const [version, setVersion] = useState('')
  const [versionTouched, setVersionTouched] = useState(false)
  const [showVersionHelp, setShowVersionHelp] = useState(false)
  const [releaseNote, setReleaseNote] = useState('')
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    channel: true,
    version: true,
    packages: true,
    notes: true,
  })
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false)
  const [packageModeByKey, setPackageModeByKey] = useState<Record<string, PackageMode>>({})
  const [packageSpecificVersionByKey, setPackageSpecificVersionByKey] = useState<Record<string, string>>({})
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
          setSteps([])
          return
        }

        const [channelRes, stepRes, pkgRefRes] = await Promise.all([
          getChannels({ pageSize: 1000 }),
          getDeploymentSteps({
            processId: foundProject.deploymentProcessId,
            pageSize: 500,
          }).catch(() => ({ steps: [], count: 0 })),
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
        setSteps(stepRes.steps ?? [])
      } catch {
        setChannels([])
        setSteps([])
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

  const latestRelease = channelReleases[0]
  const latestVersionLabel = latestRelease?.version ?? ''
  const lastVersionLabel = latestRelease?.version ?? ''

  useEffect(() => {
    if (versionTouched) return
    setVersion(nextVersionFromLatest(latestVersionLabel))
  }, [latestVersionLabel, versionTouched])

  const packageTargets = useMemo<PackageTarget[]>(() => {
    return packageReferences.map((ref, index) => ({
      key: `${ref.actionName}-${ref.packageReferenceName}-${index}`,
      actionName: ref.actionName,
      packageReferenceName: ref.packageReferenceName,
      packageId: ref.packageId,
      feedName: ref.feedName,
    }))
  }, [packageReferences])

  useEffect(() => {
    setPackageModeByKey((prev) => {
      const next = { ...prev }
      for (const target of packageTargets) {
        if (!next[target.key]) next[target.key] = 'latest'
      }
      return next
    })
  }, [packageTargets])

  const allExpanded = Object.values(expanded).every(Boolean)
  const selectedChannelLabel = channels.find((c) => c.id === selectedChannelId)?.name ?? ''

  const setAllPackageMode = (mode: PackageMode) => {
    setPackageModeByKey((prev) => {
      const next = { ...prev }
      for (const target of packageTargets) next[target.key] = mode
      return next
    })
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

    const selectedPackages = packageTargets.map((target) => {
      const mode = packageModeByKey[target.key] ?? 'latest'
      const value =
        mode === 'specific'
          ? (packageSpecificVersionByKey[target.key] ?? '').trim()
          : mode === 'last'
            ? lastVersionLabel
            : latestVersionLabel

      return {
        actionName: target.actionName,
        packageReferenceName: target.packageReferenceName,
        version: value,
      }
    })

    const hasEmptySpecificVersion = selectedPackages.some(
      (pkg, index) => (packageModeByKey[packageTargets[index].key] ?? 'latest') === 'specific' && !pkg.version,
    )

    if (hasEmptySpecificVersion) {
      message.error('Specific package version cannot be empty.')
      return
    }

    setSaving(true)
    try {
      const createdRelease = await createRelease({
        version: version.trim(),
        channelId: selectedChannelId,
        projectId: project.id,
        releaseNote: releaseNote.trim(),
        selectedPackages,
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
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2">Step / Package</th>
                        <th className="text-left px-3 py-2">
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
                        <th className="text-left px-3 py-2">
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
                        const mode = packageModeByKey[target.key] ?? 'latest'
                        return (
                          <tr key={target.key} className="border-b border-slate-100 last:border-b-0">
                            <td className="align-top px-3 py-3">
                              <div className="font-medium text-slate-700">
                                {target.actionName}
                                <span className="text-slate-400">/{target.packageReferenceName}</span>
                              </div>
                              <div className="text-xs text-slate-500">{target.packageId}</div>
                            </td>
                            <td className="align-top px-3 py-3">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={mode === 'latest'}
                                  onChange={() =>
                                    setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'latest' }))
                                  }
                                />
                                <span>{latestVersionLabel || '-'}</span>
                              </label>
                            </td>
                            <td className="align-top px-3 py-3">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={mode === 'last'}
                                  onChange={() =>
                                    setPackageModeByKey((prev) => ({ ...prev, [target.key]: 'last' }))
                                  }
                                />
                                <span>{lastVersionLabel || '-'}</span>
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
                                  value={packageSpecificVersionByKey[target.key] ?? ''}
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
                                  size="small"
                                  onClick={() =>
                                    setPackageSpecificVersionByKey((prev) => ({
                                      ...prev,
                                      [target.key]: version,
                                    }))
                                  }
                                >
                                  Select Version
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
    </div>
  )
}

export default ReleasesCreate
