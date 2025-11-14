import React, { useState } from 'react';
import { 
  Button, 
  Input, 
  Dropdown, 
  Space, 
  Table, 
  Badge, 
  Typography,
  Tooltip,
  Menu,
  Modal,
  Radio,
  Select,
  Steps,
  Upload,
  message
} from 'antd';
import type { UploadProps, MenuProps, TableColumnsType } from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  DownOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ProjectOutlined,
  ReloadOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';

const { Title, Text, Link } = Typography;
const { TextArea } = Input;

interface DeploymentInfo {
  version: string;
  timestamp: string;
  status: 'success' | 'failed' | 'none';
}

interface ProjectData {
  key: string;
  name: string;
  dev: DeploymentInfo | null;
  test: DeploymentInfo | null;
  uat: DeploymentInfo | null;
  prd: DeploymentInfo | null;
}

interface ProjectGroup {
  name: string;
  count: number;
  projects: ProjectData[];
}

import { useNavigate } from "react-router-dom";

const Project: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [projectGroups, setProjectGroups] = useState('all');
  const [projects, setProjects] = useState('all');
  const [environments, setEnvironments] = useState('all');
  const [tenants, setTenants] = useState('all');
  
  // Add Project form states
  const [projectName, setProjectName] = useState('');
  const [storageLocation, setStorageLocation] = useState('octopus');
  const [deployTarget, setDeployTarget] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedProjectGroup, setSelectedProjectGroup] = useState('all-projects');
  const [selectedLifecycle, setSelectedLifecycle] = useState('.NET TEST PRD');
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [projectIcon, setProjectIcon] = useState<string | null>(null);
  
  const totalProjects = 399;

  const navigate = useNavigate();

  // 模拟数据
  const projectGroupsData: ProjectGroup[] = [
    {
      name: '.NET A TEAM',
      count: 12,
      projects: [
        {
          key: '1',
          name: 'FoundationNew',
          dev: null,
          test: {
            version: '2.2.0-addPagingF...',
            timestamp: 'Apr 10, 2024 3:55 PM',
            status: 'success'
          },
          uat: {
            version: '2.2.0-addPagingF...',
            timestamp: 'Apr 29, 2024 2:32 PM',
            status: 'failed'
          },
          prd: {
            version: '2.2.0--4185.1+598',
            timestamp: 'Jan 22, 2024 4:20 PM',
            status: 'success'
          }
        },
        {
          key: '2',
          name: 'HrTicketingSystem',
          dev: null,
          test: {
            version: '2.4.13-mixture-no...',
            timestamp: 'Dec 13, 2024 2:15 PM',
            status: 'success'
          },
          uat: {
            version: '2.4.13-mixture-no...',
            timestamp: 'Dec 12, 2024 9:07 AM',
            status: 'success'
          },
          prd: null
        },
        {
          key: '3',
          name: 'HrTicketingSystem_Dotnet Core',
          dev: null,
          test: {
            version: '2.5.0-upgrade-to...',
            timestamp: 'Oct 16, 2024 11:06 AM',
            status: 'failed'
          },
          uat: {
            version: '2.5.0-upgrade-to...',
            timestamp: 'Dec 12, 2024 9:16 AM',
            status: 'success'
          },
          prd: null
        },
        {
          key: '4',
          name: 'IsTicketingSystem',
          dev: null,
          test: {
            version: '2.1.8-synchronize...',
            timestamp: 'Dec 16, 2024 2:48 PM',
            status: 'success'
          },
          uat: null,
          prd: null
        },
        {
          key: '5',
          name: 'IsTicketingSystem_DotnetCore',
          dev: null,
          test: {
            version: '2.1.4-upgrade-to-...',
            timestamp: 'Oct 9, 2024 6:23 PM',
            status: 'success'
          },
          uat: {
            version: '2.1.4-upgrade-to-...',
            timestamp: 'Dec 2, 2024 10:57 AM',
            status: 'success'
          },
          prd: null
        },
        {
          key: '6',
          name: 'JustIM',
          dev: null,
          test: {
            version: '5.5.1-mixture-no-...',
            timestamp: 'Dec 17, 2024 5:35 PM',
            status: 'success'
          },
          uat: {
            version: '5.5.1-mixture-no-...',
            timestamp: 'Dec 13, 2024 8:44 AM',
            status: 'success'
          },
          prd: null
        }
      ]
    }
  ];

  const importExportItems: MenuProps['items'] = [
    {
      key: '1',
      label: 'Import Projects',
    },
    {
      key: '2',
      label: 'Export Projects',
    },
  ];

  const pageSizeMenu = (
    <Menu
      className="min-w-[180px]"
      items={[
        {
          key: 'header',
          label: (
            <div className="font-semibold text-gray-900 py-1 cursor-default">
              Projects per page
            </div>
          ),
          disabled: true,
        },
        {
          key: '50',
          label: '50',
          onClick: () => {
            setPageSize(50);
            setCurrentPage(1);
          },
        },
        {
          key: '100',
          label: '100',
          onClick: () => {
            setPageSize(100);
            setCurrentPage(1);
          },
        },
        {
          key: '150',
          label: '150',
          onClick: () => {
            setPageSize(150);
            setCurrentPage(1);
          },
        },
      ]}
    />
  );

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalProjects);

  const handleSaveFilters = () => {
    console.log('Filters saved:', { projectGroups, projects, environments, tenants });
    setShowFiltersModal(false);
  };

  const handleCancelFilters = () => {
    setShowFiltersModal(false);
  };

  const handleCreateProject = () => {
    console.log('Creating project:', {
      projectName,
      storageLocation,
      deployTarget,
      projectDescription,
      selectedProjectGroup,
      selectedLifecycle,
      projectIcon
    });
    setShowAddProjectModal(false);
    // Reset form
    setProjectName('');
    setStorageLocation('octopus');
    setDeployTarget('');
    setProjectDescription('');
    setSelectedProjectGroup('all-projects');
    setSelectedLifecycle('.NET TEST PRD');
    setShowLifecycle(false);
    setProjectIcon(null);
  };

  const handleCancelAddProject = () => {
    setShowAddProjectModal(false);
    // Reset form
    setProjectName('');
    setStorageLocation('octopus');
    setDeployTarget('');
    setProjectDescription('');
    setSelectedProjectGroup('all-projects');
    setSelectedLifecycle('.NET TEST PRD');
    setShowLifecycle(false);
    setProjectIcon(null);
  };

  const handleIconUpload: UploadProps['beforeUpload'] = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return false;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setProjectIcon(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const renderDeploymentCell = (deployment: DeploymentInfo | null) => {
    if (!deployment) {
      return (
        <div className="flex items-center text-gray-400">
          <MinusCircleOutlined className="text-gray-300 mr-2" />
          <Text type="secondary">No Data</Text>
        </div>
      );
    }

    const icon = deployment.status === 'success' 
      ? <CheckCircleFilled className="text-green-500" />
      : deployment.status === 'failed'
      ? <CloseCircleFilled className="text-red-500" />
      : <MinusCircleOutlined className="text-gray-300" />;

    return (
      <div className="flex items-center">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-lg">{icon}</span>
          <div className="flex flex-col gap-0.5">
            <Tooltip title={deployment.version}>
              <Text strong className="text-sm text-gray-900 block overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
                {deployment.version}
              </Text>
            </Tooltip>
            <Text type="secondary" className="text-xs text-gray-500">
              {deployment.timestamp}
            </Text>
          </div>
        </div>
      </div>
    );
  };

  const columns: TableColumnsType<ProjectData> = [
    {
      title: '',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (name: string) => (
        <Space>
          <ProjectOutlined className="text-gray-300 text-xl" />
          <Text type="secondary">{name}</Text>
        </Space>
      ),
    },
    {
      title: 'DEV',
      dataIndex: 'dev',
      key: 'dev',
      width: 200,
      render: renderDeploymentCell,
    },
    {
      title: 'TEST',
      dataIndex: 'test',
      key: 'test',
      width: 200,
      render: renderDeploymentCell,
    },
    {
      title: 'UAT',
      dataIndex: 'uat',
      key: 'uat',
      width: 200,
      render: renderDeploymentCell,
    },
    {
      title: 'PRD',
      dataIndex: 'prd',
      key: 'prd',
      width: 200,
      render: renderDeploymentCell,
    },
  ];

  // 自定义表格样式
  const tableStyles = `
    .project-table .ant-table {
      border: none;
    }
    .project-table .ant-table-thead > tr > th {
      background-color: #fafafa;
      color: #666;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      border-bottom: 1px solid #f0f0f0;
      padding: 12px 6px;
    }
    .project-table .ant-table-tbody > tr > td {
      border-bottom: 1px solid #f0f0f0;
      padding: 16px 6px;
    }
    .project-table .ant-table-tbody > tr:hover > td {
      background-color: #fafafa;
    }
  `;

  return (
    <div className="p-6 bg-white min-h-screen">
      <style>{tableStyles}</style>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Title level={3} className="!m-0">Projects</Title>
        <Space>
          <Dropdown menu={{ items: importExportItems }} placement="bottomRight">
            <Button>
              Import/Export <DownOutlined />
            </Button>
          </Dropdown>
          <Button 
            type="primary" 
            className="!bg-green-700 hover:!bg-green-800 !border-green-700"
            onClick={() => setShowAddProjectModal(true)}
          >
            Add Project
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <Space size={16}>
          <Input
            placeholder="Find projects or project groups"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-80"
          />
          <Link onClick={() => setShowFiltersModal(true)}>
            <FilterOutlined /> Advanced filters
          </Link>
        </Space>
        <Space size={8}>
          <Dropdown overlay={pageSizeMenu} trigger={['click']}>
            <Text className="cursor-pointer select-none">
              {startIndex} - {endIndex} of {totalProjects} Projects
            </Text>
          </Dropdown>
          <Button 
            icon={<LeftOutlined />} 
            size="small"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          />
          <Button 
            icon={<RightOutlined />} 
            size="small"
            disabled={endIndex >= totalProjects}
            onClick={() => setCurrentPage(currentPage + 1)}
          />
        </Space>
      </div>

      {/* Project Groups */}
      <div className="mt-6">
        {projectGroupsData.map((group) => (
          <div key={group.name} className="mb-8">
            <div className="py-3 border-b-2 border-gray-200 mb-0">
              <Space>
                <Text strong className="text-base">{group.name}</Text>
                <Badge 
                  count={group.count} 
                  className="[&_.ant-badge-count]:bg-gray-300 [&_.ant-badge-count]:text-gray-600"
                />
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={group.projects}
              pagination={false}
              className="project-table"
              onRow={(record) => ({
                onClick: () => {
                  navigate(`/project/${encodeURIComponent(record.name)}/project-detail`);
                },
                style: { cursor: "pointer" }
              })}
            />
          </div>
        ))}
      </div>

      {/* Advanced Filters Modal */}
      <Modal
        title="Filters"
        open={showFiltersModal}
        onCancel={handleCancelFilters}
        footer={[
          <Button key="cancel" onClick={handleCancelFilters}>
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            onClick={handleSaveFilters} 
            className="!bg-gray-300 !border-gray-300 !text-black hover:!bg-gray-400"
          >
            Save
          </Button>,
        ]}
        width={600}
      >
        <div className="text-gray-500 text-sm mb-6">
          Change and save the default view of the dashboard to display all or only selected projects, 
          environments or releases for a tenant.
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-900 mb-1">Project Groups</div>
          <div className="text-xs text-gray-500 mb-3">View all or selected project groups</div>
          <Radio.Group 
            value={projectGroups} 
            onChange={(e) => setProjectGroups(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all">All project groups (default)</Radio>
            <Radio value="selected">Only selected project groups</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-900 mb-1">Projects</div>
          <div className="text-xs text-gray-500 mb-3">View all or selected projects</div>
          <Radio.Group 
            value={projects} 
            onChange={(e) => setProjects(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all">All projects (default)</Radio>
            <Radio value="selected">Only selected projects</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-900 mb-1">Environments</div>
          <div className="text-xs text-gray-500 mb-3">View all or selected environments</div>
          <Radio.Group 
            value={environments} 
            onChange={(e) => setEnvironments(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all">All environments (default)</Radio>
            <Radio value="selected">Only selected environments</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6">
          <div className="text-base font-semibold text-gray-900 mb-1">Tenants</div>
          <div className="text-xs text-gray-500 mb-3">View all or selected tenants</div>
          <Radio.Group 
            value={tenants} 
            onChange={(e) => setTenants(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all">All tenants (default)</Radio>
            <Radio value="selected">Only selected tenants</Radio>
          </Radio.Group>
        </div>
      </Modal>

      {/* Add New Project Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={handleCancelAddProject}
              className="!p-1"
            />
            <span>Add New Project</span>
          </div>
        }
        open={showAddProjectModal}
        onCancel={handleCancelAddProject}
        footer={[
          <Button key="cancel" onClick={handleCancelAddProject}>
            Cancel
          </Button>,
          <Button 
            key="create" 
            type="primary" 
            onClick={handleCreateProject}
            disabled={!projectName.trim()}
          >
            Create Project
          </Button>,
        ]}
        centered
        width="80%"
        style={{ top: 40, maxWidth: '100%', margin: '0 auto', paddingBottom: 0 }}
        bodyStyle={{ height: 'calc(100vh - 110px)', overflowY: 'auto', padding: '24px 48px' }}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        closeIcon={null}
      >
        {/* Steps indicator */}
        <div className="mb-6">
          <Steps
            current={0}
            items={[
              { title: 'Project' },
              { title: 'Deployment Process' },
              { title: 'Release and Deploy' }
            ]}
            size="small"
          />
        </div>

        {/* Project Icon and Name in same row */}
        <div className="flex items-center gap-4 mb-6">
          <Upload
            beforeUpload={handleIconUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Tooltip title="Click to upload project icon">
              <div 
                className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center text-white text-2xl cursor-pointer border-2 border-dashed border-transparent transition-all flex-shrink-0 overflow-hidden hover:border-blue-500 hover:bg-blue-50"
              >
                {projectIcon ? (
                  <img 
                    src={projectIcon} 
                    alt="Project icon" 
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <ProjectOutlined />
                )}
              </div>
            </Tooltip>
          </Upload>
          <Input
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            size="large"
            className="text-base font-medium flex-1"
          />
        </div>

        {/* Storage Location */}
        <div className="mb-5">
          <label className="text-xs text-gray-900 font-medium mb-2 block">
            Store project process, settings, and non-sensitive variables in
          </label>
          <Radio.Group 
            value={storageLocation} 
            onChange={(e) => setStorageLocation(e.target.value)}
            className="w-full flex gap-3"
          >
            <Radio.Button value="octopus" className="h-12 flex items-center justify-center flex-1">
              <div className="text-center">
                <div className="font-medium">Octopus</div>
                <div className="text-xs text-gray-500 mt-0.5">Recommended</div>
              </div>
            </Radio.Button>
            <Radio.Button value="git" className="h-12 flex items-center justify-center flex-1">
              <div className="text-center">
                <div className="font-medium">Git Repository</div>
              </div>
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* Deploy to */}
        <div className="mb-5">
          <label className="text-xs text-gray-900 font-medium mb-2 block">Deploy to</label>
          <Radio.Group 
            value={deployTarget} 
            onChange={(e) => setDeployTarget(e.target.value)}
            className="w-full"
          >
            <div className="grid grid-cols-3 gap-2">
              <Radio.Button value="kubernetes" className="h-12 flex items-center justify-center">
                Kubernetes
              </Radio.Button>
              <Radio.Button value="azure" className="h-12 flex items-center justify-center">
                Azure
              </Radio.Button>
              <Radio.Button value="aws" className="h-12 flex items-center justify-center">
                AWS
              </Radio.Button>
              <Radio.Button value="linux" className="h-12 flex items-center justify-center">
                Linux
              </Radio.Button>
              <Radio.Button value="windows" className="h-12 flex items-center justify-center">
                Windows
              </Radio.Button>
              <Radio.Button value="other" className="h-12 flex items-center justify-center">
                Other
              </Radio.Button>
            </div>
          </Radio.Group>
        </div>

        {/* Advanced Settings */}
        <div className="mt-5 pt-5 border-t border-gray-200">
          <Text strong className="text-xs text-gray-500 uppercase">
            ADVANCED SETTINGS
          </Text>

          {/* Project Description */}
          <div className="mt-4 mb-4">
            <label className="text-xs text-gray-900 font-medium mb-2 block">Project description</label>
            <TextArea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Project description"
              rows={2}
            />
          </div>

          {/* Project Group */}
          <div className="mb-4">
            <label className="text-xs text-gray-900 font-medium mb-2 block">Project group</label>
            <Select
              value={selectedProjectGroup}
              onChange={setSelectedProjectGroup}
              className="w-full"
              options={[
                { value: 'all-projects', label: 'All Projects' },
                { value: '.net-a-team', label: '.NET A TEAM' },
              ]}
            />
          </div>

          {/* Lifecycle */}
          <div className="mb-4">
            <label className="text-xs text-gray-900 font-medium mb-2 block">Lifecycle</label>
            <div className="flex gap-2 items-center">
              <Select
                value={selectedLifecycle}
                onChange={setSelectedLifecycle}
                className="flex-1"
                options={[
                  { value: '.NET TEST PRD', label: '.NET TEST PRD' },
                ]}
              />
              <Button icon={<ReloadOutlined />} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              The lifecycle defines how releases can be promoted between environments.{' '}
              <Link onClick={() => setShowLifecycle(!showLifecycle)}>
                {showLifecycle ? 'Hide' : 'Show'} Lifecycle
              </Link>
            </div>
            
            {showLifecycle && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-700">
                Lifecycle phases will be displayed here...
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Project;
