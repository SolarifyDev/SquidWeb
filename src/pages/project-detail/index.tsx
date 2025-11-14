import React from "react";
import { Outlet, useLocation, useParams, useNavigate } from "react-router-dom";
import { Layout, Menu, Typography } from "antd";
import {
  AppstoreOutlined,
  SettingOutlined,
  RocketOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  DeploymentUnitOutlined,
} from "@ant-design/icons";

const { Sider, Content } = Layout;
const { Title } = Typography;

const menu = (projectName?: string) => [
  {
    key: "deployments",
    icon: <RocketOutlined />,
    label: "Deployments",
    path: projectName
      ? `/project/${projectName}/project-detail/deployments`
      : "/project-detail/deployments",
  },
  {
    key: "process",
    icon: <BranchesOutlined />,
    label: "Process",
    path: projectName
      ? `/project/${projectName}/project-detail/process`
      : "/project-detail/process",
  },
  {
    key: "channels",
    icon: <AppstoreOutlined />,
    label: "Channels",
    path: projectName
      ? `/project/${projectName}/project-detail/channels`
      : "/project-detail/channels",
  },
  {
    key: "releases",
    icon: <DeploymentUnitOutlined />,
    label: "Releases",
    path: projectName
      ? `/project/${projectName}/project-detail/releases`
      : "/project-detail/releases",
  },
  {
    key: "triggers",
    icon: <ThunderboltOutlined />,
    label: "Triggers",
    path: projectName
      ? `/project/${projectName}/project-detail/triggers`
      : "/project-detail/triggers",
  },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "Settings",
    path: projectName
      ? `/project/${projectName}/project-detail/settings`
      : "/project-detail/settings",
  },
];

const ProjectDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName: string }>();

  const menuItems = menu(projectName);

  // 选中当前菜单
  const selectedKey =
    menuItems.find((item) => location.pathname === item.path)?.key ||
    menuItems.find((item) => location.pathname.startsWith(item.path))?.key ||
    menuItems[0].key;

  return (
    <Layout className="min-h-screen bg-gray-100">
      <Sider
        width={220}
        style={{ background: "#fff", borderRight: "1px solid #eee" }}
        className="shadow-sm"
      >
        <div className="font-bold text-lg mb-8 text-center py-6 tracking-wide text-blue-700">
          {projectName}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderRight: 0 }}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.path),
          }))}
          className="border-none"
        />
      </Sider>
      <Layout>
        <Content className="p-8 bg-white rounded-md shadow-md m-8">
          <div className="mt-4">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ProjectDetail;
