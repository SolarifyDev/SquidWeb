// src/pages/deploymentTargets/index.tsx
import React, { useState, useEffect } from 'react'
import { Input, Button, Tag, Space, Checkbox, Collapse } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons'

const { Panel } = Collapse

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
      tags: ['aws-eks', 'Normal'],
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
    {
      id: 6,
      name: 'Cloud-.NET-P002',
      type: 'Polling Tentacle',
      url: 'poll://jne38ygehqfsdnxyuzp92/',
      environments: 0,
      environmentList: [],
      tags: ['PRD'],
      roles: 5,
    },
  ],
}

/** -------------------------------
 * 主组件
 * ------------------------------*/
const DeploymentTargets: React.FC = () => {
  // ---------------- 状态定义 ----------------
  const [searchText, setSearchText] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(true)
  const [disabledOnly, setDisabledOnly] = useState<boolean>(false)
  const [expandedTargets, setExpandedTargets] = useState<Set<number>>(new Set())
  const [filterByStatus, setFilterByStatus] = useState<'all' | 'healthy' | 'disabled'>('all')

  // 过滤器选项数据
  const filterOptions = {
    environments: ['DEV', 'TEST', 'UAT', 'PRD', 'STAGE', 'QA', 'DEMO', 'BETA'],
    tags: ['aws-eks', 'Normal', 'aws-eks-us', 'SJUSAKS', 'vendor-queue-web', 'Aliyun-HK-AI', 'PRD'],
    tenants: ['Tenant A', 'Tenant B', 'Tenant C'],
    smartassistant: ['Tag 1', 'Tag 2', 'Tag 3'],
    restore: ['Database 1', 'Database 2', 'Database 3'],
    cli: ['Bash', 'PowerShell', 'Python', 'Node.js'],
    types: ['Kubernetes API', 'Polling Tentacle', 'Listening Tentacle', 'SSH Connection'],
    health: ['Healthy', 'Unhealthy', 'Unavailable', 'Disabled', 'Unknown'],
  }

  // 选中的过滤器
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    environments: [],
    tags: [],
    tenants: [],
    smartassistant: [],
    restore: [],
    cli: [],
    types: [],
    health: [],
  })

  // 处理过滤器选择
  const handleFilterChange = (category: string, value: string, checked: boolean) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: checked
        ? [...prev[category], value]
        : prev[category].filter((v) => v !== value),
    }))
  }

  // 重置过滤器
  const resetFilters = () => {
    setDisabledOnly(false)
    setSelectedFilters({
      environments: [],
      tags: [],
      tenants: [],
      smartassistant: [],
      restore: [],
      cli: [],
      types: [],
      health: [],
    })
  }

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
        className="flex items-start gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-all duration-200"
      >
        {/* 图标 */}
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-lg text-2xl flex-shrink-0 ${
            isDisabled ? 'bg-gray-100' : 'bg-green-50'
          }`}
        >
          {icon}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base mb-1">{target.name}</div>
          <div className="text-sm text-gray-600 mb-1">{target.type}</div>
          <div className="text-xs text-gray-500 mb-3 break-all">{target.url}</div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isDisabled && <CheckCircleOutlined className="text-green-500" />}
            {isDisabled && <CloseCircleOutlined className="text-gray-400" />}

            <Space size={[8, 8]} wrap>
              {/* 展开环境列表或显示总数 */}
              {isExpanded && target.environmentList && target.environmentList.length > 0 ? (
                target.environmentList.map((env, idx) => (
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
                <Tag key={idx} className={tag === 'Normal' ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 border-gray-300'}>
                  {tag}
                </Tag>
              ))}

              {target.roles && (
                <Tag icon={<SettingOutlined />} className="bg-gray-100 border-gray-300">
                  {target.roles} roles
                </Tag>
              )}
            </Space>

            {/* 展开/收起按钮 */}
            {target.environmentList && target.environmentList.length > 0 && (
              <button
                onClick={() => toggleExpand(target.id)}
                className="text-blue-500 text-sm ml-2 hover:underline cursor-pointer bg-transparent border-0"
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

  const displayHealthy = disabledOnly || filterByStatus === 'disabled' ? [] : filteredHealthy
  const displayDisabled = filterByStatus === 'healthy' ? [] : filteredDisabled

  // ---------------- 页面渲染 ----------------
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-semibold mb-6">Deployment Targets</h1>

          {/* 搜索框 + 筛选按钮 */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search deployment targets..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-xs"
              size="large"
            />
            <Button
              type="link"
              icon={<FilterOutlined />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-blue-600"
            >
              {showAdvancedFilters ? 'Hide' : 'Show'} advanced filters
            </Button>
          </div>
        </div>

        <div className="flex">
          {/* 左侧筛选面板 */}
          {showAdvancedFilters && (
            <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-base">Advanced filter</span>
                <Button size="small" className="text-gray-600" onClick={resetFilters}>
                  Reset
                </Button>
              </div>

              {/* Checkbox 选项 */}
              <div className="space-y-3 mb-6 pb-6 border-b">
                <Checkbox checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)}>
                  Disabled only
                </Checkbox>
              </div>

              {/* 过滤分类 - 使用 Collapse */}
              <Collapse ghost expandIconPosition="end" className="bg-transparent" style={{ border: 'none' }}>
                <Panel header={<span className="text-sm text-gray-700">By environments</span>} key="environments" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.environments.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.environments.includes(option)}
                        onChange={(e) => handleFilterChange('environments', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By target tags</span>} key="tags" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.tags.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.tags.includes(option)}
                        onChange={(e) => handleFilterChange('tags', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By tenants</span>} key="tenants" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.tenants.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.tenants.includes(option)}
                        onChange={(e) => handleFilterChange('tenants', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By ForSmartAssistant tags</span>} key="smartassistant" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.smartassistant.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.smartassistant.includes(option)}
                        onChange={(e) => handleFilterChange('smartassistant', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By Restore database tags</span>} key="restore" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.restore.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.restore.includes(option)}
                        onChange={(e) => handleFilterChange('restore', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By CLI/shell</span>} key="cli" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.cli.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.cli.includes(option)}
                        onChange={(e) => handleFilterChange('cli', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By deployment target types</span>} key="types" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.types.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.types.includes(option)}
                        onChange={(e) => handleFilterChange('types', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel header={<span className="text-sm text-gray-700">By health statuses</span>} key="health" className="border-b">
                  <div className="space-y-2 pl-2">
                    {filterOptions.health.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.health.includes(option)}
                        onChange={(e) => handleFilterChange('health', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>
              </Collapse>
            </div>
          )}

          {/* 右侧主内容 */}
          <div className="flex-1 p-6">
            {/* 状态统计 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Deployment targets</span>
                <span className="text-gray-500">({filteredHealthy.length + filteredDisabled.length})</span>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-green-500" />
                  <span className="text-green-600 font-medium">{displayHealthy.length} healthy</span>
                </div>
                <div className="flex items-center gap-2">
                  <CloseCircleOutlined className="text-gray-400" />
                  <span className="text-blue-600 font-medium">{displayDisabled.length} disabled</span>
                </div>
              </div>
            </div>

            {/* HEALTHY */}
            {displayHealthy.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircleOutlined className="text-green-500" />
                  <span className="font-semibold text-sm">HEALTHY ({displayHealthy.length})</span>
                </div>
                <div className="bg-white rounded-lg border">
                  {displayHealthy.map((t) => renderTarget(t, false))}
                </div>
              </div>
            )}

            {/* DISABLED */}
            {displayDisabled.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CloseCircleOutlined className="text-gray-400" />
                  <span className="font-semibold text-sm">DISABLED ({displayDisabled.length})</span>
                </div>
                <div className="bg-white rounded-lg border">
                  {displayDisabled.map((t) => renderTarget(t, true))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeploymentTargets
