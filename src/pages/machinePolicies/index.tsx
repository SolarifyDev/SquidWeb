import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Spin, Tag, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import {
  MachinePolicyDto,
  ScriptPolicyDto,
  getMachinePolicies,
} from 'pages/apis/machinePolicy'
import { useSpace } from 'contexts/SpaceContext'

function getScriptPolicy(policy: MachinePolicyDto, syntax: 'Bash' | 'PowerShell'): ScriptPolicyDto {
  return policy.machineHealthCheckPolicy.scriptPolicies?.[syntax] ?? {
    runType: 'InheritFromDefault',
    scriptBody: null,
  }
}

function formatHealthCheckInterval(seconds?: number | null): string {
  const value = Number(seconds ?? 3600)
  if (!Number.isFinite(value) || value <= 0) return 'Automatically performs health checks every 1 hour'
  if (value % 86400 === 0) {
    const days = value / 86400
    return `Automatically performs health checks every ${days} day${days === 1 ? '' : 's'} 0 minutes`
  }
  if (value % 3600 === 0) {
    const hours = value / 3600
    return `Automatically performs health checks every ${hours} hour${hours === 1 ? '' : 's'}`
  }
  const minutes = Math.max(1, Math.floor(value / 60))
  return `Automatically performs health checks every ${minutes} minute${minutes === 1 ? '' : 's'}`
}

function formatCleanupPolicy(behavior: string, deleteAfterSeconds?: number | null): string {
  if (behavior === 'DeleteUnavailableMachines') {
    const days = Math.max(0, Math.floor(Number(deleteAfterSeconds ?? 0) / 86400))
    if (days > 0) return `Deletes unavailable deployment targets automatically after ${days} day${days === 1 ? '' : 's'}`
    return 'Deletes unavailable deployment targets automatically'
  }
  return 'Does not delete deployment targets automatically'
}

function toSummaryRows(policy: MachinePolicyDto): Array<{ label: string; value: string }> {
  const bashPolicy = getScriptPolicy(policy, 'Bash')
  const psPolicy = getScriptPolicy(policy, 'PowerShell')

  const healthInterval = policy.machineHealthCheckPolicy.healthCheckScheduleType === 'Never'
    ? 'Does not perform automatic health checks'
    : policy.machineHealthCheckPolicy.healthCheckScheduleType === 'Cron'
      ? `Runs on schedule: ${policy.machineHealthCheckPolicy.healthCheckCronExpression ?? '-'}`
      : formatHealthCheckInterval(policy.machineHealthCheckPolicy.healthCheckIntervalSeconds)

  const healthType = policy.machineHealthCheckPolicy.healthCheckType === 'OnlyConnectivity'
    ? 'Only test network connectivity'
    : 'Run health check scripts'

  const scriptPolicyText = (runType?: string) => runType === 'CustomScript' ? 'Uses custom script' : 'Inherits from the default machine policy'

  const connectivityText = policy.machineConnectivityPolicy.machineConnectivityBehavior === 'MayBeOfflineAndCanBeSkipped'
    ? 'Skips unavailable deployment targets'
    : 'Fails when a deployment target is unavailable'

  const calamariText = policy.machineUpdatePolicy.calamariUpdateBehavior === 'UpdateAlways'
    ? 'Always update automatically'
    : policy.machineUpdatePolicy.calamariUpdateBehavior === 'UpdateOnNewMachine'
      ? 'Automatically update only when first deploying to a new deployment target'
      : 'Automatically update when a deployment target is involved in a deployment'

  const updateBehaviorText = (value?: string) => value === 'Update' ? 'Automatically' : 'Manually - from Deployment Targets'

  return [
    { label: 'Health check interval', value: healthInterval },
    { label: 'Health check type', value: healthType },
    { label: 'PowerShell health check script', value: scriptPolicyText(psPolicy.runType) },
    { label: 'Bash health check script', value: scriptPolicyText(bashPolicy.runType) },
    { label: 'Machine connectivity', value: connectivityText },
    { label: 'Calamari Machine updates', value: calamariText },
    { label: 'Tentacle Machine updates', value: updateBehaviorText(policy.machineUpdatePolicy.tentacleUpdateBehavior) },
    { label: 'Kubernetes Agent updates', value: updateBehaviorText(policy.machineUpdatePolicy.kubernetesAgentUpdateBehavior) },
    { label: 'Clean up', value: formatCleanupPolicy(policy.machineCleanupPolicy.deleteMachinesBehavior, policy.machineCleanupPolicy.deleteMachinesAfterSeconds) },
    { label: 'Recover from Communication Errors with Tentacle', value: policy.machineRpcCallRetryPolicy.enabled ? 'Enabled' : 'Disabled' },
  ]
}

const MachinePolicies: React.FC = () => {
  const navigate = useNavigate()
  const { space } = useSpace()
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [policies, setPolicies] = useState<MachinePolicyDto[]>([])

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getMachinePolicies()
      const nextPolicies = [...(response.machinePolicies ?? [])].sort((left, right) => {
        if (left.isDefault && !right.isDefault) return -1
        if (!left.isDefault && right.isDefault) return 1
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      })
      setPolicies(nextPolicies)
    } catch {
      setPolicies([])
      message.error('Failed to load machine policies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPolicies()
  }, [loadPolicies])

  const filteredPolicies = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return policies
    return policies.filter((policy) => {
      const name = policy.name.toLowerCase()
      const description = String(policy.description ?? '').toLowerCase()
      return name.includes(keyword) || description.includes(keyword)
    })
  }, [policies, searchValue])

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Machine Policies</h1>
              <Button
                type="primary"
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                onClick={() => navigate(`/${space.slug}/infrastructure/machinepolicies/new`)}
              >
                New Machine Policy
              </Button>
            </div>

            <div className="max-w-[320px]">
              <Input
                placeholder="Filter by name..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                size="large"
              />
            </div>
          </div>

          <div className="p-6">
            <Spin spinning={loading}>
              <ul className="m-0 p-0 list-none space-y-4">
                {filteredPolicies.map((policy) => {
                  const rows = toSummaryRows(policy)
                  const detailPath = `/${space.slug}/infrastructure/machinepolicies/MachinePolicies-${policy.id}`
                  return (
                    <li key={policy.id ?? policy.name}>
                      <button
                        type="button"
                        onClick={() => navigate(detailPath)}
                        className="w-full text-left border border-gray-200 rounded-md bg-white overflow-hidden cursor-pointer transition-all duration-150 hover:border-blue-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                      >
                        <div className="px-5 pt-4 pb-3">
                          <h3 className="text-lg font-semibold text-squid-blue m-0 flex flex-wrap items-center gap-2">
                            <span className="break-all">{policy.name}</span>
                            {policy.isDefault ? (
                              <Tag className="m-0 !rounded-full !border-gray-300 !bg-gray-100 !text-gray-700">default</Tag>
                            ) : null}
                          </h3>
                        </div>

                        <div className="px-5 pb-5">
                          {policy.description ? (
                            <div className="text-sm text-gray-600 mb-4 leading-6">{policy.description}</div>
                          ) : null}

                          <table className="w-full text-sm border-collapse">
                            <tbody>
                              {rows.map((item) => (
                                <tr key={item.label} className="border-b border-gray-100 last:border-b-0">
                                  <td className="align-top py-2.5 pr-6 text-gray-700 font-medium w-[320px]">{item.label}</td>
                                  <td className="align-top py-2.5 text-gray-700 break-all">{item.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </button>
                    </li>
                  )
                })}

                {!loading && filteredPolicies.length === 0 ? (
                  <li className="border border-dashed border-gray-300 rounded-md p-8 text-center text-gray-500">
                    No machine policies found.
                  </li>
                ) : null}
              </ul>
            </Spin>
          </div>
        </div>
    </PageContainer>
  )
}

export default MachinePolicies
