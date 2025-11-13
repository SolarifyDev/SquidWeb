// src/pages/deploymentTargets/index.tsx
import React, { useState, useEffect } from 'react'
import { Input, Button, Tag, Space, Card, Checkbox, Select } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  SettingOutlined,
  DownOutlined,
} from '@ant-design/icons'

/** -------------------------------
 * 类型定义
 * ------------------------------*/
interface DeploymentTarget {
  id: number
  name: string
  type: string
  url: string
  environments: number
  environmentList?: string[]
  tags: string[]
  roles?: number
  status?: string
}

interface DeploymentData {
  healthy: DeploymentTarget[]
  disabled: DeploymentTarget[]
}

/** -------------------------------
 * 模拟数据
 * ------------------------------*/
const deploymentData: DeploymentData = {
  healthy: [
    {
      id: 1,
      name: 'AWS Cluster',
      type: 'Kubernetes API',
      url: 'https://916BB91AF6C5919BC53AEB97E0C061DA.yl4.ap-east-1.eks.amazonaws.com',
      environments: 3,
      environmentList: ['DEV', 'TEST', 'PRD'],
      tags: ['aws-eks'],
      status: 'Healthy',
    },
    {
      id: 2,
      name: 'AWS-EKS-US',
      type: 'Kubernetes API',
      url: 'https://D977349BE6AAB1BD6786BCF8626F6B19B.gr7.us-west-1.eks.amazonaws.com',
      environments: 3,
      environmentList: ['DEV', 'TEST', 'PROD'],
      tags: ['aws-eks-us'],
      status: 'Healthy',
    },
    {
      id: 3,
      name: 'SJ-US-AKS',
      type: 'Kubernetes API',
      url: 'https://47.254.20.160:6443',
      environments: 6,
      environmentList: ['DEV', 'TEST', 'STAGE', 'PRD', 'UAT', 'QA'],
      tags: ['SJUSAKS', 'vendor-queue-web'],
      status: 'Healthy',
    },
  ],
  disabled: [
    {
      id: 4,
      name: 'Aliyun-HK-AI-Cluster',
      type: 'Kubernetes API',
      url: 'https://172.20.41.126:6443',
      environments: 8,
      environmentList: ['DEV', 'TEST', 'STAGE', 'PRD', 'UAT', 'QA', 'DEMO', 'BETA'],
      tags: ['Aliyun-HK-AI'],
    },
    {
      id: 5,
      name: 'Cloud-.NET-P001',
      type: 'Polling Tentacle',
      url: 'poll://r97yx2qtbnwrd526kke/',
      environments: 0,
      environmentList: [],
      tags: ['PRD'],
      roles: 24,
    },
  ],
}

/** -------------------------------
 * 主组件
 * ------------------------------*/
const DeploymentTargets: React.FC = () => {
  // ---------------- 状态定义 ----------------
  const [searchText, setSearchText] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false)
  const [disabledOnly, setDisabledOnly] = useState<boolean>(false)
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set())
  const [filterByStatus, setFilterByStatus] = useState<'all' | 'healthy' | 'disabled'>('all')

  // Advanced filter 下拉选项
  const [environmentOptions, setEnvironmentOptions] = useState<{ label: string; value: string }[]>([])
  const [tagOptions, setTagOptions] = useState<{ label: string; value: string }[]>([])
  const [tenantOptions, setTenantOptions] = useState<{ label: string; value: string }[]>([])
  const [typeOptions, setTypeOptions] = useState<{ label: string; value: string }[]>([])
  const [healthOptions, setHealthOptions] = useState<{ label: string; value: string }[]>([])

  // ---------------- 异步获取下拉选项 ----------------
  useEffect(() => {
    const fetchFilterOptions = async () => {
      // 模拟接口延迟
      await new Promise((resolve) => setTimeout(resolve, 300))

      setEnvironmentOptions([
        { label: 'DEV', value: 'DEV' },
        { label: 'TEST', value: 'TEST' },
        { label: 'PRD', value: 'PRD' },
      ])
      setTagOptions([
        { label: 'aws-eks', value: 'aws-eks' },
        { label: 'Aliyun-HK-AI', value: 'Aliyun-HK-AI' },
        { label: 'vendor-queue-web', value: 'vendor-queue-web' },
      ])
      setTenantOptions([
        { label: 'Tenant-A', value: 'Tenant-A' },
        { label: 'Tenant-B', value: 'Tenant-B' },
      ])
      setTypeOptions([
        { label: 'Kubernetes API', value: 'Kubernetes API' },
        { label: 'Polling Tentacle', value: 'Polling Tentacle' },
      ])
      setHealthOptions([
        { label: 'Healthy', value: 'Healthy' },
        { label: 'Disabled', value: 'Disabled' },
      ])
    }

    fetchFilterOptions()
  }, [])

  // ---------------- 展开/收起 ----------------
  const toggleExpand = (id: number) => {
    setExpandedTargets((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // ---------------- 渲染单个 DeploymentTarget ----------------
  const renderTarget = (target: DeploymentTarget, isDisabled = false) => {
    const icon = target.type.includes('Kubernetes') ? '☸️' : '🔌'
    const isExpanded = expandedTargets.has(target.id)

    return (
      <div
        key={target.id}
        className={`flex items-start gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-all duration-200 ${
          isDisabled ? 'opacity-70' : ''
        }`}
      >
        {/* 图标 */}
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl text-2xl ${
            isDisabled ? 'bg-gray-100' : 'bg-green-50 text-green-600'
          }`}
        >
          {icon}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-base">{target.name}</span>
            {!isDisabled && <CheckCircleOutlined className="text-green-500" />}
            {isDisabled && <CloseCircleOutlined className="text-gray-400" />}
          </div>

          <div className="text-sm text-gray-600 mb-1">{target.type}</div>

          <div className="text-xs text-gray-500 mb-3 font-mono break-all">{target.url}</div>

          <div className="flex items-center gap-2 flex-wrap">
            <Space size={[0, 8]} wrap>
              {/* 展开环境列表或显示总数 */}
              {isExpanded ? (
                target.environmentList?.map((env, idx) => (
                  <Tag key={idx} icon={<DatabaseOutlined />} className="bg-gray-100 border-gray-300">
                    {env}
                  </Tag>
                ))
              ) : (
                <Tag icon={<DatabaseOutlined />} className="bg-gray-100 border-gray-300">
                  {target.environments} environments
                </Tag>
              )}

              {target.tags.map((tag, idx) => (
                <Tag key={idx} className="bg-gray-100 border-gray-300">
                  {tag}
                </Tag>
              ))}

              {target.roles && (
                <Tag icon={<SettingOutlined />} className="bg-gray-100 border-gray-300">
                  {target.roles} roles
                </Tag>
              )}

              {target.status && (
                <Tag className="bg-gray-800 text-white border-gray-800">{target.status}</Tag>
              )}
            </Space>

            {/* 展开/收起按钮 */}
            {target.environmentList && target.environmentList.length > 0 && (
              <button
                onClick={() => toggleExpand(target.id)}
                className="text-blue-500 text-sm ml-auto hover:underline cursor-pointer bg-transparent border-0"
              >
                {isExpanded ? 'Show summary' : 'Show all'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------- 搜索过滤 ----------------
  const filteredHealthy = deploymentData.healthy.filter((t) =>
    t.name.toLowerCase().includes(searchText.toLowerCase())
  )
  const filteredDisabled = deploymentData.disabled.filter((t) =>
    t.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const displayHealthy =
    disabledOnly || filterByStatus === 'disabled' ? [] : filteredHealthy
  const displayDisabled =
    disabledOnly || filterByStatus === 'healthy' ? [] : filteredDisabled

  // ---------------- 页面渲染 ----------------
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-6">
          {/* 高级过滤区 */}
          {showAdvancedFilters && (
            <div className="w-72 flex-shrink-0">
              <Card className="shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-gray-700">Advanced filter</span>
                  <Button size="small" onClick={() => window.location.reload()}>
                    Reset
                  </Button>
                </div>
                <div className="space-y-4">
                  <Checkbox
                    checked={disabledOnly}
                    onChange={(e) => setDisabledOnly(e.target.checked)}
                  >
                    Disabled only
                  </Checkbox>

                  {/* 每个下拉框 */}
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="By environments"
                    options={environmentOptions}
                  />
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="By target tags"
                    options={tagOptions}
                  />
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="By tenants"
                    options={tenantOptions}
                  />
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="By target type"
                    options={typeOptions}
                  />
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="By health status"
                    options={healthOptions}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* 主内容 */}
          <div className="flex-1">
            {/* 标题 & 搜索 */}
            <h1 className="text-2xl font-semibold mb-6 text-gray-800">
              Deployment Targets
            </h1>

            <div className="flex items-center gap-3 mb-6">
              <Input
                placeholder="Search deployment targets..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="max-w-md"
                size="large"
              />
              <Button
                type="link"
                icon={<FilterOutlined />}
                className="text-blue-500"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
              </Button>
            </div>

            {/* 状态统计 */}
            <div className="flex justify-between mb-6">
              <div className="flex items-center gap-4">
                <CheckCircleOutlined
                  className={`cursor-pointer text-lg ${
                    filterByStatus === 'healthy' ? 'text-green-600' : 'text-gray-400'
                  }`}
                  onClick={() =>
                    setFilterByStatus(filterByStatus === 'healthy' ? 'all' : 'healthy')
                  }
                />
                <span
                  className="cursor-pointer"
                  onClick={() =>
                    setFilterByStatus(filterByStatus === 'healthy' ? 'all' : 'healthy')
                  }
                >
                  Healthy ({displayHealthy.length})
                </span>

                <CloseCircleOutlined
                  className={`cursor-pointer text-lg ${
                    filterByStatus === 'disabled' ? 'text-gray-600' : 'text-gray-400'
                  }`}
                  onClick={() =>
                    setFilterByStatus(filterByStatus === 'disabled' ? 'all' : 'disabled')
                  }
                />
                <span
                  className="cursor-pointer"
                  onClick={() =>
                    setFilterByStatus(filterByStatus === 'disabled' ? 'all' : 'disabled')
                  }
                >
                  Disabled ({displayDisabled.length})
                </span>
              </div>
            </div>

            {/* HEALTHY */}
            {!disabledOnly && displayHealthy.length > 0 && (
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-green-500" />
                    <span className="font-semibold text-green-700">HEALTHY</span>
                    <span className="text-gray-500">({displayHealthy.length})</span>
                  </div>
                }
                className="mb-4 rounded-lg shadow-sm"
              >
                {displayHealthy.map((t) => renderTarget(t, false))}
              </Card>
            )}

            {/* DISABLED */}
            {displayDisabled.length > 0 && (
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <CloseCircleOutlined className="text-gray-400" />
                    <span className="font-semibold text-gray-600">DISABLED</span>
                    <span className="text-gray-500">({displayDisabled.length})</span>
                  </div>
                }
                className="rounded-lg shadow-sm"
              >
                {displayDisabled.map((t) => renderTarget(t, true))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeploymentTargets
