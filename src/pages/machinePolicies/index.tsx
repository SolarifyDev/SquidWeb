import React, { useState } from 'react';
import { Input, Tag, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const MachinePolicies = () => {
  const [searchText, setSearchText] = useState('');

  const policyData = [
    { key: 'Health check interval', value: 'Automatically performs health checks every 1 hour' },
    { key: 'Health check type', value: 'Run health check scripts' },
    { key: 'PowerShell health check script', value: 'Uses custom script' },
    { key: 'Bash health check script', value: 'Uses custom script' },
    { key: 'Machine connectivity', value: 'Fails when a deployment target is unavailable' },
    { key: 'Calamari Machine updates', value: 'Automatically update when a deployment target is involved in a deployment' },
    { key: 'Tentacle Machine updates', value: 'Manually - from Deployment Targets' },
    { key: 'Kubernetes Agent updates', value: 'Automatically' },
    { key: 'Clean up', value: 'Does not delete deployment targets automatically' },
    { key: 'Recover from Communication Errors with Tentacle', value: 'Enabled' },
  ];

  return (
    <div className="bg-white p-6 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">Machine Policies</h1>
      
      <div className="mb-6">
        <Input
          placeholder="Filter by name..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="border rounded-lg p-6">
        <div className="mb-4">
          <a href="#" className="text-blue-600 text-lg font-medium hover:underline">
            Default Machine Policy
          </a>
          <Tag color="default" className="ml-2">default</Tag>
        </div>

        <p className="text-gray-600 mb-6">
          This policy is automatically applied to machines that are created when no policy is specified. 
          Any other machine policies will inherit this policy's custom health check scripts unless they specify their own.
        </p>

        <div className="space-y-3">
          {policyData.map((item) => (
            <div key={item.key} className="grid grid-cols-2 gap-4">
              <div className="font-medium text-gray-700">{item.key}</div>
              <div className="text-gray-600">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MachinePolicies;