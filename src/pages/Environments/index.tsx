import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Checkbox, Button, Tag, Modal, Tabs, Spin, Select, message } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  DownOutlined,
  UpOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { getEnvironments, createEnvironment } from 'pages/apis/environment';
import { getMachines, MachineDto } from 'pages/apis/machine';
import { useSpace } from 'contexts/SpaceContext';
import PageContainer from 'components/PageContainer';
import { resolveMachineHealthState } from 'pages/deploymentTargets';

type HealthState = 'Healthy' | 'Unhealthy' | 'Unavailable' | 'Unknown' | 'Disabled';

const HEALTH_STATE_ORDER: HealthState[] = ['Healthy', 'Unhealthy', 'Unavailable', 'Unknown', 'Disabled'];

const HEALTH_STATE_META: Record<HealthState, { label: string; dot: string; iconBg: string; iconText: string }> = {
  Healthy: { label: 'Healthy', dot: 'bg-green-500', iconBg: 'bg-green-100', iconText: 'text-green-700' },
  Unhealthy: { label: 'Unhealthy', dot: 'bg-rose-500', iconBg: 'bg-rose-100', iconText: 'text-rose-700' },
  Unavailable: { label: 'Unavailable', dot: 'bg-amber-500', iconBg: 'bg-amber-100', iconText: 'text-amber-700' },
  Unknown: { label: 'Unknown', dot: 'bg-slate-400', iconBg: 'bg-slate-100', iconText: 'text-slate-500' },
  Disabled: { label: 'Disabled', dot: 'bg-slate-400', iconBg: 'bg-slate-100', iconText: 'text-slate-500' },
};

const toEnvironmentSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'environment';

interface KubernetesApiEndpoint {
  CommunicationStyle: string;
  ClusterUrl: string;
  Namespace: string;
}

interface KubernetesAgentEndpoint {
  CommunicationStyle: string;
  Thumbprint: string;
  Namespace: string;
}

type MachineEndpoint = KubernetesApiEndpoint | KubernetesAgentEndpoint;

function parseEndpointJson(json: string): MachineEndpoint | null {
  try {
    return JSON.parse(json) as MachineEndpoint;
  } catch {
    return null;
  }
}

function communicationStyleLabel(style: string): string {
  const map: Record<string, string> = {
    KubernetesApi: 'Kubernetes API',
    KubernetesAgent: 'Kubernetes Agent',
    TentaclePassive: 'Listening Tentacle',
    TentacleListening: 'Listening Tentacle',
    TentacleActive: 'Polling Tentacle',
    TentaclePolling: 'Polling Tentacle',
    Ssh: 'SSH Connection',
  };
  return map[style] || style;
}

function endpointSummary(ep: MachineEndpoint | null): string {
  if (!ep) return '';
  if (ep.CommunicationStyle === 'KubernetesApi') return (ep as KubernetesApiEndpoint).ClusterUrl || '';
  if (ep.CommunicationStyle === 'KubernetesAgent') return (ep as KubernetesAgentEndpoint).Thumbprint || '';
  return '';
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

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
  interface MappedTarget {
    name: string;
    type: string;
    url: string;
    state: HealthState;
    environmentNames: string[];
    tags: string[];
  }

  interface EnvHealthGroup {
    state: HealthState;
    targets: MappedTarget[];
  }

  interface EnvironmentWithTargets {
    key: string;
    name: string;
    total: number;
    healthyCount: number;
    groups: EnvHealthGroup[];
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
        const envNameLookup = new Map<string, string>();
        envRes.environments.forEach((e) => envNameLookup.set(String(e.id), e.name));

        // Group machines by environment.
        const envTargets = new Map<number, MachineDto[]>();
        envRes.environments.forEach((e) => envTargets.set(e.id, []));

        machineRes.machines.forEach((m) => {
          (m.environmentIds ?? []).forEach((envId: number) => {
            envTargets.get(envId)?.push(m);
          });
        });

        const mapMachine = (m: MachineDto): MappedTarget => {
          const mEnvNames = unique(
            (m.environmentIds ?? [])
              .map((envId) => envNameLookup.get(String(envId)) || '')
              .filter(Boolean),
          );
          const ep = parseEndpointJson(m.endpoint || '{}');
          const style = ep?.CommunicationStyle || 'Unknown';
          const summary = endpointSummary(ep);
          return {
            name: m.name,
            type: communicationStyleLabel(style),
            url: summary || m.uri || '',
            state: resolveMachineHealthState(m),
            environmentNames: mEnvNames,
            tags: m.roles ?? [],
          };
        };

        const result: EnvironmentWithTargets[] = envRes.environments
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((e) => {
            const targets = (envTargets.get(e.id) || []).map(mapMachine);
            const groups: EnvHealthGroup[] = HEALTH_STATE_ORDER
              .map((state) => ({ state, targets: targets.filter((t) => t.state === state) }))
              .filter((group) => group.targets.length > 0);
            return {
              key: String(e.id),
              name: e.name,
              total: targets.length,
              healthyCount: targets.filter((t) => t.state === 'Healthy').length,
              groups,
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
    if (hideEmpty && env.total === 0) return false;
    if (disabledOnly && !env.groups.some((g) => g.state === 'Disabled')) return false;
    if (searchText && !env.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (
      deploymentTargetSearch &&
      !env.groups.flatMap((g) => g.targets).some((d) =>
        `${d.name} ${d.type} ${d.url} ${d.environmentNames.join(' ')} ${d.tags.join(' ')}`.toLowerCase().includes(deploymentTargetSearch.toLowerCase())
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
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
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
                      className="border border-slate-200 rounded-lg bg-white overflow-hidden transition-shadow hover:shadow-sm"
                    >
                      <div
                        onClick={() =>
                          setExpandedKeys((prev: string[]) =>
                            prev.includes(env.key)
                              ? prev.filter((k) => k !== env.key)
                              : [...prev, env.key]
                          )
                        }
                        className="flex items-start justify-between gap-3 p-4 cursor-pointer select-none transition-colors hover:bg-slate-50/70"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="flex items-center gap-2">
                              <MenuOutlined className="text-gray-400" />
                              <span className="font-semibold text-squid-blue text-base">{env.name}</span>
                            </div>
                            <span className="text-slate-500 text-sm">
                              {env.total} deployment target{env.total !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button type="text" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                          <Button
                            type="text"
                            aria-label={expandedKeys.includes(env.key) ? 'Collapse environment' : 'Expand environment'}
                            icon={expandedKeys.includes(env.key) ? <UpOutlined /> : <DownOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
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
                        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
                          {env.total === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                              No deployment targets in this environment
                            </div>
                          ) : (
                            <div className="space-y-5">
                              {env.groups.map((group) => {
                                const meta = HEALTH_STATE_META[group.state];
                                return (
                                  <div key={group.state}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
                                      <span className="font-semibold text-xs uppercase tracking-wide text-slate-600">
                                        {meta.label} ({group.state === 'Healthy' ? `${group.targets.length}/${env.total}` : group.targets.length})
                                      </span>
                                    </div>

                                    <div className="space-y-2">
                                      {group.targets.map((target, idx) => (
                                        <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3 transition-shadow hover:shadow-sm">
                                          <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 ${meta.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                              <span className={`${meta.iconText} text-lg`}>☸</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-slate-900 mb-0.5">{target.name}</div>
                                              <div className="text-sm text-slate-600">{target.type}</div>
                                              {target.url && (
                                                <div className="text-xs text-slate-500 break-all mt-1">{target.url}</div>
                                              )}
                                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                                {target.environmentNames.slice(0, 3).map((envName, i) => (
                                                  <Tag key={`env-${i}`} color="blue" className="!m-0">
                                                    {envName}
                                                  </Tag>
                                                ))}
                                                {target.environmentNames.length > 3 && (
                                                  <Button type="link" size="small" className="!px-0">
                                                    +{target.environmentNames.length - 3} envs
                                                  </Button>
                                                )}
                                                {target.tags.slice(0, 4).map((tag, i) => (
                                                  <Tag key={`tag-${i}`} className="!m-0">{tag}</Tag>
                                                ))}
                                                {target.tags.length > 4 && (
                                                  <Button type="link" size="small" className="!px-0">
                                                    +{target.tags.length - 4} more
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
    </PageContainer>
  );
};

export default Environments;
