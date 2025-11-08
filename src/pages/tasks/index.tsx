import React, { useState, CSSProperties } from 'react';
import { 
  Button, 
  Tabs, 
  Select, 
  Table, 
  Typography,
  Checkbox,
  Tag,
  Space
} from 'antd';
import { 
  CheckCircleFilled,
  SyncOutlined,
  FilterOutlined,
  CloseOutlined,
  DownOutlined
} from '@ant-design/icons';
import type { TabsProps, TableColumnsType } from 'antd';

const { Title, Text, Link } = Typography;

interface TaskData {
  key: string;
  state: 'Executing' | 'Success' | 'Failed' | 'Waiting' | 'Canceled' | 'Cancelling' | 'Completed' | 'Incomplete' | 'Queued' | 'Running' | 'TimedOut' | 'Unsuccessful';
  taskName: string;
  taskDate: string;
  startTime: string;
  completedTime: string | null;
  duration: string;
}

// 样式对象
const styles: { [key: string]: CSSProperties } = {
  container: {
    padding: '24px',
    backgroundColor: '#fff',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  filterSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
    marginTop: '16px',
  },
  filterLabel: {
    fontSize: '12px',
    color: '#8c8c8c',
    marginBottom: '4px',
  },
  contentWrapper: {
    display: 'flex',
    gap: '24px',
  },
  advancedFilterPanel: {
    width: '280px',
    border: '2px solid #ff4d4f',
    borderRadius: '4px',
    padding: '16px',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  advancedFilterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  advancedFilterTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#262626',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  filterItem: {
    marginBottom: '16px',
  },
  filterItemLabel: {
    fontSize: '12px',
    color: '#8c8c8c',
    marginBottom: '8px',
    display: 'block',
  },
  tableWrapper: {
    flex: 1,
    minWidth: 0,
  },
  stateCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  taskInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  taskName: {
    fontSize: '14px',
    color: '#262626',
    fontWeight: 500,
  },
  taskDate: {
    fontSize: '12px',
    color: '#8c8c8c',
  },
  defaultTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '16px',
    width: 'fit-content',
  },
};

const Tasks: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [taskState, setTaskState] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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

  // 模拟数据
  const tasksData: TaskData[] = [
    {
      key: '1',
      state: 'Executing',
      taskName: 'Deploy Customer Intention in MTR release 0.0.7 to TEST',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 3:28 PM +08:00',
      completedTime: 'Friday, November 7, 2025 3:29 PM +08:00',
      duration: '1 minute',
    },
    {
      key: '2',
      state: 'Success',
      taskName: 'Deploy Smarties.Api release 6.0.1-mixture-v6.1-3550 to TEST',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 3:24 PM +08:00',
      completedTime: 'Friday, November 7, 2025 3:27 PM +08:00',
      duration: '2 minutes',
    },
    {
      key: '3',
      state: 'Success',
      taskName: 'Check target health for Default Machine Policy',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 3:22 PM +08:00',
      completedTime: 'Friday, November 7, 2025 3:22 PM +08:00',
      duration: '2 seconds',
    },
    {
      key: '4',
      state: 'Success',
      taskName: 'Deploy SmartTalk.Api release 2.4.6-mixture-v6.1-1537 to TEST',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 2:22 PM +08:00',
      completedTime: 'Friday, November 7, 2025 2:22 PM +08:00',
      duration: '51 seconds',
    },
    {
      key: '5',
      state: 'Success',
      taskName: 'Check target health for Default Machine Policy',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 2:22 PM +08:00',
      completedTime: 'Friday, November 7, 2025 2:22 PM +08:00',
      duration: '4 seconds',
    },
    {
      key: '6',
      state: 'Success',
      taskName: 'Deploy SmartTalk.Api release 2.4.6-mixture-v6.1-1537 to TEST',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 2:08 PM +08:00',
      completedTime: 'Friday, November 7, 2025 2:08 PM +08:00',
      duration: '42 seconds',
    },
    {
      key: '7',
      state: 'Success',
      taskName: 'Check target health for Default Machine Policy',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 1:22 PM +08:00',
      completedTime: 'Friday, November 7, 2025 1:22 PM +08:00',
      duration: '2 seconds',
    },
    {
      key: '8',
      state: 'Success',
      taskName: 'Check target health for Default Machine Policy',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 12:22 PM +08:00',
      completedTime: 'Friday, November 7, 2025 12:22 PM +08:00',
      duration: '2 seconds',
    },
    {
      key: '9',
      state: 'Success',
      taskName: 'Apply retention policies',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 11:00 AM +08:00',
      completedTime: 'Friday, November 7, 2025 11:01 AM +08:00',
      duration: '1 minute',
    },
    {
      key: '10',
      state: 'Success',
      taskName: 'Deploy Hi200Go Api release 2025.8.16-all-in-one-2025-10-31.1-360 to TEST',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 10:30 AM +08:00',
      completedTime: 'Friday, November 7, 2025 10:35 AM +08:00',
      duration: '5 minutes',
    },
    {
      key: '11',
      state: 'Success',
      taskName: 'Process recurring scheduled triggers',
      taskDate: 'November 7th 2025',
      startTime: 'Friday, November 7, 2025 10:00 AM +08:00',
      completedTime: 'Friday, November 7, 2025 10:00 AM +08:00',
      duration: '30 seconds',
    },
  ];

  const renderStateCell = (state: string) => {
    if (state === 'Executing') {
      return (
        <div style={styles.stateCell}>
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <SyncOutlined spin style={{ color: '#fff', fontSize: '16px' }} />
          </div>
          <Text>Executing</Text>
        </div>
      );
    } else if (state === 'Success') {
      return (
        <div style={styles.stateCell}>
          <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
            <CheckCircleFilled style={{ color: '#fff', fontSize: '16px' }} />
          </div>
          <Text>Success</Text>
        </div>
      );
    }
    return <Text>{state}</Text>;
  };

  const renderTaskCell = (taskName: string, taskDate: string) => {
    return (
      <div style={styles.taskInfo}>
        <Text style={styles.taskName}>{taskName}</Text>
        <Text style={styles.taskDate}>{taskDate}</Text>
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
    {
      key: 'all',
      label: 'All',
    },
    {
      key: 'running',
      label: 'Running (0)',
    },
    {
      key: 'waiting',
      label: 'Waiting (0)',
    },
    {
      key: 'needsApproval',
      label: 'Needs Approval (0)',
    },
    {
      key: 'completed',
      label: 'Completed',
    },
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Title level={3} style={{ margin: 0 }}>Tasks</Title>
        <Button 
          type="primary" 
          style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}
        >
          Script console
        </Button>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
      />

      <div style={styles.filterSection}>
        <div>
          <div style={styles.filterLabel}>Filter by task state</div>
          <Select
            value={taskState}
            onChange={setTaskState}
            options={taskStateOptions}
            style={{ width: 200 }}
          />
        </div>
        <Link 
          style={{ marginTop: '20px' }}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <FilterOutlined /> {showAdvancedFilters ? 'Hide' : 'Show'} advanced filters
        </Link>
      </div>

      <div style={styles.contentWrapper}>
        {showAdvancedFilters && (
          <div style={styles.advancedFilterPanel}>
            <div style={styles.advancedFilterHeader}>
              <span style={styles.advancedFilterTitle}>Advanced filter</span>
              <Button size="small" onClick={handleReset}>Reset</Button>
            </div>

            <div style={styles.checkboxGroup}>
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

            <div style={styles.defaultTag}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '50%', 
                  backgroundColor: '#8c8c8c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#fff'
                }}>
                  ⚙
                </span>
                Default
              </span>
              <CloseOutlined style={{ fontSize: '10px', cursor: 'pointer' }} />
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By space</label>
              <Select
                value={space}
                onChange={setSpace}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All spaces</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By task type</label>
              <Select
                value={taskType}
                onChange={setTaskType}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All task types</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By node</label>
              <Select
                value={node}
                onChange={setNode}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All nodes</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By project</label>
              <Select
                value={project}
                onChange={setProject}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All projects</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By runbook</label>
              <Select
                value={runbook}
                onChange={setRunbook}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All runbooks</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By environment</label>
              <Select
                value={environment}
                onChange={setEnvironment}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All environments</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By tenant</label>
              <Select
                value={tenant}
                onChange={setTenant}
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="all">All tenants</Select.Option>
              </Select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterItemLabel}>By date</label>
              <Select
                value={dateField}
                onChange={setDateField}
                placeholder="Select a date field"
                style={{ width: '100%' }}
                suffixIcon={<DownOutlined />}
              >
                <Select.Option value="startTime">Start Time</Select.Option>
                <Select.Option value="completedTime">Completed Time</Select.Option>
              </Select>
            </div>
          </div>
        )}

        <div style={styles.tableWrapper}>
          <Table
            columns={columns}
            dataSource={tasksData}
            pagination={false}
            bordered={false}
          />
        </div>
      </div>
    </div>
  );
};

export default Tasks;