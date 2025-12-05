// src/pages/deploymentTargets/index.tsx
import React, { useState } from 'react'
import { Input, Button, Tag, Space, Checkbox, Collapse, Modal, Tabs } from 'antd'
import {
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  SettingOutlined,
  PlusOutlined,
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
  
  // 新增：Add Deployment Target Modal 状态
  const [showAddDeploymentTarget, setShowAddDeploymentTarget] = useState(false)
  const [selectedDeploymentType, setSelectedDeploymentType] = useState('Kubernetes')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

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

  // Deployment Target 类型选项
  const deploymentTypes = [
    { key: 'Kubernetes', label: 'Kubernetes' },
    { key: 'Linux', label: 'Linux' },
    { key: 'Windows', label: 'Windows' },
    { key: 'Mac', label: 'Mac' },
    { key: 'Azure', label: 'Azure' },
    { key: 'Aws', label: 'Aws' },
    { key: 'Cloud Region', label: 'Cloud Region' },
    { key: 'Offline Package Drop', label: 'Offline Package Drop' },
  ]

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

  // 处理保存部署目标
  const handleSaveDeploymentTarget = () => {
    console.log('Deployment Type:', selectedDeploymentType)
    setShowAddDeploymentTarget(false)
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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Deployment Targets</h1>
            
            {/* Add Deployment Target 按钮 */}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowAddDeploymentTarget(true)}
              className="!bg-green-700 hover:!bg-green-800 !border-green-700 font-medium"
            >
              Add Deployment Target
            </Button>
          </div>

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

      {/* Add Deployment Target Modal - 添加部署目标弹窗 */}
      <Modal
        title={
          <div>
            <div className="text-blue-600 text-sm mb-1">Deployment Targets</div>
            <div className="text-xl font-bold">Add Deployment Target</div>
          </div>
        }
        open={showAddDeploymentTarget}
        onCancel={() => setShowAddDeploymentTarget(false)}
        width={1000}
        footer={null}
        bodyStyle={{ padding: '24px' }}
      >
        <div className="mb-6">
          <p className="text-gray-700 mb-1">
            What type of <span className="font-semibold">Deployment Target</span> do you want to set up? Learn more about{' '}
            <a href="#" className="text-blue-600 hover:underline">
              Deployment Targets ↗
            </a>
          </p>
        </div>

        {/* Tabs for deployment types */}
        <Tabs
          defaultActiveKey="Kubernetes"
          activeKey={selectedDeploymentType}
          onChange={setSelectedDeploymentType}
          items={deploymentTypes.map((type) => ({
            key: type.key,
            label: type.label,
          }))}
          className="mb-6"
        />

        {/* Kubernetes content */}
        {selectedDeploymentType === 'Kubernetes' && (
          <div>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Let's connect to a <span className="font-semibold">Kubernetes</span> cluster.
              </p>
              <p className="text-sm text-gray-600">
                Learn more about connecting to{' '}
                <a href="#" className="text-blue-600 hover:underline">
                  Kubernetes clusters ↗
                </a>
              </p>
            </div>

            {/* Two options cards - 带悬停效果的卡片，更透明的遮罩层 */}
            <div className="grid grid-cols-2 gap-6">
              {/* Kubernetes Agent */}
              <div
                className="relative border-2 rounded-lg p-6 transition-all duration-300 cursor-pointer overflow-hidden"
                style={{ 
                  borderColor: hoveredCard === 'agent' ? '#16a34a' : '#e5e7eb',
                  boxShadow: hoveredCard === 'agent' ? '0 4px 12px rgba(22, 163, 74, 0.15)' : 'none'
                }}
                onMouseEnter={() => setHoveredCard('agent')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* 原始内容 */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-4xl">☸</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-center mb-2">Kubernetes Agent</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Install an agent to execute deployments on your cluster. No extra workers needed.
                </p>
                <div className="flex justify-center">
                  <Tag color="green" className="text-xs">Recommended</Tag>
                </div>

                {/* 悬停时显示的半透明遮罩层和 Add 按钮 */}
                {hoveredCard === 'agent' && (
                  <div 
                  className="absolute inset-0 rounded-lg flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: 'blur(1px)'
                  }}
                  >
                    <Button
                      type="default"
                      size="middle"
                      className="!bg-gray-200 hover:!bg-gray-300 !border-gray-300 !text-gray-800 font-medium px-6 py-3 h-auto shadow-md rounded-md"
                      style={{
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Kubernetes API */}
              <div
                className="relative border-2 rounded-lg p-6 transition-all duration-300 cursor-pointer overflow-hidden"
                style={{ 
                  borderColor: hoveredCard === 'api' ? '#16a34a' : '#e5e7eb',
                  boxShadow: hoveredCard === 'api' ? '0 4px 12px rgba(22, 163, 74, 0.15)' : 'none'
                }}
                onMouseEnter={() => setHoveredCard('api')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* 原始内容 */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-4xl">☸</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-center mb-2">Kubernetes API</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Connect to your cluster via API and execute deployment tasks on workers.
                </p>

                {/* 悬停时显示的半透明遮罩层和 Add 按钮 */}
                {hoveredCard === 'api' && (
                  <div 
                  className="absolute inset-0 rounded-lg flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: 'blur(1px)'
                  }}
                  >
                    <Button
                      type="default"
                      size="middle"
                      className="!bg-gray-200 hover:!bg-gray-300 !border-gray-300 !text-gray-800 font-medium px-6 py-3 h-auto shadow-md rounded-md"
                      style={{
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DeploymentTargets
