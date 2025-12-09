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
  message,
  List
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
  ArrowLeftOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined
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
  const [showAddProjectGroup, setShowAddProjectGroup] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [projectGroups, setProjectGroups] = useState('all');
  const [projects, setProjects] = useState('all');
  const [environments, setEnvironments] = useState('all');
  const [tenants, setTenants] = useState('all');
  
  // Add Project Group states
  const [projectGroupName, setProjectGroupName] = useState('');
  const [projectGroupDesc, setProjectGroupDesc] = useState('');
  const [showMarkdownControls, setShowMarkdownControls] = useState(true);
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
        },
        {
          key: '7',
          name: 'JustIM_DotnetCore',
          dev: null,
          test: {
            version: '5.6.1',
            timestamp: 'Jan 22, 2025 6:38 PM',
            status: 'success'
          },
          uat: {
            version: '5.6.2',
            timestamp: 'Jan 21, 2025 3:26 PM',
            status: 'success'
          },
          prd: {
            version: '5.6.2',
            timestamp: 'Jan 21, 2025 5:38 PM',
            status: 'success'
          }
        },
        {
          key: '8',
          name: 'JustIM_SugarChat',
          dev: null,
          test: {
            version: '2023.4.2',
            timestamp: 'Sep 4, 2023 2:33 PM',
            status: 'success'
          },
          uat: {
            version: '2023.4.2',
            timestamp: 'Sep 4, 2023 2:34 PM',
            status: 'success'
          },
          prd: {
            version: '2023.4.2',
            timestamp: 'Sep 13, 2023 3:14 PM',
            status: 'success'
          }
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

  const MarkdownToolbar = () => (
    <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
      <button className="p-1 hover:bg-gray-200 rounded"><BoldOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><ItalicOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><UnorderedListOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><OrderedListOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><PictureOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><LinkOutlined style={{ fontSize: 16 }} /></button>
      <button className="p-1 hover:bg-gray-200 rounded"><CodeOutlined style={{ fontSize: 16 }} /></button>
    </div>
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

  const handleSaveProjectGroup = () => {
    console.log('Project Group Name:', projectGroupName);
    console.log('Project Group Description:', projectGroupDesc);
    // 这里添加保存逻辑
    setShowAddProjectGroup(false);
    setProjectGroupName('');
    setProjectGroupDesc('');
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
          <MinusCircleOutlined className="text-gray-300 mr-2 text-lg flex-shrink-0" />
          <Text type="secondary" className="text-xs font-medium">No Data</Text>
        </div>
      );
    }

    const icon = deployment.status === 'success' 
      ? <CheckCircleFilled className="text-green-500 text-lg" />
      : deployment.status === 'failed'
      ? <CloseCircleFilled className="text-red-500 text-lg" />
      : <MinusCircleOutlined className="text-gray-300 text-lg" />;

    return (
      <div className="flex items-center min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 flex-shrink-0">{icon}</span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <Tooltip title={deployment.version}>
              <Text strong className="text-xs text-gray-900 block truncate font-semibold">
                {deployment.version}
              </Text>
            </Tooltip>
            <Text type="secondary" className="text-xs text-gray-500 font-normal whitespace-nowrap">
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
      width: 200,
      fixed: 'left',
      ellipsis: true,
      render: (name: string) => (
        <Space className="min-w-0">
          <ProjectOutlined className="text-gray-400 text-base flex-shrink-0" />
          <Text className="text-xs text-gray-600 font-medium truncate">{name}</Text>
        </Space>
      ),
    },
    {
      title: 'DEV',
      dataIndex: 'dev',
      key: 'dev',
      width: 220,
      ellipsis: true,
      render: renderDeploymentCell,
    },
    {
      title: 'TEST',
      dataIndex: 'test',
      key: 'test',
      width: 220,
      ellipsis: true,
      render: renderDeploymentCell,
    },
    {
      title: 'UAT',
      dataIndex: 'uat',
      key: 'uat',
      width: 220,
      ellipsis: true,
      render: renderDeploymentCell,
    },
    {
      title: 'PRD',
      dataIndex: 'prd',
      key: 'prd',
      width: 220,
      ellipsis: true,
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
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #f0f0f0;
      padding: 12px 16px;
    }
    .project-table .ant-table-tbody > tr > td {
      border-bottom: 1px solid #f0f0f0;
      padding: 14px 16px;
    }
    .project-table .ant-table-tbody > tr:hover > td {
      background-color: #fafafa;
    }
    .project-table .ant-table-container {
      overflow-x: auto;
    }
    .project-table .ant-table-cell {
      white-space: nowrap;
    }
    
    /* 响应式优化 */
    @media (max-width: 1400px) {
      .project-table .ant-table-thead > tr > th,
      .project-table .ant-table-tbody > tr > td {
        padding: 10px 12px;
      }
    }
    
    @media (max-width: 1200px) {
      .project-table .ant-table-thead > tr > th,
      .project-table .ant-table-tbody > tr > td {
        padding: 8px 10px;
      }
    }
  `;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <style>{tableStyles}</style>
      
      {/* Fixed Header - 不滚动 */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-200 bg-white">
        {/* Title and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <Title level={3} className="!m-0 !text-xl sm:!text-2xl !font-bold">Projects</Title>
          <Space size="small" wrap>
            <Dropdown menu={{ items: importExportItems }} placement="bottomRight">
              <Button className="text-sm font-medium">
                Import/Export <DownOutlined />
              </Button>
            </Dropdown>
            <Button 
              onClick={() => setShowAddProjectGroup(true)}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 font-medium"
            >
              Add Project Group
            </Button>
            <Button 
              type="primary" 
              className="!bg-green-700 hover:!bg-green-800 !border-green-700 text-sm font-semibold"
              onClick={() => setShowAddProjectModal(true)}
            >
              Add Project
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <Space size={12} wrap className="w-full lg:w-auto">
            <Input
              placeholder="Find projects or project groups"
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full sm:w-80"
              size="middle"
            />
            <Link onClick={() => setShowFiltersModal(true)} className="text-sm font-medium whitespace-nowrap">
              <FilterOutlined /> Advanced filters
            </Link>
          </Space>
          <Space size={8} wrap className="w-full lg:w-auto justify-end">
            <Dropdown overlay={pageSizeMenu} trigger={['click']}>
              <Text className="cursor-pointer select-none text-sm text-blue-600 font-semibold whitespace-nowrap">
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
      </div>

      {/* Scrollable Content Area - 只有这部分滚动 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 sm:px-6 py-4">
          {projectGroupsData.map((group) => (
            <div key={group.name} className="mb-6">
              <div className="py-2 border-b-2 border-gray-200 mb-0">
                <Space>
                  <Text strong className="text-sm font-bold">{group.name}</Text>
                  <Badge 
                    count={group.count} 
                    className="[&_.ant-badge-count]:bg-gray-300 [&_.ant-badge-count]:text-gray-700 [&_.ant-badge-count]:text-xs [&_.ant-badge-count]:font-semibold"
                  />
                </Space>
              </div>
              <div className="overflow-x-auto">
                <Table
                  columns={columns}
                  dataSource={group.projects}
                  pagination={false}
                  className="project-table"
                  scroll={{ x: 1000 }}
                  rowClassName={() => "cursor-pointer"}
                  onRow={(record: ProjectData) => ({
                    onClick: () => {
                      navigate(`/project/${encodeURIComponent(record.name)}/project-detail`);
                    },
                  })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Filters Modal */}
      <Modal
        title={<span className="font-bold text-lg">Filters</span>}
        open={showFiltersModal}
        onCancel={handleCancelFilters}
        footer={[
          <Button key="cancel" onClick={handleCancelFilters} className="font-medium">
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            onClick={handleSaveFilters} 
            className="!bg-gray-300 !border-gray-300 !text-black hover:!bg-gray-400 font-semibold"
          >
            Save
          </Button>,
        ]}
        width={600}
      >
        <div className="text-gray-500 text-sm mb-6 font-normal">
          Change and save the default view of the dashboard to display all or only selected projects, 
          environments or releases for a tenant.
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-bold text-gray-900 mb-1">Project Groups</div>
          <div className="text-xs text-gray-500 mb-3 font-normal">View all or selected project groups</div>
          <Radio.Group 
            value={projectGroups} 
            onChange={(e) => setProjectGroups(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all" className="font-medium">All project groups (default)</Radio>
            <Radio value="selected" className="font-medium">Only selected project groups</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-bold text-gray-900 mb-1">Projects</div>
          <div className="text-xs text-gray-500 mb-3 font-normal">View all or selected projects</div>
          <Radio.Group 
            value={projects} 
            onChange={(e) => setProjects(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all" className="font-medium">All projects (default)</Radio>
            <Radio value="selected" className="font-medium">Only selected projects</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="text-base font-bold text-gray-900 mb-1">Environments</div>
          <div className="text-xs text-gray-500 mb-3 font-normal">View all or selected environments</div>
          <Radio.Group 
            value={environments} 
            onChange={(e) => setEnvironments(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all" className="font-medium">All environments (default)</Radio>
            <Radio value="selected" className="font-medium">Only selected environments</Radio>
          </Radio.Group>
        </div>

        <div className="mb-6">
          <div className="text-base font-bold text-gray-900 mb-1">Tenants</div>
          <div className="text-xs text-gray-500 mb-3 font-normal">View all or selected tenants</div>
          <Radio.Group 
            value={tenants} 
            onChange={(e) => setTenants(e.target.value)}
            className="flex flex-col gap-2"
          >
            <Radio value="all" className="font-medium">All tenants (default)</Radio>
            <Radio value="selected" className="font-medium">Only selected tenants</Radio>
          </Radio.Group>
        </div>
      </Modal>

      {/* Add Project Group Modal - 添加项目组弹窗 */}
      <Modal
        title={<span className="text-xl font-bold">Add New Project Group</span>}
        open={showAddProjectGroup}
        onCancel={() => setShowAddProjectGroup(false)}
        width={600}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => setShowAddProjectGroup(false)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary"
            onClick={handleSaveProjectGroup}
            className="!bg-green-700 hover:!bg-green-800 !border-green-700 text-sm font-semibold"
          >
            Save
          </Button>
        ]}
        className="add-project-group-modal"
      >
        {/* 项目组名称输入框 */}
        <div className="mb-4">
          <Input
            placeholder="New project group name"
            value={projectGroupName}
            onChange={(e) => setProjectGroupName(e.target.value)}
            size="large"
            className="text-base"
          />
        </div>
        {/* 项目组描述输入区域 - 带Markdown工具栏 */}
        <div className="mb-4">
          <div className="border border-gray-300 rounded">
            {showMarkdownControls && <MarkdownToolbar />}
            <TextArea
              placeholder="Project group description"
              value={projectGroupDesc}
              onChange={(e) => setProjectGroupDesc(e.target.value)}
              rows={6}
              bordered={false}
              className="resize-none"
              style={{ padding: '12px' }}
            />
          </div>
        </div>
        {/* Markdown控制链接 */}
        <div className="flex gap-4 text-sm">
          <button 
            onClick={() => setShowMarkdownControls(!showMarkdownControls)}
            className="text-blue-600 hover:underline"
          >
            {showMarkdownControls ? 'Hide' : 'Show'} markdown controls
          </button>
          <a 
            href="#" 
            className="text-blue-600 hover:underline flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Markdown instructions
            <span className="text-xs">↗</span>
          </a>
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
            <span className="font-bold text-lg">Add New Project</span>
          </div>
        }
        open={showAddProjectModal}
        onCancel={handleCancelAddProject}
        footer={[
          <Button key="cancel" onClick={handleCancelAddProject} className="font-medium">
            Cancel
          </Button>,
          <Button 
            key="create" 
            type="primary" 
            onClick={handleCreateProject}
            disabled={!projectName.trim()}
            className="font-semibold"
          >
            Create Project
          </Button>,
        ]}
        centered
        width="90%"
        style={{ top: 40, maxWidth: 1200, margin: '0 auto', paddingBottom: 0 }}
        bodyStyle={{ height: 'calc(100vh - 110px)', overflowY: 'auto', padding: '24px' }}
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
            className="text-base font-semibold flex-1"
          />
        </div>

        {/* Storage Location */}
        <div className="mb-5">
          <label className="text-xs text-gray-900 font-bold mb-2 block uppercase tracking-wide">
            Store project process, settings, and non-sensitive variables in
          </label>
          <Radio.Group 
            value={storageLocation} 
            onChange={(e) => setStorageLocation(e.target.value)}
            className="w-full flex gap-3"
          >
            <Radio.Button value="octopus" className="h-12 flex items-center justify-center flex-1">
              <div className="text-center">
                <div className="font-semibold">Octopus</div>
                <div className="text-xs text-gray-500 mt-0.5 font-normal">Recommended</div>
              </div>
            </Radio.Button>
            <Radio.Button value="git" className="h-12 flex items-center justify-center flex-1">
              <div className="text-center">
                <div className="font-semibold">Git Repository</div>
              </div>
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* Deploy to */}
        <div className="mb-5">
          <label className="text-xs text-gray-900 font-bold mb-2 block uppercase tracking-wide">Deploy to</label>
          <Radio.Group 
            value={deployTarget} 
            onChange={(e) => setDeployTarget(e.target.value)}
            className="w-full"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Radio.Button value="kubernetes" className="h-12 flex items-center justify-center font-medium">
                Kubernetes
              </Radio.Button>
              <Radio.Button value="azure" className="h-12 flex items-center justify-center font-medium">
                Azure
              </Radio.Button>
              <Radio.Button value="aws" className="h-12 flex items-center justify-center font-medium">
                AWS
              </Radio.Button>
              <Radio.Button value="linux" className="h-12 flex items-center justify-center font-medium">
                Linux
              </Radio.Button>
              <Radio.Button value="windows" className="h-12 flex items-center justify-center font-medium">
                Windows
              </Radio.Button>
              <Radio.Button value="other" className="h-12 flex items-center justify-center font-medium">
                Other
              </Radio.Button>
            </div>
          </Radio.Group>
        </div>

        {/* Advanced Settings */}
        <div className="mt-5 pt-5 border-t border-gray-200">
          <Text strong className="text-xs text-gray-500 uppercase font-bold tracking-wider">
            ADVANCED SETTINGS
          </Text>

          {/* Project Description */}
          <div className="mt-4 mb-4">
            <label className="text-xs text-gray-900 font-bold mb-2 block uppercase tracking-wide">
              Project description
            </label>
            <TextArea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Project description"
              rows={2}
            />
          </div>

          {/* Project Group */}
          <div className="mb-4">
            <label className="text-xs text-gray-900 font-bold mb-2 block uppercase tracking-wide">
              Project group
            </label>
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
            <label className="text-xs text-gray-900 font-bold mb-2 block uppercase tracking-wide">
              Lifecycle
            </label>
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
            <div className="text-xs text-gray-500 mt-1 font-normal">
              The lifecycle defines how releases can be promoted between environments.{' '}
              <Link onClick={() => setShowLifecycle(!showLifecycle)} className="font-medium">
                {showLifecycle ? 'Hide' : 'Show'} Lifecycle
              </Link>
            </div>
            
            {showLifecycle && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-700 font-normal">
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
