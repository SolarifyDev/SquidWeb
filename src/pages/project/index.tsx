import React, { useState, CSSProperties } from 'react';
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
  Radio
} from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  DownOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import type { MenuProps, TableColumnsType } from 'antd';

const { Title, Text, Link } = Typography;

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
    marginBottom: '16px',
  },
  filters: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f0f0f0',
  },
  groups: {
    marginTop: '24px',
  },
  group: {
    marginBottom: '32px',
  },
  groupHeader: {
    padding: '12px 0',
    borderBottom: '2px solid #f0f0f0',
    marginBottom: 0,
  },
  deploymentCell: {
    display: 'flex',
    alignItems: 'center',
  },
  deploymentInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  deploymentText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  versionText: {
    fontSize: '14px',
    color: '#262626',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '150px',
  },
  timestampText: {
    fontSize: '13px',
    color: '#999',
  },
  pageSizeText: {
    cursor: 'pointer',
    userSelect: 'none',
  },
  modalDescription: {
    color: '#8c8c8c',
    fontSize: '14px',
    marginBottom: '24px',
  },
  filterSection: {
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f0f0f0',
  },
  filterSectionLast: {
    marginBottom: '24px',
  },
  filterLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#262626',
    marginBottom: '4px',
  },
  filterDescription: {
    fontSize: '13px',
    color: '#8c8c8c',
    marginBottom: '12px',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
};

const Project: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [projectGroups, setProjectGroups] = useState('all');
  const [projects, setProjects] = useState('all');
  const [environments, setEnvironments] = useState('all');
  const [tenants, setTenants] = useState('all');
  
  const totalProjects = 399;

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
      style={{ minWidth: '180px' }}
      items={[
        {
          key: 'header',
          label: (
            <div style={{ fontWeight: 600, color: '#262626', padding: '4px 0', cursor: 'default' }}>
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

  const renderDeploymentCell = (deployment: DeploymentInfo | null) => {
    if (!deployment) {
      return (
        <div style={{ ...styles.deploymentCell, color: '#999' }}>
          <MinusCircleOutlined style={{ color: '#d9d9d9', marginRight: 8 }} />
          <Text type="secondary">No Data</Text>
        </div>
      );
    }

    const icon = deployment.status === 'success' 
      ? <CheckCircleFilled style={{ color: '#52c41a' }} />
      : deployment.status === 'failed'
      ? <CloseCircleFilled style={{ color: '#ff4d4f' }} />
      : <MinusCircleOutlined style={{ color: '#d9d9d9' }} />;

    return (
      <div style={styles.deploymentCell}>
        <div style={styles.deploymentInfo}>
          <span style={{ marginTop: '2px', fontSize: '18px' }}>{icon}</span>
          <div style={styles.deploymentText}>
            <Tooltip title={deployment.version}>
              <Text strong style={styles.versionText as CSSProperties}>
                {deployment.version}
              </Text>
            </Tooltip>
            <Text type="secondary" style={styles.timestampText}>
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
          <ProjectOutlined style={{ color: '#d9d9d9', fontSize: 20 }} />
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
    <div style={styles.container}>
      <style>{tableStyles}</style>
      
      <div style={styles.header}>
        <Title level={3} style={{ margin: 0 }}>Projects</Title>
        <Space>
          <Dropdown menu={{ items: importExportItems }} placement="bottomRight">
            <Button>
              Import/Export <DownOutlined />
            </Button>
          </Dropdown>
          <Button type="primary" style={{ backgroundColor: '#2e7d32' }}>
            Add Project
          </Button>
        </Space>
      </div>

      <div style={styles.filters}>
        <Space size={16}>
          <Input
            placeholder="Find projects or project groups"
            prefix={<SearchOutlined style={{ color: '#999' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320 }}
          />
          <Link onClick={() => setShowFiltersModal(true)}>
            <FilterOutlined /> Advanced filters
          </Link>
        </Space>
        <Space size={8}>
          <Dropdown overlay={pageSizeMenu} trigger={['click']}>
            <Text style={styles.pageSizeText}>
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

      <div style={styles.groups}>
        {projectGroupsData.map((group) => (
          <div key={group.name} style={styles.group}>
            <div style={styles.groupHeader}>
              <Space>
                <Text strong style={{ fontSize: 16 }}>{group.name}</Text>
                <Badge 
                  count={group.count} 
                  style={{ backgroundColor: '#d9d9d9', color: '#666' }}
                />
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={group.projects}
              pagination={false}
              className="project-table"
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
          <Button key="save" type="primary" onClick={handleSaveFilters} style={{ backgroundColor: '#d9d9d9', borderColor: '#d9d9d9', color: '#000' }}>
            Save
          </Button>,
        ]}
        width={600}
      >
        <div style={styles.modalDescription}>
          Change and save the default view of the dashboard to display all or only selected projects, 
          environments or releases for a tenant.
        </div>

        <div style={styles.filterSection}>
          <div style={styles.filterLabel}>Project Groups</div>
          <div style={styles.filterDescription}>View all or selected project groups</div>
          <Radio.Group 
            value={projectGroups} 
            onChange={(e) => setProjectGroups(e.target.value)}
            style={styles.radioGroup}
          >
            <Radio value="all">All project groups (default)</Radio>
            <Radio value="selected">Only selected project groups</Radio>
          </Radio.Group>
        </div>

        <div style={styles.filterSection}>
          <div style={styles.filterLabel}>Projects</div>
          <div style={styles.filterDescription}>View all or selected projects</div>
          <Radio.Group 
            value={projects} 
            onChange={(e) => setProjects(e.target.value)}
            style={styles.radioGroup}
          >
            <Radio value="all">All projects (default)</Radio>
            <Radio value="selected">Only selected projects</Radio>
          </Radio.Group>
        </div>

        <div style={styles.filterSection}>
          <div style={styles.filterLabel}>Environments</div>
          <div style={styles.filterDescription}>View all or selected environments</div>
          <Radio.Group 
            value={environments} 
            onChange={(e) => setEnvironments(e.target.value)}
            style={styles.radioGroup}
          >
            <Radio value="all">All environments (default)</Radio>
            <Radio value="selected">Only selected environments</Radio>
          </Radio.Group>
        </div>

        <div style={styles.filterSectionLast}>
          <div style={styles.filterLabel}>Tenants</div>
          <div style={styles.filterDescription}>View all or selected tenants</div>
          <Radio.Group 
            value={tenants} 
            onChange={(e) => setTenants(e.target.value)}
            style={styles.radioGroup}
          >
            <Radio value="all">All tenants (default)</Radio>
            <Radio value="selected">Only selected tenants</Radio>
          </Radio.Group>
        </div>
      </Modal>
    </div>
  );
};

export default Project;