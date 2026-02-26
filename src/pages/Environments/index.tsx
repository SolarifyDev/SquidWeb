import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Checkbox, Button, Badge, Tag, Modal, Tabs, Spin, Select, message } from 'antd';
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
import { getEnvironments, createEnvironment, EnvironmentDto } from 'pages/apis/environment';
import { getMachines, MachineDto } from 'pages/apis/machine';
import { useSpace } from 'contexts/SpaceContext';

const toEnvironmentSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'environment';

const Environments = () => {
  const navigate = useNavigate();
  const { space } = useSpace();
  const [searchText, setSearchText] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [deploymentTargetSearch, setDeploymentTargetSearch] = useState('');
  
  // 新增弹窗状态
  const [showAddEnvironment, setShowAddEnvironment] = useState(false);
  const [showAddDeploymentTarget, setShowAddDeploymentTarget] = useState(false);
  const [environmentName, setEnvironmentName] = useState('');
  const [savingEnvironment, setSavingEnvironment] = useState(false);
  const [selectedDeploymentType, setSelectedDeploymentType] = useState('Kubernetes');

  // 过滤器选项数据
  const filterOptions = {
    deployment: ['AWS Cluster', 'AWS-EKS-US', 'SJ-US-AKS', 'Aliyun-HK-AI-Cluster', 'Cloud-Deployment-Target'],
    environments: ['DEV', 'TEST', 'UAT', 'PRD', 'PRD2', 'TEST2', 'PRE-PROD', 'Startup', 'Shutdown'],
    tags: ['aws-eks', 'Normal', 'aws-eks-us', 'SJUSAKS', 'vendor-queue-web', 'Aliyun-HK-AI', 'DotnetCore'],
    health: ['Healthy', 'Unhealthy', 'Unavailable', 'Disabled', 'Unknown'],
    types: ['Kubernetes API', 'Polling Tentacle', 'Listening Tentacle', 'SSH Connection', 'Offline Package Drop'],
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

  const loadEnvironments = () => {
    setLoadingEnvs(true);
    Promise.all([
      getEnvironments({ pageSize: 1000, spaceId: space.id }),
      getMachines({ pageSize: 1000, spaceId: space.id }).catch((error) => {
        console.error('Failed to load machines', error);
        message.warning('Failed to load deployment targets, showing environments only');
        return { count: 0, machines: [] as MachineDto[] };
      }),
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
      .catch((error) => {
        console.error('Failed to load environments', error);
        message.error(error instanceof Error ? error.message : 'Failed to load environments');
      })
      .finally(() => setLoadingEnvs(false));
  };

  useEffect(() => {
    if (!space?.id) return;
    loadEnvironments();
  }, [space?.id]);

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
    setDeploymentTargetSearch('');
    setSelectedFilters({
      deployment: [],
      environments: [],
      tags: [],
      health: [],
      types: [],
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
    if (
      deploymentTargetSearch &&
      ![...env.deployments, ...env.disabledTargets].some((d) =>
        `${d.name} ${d.type} ${d.url}`.toLowerCase().includes(deploymentTargetSearch.toLowerCase())
      )
    ) {
      return false;
    }
    
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
  const handleSaveEnvironment = async () => {
    const name = environmentName.trim();
    if (!name) {
      message.warning('Please enter an environment name');
      return;
    }

    if (!space?.id) {
      message.error('Space is not available');
      return;
    }

    setSavingEnvironment(true);
    try {
      await createEnvironment({
        spaceId: space.id,
        slug: toEnvironmentSlug(name),
        name,
        description: '',
        sortOrder: environments.length + 1,
        useGuidedFailure: false,
        allowDynamicInfrastructure: false,
      });
      message.success('Environment created');
      setShowAddEnvironment(false);
      setEnvironmentName('');
      loadEnvironments();
    } catch (error) {
      console.error('Failed to create environment', error);
      message.error(error instanceof Error ? error.message : 'Failed to create environment');
    } finally {
      setSavingEnvironment(false);
    }
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
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 pt-5 pb-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 m-0">Environments</h1>
                <p className="mt-1 mb-0 text-sm text-gray-500">
                  Manage environments and review their deployment targets.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  onClick={() => navigate(`/${space.slug}/deployment/targets`)}
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search environments..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-72"
                size="large"
              />

              <Button
                type="link"
                icon={<FilterOutlined />}
                onClick={() => setShowFilters(!showFilters)}
                className="text-blue-600 px-0"
              >
                {showFilters ? 'Hide' : 'Show'} advanced filters
              </Button>

              <div className="flex-1" />

              <Button
                type="link"
                onClick={toggleExpandAll}
                className="text-gray-600 uppercase text-xs font-semibold px-0"
              >
                {expandedKeys.length === filteredEnvironments.length && filteredEnvironments.length > 0
                  ? 'Collapse All'
                  : 'Expand All'}
              </Button>
            </div>
          </div>

          <div className="flex">
            {showFilters && (
              <aside className="w-[320px] shrink-0 border-r border-gray-200 bg-white px-5 py-4">
                <div className="sticky top-[132px] max-h-[calc(100vh-156px)] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-gray-800">Advanced filter</div>
                    <Button
                      size="small"
                      onClick={resetFilters}
                      disabled={
                        !disabledOnly &&
                        !hideEmpty &&
                        !deploymentTargetSearch &&
                        Object.values(selectedFilters).every((arr) => arr.length === 0)
                      }
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <Checkbox checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)}>
                      Disabled only
                    </Checkbox>
                    <Checkbox checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)}>
                      Hide empty environments
                    </Checkbox>
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={deploymentTargetSearch}
                      onChange={(e) => setDeploymentTargetSearch(e.target.value)}
                      placeholder="By deployment target"
                      allowClear
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By environments"
                      className="w-full"
                      value={selectedFilters.environments}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, environments: values }))}
                      options={filterOptions.environments.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By target tags"
                      className="w-full"
                      value={selectedFilters.tags}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, tags: values }))}
                      options={filterOptions.tags.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By health statuses"
                      className="w-full"
                      value={selectedFilters.health}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, health: values }))}
                      options={filterOptions.health.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By deployment target types"
                      className="w-full"
                      value={selectedFilters.types}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, types: values }))}
                      options={filterOptions.types.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By ForSmartAssistant tags"
                      className="w-full"
                      value={selectedFilters.smartassistant}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, smartassistant: values }))}
                      options={filterOptions.smartassistant.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By Restore database tags"
                      className="w-full"
                      value={selectedFilters.restore}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, restore: values }))}
                      options={filterOptions.restore.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />

                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      placeholder="By CLI/shell"
                      className="w-full"
                      value={selectedFilters.cli}
                      onChange={(values) => setSelectedFilters((prev) => ({ ...prev, cli: values }))}
                      options={filterOptions.cli.map((value) => ({ value, label: value }))}
                      optionFilterProp="label"
                    />
                  </div>
                </div>
              </aside>
            )}

            <div className="flex-1 min-w-0 p-6">
            <Spin spinning={loadingEnvs}>
              {filteredEnvironments.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-md px-6 py-12 text-center">
                  <div className="text-base font-medium text-gray-700 mb-1">No environments found</div>
                  <div className="text-sm text-gray-500">
                    Try changing filters or create a new environment.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEnvironments.map((env) => (
                    <div
                      key={env.key}
                      className="border border-gray-200 rounded-md bg-white overflow-hidden hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="flex items-center gap-2">
                              <MenuOutlined className="text-gray-400" />
                              <span className="font-semibold text-squid-blue text-base">{env.name}</span>
                            </div>
                            <span className="text-gray-500 text-sm">
                              {env.targets} deployment target{env.targets !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag color="green" className="!m-0">
                              {env.healthy} Healthy
                            </Tag>
                            <Tag className="!m-0" color="default">
                              {env.disabled} Disabled
                            </Tag>
                            {env.targets === 0 && (
                              <Tag className="!m-0" color="default">Empty</Tag>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
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

                      {expandedKeys.includes(env.key) && (
                        <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                          <div className="space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircleFilled className="text-green-500" />
                                <span className="font-semibold text-xs uppercase tracking-wide text-gray-700">
                                  Healthy Deployment Targets ({env.healthy})
                                </span>
                              </div>

                              <div className="space-y-2">
                                {env.deployments.length === 0 ? (
                                  <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-3 text-sm text-gray-500">
                                    No healthy deployment targets
                                  </div>
                                ) : (
                                  env.deployments.map((deployment, idx) => (
                                    <div key={idx} className="bg-white rounded border border-gray-200 p-3">
                                      <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                                          <span className="text-green-700 text-lg">☸</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-gray-900 mb-0.5">{deployment.name}</div>
                                          <div className="text-sm text-gray-600">{deployment.type}</div>
                                          {deployment.url && (
                                            <div className="text-xs text-gray-500 break-all mt-1">{deployment.url}</div>
                                          )}
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <CheckCircleFilled className="text-green-500" />
                                            <Badge count={deployment.environments} style={{ backgroundColor: '#e5e7eb', color: '#111' }} />
                                            {deployment.tags.slice(0, 4).map((tag, i) => (
                                              <Tag key={i} color={tag === 'Normal' ? 'black' : 'default'} className="!m-0">
                                                {tag}
                                              </Tag>
                                            ))}
                                            {deployment.tags.length > 4 && (
                                              <Button type="link" size="small" className="!px-0">
                                                +{deployment.tags.length - 4} more
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <CloseCircleOutlined className="text-gray-400" />
                                <span className="font-semibold text-xs uppercase tracking-wide text-gray-700">
                                  Disabled Deployment Targets ({env.disabled})
                                </span>
                              </div>

                              <div className="space-y-2">
                                {env.disabledTargets.length === 0 ? (
                                  <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-3 text-sm text-gray-500">
                                    No disabled deployment targets
                                  </div>
                                ) : (
                                  env.disabledTargets.map((deployment, idx) => (
                                    <div key={idx} className="bg-white rounded border border-gray-200 p-3">
                                      <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                          <span className="text-gray-500 text-lg">☸</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-gray-900 mb-0.5">{deployment.name}</div>
                                          <div className="text-sm text-gray-600">{deployment.type}</div>
                                          {deployment.url && (
                                            <div className="text-xs text-gray-500 break-all mt-1">{deployment.url}</div>
                                          )}
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <CloseCircleOutlined className="text-gray-400" />
                                            <Badge count={deployment.environments} style={{ backgroundColor: '#e5e7eb', color: '#111' }} />
                                            {deployment.tags.slice(0, 4).map((tag, i) => (
                                              <Tag key={i} className="!m-0">{tag}</Tag>
                                            ))}
                                            {deployment.tags.length > 4 && (
                                              <Button type="link" size="small" className="!px-0">
                                                +{deployment.tags.length - 4} more
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Spin>
            </div>
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
            disabled={savingEnvironment}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary"
            onClick={handleSaveEnvironment}
            loading={savingEnvironment}
            disabled={!environmentName.trim()}
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
            onPressEnter={() => {
              if (!savingEnvironment) {
                void handleSaveEnvironment();
              }
            }}
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
