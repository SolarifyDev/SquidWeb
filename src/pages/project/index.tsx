import React, { useState, useEffect } from 'react';
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
  Spin
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
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
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
  ThunderboltFilled,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getLifecycles, LifecycleDto } from 'pages/apis/lifecycle';

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
import { getProjects, ProjectDto } from "pages/apis/project";
import { useSpace } from "contexts/SpaceContext";

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
  
  // Add Project Group states
  const [projectGroupName, setProjectGroupName] = useState('');
  const [projectGroupDesc, setProjectGroupDesc] = useState('');
  const [showMarkdownControls, setShowMarkdownControls] = useState(true);
  // Add Project form states
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedLifecycle, setSelectedLifecycle] = useState<string | undefined>(undefined);
  const [showLifecyclePreview, setShowLifecyclePreview] = useState(false);
  const [lifecycleOptions, setLifecycleOptions] = useState<{ value: string; label: string; phases: { name: string; type?: string }[] }[]>([]);
  const [loadingLifecycles, setLoadingLifecycles] = useState(false);
  const [storageLocation, setStorageLocation] = useState('squid');
  const [deployTarget, setDeployTarget] = useState('');
  const [selectedProjectGroup, setSelectedProjectGroup] = useState('all-projects');
  const [projectGroupsData, setProjectGroupsData] = useState<ProjectGroup[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const navigate = useNavigate();
  const { space } = useSpace();

  // 加载 Lifecycle 列表（当 Add Project 弹窗打开时）
  useEffect(() => {
    if (!showAddProjectModal) return;
    setLoadingLifecycles(true);
    getLifecycles()
      .then((res) => {
        const options = res.lifecycles.map((lc: LifecycleDto) => {
          let phases: { name: string; type?: string }[] = [];
          if (lc.json) {
            try {
              const parsed = JSON.parse(lc.json);
              if (Array.isArray(parsed.phases)) {
                phases = parsed.phases.map((p: any) => ({
                  name: p.name || p.Name || '',
                  type: p.isOptionalPhase ? 'default' : 'active',
                }));
              }
            } catch {}
          }
          return { value: String(lc.id), label: lc.name, phases };
        });
        setLifecycleOptions(options);
        if (options.length > 0 && !selectedLifecycle) {
          setSelectedLifecycle(options[0].value);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLifecycles(false));
  }, [showAddProjectModal]);

  // 从 API 加载项目列表
  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await getProjects({
          pageIndex: currentPage,
          pageSize,
          keyword: searchText || undefined,
          spaceId: space.id,
        });
        if (cancelled) return;

        const projects: ProjectData[] = (res.projects ?? []).map((p: ProjectDto) => ({
          key: String(p.id),
          name: p.name,
          dev: null,
          test: null,
          uat: null,
          prd: null,
        }));

        setProjectGroupsData([
          {
            name: 'All Projects',
            count: res.count,
            projects,
          },
        ]);
        setTotalProjects(res.count);
      } catch (error) {
        console.error('Failed to load projects', error);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };

    fetchProjects();
    return () => { cancelled = true; };
  }, [currentPage, pageSize, searchText]);

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
    console.log('Filters saved:', { projectGroups, projects, environments });
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

  const resetAddProjectForm = () => {
    setProjectName('');
    setProjectDescription('');
    setSelectedLifecycle(undefined);
    setShowLifecyclePreview(false);
    setLifecycleOptions([]);
    setStorageLocation('squid');
    setDeployTarget('');
    setSelectedProjectGroup('all-projects');
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    console.log('Creating project:', { projectName, projectDescription, selectedLifecycle, storageLocation, deployTarget, selectedProjectGroup });
    setShowAddProjectModal(false);
    resetAddProjectForm();
  };

  const handleCancelAddProject = () => {
    setShowAddProjectModal(false);
    resetAddProjectForm();
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
        <Space
          className="min-w-0 cursor-pointer"
          onClick={() => navigate(`/${space.slug}/projects/${encodeURIComponent(name)}/project-detail`)}
        >
          <ProjectOutlined className="text-gray-400 text-base flex-shrink-0" />
          <Text className="text-xs text-squid-blue font-medium truncate hover:underline">{name}</Text>
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

    /* Fullscreen Add Project Modal */
    .fullscreen-add-project-modal .ant-modal-wrap {
      overflow: hidden;
    }
    .fullscreen-add-project-modal .ant-modal {
      top: 0 !important;
      max-width: 100vw !important;
      margin: 0 !important;
      padding-bottom: 0 !important;
      width: 100vw !important;
    }
    .fullscreen-add-project-modal .ant-modal-content {
      height: 100vh;
      border-radius: 0 !important;
      padding: 0 !important;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .fullscreen-add-project-modal .ant-modal-body {
      padding: 0 !important;
      flex: 1;
      overflow: hidden;
      height: 100vh;
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
          {loadingProjects ? (
            <div className="flex items-center justify-center py-20">
              <Spin tip="Loading projects..." />
            </div>
          ) : projectGroupsData.length === 0 ? (
            <div className="py-20 text-center text-gray-400">No projects found</div>
          ) : (
            projectGroupsData.map((group) => (
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
                  />
                </div>
              </div>
            ))
          )}
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
          environments or releases.
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
      
      {/* Add New Project Modal - Fullscreen */}
      <Modal
        open={showAddProjectModal}
        onCancel={handleCancelAddProject}
        destroyOnClose
        footer={null}
        title={null}
        closable={false}
        width="100vw"
        style={{ top: 0, margin: 0, maxWidth: '100vw', padding: 0 }}
        wrapClassName="fullscreen-add-project-modal"
      >
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          {/* ── Left Panel ── */}
          <div style={{ width: '62%', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>

            {/* Top bar: close + brand */}
            <div className="flex items-center justify-between px-10 py-4 border-b border-gray-100 flex-shrink-0">
              <button
                onClick={handleCancelAddProject}
                className="text-gray-400 hover:text-gray-600 transition-colors leading-none"
              >
                <CloseOutlined style={{ fontSize: 18 }} />
              </button>
              <span className="text-gray-500 font-semibold text-sm tracking-wide">Squid</span>
            </div>

            {/* Breadcrumb + step indicator */}
            <div className="px-10 pt-8 pb-2 flex-shrink-0">
              <button
                onClick={handleCancelAddProject}
                className="flex items-center gap-1 text-squid-blue text-sm hover:opacity-75 mb-8 transition-opacity"
              >
                <LeftOutlined style={{ fontSize: 11 }} />
                <span>Projects</span>
              </button>

              {/* Step indicator */}
              <div className="flex items-center mb-8">
                {/* Step 1 – active */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#00B065' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">Project</span>
                </div>

                <div className="mx-3 h-px bg-gray-200" style={{ width: 40 }} />

                {/* Step 2 – inactive */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-400 whitespace-nowrap">Deployment Process</span>
                </div>

                <div className="mx-3 h-px bg-gray-200" style={{ width: 40 }} />

                {/* Step 3 – inactive */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-400 whitespace-nowrap">Release and Deploy</span>
                </div>
              </div>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-10 pb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Add New Project</h2>

              {/* Project name + icon */}
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded bg-squid-blue flex items-center justify-center text-white flex-shrink-0">
                  <ProjectOutlined style={{ fontSize: 16 }} />
                </div>
                <div
                  className="flex-1 pb-1 transition-colors"
                  style={{ borderBottom: '2px solid #d1d5db' }}
                  onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#0d80d8')}
                  onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#d1d5db')}
                >
                  <input
                    autoFocus
                    placeholder="New project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full text-lg outline-none border-0 bg-transparent py-1 text-gray-900 placeholder-gray-400 font-medium"
                  />
                </div>
              </div>

              {/* Storage Location */}
              <div className="mb-8">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Storage Location</div>
                <Radio.Group value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)}>
                  <div className="flex flex-col gap-4">
                    <Radio value="squid">
                      <div className="ml-1">
                        <div className="text-sm font-semibold text-gray-900">Squid</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Store project and deployment process in the Squid database.
                        </div>
                      </div>
                    </Radio>
                    <Radio value="git">
                      <div className="ml-1">
                        <div className="text-sm font-semibold text-gray-900">Git Repository</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Store deployment process in a Git repository using Configuration as Code.
                        </div>
                      </div>
                    </Radio>
                  </div>
                </Radio.Group>
              </div>

              {/* Deploy To */}
              <div className="mb-8">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Deploy To</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'kubernetes', label: 'Kubernetes', emoji: '⚓' },
                    { value: 'azure', label: 'Azure Cloud', emoji: '☁' },
                    { value: 'aws', label: 'AWS', emoji: '🟡' },
                    { value: 'linux', label: 'Linux/Unix', emoji: '🐧' },
                    { value: 'windows', label: 'Windows', emoji: '🪟' },
                    { value: 'other', label: 'Other', emoji: '⚡' },
                  ].map(({ value, label, emoji }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDeployTarget(value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        deployTarget === value
                          ? 'border-squid-blue bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-2xl leading-none">{emoji}</span>
                      <span
                        className={`text-sm font-medium ${deployTarget === value ? 'text-squid-blue' : 'text-gray-700'}`}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings separator */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  Advanced Settings
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Description */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <div className="border-b border-gray-300 pb-1 focus-within:border-squid-blue transition-colors">
                  <textarea
                    placeholder="Describe your project (optional)"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={2}
                    className="w-full outline-none border-0 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 py-1"
                  />
                </div>
              </div>

              {/* Project Group */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 mb-1">Project Group</div>
                <div className="border-b border-gray-300 focus-within:border-squid-blue transition-colors">
                  <Select
                    className="w-full"
                    value={selectedProjectGroup}
                    onChange={setSelectedProjectGroup}
                    bordered={false}
                    options={[{ value: 'all-projects', label: 'All Projects' }]}
                    style={{ paddingLeft: 0 }}
                    dropdownStyle={{ zIndex: 10001 }}
                  />
                </div>
              </div>

              {/* Lifecycle */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 mb-1">Lifecycle</div>
                <div className="flex items-center gap-2 border-b border-gray-300 focus-within:border-squid-blue transition-colors">
                  <Select
                    className="flex-1"
                    loading={loadingLifecycles}
                    value={selectedLifecycle}
                    onChange={setSelectedLifecycle}
                    placeholder="Select a lifecycle"
                    bordered={false}
                    options={lifecycleOptions.map((o) => ({ value: o.value, label: o.label }))}
                    style={{ paddingLeft: 0 }}
                    dropdownStyle={{ zIndex: 10001 }}
                  />
                  <button
                    type="button"
                    title="Refresh lifecycles"
                    className="text-squid-blue hover:text-blue-700 p-1 transition-colors flex-shrink-0"
                    onClick={() => {
                      setLoadingLifecycles(true);
                      getLifecycles()
                        .then((res) => {
                          const options = res.lifecycles.map((lc: LifecycleDto) => {
                            let phases: { name: string; type?: string }[] = [];
                            if (lc.json) {
                              try {
                                const parsed = JSON.parse(lc.json);
                                if (Array.isArray(parsed.phases)) {
                                  phases = parsed.phases.map((p: any) => ({
                                    name: p.name || p.Name || '',
                                    type: p.isOptionalPhase ? 'default' : 'active',
                                  }));
                                }
                              } catch {}
                            }
                            return { value: String(lc.id), label: lc.name, phases };
                          });
                          setLifecycleOptions(options);
                        })
                        .catch(() => {})
                        .finally(() => setLoadingLifecycles(false));
                    }}
                  >
                    <ReloadOutlined />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Lifecycles determine which environments the project can be deployed to and in what order.{' '}
                  <button
                    type="button"
                    className="text-squid-blue hover:underline bg-transparent border-0 cursor-pointer p-0"
                    onClick={() => setShowLifecyclePreview((v) => !v)}
                  >
                    {showLifecyclePreview ? 'Hide' : 'Show'} lifecycle
                  </button>
                </p>
                {showLifecyclePreview && (() => {
                  const sel = lifecycleOptions.find((o) => o.value === selectedLifecycle);
                  return (
                    <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {sel && sel.phases.length > 0 ? (
                        <div className="space-y-1.5">
                          {sel.phases.map((phase, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              {phase.type === 'active' ? (
                                <ThunderboltFilled className="text-orange-500 text-xs" />
                              ) : (
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-400" />
                              )}
                              <span className={phase.type === 'active' ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                                {phase.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Uses default conventions</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Bottom spacing */}
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-10 py-4 border-t border-gray-200 flex justify-between items-center bg-white">
              <Button onClick={handleCancelAddProject}>Cancel</Button>
              <Button
                type="primary"
                onClick={handleCreateProject}
                disabled={!projectName.trim()}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700 font-semibold"
              >
                Create Project
              </Button>
            </div>
          </div>

          {/* ── Right Panel – Illustration ── */}
          <div
            className="flex-1 h-full flex flex-col items-center justify-center p-12"
            style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 55%, #dbeafe 100%)' }}
          >
            <svg width="300" height="200" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-8">
              {/* Build box */}
              <rect x="10" y="65" width="75" height="52" rx="8" fill="white" stroke="#0d80d8" strokeWidth="1.5" />
              <rect x="10" y="65" width="75" height="20" rx="8" fill="#0d80d8" />
              <rect x="10" y="76" width="75" height="9" fill="#0d80d8" />
              <text x="48" y="80" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">BUILD</text>
              <circle cx="28" cy="101" r="4" fill="#e2e8f0" />
              <circle cx="42" cy="101" r="4" fill="#e2e8f0" />
              <rect x="52" y="97" width="24" height="8" rx="2" fill="#e2e8f0" />
              {/* Arrow 1→2 */}
              <line x1="85" y1="91" x2="110" y2="91" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
              <polygon points="110,87 118,91 110,95" fill="#94a3b8" />
              {/* Test box */}
              <rect x="118" y="65" width="75" height="52" rx="8" fill="white" stroke="#00B065" strokeWidth="1.5" />
              <rect x="118" y="65" width="75" height="20" rx="8" fill="#00B065" />
              <rect x="118" y="76" width="75" height="9" fill="#00B065" />
              <text x="156" y="80" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">TEST</text>
              <circle cx="136" cy="101" r="4" fill="#bbf7d0" />
              <circle cx="150" cy="101" r="4" fill="#bbf7d0" />
              <rect x="160" y="97" width="24" height="8" rx="2" fill="#bbf7d0" />
              {/* Arrow 2→3 */}
              <line x1="193" y1="91" x2="218" y2="91" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
              <polygon points="218,87 226,91 218,95" fill="#94a3b8" />
              {/* Deploy box */}
              <rect x="226" y="65" width="64" height="52" rx="8" fill="white" stroke="#7c3aed" strokeWidth="1.5" />
              <rect x="226" y="65" width="64" height="20" rx="8" fill="#7c3aed" />
              <rect x="226" y="76" width="64" height="9" fill="#7c3aed" />
              <text x="258" y="80" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">DEPLOY</text>
              <circle cx="244" cy="101" r="4" fill="#ede9fe" />
              <rect x="254" y="97" width="26" height="8" rx="2" fill="#ede9fe" />
              {/* Vertical connectors */}
              <line x1="48" y1="117" x2="48" y2="145" stroke="#e2e8f0" strokeWidth="1.5" />
              <line x1="156" y1="117" x2="156" y2="145" stroke="#e2e8f0" strokeWidth="1.5" />
              <line x1="258" y1="117" x2="258" y2="145" stroke="#e2e8f0" strokeWidth="1.5" />
              {/* Ground line */}
              <line x1="10" y1="150" x2="290" y2="150" stroke="#e2e8f0" strokeWidth="1" />
              {/* Environment labels */}
              <text x="48" y="163" textAnchor="middle" fontSize="9" fill="#94a3b8">Development</text>
              <text x="156" y="163" textAnchor="middle" fontSize="9" fill="#94a3b8">Staging</text>
              <text x="258" y="163" textAnchor="middle" fontSize="9" fill="#94a3b8">Production</text>
              {/* Decorative dots */}
              <circle cx="150" cy="28" r="5" fill="#0d80d8" opacity="0.25" />
              <circle cx="172" cy="18" r="3" fill="#00B065" opacity="0.3" />
              <circle cx="192" cy="32" r="4" fill="#7c3aed" opacity="0.25" />
              <circle cx="128" cy="22" r="4" fill="#0d80d8" opacity="0.18" />
            </svg>

            <h3 className="text-xl font-bold text-gray-700 text-center mb-3">
              Accelerate your deployments
            </h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed" style={{ maxWidth: 280 }}>
              Projects contain all the settings needed to deploy your software.
              Define your deployment process, manage variables, and release to environments on demand.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Project;
