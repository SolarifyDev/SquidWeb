import React, { useState } from 'react';
import { Input, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const MachinePolicies = () => {
  const [searchValue, setSearchValue] = useState<string>('');

  const policyDetails = [
    { label: 'Health check interval', value: 'Automatically performs health checks every 1 hour' },
    { label: 'Health check type', value: 'Run health check scripts' },
    { label: 'PowerShell health check script', value: 'Uses custom script' },
    { label: 'Bash health check script', value: 'Uses custom script' },
    { label: 'Machine connectivity', value: 'Fails when a deployment target is unavailable' },
    { label: 'Calamari Machine updates', value: 'Automatically update when a deployment target is involved in a deployment' },
    { label: 'Tentacle Machine updates', value: 'Manually - from Deployment Targets' },
    { label: 'Kubernetes Agent updates', value: 'Automatically' },
    { label: 'Clean up', value: 'Does not delete deployment targets automatically' },
    { label: 'Recover from Communication Errors with Tentacle', value: 'Enabled' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Machine Policies
        </h1>

        {/* Search Input */}
        <div className="mb-8">
          <Input
            placeholder="Filter by name..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="max-w-md"
            size="large"
          />
        </div>

        {/* Policy Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          {/* Policy Title */}
          <div className="flex items-center gap-3 mb-4">
            <a 
              href="#" 
              className="text-lg font-medium text-blue-600 hover:text-blue-700"
            >
              Default Machine Policy
            </a>
            <Tag className="bg-gray-100 text-gray-700 border-gray-300">
              default
            </Tag>
          </div>

          {/* Policy Description */}
          <p className="text-sm text-gray-600 mb-6">
            This policy is automatically applied to machines that are created when no policy is specified. 
            Any other machine policies will inherit this policy's custom health check scripts unless they specify their own.
          </p>

          {/* Policy Details */}
          <div className="space-y-3">
            {policyDetails.map((item, index) => (
              <div 
                key={index} 
                className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">
                  {item.label}
                </div>
                <div className="text-sm text-gray-700">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachinePolicies;
