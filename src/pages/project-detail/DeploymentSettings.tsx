import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Radio, Spin, message } from 'antd'
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

export default function DeploymentSettings() {
  const { projectName } = useParams<{ spaceId: string; projectName: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [settings, setSettings] = useState<DeploymentSettingsDto>(DEFAULT_SETTINGS)

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
      setSettings(saved ?? settings)
      message.success('Deployment settings saved')
    } catch {
      message.error('Failed to save deployment settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Spin />
      </div>
    )
  }

  const transient = settings.transientDeploymentTargets

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Deployment Settings</h1>
        <Button type="primary" loading={saving} disabled={projectId == null} onClick={handleSave}>
          Save
        </Button>
      </div>

      <div className="border border-gray-200 rounded-md">
        <div className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
          Transient Deployment Targets
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Unavailable Deployment targets</div>
            <Radio.Group
              value={transient.unavailableDeploymentTargets}
              onChange={(event) => updateUnavailable(event.target.value as UnavailableDeploymentTargetBehavior)}
            >
              <div className="space-y-2">
                <div>
                  <Radio value="FailDeployment">Fail deployment</Radio>
                </div>
                <div>
                  <Radio value="SkipAndContinue">Skip and continue</Radio>
                </div>
              </div>
            </Radio.Group>
            <p className="text-xs text-gray-500 mt-1">
              Deployment targets that are unavailable at the start of the deployment, or become unavailable during it,
              will be skipped and removed from the deployment.
            </p>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Unhealthy Deployment Targets</div>
            <Radio.Group
              value={transient.unhealthyDeploymentTargets}
              onChange={(event) => updateUnhealthy(event.target.value as UnhealthyDeploymentTargetBehavior)}
            >
              <div className="space-y-2">
                <div>
                  <Radio value="DoNotExclude">Do not exclude</Radio>
                </div>
                <div>
                  <Radio value="Exclude">Exclude</Radio>
                </div>
              </div>
            </Radio.Group>
            <p className="text-xs text-gray-500 mt-1">
              Deployment targets that are unhealthy at the start of the deployment will be skipped and removed from the
              deployment.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
