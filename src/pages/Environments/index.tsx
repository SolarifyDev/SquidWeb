import React, { useState } from 'react';
import { Input, Checkbox, Button, Badge, Tag, Collapse } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  DownOutlined,
  UpOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  MenuOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;

const Environments = () => {
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);

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

  // 模拟环境数据
  const environments = [
    {
      key: 'DEV',
      name: 'DEV',
      targets: 8,
      healthy: 3,
      disabled: 5,
      deployments: [
        {
          name: 'AWS Cluster',
          type: 'Kubernetes API',
          url: 'https://0316B691AEF6C9B1BC53AEB77EDC061D4.yl4.ap-east-1.eks.amazonaws.com',
          status: 'healthy',
          environments: 3,
          tags: ['aws-eks', 'Normal'],
        },
        {
          name: 'AWS-EKS-US',
          type: 'Kubernetes API',
          url: 'https://D9773498E6AAB1BDB768CF862EF6B18B.gr7.us-west-1.eks.amazonaws.com',
          status: 'healthy',
          environments: 3,
          tags: ['aws-eks-us'],
        },
        {
          name: 'SJ-US-AKS',
          type: 'Kubernetes API',
          url: 'https://47.254.20.160:6443',
          status: 'healthy',
          environments: 6,
          tags: ['SJUSAKS', 'vendor-queue-web'],
        },
      ],
      disabledTargets: [
        {
          name: 'Aliyun-HK-AI-Cluster',
          type: 'Kubernetes API',
          url: 'https://172.20.41.126:6443',
          status: 'disabled',
          environments: 8,
          tags: ['Aliyun-HK-AI'],
        },
        {
          name: 'Cloud-Deployment-Target',
          type: 'Polling Tentacle',
          url: 'poll://j64fxsyfrk6j37d6q7wss/',
          status: 'disabled',
          environments: 6,
          tags: ['DotnetCore'],
        },
      ],
    },
    {
      key: 'TEST',
      name: 'TEST',
      targets: 12,
      healthy: 3,
      disabled: 9,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'UAT',
      name: 'UAT',
      targets: 8,
      healthy: 1,
      disabled: 7,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'PRD',
      name: 'PRD',
      targets: 14,
      healthy: 3,
      disabled: 11,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'PRD2',
      name: 'PRD2',
      targets: 4,
      healthy: 1,
      disabled: 3,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'TEST2',
      name: 'TEST2',
      targets: 2,
      healthy: 1,
      disabled: 1,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'PRE-PROD',
      name: 'PRE-PROD',
      targets: 2,
      healthy: 0,
      disabled: 2,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'Startup',
      name: 'Startup',
      targets: 1,
      healthy: 0,
      disabled: 1,
      deployments: [],
      disabledTargets: [],
    },
    {
      key: 'Shutdown',
      name: 'Shutdown',
      targets: 1,
      healthy: 0,
      disabled: 1,
      deployments: [],
      disabledTargets: [],
    },
  ];

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

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-semibold mb-6">Environments</h1>

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
            <div className="flex justify-end mb-4">
              <Button type="link" onClick={toggleExpandAll} className="text-gray-600">
                {expandedKeys.length === filteredEnvironments.length ? 'COLLAPSE ALL' : 'EXPAND ALL'}
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
                  {expandedKeys.includes(env.key) && env.key === 'DEV' && (
                    <div className="border-t bg-gray-50">
                      <div className="p-4">
                        {/* Healthy */}
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircleFilled className="text-green-500" />
                          <span className="font-medium text-sm">
                            HEALTHY ({env.healthy}/{env.targets})
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
                          <span className="font-medium text-sm">DISABLED ({env.disabled})</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Environments;
