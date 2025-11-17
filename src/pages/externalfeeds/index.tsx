import React, { useState } from 'react';
import { Input, Table } from 'antd';
import { SearchOutlined, LinkOutlined } from '@ant-design/icons';

const ExternalFeeds = () => {
  const [searchText, setSearchText] = useState('');

  // 模拟数据
  const dataSource = [
    {
      key: '1',
      name: 'Yamimeal ACR',
      url: 'https://yamimeal.azurecr.io',
    },
    {
      key: '2',
      name: 'Alibaba Cloud',
      url: 'https://registry.cn-hongkong.aliyuncs.com/wiltechs',
    },
    {
      key: '3',
      name: 'Docker Hub Registry',
      url: 'https://index.docker.io',
    },
    {
      key: '4',
      name: 'test',
      url: 'https://index.docker.io',
    },
    {
      key: '5',
      name: 'EasyPOS ACR',
      url: 'https://easypos.azurecr.io',
    },
    {
      key: '6',
      name: 'nuget',
      url: 'https://api.nuget.org/v3/index.json',
    },
    {
      key: '7',
      name: 'Hongkong Aliyuncs Hub',
      url: 'https://registry.cn-hongkong.aliyuncs.com/',
    },
    {
      key: '8',
      name: 'OmegoDev Test',
      url: 'https://index.docker.io',
    },
    {
      key: '9',
      name: 'Github Repository',
      url: 'https://ghcr.io',
    },
    {
      key: '10',
      name: 'PickGoGo ACR',
      url: 'https://pickgogo.azurecr.io',
    },
    {
      key: '11',
      name: 'Docker Registry',
      url: 'https://registry-1.docker.io',
    },
  ];

  // 过滤数据
  const filteredData = dataSource.filter(item =>
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
        title: '文档',
        dataIndex: 'docUrl',
        key: 'docUrl',
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

  return (
    <div className="p-6 bg-white">
      {/* 标题 */}
      <h1 className="text-2xl font-semibold mb-6">External Feeds</h1>

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
      <Table
        dataSource={filteredData}
        columns={columns}
        pagination={false}
        bordered
        className="border border-gray-200"
      />
    </div>
  );
};

export default ExternalFeeds;
