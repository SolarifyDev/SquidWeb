import React, { useState, useEffect } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Input,
  Checkbox,
  Select,
} from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

/** -------------------------------
 * 类型定义
 * ------------------------------*/
interface Target {
  name: string;
  status: 'Healthy' | 'Disabled';
}

interface Environment {
  id: number;
  name: string;
  targets: Target[];
}

/** -------------------------------
 * 模拟数据
 * ------------------------------*/
const environmentsData: Environment[] = [
  {
    id: 1,
    name: 'DEV',
    targets: [
      { name: 'API Gateway', status: 'Healthy' },
      { name: 'Database', status: 'Disabled' },
      { name: 'Cache', status: 'Healthy' },
      { name: 'Auth Service', status: 'Healthy' },
      { name: 'Logging', status: 'Disabled' },
      { name: 'Monitoring', status: 'Healthy' },
      { name: 'Scheduler', status: 'Healthy' },
      { name: 'Message Queue', status: 'Healthy' },
    ],
  },
  {
    id: 2,
    name: 'TEST',
    targets: [
      { name: 'Load Tester', status: 'Healthy' },
      { name: 'Performance Monitor', status: 'Healthy' },
      { name: 'Staging DB', status: 'Disabled' },
    ],
  },
  {
    id: 3,
    name: 'PRD',
    targets: [
      { name: 'Main Servers', status: 'Healthy' },
      { name: 'CDN', status: 'Disabled' },
      { name: 'Monitoring', status: 'Healthy' },
      { name: 'Backup', status: 'Disabled' },
    ],
  },
];

/** -------------------------------
 * 主组件
 * ------------------------------*/
const EnvironmentsPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [expanded, setExpanded] = useState<{ [envId: number]: 'Healthy' | 'Disabled' | null }>({});

  // 下拉选项模拟
  const [environmentOptions, setEnvironmentOptions] = useState<{ label: string; value: string }[]>([]);
  const [tagOptions, setTagOptions] = useState<{ label: string; value: string }[]>([]);
  const [tenantOptions, setTenantOptions] = useState<{ label: string; value: string }[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [healthOptions, setHealthOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    setEnvironmentOptions([
      { label: 'DEV', value: 'DEV' },
      { label: 'TEST', value: 'TEST' },
      { label: 'PRD', value: 'PRD' },
    ]);
    setTagOptions([
      { label: 'aws-eks', value: 'aws-eks' },
      { label: 'Aliyun-HK-AI', value: 'Aliyun-HK-AI' },
    ]);
    setTenantOptions([
      { label: 'Tenant-A', value: 'Tenant-A' },
      { label: 'Tenant-B', value: 'Tenant-B' },
    ]);
    setTypeOptions([
      { label: 'Kubernetes API', value: 'Kubernetes API' },
      { label: 'Polling Tentacle', value: 'Polling Tentacle' },
    ]);
    setHealthOptions([
      { label: 'Healthy', value: 'Healthy' },
      { label: 'Disabled', value: 'Disabled' },
    ]);
  }, []);

  // 切换展开/收起
  const toggleExpand = (envId: number, status: 'Healthy' | 'Disabled') => {
    setExpanded(prev => ({
      ...prev,
      [envId]: prev[envId] === status ? null : status,
    }));
  };

  // 一键展开所有
  const expandAll = () => {
    const newExpanded: { [envId: number]: 'Healthy' | 'Disabled' | null } = {};
    environmentsData.forEach(env => {
      newExpanded[env.id] = 'Healthy'; // 默认展开 Healthy
    });
    setExpanded(newExpanded);
  };

  // 一键折叠所有
  const collapseAll = () => {
    setExpanded({});
  };

  // 过滤环境
  const filteredEnvs = environmentsData.filter(env => {
    if (searchText && !env.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (hideEmpty && env.targets.length === 0) return false;
    return true;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* 搜索框 */}
        <div className="flex items-center gap-3 mb-4">
          <Input
            placeholder="Search environments..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="max-w-md"
            size="large"
          />
          <Button
            type="link"
            icon={<FilterOutlined />}
            className="text-blue-500"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? 'Hide filters' : 'Show filters'}
          </Button>
        </div>

        {/* 高级过滤器 & List 布局 */}
        <div className="flex gap-6">
          {/* 高级过滤器 */}
          {showAdvancedFilters && (
            <div className="w-80 flex-shrink-0">
              <Card className="shadow-sm border border-black">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-gray-700">Advanced filter</span>
                  <Button size="small" onClick={() => window.location.reload()}>Reset</Button>
                </div>
                <div className="space-y-4">
                  <Checkbox checked={disabledOnly} onChange={e => setDisabledOnly(e.target.checked)}>Disabled only</Checkbox>
                  <Checkbox checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)}>Hide empty environments</Checkbox>
                  <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="By deployment target" options={environmentOptions} />
                  <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="By environments" options={environmentOptions} />
                  <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="By target tags" options={tagOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By health statuses" options={healthOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By deployment target types" options={typeOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By tenants" options={tenantOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By ForSmartAssistant tags" options={tagOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By Restore database tags" options={tagOptions} />
                  <Select allowClear style={{ width: '100%' }} placeholder="By CLI/shell" options={tagOptions} />
                </div>
              </Card>
            </div>
          )}

          {/* List */}
          <div className="flex-1">
            <Card className="shadow-sm rounded-lg">
              {/* 一键展开/折叠按钮 */}
              <div className="flex justify-end mb-2">
                <Button size="small" onClick={() => {
                  const allExpanded = filteredEnvs.every(env => expanded[env.id]);
                  if (allExpanded) collapseAll();
                  else expandAll();
                }}>
                  {filteredEnvs.every(env => expanded[env.id]) ? 'Collapse all' : 'Expand all'}
                </Button>
              </div>

              {filteredEnvs.map(env => {
                const healthyTargets = env.targets.filter(t => t.status === 'Healthy');
                const disabledTargets = env.targets.filter(t => t.status === 'Disabled');
                const expandedStatus = expanded[env.id];

                return (
                  <div key={env.id} className="flex flex-col border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-all duration-200 p-4">
                    {/* 环境 header */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <DatabaseOutlined className="text-blue-400" />
                        <span className="text-blue-400 font-semibold text-base">{env.name}</span>
                        <span className="text-gray-500 text-sm">({env.targets.length} deployment targets)</span>
                      </div>

                      <Button
                        type="default"
                        size="small"
                        icon={<CheckCircleOutlined className="text-green-500" />}
                        onClick={() => toggleExpand(env.id, 'Healthy')}
                      >
                        Healthy ({healthyTargets.length})
                      </Button>

                      <Button
                        type="default"
                        size="small"
                        icon={<CloseCircleOutlined className="text-gray-400" />}
                        onClick={() => toggleExpand(env.id, 'Disabled')}
                      >
                        Disabled ({disabledTargets.length})
                      </Button>
                    </div>

                    {/* 展开 targets */}
                    {expandedStatus && (
                      <div className="flex flex-wrap gap-2 mt-2 ml-10">
                        {env.targets
                          .filter(t => t.status === expandedStatus)
                          .map((t, idx) => (
                            <Tag key={idx} color={t.status === 'Healthy' ? 'green' : 'red'}>
                              {t.name}
                            </Tag>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentsPage;
