import React, { useState } from 'react';
import { 
  Button, 
  Tabs, 
  Select, 
  Table, 
  Typography,
  Checkbox,
  Modal,
  Radio,
  Collapse,
  Space,
  Input
} from 'antd';
import { 
  CheckCircleFilled,
  SyncOutlined,
  FilterOutlined,
  CloseOutlined,
  DownOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  ExpandOutlined,
  SettingOutlined
} from '@ant-design/icons';
import type { TabsProps, TableColumnsType } from 'antd';

const { Title, Text, Link } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface TaskData {
  key: string;
  state: 'Executing' | 'Success' | 'Failed' | 'Waiting' | 'Canceled' | 'Cancelling' | 'Completed' | 'Incomplete' | 'Queued' | 'Running' | 'TimedOut' | 'Unsuccessful';
  taskName: string;
  taskDate: string;
  startTime: string;
  completedTime: string | null;
  duration: string;
}

const Tasks: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [taskState, setTaskState] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showScriptConsole, setShowScriptConsole] = useState(false);
  const [awaitingManual, setAwaitingManual] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(false);
  const [hasWarnings, setHasWarnings] = useState(false);
  const [space, setSpace] = useState('all');
  const [taskType, setTaskType] = useState('all');
  const [node, setNode] = useState('all');
  const [project, setProject] = useState('all');
  const [runbook, setRunbook] = useState('all');
  const [environment, setEnvironment] = useState('all');
  const [tenant, setTenant] = useState('all');
  const [dateField, setDateField] = useState('');
  
  // Script Console states
  const [targetType, setTargetType] = useState('individual');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [scriptLanguage, setScriptLanguage] = useState('PowerShell');
  const [scriptBody, setScriptBody] = useState('');

  const tasksData: TaskData[] = [];

  const renderStateCell = (state: string) => {
    if (state === 'Executing') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <SyncOutlined spin className="text-white text-base" />
          </div>
          <Text>Executing</Text>
        </div>
      );
    } else if (state === 'Success') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
            <CheckCircleFilled className="text-white text-base" />
          </div>
          <Text>Success</Text>
        </div>
      );
    }
    return <Text>{state}</Text>;
  };

  const renderTaskCell = (taskName: string, taskDate: string) => {
    return (
      <div className="flex flex-col gap-0.5">
        <Text className="text-sm text-gray-900 font-medium">{taskName}</Text>
        <Text className="text-xs text-gray-500">{taskDate}</Text>
      </div>
    );
  };

  const columns: TableColumnsType<TaskData> = [
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      width: 150,
      render: (state: string) => renderStateCell(state),
    },
    {
      title: 'Task',
      dataIndex: 'taskName',
      key: 'task',
      render: (taskName: string, record: TaskData) => renderTaskCell(taskName, record.taskDate),
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 300,
    },
    {
      title: 'Completed Time',
      dataIndex: 'completedTime',
      key: 'completedTime',
      width: 300,
      render: (time: string | null) => time || '-',
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 150,
    },
  ];

  const tabItems: TabsProps['items'] = [
    { key: 'all', label: 'All' },
    { key: 'running', label: 'Running (0)' },
    { key: 'waiting', label: 'Waiting (0)' },
    { key: 'needsApproval', label: 'Needs Approval (0)' },
    { key: 'completed', label: 'Completed' },
  ];

  const taskStateOptions = [
    { value: 'all', label: 'All task states' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'cancelling', label: 'Cancelling' },
    { value: 'completed', label: 'Completed' },
    { value: 'executing', label: 'Executing' },
    { value: 'failed', label: 'Failed' },
    { value: 'incomplete', label: 'Incomplete' },
    { value: 'queued', label: 'Queued' },
    { value: 'running', label: 'Running' },
    { value: 'success', label: 'Success' },
    { value: 'timedout', label: 'TimedOut' },
    { value: 'unsuccessful', label: 'Unsuccessful' },
  ];

  const scriptLanguages = [
    { value: 'PowerShell', label: 'PowerShell' },
    { value: 'Bash', label: 'Bash' },
    { value: 'Python', label: 'Python' },
    { value: 'C#', label: 'C#' },
    { value: 'F#', label: 'F#' },
  ];

  const handleReset = () => {
    setAwaitingManual(false);
    setIncludeSystem(false);
    setHasWarnings(false);
    setSpace('all');
    setTaskType('all');
    setNode('all');
    setProject('all');
    setRunbook('all');
    setEnvironment('all');
    setTenant('all');
    setDateField('');
  };

  const handleRunScript = () => {
    console.log('Running script:', {
      targetType,
      selectedTargets,
      scriptLanguage,
      scriptBody
    });
    // Implement script execution logic
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(scriptBody);
  };

  const handleEnterFullscreen = () => {
    // Implement fullscreen logic
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">Tasks</Title>
        <Button 
          type="primary" 
          onClick={() => setShowScriptConsole(true)}
          className="!bg-green-700 hover:!bg-green-800 !border-green-700"
        >
          Script console
        </Button>
      </div>

      {/* Tabs */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
      />

      {/* Filter Section */}
      <div className="flex items-center gap-4 mb-4 mt-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Filter by task state</div>
          <Select
            value={taskState}
            onChange={setTaskState}
            options={taskStateOptions}
            className="w-50"
          />
        </div>
        <Link 
          className="mt-5"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <FilterOutlined /> {showAdvancedFilters ? 'Hide' : 'Show'} advanced filters
        </Link>
      </div>

      {/* Content Wrapper */}
      <div className="flex gap-6">
        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="w-70 border-2 border-red-500 rounded p-4 bg-white flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-base font-semibold text-gray-900">Advanced filter</span>
              <Button size="small" onClick={handleReset}>Reset</Button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <Checkbox 
                checked={awaitingManual} 
                onChange={(e) => setAwaitingManual(e.target.checked)}
              >
                Awaiting manual intervention
              </Checkbox>
              <Checkbox 
                checked={includeSystem} 
                onChange={(e) => setIncludeSystem(e.target.checked)}
              >
                Include system tasks
              </Checkbox>
              <Checkbox 
                checked={hasWarnings} 
                onChange={(e) => setHasWarnings(e.target.checked)}
              >
                Has warnings or errors
              </Checkbox>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded px-2 py-1 mb-4 w-fit">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs">
                  ⚙
                </span>
                Default
              </span>
              <CloseOutlined className="text-xs cursor-pointer" />
            </div>

            {[
              { label: 'By space', value: space, setter: setSpace, options: ['All spaces'] },
              { label: 'By task type', value: taskType, setter: setTaskType, options: ['All task types'] },
              { label: 'By node', value: node, setter: setNode, options: ['All nodes'] },
              { label: 'By project', value: project, setter: setProject, options: ['All projects'] },
              { label: 'By runbook', value: runbook, setter: setRunbook, options: ['All runbooks'] },
              { label: 'By environment', value: environment, setter: setEnvironment, options: ['All environments'] },
              { label: 'By tenant', value: tenant, setter: setTenant, options: ['All tenants'] },
            ].map((filter, index) => (
              <div key={index} className="mb-4">
                <label className="text-xs text-gray-500 mb-2 block">{filter.label}</label>
                <Select
                  value={filter.value}
                  onChange={filter.setter}
                  className="w-full"
                  suffixIcon={<DownOutlined />}
                >
                  {filter.options.map((opt) => (
                    <Select.Option key={opt} value="all">{opt}</Select.Option>
                  ))}
                </Select>
              </div>
            ))}

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-2 block">By date</label>
              <Select
                value={dateField}
                onChange={setDateField}
                placeholder="Select a date field"
                className="w-full"
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="startTime">Start Time</Select.Option>
                <Select.Option value="completedTime">Completed Time</Select.Option>
              </Select>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 min-w-0">
          <Table
            columns={columns}
            dataSource={tasksData}
            pagination={false}
            bordered={false}
          />
        </div>
      </div>

      {/* Script Console Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => setShowScriptConsole(false)}
              className="!p-1"
            />
            <span>Script Console</span>
          </div>
        }
        open={showScriptConsole}
        onCancel={() => setShowScriptConsole(false)}
        footer={
          <div className="flex justify-end">
            <Button 
              type="primary" 
              onClick={handleRunScript}
              className="!bg-green-600 hover:!bg-green-700"
            >
              Run now
            </Button>
          </div>
        }
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
        closeIcon={null}
      >
        <div className="space-y-4">
          {/* Description */}
          <div className="text-sm text-gray-600 pb-4 border-b border-gray-200">
            Use the Script Console to run one-off scripts remotely on deployment targets. Scripts run this way are not associated with projects or deployments.
          </div>

          {/* Targets Section */}
          <Collapse 
            defaultActiveKey={['targets']} 
            ghost
            expandIconPosition="end"
          >
            <Panel 
              header={
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Targets</span>
                  <span className="text-blue-500 text-sm">Select targets</span>
                </div>
              } 
              key="targets"
            >
              <div className="space-y-4 pt-2">
                <Radio.Group 
                  value={targetType} 
                  onChange={(e) => setTargetType(e.target.value)}
                  className="flex flex-col gap-3"
                >
                  <Radio value="individual">
                    <span className="text-sm">
                      Select individual <span className="italic">deployment targets</span> to run the script on <span className="text-gray-500">(default)</span>
                    </span>
                  </Radio>
                  <Radio value="environments">
                    <span className="text-sm">
                      Run the script on all deployment targets in set of environments, roles, and tenants
                    </span>
                  </Radio>
                  <Radio value="server">
                    <span className="text-sm">
                      Run the script on the Squid Server
                    </span>
                  </Radio>
                </Radio.Group>

                {targetType === 'individual' && (
                  <Select
                    mode="multiple"
                    placeholder="Select targets"
                    value={selectedTargets}
                    onChange={setSelectedTargets}
                    className="w-full"
                    suffixIcon={<DownOutlined />}
                  >
                    <Select.Option value="target1">Target 1</Select.Option>
                    <Select.Option value="target2">Target 2</Select.Option>
                  </Select>
                )}
              </div>
            </Panel>
          </Collapse>

          {/* Script Section */}
          <Collapse 
            defaultActiveKey={['script']} 
            ghost
            expandIconPosition="end"
          >
            <Panel 
              header={<span className="font-semibold">Script</span>} 
              key="script"
            >
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">Body</span>
                    <span className="text-xs text-gray-500">
                      Select the script language and enter the body of the script that will be executed.
                    </span>
                  </div>
                  
                  {/* Script Editor Toolbar */}
                  <div className="bg-gray-100 border border-gray-300 rounded-t px-3 py-2 flex items-center justify-between">
                    <Select
                      value={scriptLanguage}
                      onChange={setScriptLanguage}
                      options={scriptLanguages}
                      className="w-32"
                      size="small"
                      bordered={false}
                    />
                    <Space size="small">
                      <Button 
                        size="small" 
                        icon={<CopyOutlined />}
                        onClick={handleCopyToClipboard}
                      >
                        Copy to clipboard
                      </Button>
                      <Button 
                        size="small" 
                        icon={<ExpandOutlined />}
                        onClick={handleEnterFullscreen}
                      >
                        Enter full screen
                      </Button>
                      <Button 
                        size="small" 
                        icon={<SettingOutlined />}
                      />
                    </Space>
                  </div>

                  {/* Script Editor */}
                  <TextArea
                    value={scriptBody}
                    onChange={(e) => setScriptBody(e.target.value)}
                    placeholder="Type here..."
                    rows={12}
                    className="!rounded-t-none border-t-0 font-mono text-sm"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </Panel>
          </Collapse>
        </div>
      </Modal>
    </div>
  );
};

export default Tasks;