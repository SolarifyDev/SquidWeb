import React, { useState, useEffect } from 'react';
import { Input, Checkbox, Button, Badge, Tag, Collapse, Modal, Tabs, Spin } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  DownOutlined,
  UpOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  MenuOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { getEnvironments, EnvironmentDto } from 'pages/apis/environment';
import { getMachines, MachineDto } from 'pages/apis/machine';

const { Panel } = Collapse;

const Environments = () => {
  const [searchText, setSearchText] = useState<string>('');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  
  // 新增弹窗状态
  const [showAddEnvironment, setShowAddEnvironment] = useState(false);
  const [showAddDeploymentTarget, setShowAddDeploymentTarget] = useState(false);
  const [environmentName, setEnvironmentName] = useState('');
  const [selectedDeploymentType, setSelectedDeploymentType] = useState('Kubernetes');

  // 过滤器选项数据
  const filterOptions = {
    deployment: ['AWS Cluster', 'AWS-EKS-US', 'SJ-US-AKS', 'Aliyun-HK-AI-Cluster', 'Cloud-Deployment-Target'],
    environments: ['DEV', 'TEST', 'UAT', 'PRD', 'PRD2', 'TEST2', 'PRE-PROD', 'Startup', 'Shutdown'],
    tags: ['aws-eks', 'Normal', 'aws-eks-us', 'SJUSAKS', 'vendor-queue-web', 'Aliyun-HK-AI', 'DotnetCore'],
    health: ['Healthy', 'Unhealthy', 'Unavailable', 'Disabled', 'Unknown'],
    types: ['Kubernetes API', 'Polling Tentacle', 'Listening Tentacle', 'SSH Connection', 'Offline Package Drop'],
    tenants: ['Tenant A', 'Tenant B', 'Tenant C'],
    smartassistant: ['Tag 1', 'Tag 2', 'Tag 3'],
    restore: ['Database 1', 'Database 2', 'Database 3'],
    cli: ['Bash', 'PowerShell', 'Python', 'Node.js'],
  };

  // 选中的过滤器
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    deployment: [],
    environments: [],
    tags: [],
    health: [],
    types: [],
    tenants: [],
    smartassistant: [],
    restore: [],
    cli: [],
  });

  // API 数据
  interface EnvironmentWithTargets {
    key: string;
    name: string;
    targets: number;
    healthy: number;
    disabled: number;
    deployments: { name: string; type: string; url: string; status: string; environments: number; tags: string[] }[];
    disabledTargets: { name: string; type: string; url: string; status: string; environments: number; tags: string[] }[];
  }

  const [environments, setEnvironments] = useState<EnvironmentWithTargets[]>([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);

  useEffect(() => {
    setLoadingEnvs(true);
    Promise.all([
      getEnvironments({ pageSize: 1000 }),
      getMachines({ pageSize: 1000 }),
    ])
      .then(([envRes, machineRes]) => {
        const envMap = new Map<number, EnvironmentDto>();
        envRes.environments.forEach((e) => envMap.set(e.id, e));

        // Group machines by environment
        const envTargets = new Map<number, { healthy: MachineDto[]; disabled: MachineDto[] }>();
        envRes.environments.forEach((e) => envTargets.set(e.id, { healthy: [], disabled: [] }));

        machineRes.machines.forEach((m) => {
          const envIds = m.environmentIds ? m.environmentIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id)) : [];
          envIds.forEach((envId) => {
            const bucket = envTargets.get(envId);
            if (bucket) {
              if (m.isDisabled) {
                bucket.disabled.push(m);
              } else {
                bucket.healthy.push(m);
              }
            }
          });
        });

        const mapMachine = (m: MachineDto, status: string) => {
          const mEnvIds = m.environmentIds ? m.environmentIds.split(',').filter(Boolean) : [];
          const roles = m.roles ? m.roles.split(',').map((r) => r.trim()).filter(Boolean) : [];
          return {
            name: m.name,
            type: m.endpoint || 'Unknown',
            url: m.uri,
            status,
            environments: mEnvIds.length,
            tags: roles,
          };
        };

        const result: EnvironmentWithTargets[] = envRes.environments
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((e) => {
            const bucket = envTargets.get(e.id) || { healthy: [], disabled: [] };
            return {
              key: String(e.id),
              name: e.name,
              targets: bucket.healthy.length + bucket.disabled.length,
              healthy: bucket.healthy.length,
              disabled: bucket.disabled.length,
              deployments: bucket.healthy.map((m) => mapMachine(m, 'healthy')),
              disabledTargets: bucket.disabled.map((m) => mapMachine(m, 'disabled')),
            };
          });
        setEnvironments(result);
      })
      .catch(() => {})
      .finally(() => setLoadingEnvs(false));
  }, []);

  // 处理过滤器选择
  const handleFilterChange = (category: string, value: string, checked: boolean) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: checked
        ? [...prev[category], value]
        : prev[category].filter((v) => v !== value),
    }));
  };

  // 重置过滤器
  const resetFilters = () => {
    setDisabledOnly(false);
    setHideEmpty(false);
    setSelectedFilters({
      deployment: [],
      environments: [],
      tags: [],
      health: [],
      types: [],
      tenants: [],
      smartassistant: [],
      restore: [],
      cli: [],
    });
  };

  // 应用过滤逻辑
  const filteredEnvironments = environments.filter((env) => {
    if (hideEmpty && env.targets === 0) return false;
    if (disabledOnly && env.disabled === 0) return false;
    if (searchText && !env.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    
    // 应用环境过滤
    if (selectedFilters.environments.length > 0 && !selectedFilters.environments.includes(env.name)) {
      return false;
    }
    
    return true;
  });

  // 一键展开/折叠
  const toggleExpandAll = () => {
    const allKeys = filteredEnvironments.map((env) => env.key);
    const isAllExpanded = allKeys.every((k) => expandedKeys.includes(k));
    setExpandedKeys(isAllExpanded ? [] : allKeys);
  };

  // 处理保存环境
  const handleSaveEnvironment = () => {
    console.log('Environment Name:', environmentName);
    setShowAddEnvironment(false);
    setEnvironmentName('');
  };

  // 处理保存部署目标
  const handleSaveDeploymentTarget = () => {
    console.log('Deployment Type:', selectedDeploymentType);
    setShowAddDeploymentTarget(false);
  };

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
  ];

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Environments</h1>
            
            {/* 右侧按钮组 */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowAddDeploymentTarget(true)}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 font-medium"
              >
                Add Deployment Target
              </Button>
              <Button
                type="primary"
                onClick={() => setShowAddEnvironment(true)}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700 font-medium"
              >
                Add Environment
              </Button>
              <Button
                type="text"
                icon={<EllipsisOutlined />}
                className="text-gray-600"
              />
            </div>
          </div>

          {/* 搜索框 + 筛选按钮 */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search environments..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-xs"
              size="large"
            />
            <Button
              type="link"
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
              className="text-blue-600"
            >
              {showFilters ? 'Hide' : 'Show'} advanced filters
            </Button>
          </div>
        </div>

        <div className="flex">
          {/* 左侧筛选面板 */}
          {showFilters && (
            <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-base">Advanced filter</span>
                <Button size="small" className="text-gray-600" onClick={resetFilters}>
                  Reset
                </Button>
              </div>

              {/* Checkbox 选项 */}
              <div className="space-y-3 mb-6 pb-6 border-b">
                <Checkbox
                  checked={disabledOnly}
                  onChange={(e) => setDisabledOnly(e.target.checked)}
                >
                  Disabled only
                </Checkbox>
                <Checkbox
                  checked={hideEmpty}
                  onChange={(e) => setHideEmpty(e.target.checked)}
                >
                  Hide empty environments
                </Checkbox>
              </div>

              {/* 过滤分类 - 使用 Collapse */}
              <Collapse
                ghost
                expandIconPosition="end"
                className="bg-transparent"
                style={{ border: 'none' }}
              >
                <Panel 
                  header={<span className="text-sm text-gray-700">By deployment target</span>} 
                  key="deployment"
                  className="border-b"
                >
                  <div className="space-y-2 pl-2">
                    {filterOptions.deployment.map((option) => (
                      <Checkbox
                        key={option}
                        checked={selectedFilters.deployment.includes(option)}
                        onChange={(e) => handleFilterChange('deployment', option, e.target.checked)}
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </div>
                </Panel>

                <Panel 
                  header={<span className="text-sm text-gray-700">By environments</span>} 
                  key="environments"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By target tags</span>} 
                  key="tags"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By health statuses</span>} 
                  key="health"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By deployment target types</span>} 
                  key="types"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By tenants</span>} 
                  key="tenants"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By ForSmartAssistant tags</span>} 
                  key="smartassistant"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By Restore database tags</span>} 
                  key="restore"
                  className="border-b"
                >
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

                <Panel 
                  header={<span className="text-sm text-gray-700">By CLI/shell</span>} 
                  key="cli"
                  className="border-b"
                >
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
              </Collapse>
            </div>
          )}

          {/* 右侧环境列表 */}
          <div className="flex-1 p-6">
            <Spin spinning={loadingEnvs}>
            <div className="flex justify-end mb-4">
              <Button type="link" onClick={toggleExpandAll} className="text-gray-600 uppercase text-xs font-semibold">
                {expandedKeys.length === filteredEnvironments.length ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>

            {/* 环境列表 */}
            <div className="space-y-2">
              {filteredEnvironments.map((env) => (
                <div key={env.key} className="border rounded hover:shadow-sm transition-shadow bg-white">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-3">
                        <MenuOutlined className="text-gray-400" />
                        <span className="font-semibold text-blue-600 text-base">{env.name}</span>
                        <span className="text-gray-500 text-sm">({env.targets} deployment targets)</span>
                      </div>

                      {env.healthy > 0 && (
                        <div className="flex items-center gap-1">
                          <CheckCircleFilled className="text-green-500" />
                          <span className="text-green-600 font-medium">{env.healthy} healthy</span>
                        </div>
                      )}

                      {env.disabled > 0 && (
                        <div className="flex items-center gap-1">
                          <CloseCircleOutlined className="text-gray-400" />
                          <span className="text-blue-600 font-medium">{env.disabled} disabled</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="text" icon={<MoreOutlined />} />
                      <Button
                        type="text"
                        icon={expandedKeys.includes(env.key) ? <UpOutlined /> : <DownOutlined />}
                        onClick={() => {
                          setExpandedKeys((prev: string[]) =>
                            prev.includes(env.key)
                              ? prev.filter((k) => k !== env.key)
                              : [...prev, env.key]
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* 展开内容 */}
                  {expandedKeys.includes(env.key) && (
                    <div className="border-t bg-gray-50">
                      <div className="p-4">
                        {/* Healthy */}
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircleFilled className="text-green-500" />
                          <span className="font-medium text-sm uppercase">
                            Healthy ({env.healthy}/{env.targets})
                          </span>
                        </div>

                        <div className="space-y-3">
                          {env.deployments.map((deployment, idx) => (
                            <div key={idx} className="bg-white rounded border p-4 flex items-start gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-green-700 text-xl">☸</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium mb-1">{deployment.name}</div>
                                <div className="text-sm text-gray-600 mb-1">{deployment.type}</div>
                                <div className="text-xs text-gray-500 break-all">{deployment.url}</div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <CheckCircleFilled className="text-green-500" />
                                <Badge
                                  count={deployment.environments}
                                  style={{ backgroundColor: '#e5e7eb', color: '#111' }}
                                />
                                {deployment.tags.map((tag, i) => (
                                  <Tag key={i} color={tag === 'Normal' ? 'black' : 'default'}>
                                    {tag}
                                  </Tag>
                                ))}
                                <Button type="link" size="small">
                                  Show all
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Disabled */}
                        <div className="flex items-center gap-2 mt-6 mb-4">
                          <CloseCircleOutlined className="text-gray-400" />
                          <span className="font-medium text-sm uppercase">Disabled ({env.disabled})</span>
                        </div>

                        <div className="space-y-3">
                          {env.disabledTargets.map((deployment, idx) => (
                            <div key={idx} className="bg-white rounded border p-4 flex items-start gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-500 text-xl">☸</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium mb-1">{deployment.name}</div>
                                <div className="text-sm text-gray-600 mb-1">{deployment.type}</div>
                                <div className="text-xs text-gray-500 break-all">{deployment.url}</div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <CloseCircleOutlined className="text-gray-400" />
                                <Badge
                                  count={deployment.environments}
                                  style={{ backgroundColor: '#e5e7eb', color: '#111' }}
                                />
                                {deployment.tags.map((tag, i) => (
                                  <Tag key={i}>{tag}</Tag>
                                ))}
                                <Button type="link" size="small">
                                  Show all
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </Spin>
          </div>
        </div>
      </div>

      {/* Add Environment Modal - 添加环境弹窗 */}
      <Modal
        title={<span className="text-xl font-bold">Add Environment</span>}
        open={showAddEnvironment}
        onCancel={() => setShowAddEnvironment(false)}
        width={600}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => setShowAddEnvironment(false)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary"
            onClick={handleSaveEnvironment}
            className="!bg-green-700 hover:!bg-green-800 !border-green-700 text-sm font-semibold"
          >
            Save
          </Button>
        ]}
      >
        <div className="py-4">
          <Input
            placeholder="New environment name"
            value={environmentName}
            onChange={(e) => setEnvironmentName(e.target.value)}
            size="large"
            className="mb-4"
          />
          <div className="text-sm text-gray-600">
            Examples include:{' '}
            <a href="#" className="text-blue-600 hover:underline">Development</a>
            {', '}
            <a href="#" className="text-blue-600 hover:underline">Test</a>
            {' and '}
            <a href="#" className="text-blue-600 hover:underline">Production</a>
          </div>
        </div>
      </Modal>

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

            {/* Two options cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Kubernetes Agent */}
              <div className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
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
              </div>

              {/* Kubernetes API */}
              <div className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-4xl">☸</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-center mb-2">Kubernetes API</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Connect to your cluster via API and execute deployment tasks on workers.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Environments;
