import React, { useState } from 'react';
import { Input, Checkbox, Button, Badge, Tag } from 'antd';
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

const Environments = () => {
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);

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

  // 应用过滤逻辑
  const filteredEnvironments = environments.filter((env) => {
    if (hideEmpty && env.targets === 0) return false;
    if (disabledOnly && env.disabled === 0) return false;
    if (searchText && !env.name.toLowerCase().includes(searchText.toLowerCase())) return false;
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
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Environments</h1>
          <Button type="link" onClick={toggleExpandAll}>
            {expandedKeys.length === filteredEnvironments.length ? 'COLLAPSE ALL' : 'EXPAND ALL'}
          </Button>
        </div>

        {/* 搜索框 + 筛选按钮 */}
        <div className="flex items-center gap-4 mb-6">
          <Input
            placeholder="Search environments..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-xs"
          />
          <Button
            type="link"
            icon={<FilterOutlined />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} advanced filters
          </Button>
        </div>

        {/* 筛选条件 */}
        {showFilters && (
          <div className="flex gap-8 mb-6 pb-6 border-b">
            <div className="w-64">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">Advanced filter</span>
                <Button size="small">Reset</Button>
              </div>

              <div className="space-y-3 mb-4">
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

              {/* 分类 */}
              <div className="space-y-2 text-sm text-gray-600">
                {[
                  'By deployment target',
                  'By environments',
                  'By target tags',
                  'By health statuses',
                  'By deployment target types',
                  'By tenants',
                  'By ForSmartAssistant tags',
                  'By Restore database tags',
                  'By CLI/shell',
                ].map((label) => (
                  <div key={label} className="cursor-pointer hover:text-gray-900">
                    {label} ▼
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 环境列表 */}
        <div className="space-y-2">
          {filteredEnvironments.map((env) => (
            <div key={env.key} className="border rounded hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-white">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <MenuOutlined />
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
                      <span className="font-medium">
                        HEALTHY ({env.healthy}/{env.targets})
                      </span>
                    </div>

                    <div className="space-y-4">
                      {env.deployments.map((deployment, idx) => (
                        <div key={idx} className="bg-white rounded border p-4 flex items-start gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-green-700">☸</span>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium mb-1">{deployment.name}</div>
                            <div className="text-sm text-gray-600 mb-1">{deployment.type}</div>
                            <div className="text-xs text-gray-500 break-all">{deployment.url}</div>
                          </div>
                          <div className="flex items-center gap-2">
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
                      <span className="font-medium">DISABLED ({env.disabled})</span>
                    </div>

                    <div className="space-y-4">
                      {env.disabledTargets.map((deployment, idx) => (
                        <div key={idx} className="bg-white rounded border p-4 flex items-start gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-500">☸</span>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium mb-1">{deployment.name}</div>
                            <div className="text-sm text-gray-600 mb-1">{deployment.type}</div>
                            <div className="text-xs text-gray-500 break-all">{deployment.url}</div>
                          </div>
                          <div className="flex items-center gap-2">
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
  );
};

export default Environments;
