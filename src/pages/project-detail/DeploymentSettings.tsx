import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Radio, Spin, message } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { getProjects } from 'pages/apis/project'
import {
  getDeploymentSettings,
  saveDeploymentSettings,
  type DeploymentSettingsDto,
  type UnavailableDeploymentTargetBehavior,
  type UnhealthyDeploymentTargetBehavior,
} from 'pages/apis/deploymentSettings'

const DEFAULT_SETTINGS: DeploymentSettingsDto = {
  transientDeploymentTargets: {
    unavailableDeploymentTargets: 'SkipAndContinue',
    unhealthyDeploymentTargets: 'Exclude',
  },
}

interface DetailPanelProps {
  title: string
  subtitle: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  hasBorder?: boolean
}

function DetailPanel({ title, subtitle, isOpen, onToggle, children, hasBorder = true }: DetailPanelProps) {
  return (
    <div className={hasBorder ? 'border-b border-slate-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '260px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="text-sm text-gray-500 pt-0.5">{subtitle}</div>
        <button
          type="button"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <DownOutlined className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
        </button>
      </div>
      {isOpen ? (
        <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

export default function DeploymentSettings() {
  const { projectName } = useParams<{ spaceId: string; projectName: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [settings, setSettings] = useState<DeploymentSettingsDto>(DEFAULT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<DeploymentSettingsDto>(DEFAULT_SETTINGS)
  const [transientOpen, setTransientOpen] = useState(true)

  useEffect(() => {
    if (!projectName) return

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const projectRes = await getProjects({ pageSize: 1000, keyword: projectName })
        const project = projectRes.projects.find((item) => item.slug === projectName || item.name === projectName) ?? null

        if (!project) return

        const loaded = await getDeploymentSettings(project.id)

        if (cancelled) return

        setProjectId(project.id)
        setSettings(loaded ?? DEFAULT_SETTINGS)
        setSavedSettings(loaded ?? DEFAULT_SETTINGS)
      } catch {
        if (!cancelled) message.error('Failed to load deployment settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectName])

  const transient = settings.transientDeploymentTargets

  const isDirty = useMemo(
    () =>
      transient.unavailableDeploymentTargets !== savedSettings.transientDeploymentTargets.unavailableDeploymentTargets ||
      transient.unhealthyDeploymentTargets !== savedSettings.transientDeploymentTargets.unhealthyDeploymentTargets,
    [transient, savedSettings],
  )

  const updateUnavailable = (value: UnavailableDeploymentTargetBehavior) =>
    setSettings((previous) => ({
      ...previous,
      transientDeploymentTargets: { ...previous.transientDeploymentTargets, unavailableDeploymentTargets: value },
    }))

  const updateUnhealthy = (value: UnhealthyDeploymentTargetBehavior) =>
    setSettings((previous) => ({
      ...previous,
      transientDeploymentTargets: { ...previous.transientDeploymentTargets, unhealthyDeploymentTargets: value },
    }))

  const handleSave = async () => {
    if (projectId == null) return

    setSaving(true)

    try {
      const saved = await saveDeploymentSettings(projectId, settings)
      const next = saved ?? settings
      setSettings(next)
      setSavedSettings(next)
      message.success('Deployment settings saved')
    } catch {
      message.error('Failed to save deployment settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-white">
        <Spin />
      </div>
    )
  }

  if (projectId == null) {
    return (
      <div className="min-h-full flex items-center justify-center bg-white">
        <div className="text-sm text-slate-600">Project not found.</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 min-h-full overflow-hidden flex flex-col bg-white">
      <div className="px-6 pt-4 pb-3 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 m-0 min-w-0">Deployment Settings</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="primary" disabled={!isDirty || saving} loading={saving} title="Save" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
            onClick={() => setTransientOpen((previous) => !previous)}
          >
            {transientOpen ? 'COLLAPSE ALL' : 'EXPAND ALL'}
          </button>
        </div>
      </div>

      <DetailPanel
        title="Transient Deployment Targets"
        subtitle="Choose to skip unavailable, or exclude unhealthy targets from the deployment."
        isOpen={transientOpen}
        onToggle={() => setTransientOpen((previous) => !previous)}
        hasBorder={false}
      >
        <div className="max-w-[900px]">
          <div className="text-sm font-semibold text-slate-800 mb-2">Unavailable Deployment targets</div>

          <Radio.Group
            value={transient.unavailableDeploymentTargets}
            onChange={(event) => updateUnavailable(event.target.value as UnavailableDeploymentTargetBehavior)}
            className="grid gap-2"
          >
            <div>
              <Radio value="SkipAndContinue">
                Skip and continue <span className="text-slate-400">(default)</span>
              </Radio>
            </div>
            <div>
              <Radio value="FailDeployment">Fail deployment</Radio>
            </div>
          </Radio.Group>

          <p className="text-sm text-slate-600 mt-2 pl-6 max-w-[640px]">
            Deployment targets that are unavailable at the start of the deployment, or become unavailable during it, will be
            skipped and removed from the deployment.
          </p>

          <div className="text-sm font-semibold text-slate-800 mb-2 mt-6">Unhealthy Deployment Targets</div>

          <Radio.Group
            value={transient.unhealthyDeploymentTargets}
            onChange={(event) => updateUnhealthy(event.target.value as UnhealthyDeploymentTargetBehavior)}
            className="grid gap-2"
          >
            <div>
              <Radio value="Exclude">
                Exclude <span className="text-slate-400">(default)</span>
              </Radio>
            </div>
            <div>
              <Radio value="DoNotExclude">Do not exclude</Radio>
            </div>
          </Radio.Group>

          <p className="text-sm text-slate-600 mt-2 pl-6 max-w-[640px]">
            Deployment targets that are unhealthy at the start of the deployment will be skipped and removed from the
            deployment.
          </p>
        </div>
      </DetailPanel>
    </div>
  )
}
