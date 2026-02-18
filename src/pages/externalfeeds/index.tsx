import React, { useState, useEffect } from 'react';
import { Input, Table, Button, Select, InputNumber, Checkbox, Collapse, Spin } from 'antd';
import { SearchOutlined, LinkOutlined, ArrowLeftOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { getExternalFeeds, ExternalFeedDto } from 'pages/apis/externalFeed';

const { Panel } = Collapse;
const { Password } = Input;

const ExternalFeeds = () => {
  const [searchText, setSearchText] = useState('');
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(['feedtype', 'name', 'url', 'retry', 'credentials', 'extended']);

  // 创建页面的表单状态
  const [feedType, setFeedType] = useState('NuGet Feed');
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [downloadAttempts, setDownloadAttempts] = useState(5);
  const [downloadRetryBackoff, setDownloadRetryBackoff] = useState(10);
  const [feedUsername, setFeedUsername] = useState('');
  const [feedPassword, setFeedPassword] = useState('');
  const [useExtendedAPI, setUseExtendedAPI] = useState(false);

  // Feed Type 选项
  const feedTypeOptions = [
    { value: 'NuGet Feed', label: 'NuGet Feed' },
    { value: 'Docker Container Registry', label: 'Docker Container Registry' },
    { value: 'Maven Feed', label: 'Maven Feed' },
    { value: 'GitHub Container Registry', label: 'GitHub Container Registry' },
    { value: 'Helm Feed', label: 'Helm Feed' },
    { value: 'AWS ECR Feed', label: 'AWS ECR Feed' },
  ];

  // API 数据
  const [feeds, setFeeds] = useState<ExternalFeedDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getExternalFeeds()
      .then((res) => setFeeds(res.externalFeeds))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dataSource = feeds.map((f) => ({
    key: String(f.id),
    name: f.name,
    url: f.feedUri,
  }));

  // 过滤数据
  const filteredData = dataSource.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 表格列定义
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (text: string) => (
        <a
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          {text}
          <LinkOutlined className="text-xs" />
        </a>
      ),
    },
  ];

  // 添加切换所有面板的函数
  const toggleAllPanels = () => {
    if (activeKeys.length > 0) {
      setActiveKeys([]);
    } else {
      setActiveKeys(['feedtype', 'name', 'url', 'retry', 'credentials', 'extended']);
    }
  };

  // 保存
  const handleSave = () => {
    console.log('Save Feed:', {
      feedType,
      feedName,
      feedUrl,
      downloadAttempts,
      downloadRetryBackoff,
      feedUsername,
      feedPassword,
      useExtendedAPI,
    });
    setShowCreatePage(false);
    resetForm();
  };

  // 保存并测试
  const handleSaveAndTest = () => {
    console.log('Save and Test Feed:', {
      feedType,
      feedName,
      feedUrl,
      downloadAttempts,
      downloadRetryBackoff,
      feedUsername,
      feedPassword,
      useExtendedAPI,
    });
    setShowCreatePage(false);
    resetForm();
  };

  // 重置表单
  const resetForm = () => {
    setFeedType('NuGet Feed');
    setFeedName('');
    setFeedUrl('');
    setDownloadAttempts(5);
    setDownloadRetryBackoff(10);
    setFeedUsername('');
    setFeedPassword('');
    setUseExtendedAPI(false);
  };

  // 如果显示创建页面
  if (showCreatePage) {
    return (
      <div className="min-h-screen bg-white">
        {/* 顶部导航栏 */}
        <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="px-6 py-4">
            {/* 返回链接 */}
            <button
              onClick={() => {
                setShowCreatePage(false);
                resetForm();
              }}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4 bg-transparent border-0 cursor-pointer"
            >
              <ArrowLeftOutlined />
              <span>External Feeds</span>
            </button>

            {/* 标题和按钮 */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Create Feed</h1>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveAndTest} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                  Save and test
                </Button>
                <Button onClick={handleSave} className="border-gray-300 text-gray-700 hover:bg-gray-50">
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 表单内容区域 */}
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* COLLAPSE ALL / EXPAND ALL 按钮 */}
          <div className="flex justify-end mb-4">
            <span 
              className="text-gray-600 text-xs uppercase cursor-pointer hover:underline font-semibold"
              onClick={toggleAllPanels}
            >
              {activeKeys.length > 0 ? 'COLLAPSE ALL' : 'EXPAND ALL'}
            </span>
          </div>
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            expandIconPosition="end"
            ghost
            className="bg-white"
          >
            {/* Feed Type */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Feed Type</div>
                    <div className="text-sm text-gray-600">Select the type of the feed.</div>
                  </div>
                </div>
              }
              key="feedtype"
              className="border-b"
            >
              <div className="px-4 pb-6">
                <div className="mb-2">
                  <label className="block text-sm text-gray-700 mb-2">Feed type</label>
                  <Select
                    value={feedType}
                    onChange={(value) => setFeedType(value)}
                    className="w-full"
                    size="large"
                    options={feedTypeOptions}
                  />
                </div>
              </div>
            </Panel>

            {/* Name */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Name</div>
                    <div className="text-sm text-gray-600">Enter a name for the external feed.</div>
                  </div>
                </div>
              }
              key="name"
              className="border-b"
            >
              <div className="px-4 pb-6">
                <div className="mb-2">
                  <Input
                    placeholder="Feed name"
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    className="mb-2"
                    size="large"
                  />
                  <div className="text-xs text-gray-500">
                    A short, memorable, unique name for this feed. Example: ACME Builds.
                  </div>
                </div>
              </div>
            </Panel>

            {/* URL */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">URL</div>
                    <div className="text-sm text-gray-600">Provide the location of the feed.</div>
                  </div>
                </div>
              }
              key="url"
              className="border-b"
            >
              <div className="px-4 pb-6">
                <div className="mb-2">
                  <Input
                    placeholder="Feed url"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    className="mb-2"
                    size="large"
                  />
                  <div className="text-xs text-gray-500">The feed url can be a url or a folder path.</div>
                </div>
              </div>
            </Panel>

            {/* Retry Attempts */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Retry Attempts</div>
                    <div className="text-sm text-gray-600">Control how Squid should deal with feed errors.</div>
                  </div>
                </div>
              }
              key="retry"
              className="border-b"
            >
              <div className="px-4 pb-6">
                <div className="mb-4">
                  <label className="block text-sm text-gray-700 mb-2">Download attempts (attempts)</label>
                  <InputNumber
                    value={downloadAttempts}
                    onChange={(value) => setDownloadAttempts(value || 5)}
                    className="w-full mb-2"
                    min={1}
                    size="large"
                  />
                  <div className="text-xs text-gray-500">
                    The number of times a deployment should attempt to download a package from this feed before
                    failing.
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-700 mb-2">Download retry backoff (seconds)</label>
                  <InputNumber
                    value={downloadRetryBackoff}
                    onChange={(value) => setDownloadRetryBackoff(value || 10)}
                    className="w-full mb-2"
                    min={1}
                    size="large"
                  />
                  <div className="text-xs text-gray-500">
                    The number of seconds to apply as a linear back off between download attempts.
                  </div>
                </div>
              </div>
            </Panel>

            {/* Credentials */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Credentials</div>
                    <div className="text-sm text-gray-600">
                      Leave the following blank if your feed does not require authentication.
                    </div>
                  </div>
                </div>
              }
              key="credentials"
              className="border-b"
            >
              <div className="px-4 pb-6">
                <div className="mb-4">
                  <Input
                    placeholder="Feed username"
                    value={feedUsername}
                    onChange={(e) => setFeedUsername(e.target.value)}
                    className="mb-4"
                    size="large"
                  />
                </div>

                <div className="mb-4">
                  <Password
                    placeholder="Feed password"
                    value={feedPassword}
                    onChange={(e) => setFeedPassword(e.target.value)}
                    size="large"
                  />
                </div>
              </div>
            </Panel>

            {/* Extended API */}
            <Panel
              header={
                <div className="flex items-start justify-between w-full pr-4">
                  <div className="flex-1">
                    <div className="font-semibold text-base">Extended API</div>
                  </div>
                </div>
              }
              key="extended"
            >
              <div className="px-4 pb-6">
                <Checkbox checked={useExtendedAPI} onChange={(e) => setUseExtendedAPI(e.target.checked)}>
                  Make use of the extended API
                </Checkbox>
                <div className="text-xs text-gray-500 mt-2">
                  This will improve performance of the NuGet feed but may not be supported by some older feeds.
                  Disable if Create Release does not return the latest version for a package.
                </div>
              </div>
            </Panel>
          </Collapse>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white">
      {/* 标题和按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">External Feeds</h1>
        <Button
          type="primary"
          onClick={() => setShowCreatePage(true)}
          className="!bg-green-700 hover:!bg-green-800 !border-green-700 font-medium"
        >
          Add Feed
        </Button>
      </div>

      {/* 搜索框 */}
      <div className="mb-6">
        <Input
          placeholder="Filter by name..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-xs"
          allowClear
        />
      </div>

      {/* 表格 */}
      <Spin spinning={loading}>
        <Table dataSource={filteredData} columns={columns} pagination={false} bordered className="border border-gray-200" />
      </Spin>
    </div>
  );
};

export default ExternalFeeds;
