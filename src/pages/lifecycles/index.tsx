import React, { useMemo, useState } from 'react';
import { Input, Button, Dropdown, Radio, Checkbox, Alert } from 'antd';
import {
  SearchOutlined,
  ThunderboltFilled,
  MoreOutlined,
  DownOutlined,
  UpOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
} from '@ant-design/icons';

interface Phase {
  name: string;
  type?: 'active' | 'default';
}

interface Lifecycle {
  id: number;
  name: string;
  slug: string;
  description: string;
  retentionPolicy: string;
  phases: Phase[];
  projectCount?: number;
}

const Lifecycles: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedLifecycle, setSelectedLifecycle] = useState<Lifecycle | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'usage'>('details');

  // 在组件开头添加新的状态
  const [showCreatePage, setShowCreatePage] = useState(false);
  // 创建页面的表单状态
  const [newLifecycleName, setNewLifecycleName] = useState('');
  const [newLifecycleDescription, setNewLifecycleDescription] = useState('');
  const [showMarkdownControls, setShowMarkdownControls] = useState(true);
  const [releaseRetention, setReleaseRetention] = useState('keepAll');
  const [fileRetention, setFileRetention] = useState('keepAll');
  // 创建页面的折叠状态
  const [createExpandedSections, setCreateExpandedSections] = useState({
  description: true,
  retentionPolicy: true,
  });

  // 折叠状态管理
  const [expandedSections, setExpandedSections] = useState<{
    name: boolean;
    description: boolean;
    retentionPolicy: boolean;
    phases: boolean[];
  }>({
    name: false,
    description: false,
    retentionPolicy: false,
    phases: [],
  });

  // 模拟数据
  const lifecyclesData: Lifecycle[] = [
    {
      id: 1,
      name: 'Only Test',
      slug: 'only-test',
      description: 'No lifecycle description provided',
      retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
      phases: [{ name: 'TEST', type: 'default' }],
      projectCount: 11,
    },
    {
      id: 2,
      name: 'Only PRD',
      slug: 'only-prd',
      description: 'No lifecycle description provided',
      retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
      phases: [{ name: 'PRD', type: 'default' }],
      projectCount: 5,
    },
    {
      id: 3,
      name: 'PHP New Lifecycles',
      slug: 'php-new-lifecycles',
      description: 'UAT TEST PRD',
      retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
      phases: [
        { name: 'TEST', type: 'active' },
        { name: 'UAT', type: 'active' },
        { name: 'PRD', type: 'default' },
      ],
      projectCount: 8,
    },
    {
      id: 4,
      name: 'PHP Only UAT',
      slug: 'php-only-uat',
      description: 'PHP Only UAT',
      retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
      phases: [{ name: 'UAT', type: 'default' }],
      projectCount: 3,
    },
    {
      id: 5,
      name: 'Default',
      slug: 'default',
      description: 'No lifecycle description provided',
      retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
      phases: [],
      projectCount: 0,
    },
  ];

  // 过滤数据
  const filteredData = useMemo(() => {
    return lifecyclesData.filter(
      (item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText, lifecyclesData]);


  // 渲染阶段标签（带连接线）
  const renderPhaseWithLine = (phase: Phase, index: number, totalPhases: number) => {
    const isLast = index === totalPhases - 1;

    return (
      <div key={`${phase.name}-${index}`} className="flex">
        {/* 左侧图标和连接线容器 */}
        <div className="flex flex-col items-center" style={{ width: '20px' }}>
          {/* 图标 */}
          {phase.type === 'active' ? (
            <ThunderboltFilled className="text-orange-600" style={{ fontSize: '14px' }} />
          ) : (
            <span
              className="inline-block bg-gray-400"
              style={{ width: '12px', height: '12px', borderRadius: '2px' }}
            ></span>
          )}

          {/* 连接线 */}
          {!isLast && (
            <div
              className="bg-gray-300"
              style={{ width: '2px', height: '24px', marginTop: '4px', marginBottom: '4px' }}
            ></div>
          )}
        </div>

        {/* 右侧文字 */}
        <div
          className={`ml-3 leading-5 ${phase.type === 'active' ? 'text-orange-600 font-medium' : 'text-gray-600'
            }`}
        >
          {phase.name}
        </div>
      </div>
    );
  };

  // 点击生命周期
  const handleLifecycleClick = (lifecycle: Lifecycle) => {
    setSelectedLifecycle(lifecycle);
    setActiveTab('details');
    // 初始化折叠状态
    setExpandedSections({
      name: false,
      description: false,
      retentionPolicy: false,
      phases: lifecycle.phases.map(() => false),
    });
  };

  const handleSaveNewLifecycle = () => {
    console.log('Save new lifecycle:', {
      name: newLifecycleName,
      description: newLifecycleDescription,
      releaseRetention,
      fileRetention,
    });
    // 这里添加保存逻辑
    setShowCreatePage(false);
    resetCreateForm();
  };

  const resetCreateForm = () => {
    setNewLifecycleName('');
    setNewLifecycleDescription('');
    setReleaseRetention('keepAll');
    setFileRetention('keepAll');
    setShowMarkdownControls(true);
    setCreateExpandedSections({
      description: true,
      retentionPolicy: true,
    });
  };

  // 返回列表
  const handleBackToList = () => {
    setSelectedLifecycle(null);
    setActiveTab('details');
  };

  // 展开所有
  const handleExpandAll = () => {
    if (selectedLifecycle) {
      setExpandedSections({
        name: true,
        description: true,
        retentionPolicy: true,
        phases: selectedLifecycle.phases.map(() => true),
      });
    }
  };

  // 折叠所有
  const handleCollapseAll = () => {
    if (selectedLifecycle) {
      setExpandedSections({
        name: false,
        description: false,
        retentionPolicy: false,
        phases: selectedLifecycle.phases.map(() => false),
      });
    }
  };

  // 切换单个section的展开状态
  const toggleSection = (section: 'name' | 'description' | 'retentionPolicy') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleCreateSection = (section: 'description' | 'retentionPolicy') => {
    setCreateExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 切换phase的展开状态
  const togglePhase = (index: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      phases: prev.phases.map((expanded, i) => (i === index ? !expanded : expanded)),
    }));
  };

  // 更多操作菜单
  const moreMenuItems = [
    {
      key: '1',
      label: 'Audit Trail',
    }
  ];

  // 如果选中了生命周期，显示详情页
  if (selectedLifecycle) {
    return (
      <div className="p-6 bg-white min-h-screen">
        {/* 面包屑导航 */}
        <div className="mb-4">
          <span className="text-blue-600 cursor-pointer hover:underline" onClick={handleBackToList}>
            Lifecycles
          </span>
        </div>

        {/* 标题和操作按钮 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">{selectedLifecycle.name}</h1>
          <div className="flex items-center gap-2">
            <Button disabled className="bg-gray-200 text-gray-500 border-gray-300">
              LifecycleEdit permission required
            </Button>
            <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </div>
        </div>

        {/* EXPAND ALL / COLLAPSE ALL 按钮 */}
        <div className="flex justify-end mb-4 gap-4">
          <span
            className="text-blue-600 cursor-pointer text-sm hover:underline"
            onClick={handleExpandAll}
          >
            EXPAND ALL
          </span>
          <span
            className="text-blue-600 cursor-pointer text-sm hover:underline"
            onClick={handleCollapseAll}
          >
            COLLAPSE ALL
          </span>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-8">
            <div
              className={`pb-3 cursor-pointer ${activeTab === 'details'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </div>
            <div
              className={`pb-3 cursor-pointer ${activeTab === 'usage'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
              onClick={() => setActiveTab('usage')}
            >
              Usage
            </div>
          </div>
        </div>

        {/* Details Tab Content */}
        {activeTab === 'details' && (
          <>
            {/* 详情内容 */}
            <div className="space-y-0">
              {/* Name */}
              <div className="border-b border-gray-200">
                <div
                  className="py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer px-4"
                  onClick={() => toggleSection('name')}
                >
                  <div className="font-semibold text-gray-700 w-48">Name</div>
                  <div className="flex-1 text-gray-600">
                    {selectedLifecycle.name}{' '}
                    <span className="text-gray-400">{selectedLifecycle.slug}</span>
                  </div>
                  {expandedSections.name ? (
                    <UpOutlined className="text-blue-600 text-xs" />
                  ) : (
                    <DownOutlined className="text-blue-600 text-xs" />
                  )}
                </div>
                {expandedSections.name && (
                  <div className="px-4 pb-4 bg-gray-50">
                    <div className="text-sm text-gray-600">Name details can be edited here.</div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="border-b border-gray-200">
                <div
                  className="py-4 flex items-start justify-between hover:bg-gray-50 cursor-pointer px-4"
                  onClick={() => toggleSection('description')}
                >
                  <div className="font-semibold text-gray-700 w-48">Description</div>
                  <div className="flex-1 text-gray-600">
                    {expandedSections.description
                      ? 'Enter a description for your lifecycle.'
                      : selectedLifecycle.description}
                  </div>
                  {expandedSections.description ? (
                    <UpOutlined className="text-blue-600 text-xs mt-1" />
                  ) : (
                    <DownOutlined className="text-blue-600 text-xs mt-1" />
                  )}
                </div>

                {expandedSections.description && (
                  <div className="px-4 pb-4 bg-white">
                    {/* 右侧整体往右移，与标题右侧内容对齐 */}
                    <div className="ml-48 pl-8">
                      {/* Markdown Editor Toolbar */}
                      <div className="flex gap-2 mb-2 border border-gray-300 border-b-0 rounded-t">
                        <Button
                          size="small"
                          icon={<BoldOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<ItalicOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<UnorderedListOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<OrderedListOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<PictureOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<LinkOutlined />}
                          type="text"
                          className="h-8"
                        />
                        <Button
                          size="small"
                          icon={<CodeOutlined />}
                          type="text"
                          className="h-8"
                        />
                      </div>

                      {/* 文本框边框和上面的 toolbar 拼成一块 */}
                      <Input.TextArea
                        placeholder="Lifecycle description"
                        rows={4}
                        defaultValue="Lifecycle description"
                        className="mb-2 rounded-t-none border-t-0"
                      />

                      <div className="flex gap-4 text-sm">
                        <span className="text-blue-600 cursor-pointer hover:underline">
                          Hide markdown controls
                        </span>
                        <span className="text-blue-600 cursor-pointer hover:underline">
                          Markdown instructions
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>


              {/* Retention Policy */}
              <div className="border-b border-gray-200">
                <div
                  className="py-4 flex items-start justify-between hover:bg-gray-50 cursor-pointer px-4"
                  onClick={() => toggleSection('retentionPolicy')}
                >
                  <div className="font-semibold text-gray-700 w-48">Retention Policy</div>
                  <div className="flex-1 text-gray-600">
                    {expandedSections.retentionPolicy
                      ? 'Change the retention policy.'
                      : selectedLifecycle.retentionPolicy}
                  </div>
                  {expandedSections.retentionPolicy ? (
                    <UpOutlined className="text-blue-600 text-xs mt-1" />
                  ) : (
                    <DownOutlined className="text-blue-600 text-xs mt-1" />
                  )}
                </div>

                {expandedSections.retentionPolicy && (
                  <div className="px-4 pb-4 bg-white">
                    {/* 同样右移，与上面右侧对齐 */}
                    <div className="ml-48 pl-8 text-sm text-gray-700 space-y-6">
                      <div>
                        <div className="mb-2">How long should we keep releases?</div>
                        <Radio.Group
                          defaultValue="keepAllReleases"
                          className="flex flex-col space-y-1"
                        >
                          <Radio value="keepAllReleases">Keep all (default)</Radio>
                          <Radio value="keepLimitedReleases">Keep a limited number</Radio>
                        </Radio.Group>
                      </div>

                      <div>
                        <div className="mb-2">
                          How long should we keep extracted packages and files on disk on
                          Tentacles?
                        </div>
                        <Radio.Group
                          defaultValue="keepAllFiles"
                          className="flex flex-col space-y-1"
                        >
                          <Radio value="keepAllFiles">Keep all (default)</Radio>
                          <Radio value="keepLimitedFiles">Keep a limited number</Radio>
                        </Radio.Group>
                      </div>

                      <div className="text-xs text-gray-500 leading-relaxed">
                        Retention policies dictate how long releases and deployments are kept
                        for. For more information please see{' '}
                        <span className="text-blue-600 cursor-pointer hover:underline">
                          retention policies
                        </span>{' '}
                        documentation.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Phases */}
              <div className="border-b border-gray-200 py-4 px-4">
                <div className="font-semibold text-gray-700 mb-2">Phases</div>
                <div className="text-gray-600 mb-4">
                  Projects that use this lifecycle can only be deployed according to the phases
                  below.
                </div>

                {selectedLifecycle.phases.map((phase, index) => (
                  <div key={index} className="border-b border-gray-200 last:border-b-0">
                    <div
                      className="py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                      onClick={() => togglePhase(index)}
                    >
                      <div className="font-semibold text-gray-700 w-48">Phase {index + 1}</div>
                      <div className="flex-1 text-gray-600">
                        {expandedSections.phases[index]
                          ? 'Please enter phase details'
                          : phase.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
                          <Button
                            icon={<MoreOutlined />}
                            type="text"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Dropdown>
                        {expandedSections.phases[index] ? (
                          <UpOutlined className="text-blue-600 text-xs" />
                        ) : (
                          <DownOutlined className="text-blue-600 text-xs" />
                        )}
                      </div>
                    </div>
                    {expandedSections.phases[index] && (
                      <div className="px-4 pb-4 bg-gray-50 space-y-4">
                        <div>
                          <div className="text-sm font-medium mb-2">Phase name</div>
                          <Input defaultValue={phase.name} />
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-2">Environments</div>
                          <Button type="primary" ghost className="mb-2">
                            Add Environment
                          </Button>
                          <div className="flex items-center justify-between p-2 bg-white border border-gray-300 rounded">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block bg-gray-400"
                                style={{ width: '12px', height: '12px', borderRadius: '2px' }}
                              ></span>
                              <span>{phase.name}</span>
                            </div>
                            <Button type="text" danger size="small">
                              ×
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-2">Required to progress</div>
                          <Radio.Group defaultValue="all">
                            <div className="space-y-2">
                              <Radio value="all">All must complete (default)</Radio>
                              <Radio value="minimum">
                                A minimum of <Input style={{ width: 60 }} defaultValue="1" /> must
                                complete
                              </Radio>
                              <Radio value="optional">Optional phase</Radio>
                            </div>
                          </Radio.Group>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-2">
                            Retention policy (inherited)
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            Releases: Keep all. Files on Tentacle: Keep all.
                          </div>
                          <Button type="primary" ghost size="small">
                            Override retention policy
                          </Button>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-2">Phase priority</div>
                          <Alert
                            message="Early Access"
                            description={
                              <span>
                                This feature is still in development and may be removed pending
                                feedback. We'd love to hear{' '}
                                <span className="text-blue-600 cursor-pointer hover:underline">
                                  your feedback
                                </span>{' '}
                                after using the Priority Deployments feature.
                              </span>
                            }
                            type="warning"
                            showIcon
                            className="mb-2"
                          />
                          <Checkbox>Priority</Checkbox>
                          <div className="text-sm text-gray-600 mt-2">
                            Deployments will be prioritized in this phase according to{' '}
                            <span className="text-blue-600 cursor-pointer hover:underline">
                              phase priority
                            </span>
                            .
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lifecycle Preview */}
            <div className="mt-8">
              <div className="bg-gray-50 py-3 px-4 font-semibold text-gray-700 border-b border-gray-200">
                Lifecycle Preview
              </div>
              <div className="bg-white p-6 border border-gray-200">
                {selectedLifecycle.phases.map((phase, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block bg-gray-400"
                      style={{ width: '12px', height: '12px', borderRadius: '2px' }}
                    ></span>
                    <span className="text-gray-700">{phase.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Usage Tab Content */}
        {activeTab === 'usage' && (
          <div className="space-y-0">
            <div className="border-b border-gray-200">
              <div className="py-4 flex items-center justify-between hover:bg-gray-50 px-4">
                <div className="font-semibold text-gray-700 w-48">Projects</div>
                <div className="flex-1 text-gray-600">
                  This lifecycle is being used in {selectedLifecycle.projectCount || 0} projects
                </div>
                <DownOutlined className="text-blue-600 text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 默认显示列表页
  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">Lifecycles</h1>

      {/* 搜索框 */}
      <div className="mb-6">
        <Input
          placeholder="Filter by name or phase name..."
          suffix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-md"
          allowClear
        />
      </div>

      {/* 生命周期列表 */}
      <div className="space-y-4">
        {filteredData.map((lifecycle) => (
          <div
            key={lifecycle.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleLifecycleClick(lifecycle)}
          >
            <h3 className="text-blue-600 text-lg font-medium mb-2 hover:text-blue-800">
              {lifecycle.name}
            </h3>

            {lifecycle.description && (
              <p className="text-gray-600 text-sm mb-3">{lifecycle.description}</p>
            )}

            {lifecycle.phases.length > 0 && (
              <div className="mt-3">
                {lifecycle.phases.map((phase, index) =>
                  renderPhaseWithLine(phase, index, lifecycle.phases.length)
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Lifecycles;
