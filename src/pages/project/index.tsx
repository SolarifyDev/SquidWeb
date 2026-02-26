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
  const [deployTarget, setDeployTarget] = useState('kubernetes');
  const [manageWith, setManageWith] = useState('helm');
  const [selectedProjectGroup, setSelectedProjectGroup] = useState('all-projects');
  const [projectGroupsData, setProjectGroupsData] = useState<ProjectGroup[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const navigate = useNavigate();
  const { space } = useSpace();

  useEffect(() => {
    const valid =
      deployTarget === 'kubernetes'
        ? ['helm', 'kustomize', 'yaml', 'other']
        : ['process', 'script', 'other'];
    if (!valid.includes(manageWith)) {
      setManageWith(valid[0]);
    }
  }, [deployTarget, manageWith]);

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

  const deployTargetOptions = [
    { value: 'kubernetes', label: 'Kubernetes', icon: '☸', tone: '#326ce5' },
    { value: 'azure', label: 'Azure', icon: '☁', tone: '#0284c7' },
    { value: 'aws', label: 'AWS', icon: '◌', tone: '#d97706' },
    { value: 'linux', label: 'Linux', icon: '◍', tone: '#16a34a' },
    { value: 'windows', label: 'Windows', icon: '▣', tone: '#2563eb' },
    { value: 'other', label: 'Other', icon: '•', tone: '#6b7280' },
  ] as const;

  const manageWithOptions =
    deployTarget === 'kubernetes'
      ? [
          { value: 'helm', label: 'Helm' },
          { value: 'kustomize', label: 'Kustomize' },
          { value: 'yaml', label: 'YAML files' },
          { value: 'other', label: 'Other' },
        ]
      : [
          { value: 'process', label: 'Deployment process steps' },
          { value: 'script', label: 'Script-based process' },
          { value: 'other', label: 'Other' },
        ];

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
        <div className="flex h-[100vh] overflow-hidden bg-[#f4f6f8]">
          <div className="w-full lg:w-[70%] min-w-0 bg-white border-r border-gray-200 flex flex-col h-full">
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white flex-shrink-0">
              <button
                onClick={handleCancelAddProject}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                aria-label="Close"
              >
                <CloseOutlined style={{ fontSize: 16 }} />
              </button>
              <div className="text-xs font-semibold tracking-[0.18em] text-gray-400 uppercase">Project Wizard</div>
            </div>

            <div className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-gray-100 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={handleCancelAddProject}
                  className="flex items-center gap-2 text-squid-blue text-sm hover:opacity-80 transition-opacity"
                >
                  <span className="w-7 h-7 rounded-full border border-blue-200 bg-blue-50 flex items-center justify-center">
                    <LeftOutlined style={{ fontSize: 11 }} />
                  </span>
                  <span>Projects</span>
                </button>

                <div className="flex items-center gap-3">
                  {[
                    { label: 'Project', active: true },
                    { label: 'Deployment Process', active: false },
                    { label: 'Release and Deploy', active: false },
                  ].map((step, idx) => (
                    <React.Fragment key={step.label}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center rounded-full ${
                            step.active ? 'w-5 h-5 bg-green-600' : 'w-3 h-3 bg-gray-300'
                          }`}
                        >
                          {step.active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className={`text-sm ${step.active ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </div>
                      {idx < 2 && <div className="w-8 h-px bg-gray-200" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="max-w-[920px] mx-auto">
                <div className="border border-gray-200 rounded-xl bg-white shadow-[0_8px_24px_rgba(17,24,39,0.04)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                          <ProjectOutlined style={{ fontSize: 20 }} />
                        </div>
                        <div className="absolute -right-2 -bottom-2 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center border-2 border-white">
                          <RightOutlined style={{ fontSize: 12 }} />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-gray-900 m-0">Add New Project</h2>
                        <p className="mt-1 mb-0 text-sm text-gray-500">
                          Configure how this project is stored, deployed, and promoted.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-7">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-squid-blue flex items-center justify-center text-white flex-shrink-0">
                          <ProjectOutlined style={{ fontSize: 16 }} />
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                          <PictureOutlined style={{ fontSize: 16 }} />
                        </div>
                      </div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 mb-2">
                        Project name
                      </label>
                      <div className="border-b-2 border-gray-300 focus-within:border-squid-blue transition-colors">
                        <input
                          autoFocus
                          placeholder="Project name"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="w-full text-lg outline-none border-0 bg-transparent py-2 text-gray-900 placeholder-gray-400 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-700 mb-3">
                        Store project process, settings, and non-sensitive variables in
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          {
                            value: 'squid',
                            label: 'Squid',
                            description: 'Store project and deployment process in the Squid database.',
                          },
                          {
                            value: 'git',
                            label: 'Git Repository',
                            description: 'Use configuration as code and keep deployment process in source control.',
                          },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setStorageLocation(option.value)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              storageLocation === option.value
                                ? 'border-squid-blue bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 inline-flex w-5 h-5 rounded-full border-2 items-center justify-center ${
                                  storageLocation === option.value ? 'border-squid-blue' : 'border-gray-300'
                                }`}
                              >
                                {storageLocation === option.value && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-squid-blue" />
                                )}
                              </span>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500 mt-1 leading-relaxed">{option.description}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-700 mb-3">Deploy to</div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {deployTargetOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDeployTarget(option.value)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              deployTarget === option.value
                                ? 'border-squid-blue bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <span
                              className="inline-flex w-8 h-8 rounded-lg items-center justify-center text-sm font-semibold"
                              style={{
                                background: deployTarget === option.value ? `${option.tone}22` : '#f3f4f6',
                                color: deployTarget === option.value ? option.tone : '#6b7280',
                              }}
                            >
                              {option.icon}
                            </span>
                            <span className={`text-sm font-medium ${deployTarget === option.value ? 'text-squid-blue' : 'text-gray-700'}`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-700 mb-3">Manage with</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {manageWithOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setManageWith(option.value)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              manageWith === option.value
                                ? 'border-squid-blue bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <span
                              className={`inline-flex w-5 h-5 rounded-full border-2 items-center justify-center ${
                                manageWith === option.value ? 'border-squid-blue' : 'border-gray-300'
                              }`}
                            >
                              {manageWith === option.value && <span className="w-2.5 h-2.5 rounded-full bg-squid-blue" />}
                            </span>
                            <span className={`text-sm ${manageWith === option.value ? 'text-squid-blue font-medium' : 'text-gray-700'}`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 whitespace-nowrap">
                          Advanced Settings
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="xl:col-span-2">
                          <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-800 mb-1">
                                  Project description
                                </label>
                                <div className="text-xs text-gray-500">
                                  Optional. Add context so your team can quickly understand what this project deploys.
                                </div>
                              </div>
                              <span className="text-xs text-gray-400">{projectDescription.trim().length} chars</span>
                            </div>
                            <textarea
                              placeholder="Describe the service, component, or database managed by this project"
                              value={projectDescription}
                              onChange={(e) => setProjectDescription(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 outline-none resize-y min-h-[92px] text-sm text-gray-900 placeholder-gray-400 focus:border-squid-blue focus:bg-white transition-colors"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Project group</label>
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

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Lifecycle</label>
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
                        </div>

                        <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-gray-500 leading-relaxed">
                              The lifecycle defines how releases can be promoted between environments.
                              <button
                                type="button"
                                className="ml-1 text-squid-blue hover:underline bg-transparent border-0 cursor-pointer p-0"
                              >
                                Create or modify lifecycles
                              </button>
                            </div>
                            <Button type="text" size="small" onClick={() => setShowLifecyclePreview((v) => !v)}>
                              {showLifecyclePreview ? 'Hide Lifecycle' : 'Show Lifecycle'}
                            </Button>
                          </div>

                          {showLifecyclePreview && (() => {
                            const sel = lifecycleOptions.find((o) => o.value === selectedLifecycle);
                            return (
                              <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-white">
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
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
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
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 h-full flex-col p-8 xl:p-10 bg-[#f4f6f8]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
                What is a project?
              </div>
              <div className="text-sm text-gray-700 leading-relaxed">
                A project represents a software component, service, or database that you want to deploy and manage.
                Each project contains its own deployment process, variables, and release history.
              </div>
            </div>

            <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-x-10 top-8 h-24 rounded-full bg-blue-50 blur-2xl opacity-70" />
              <div className="relative z-10 w-full flex flex-col items-center">
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

                <h3 className="text-xl font-semibold text-gray-800 text-center mb-3">
                  Accelerate your deployments
                </h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed max-w-[320px]">
                  Start with the project definition, then choose how releases move through your environments.
                  You can refine the process, variables, and lifecycle after creation.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-[320px]">
                  {['Project settings', 'Deployment process', 'Release and deploy'].map((item, idx) => (
                    <div key={item} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 bg-gray-50/60">
                      <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-xs font-semibold ${
                        idx === 0 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={`text-sm ${idx === 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Project;
