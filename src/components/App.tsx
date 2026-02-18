import { useState } from "react";
import routes from "../routes";
import { Link, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Input, Badge, Dropdown } from "antd";
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  DownOutlined,
  RocketOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import DeploySidebar from "./DeploySidebar";

interface RouteConfig {
  path: string;
  component?: React.ComponentType<any>;
  redirect?: string;
  name?: string;
  meta?: any;
  children?: RouteConfig[];
}

function renderRoutes(routes: RouteConfig[]): React.ReactNode {
  return routes.map((route) => {
    const element = route.redirect ? (
      <Navigate to={route.redirect} replace />
    ) : route.component ? (
      <route.component />
    ) : undefined;

    return (
      <Route key={route.path} path={route.path} element={element}>
        {route.children && renderRoutes(route.children)}
      </Route>
    );
  });
}

const menuItems = [
  {
    path: "/",
    icon: RocketOutlined,
    label: "Deploy",
    isActive: (pathname: string) =>
      pathname === "/" || !pathname.startsWith("/tasks"),
  },
  {
    path: "/tasks",
    icon: ScheduleOutlined,
    label: "Tasks",
    isActive: (pathname: string) => pathname === "/tasks",
  },
];

function App() {
  const location = useLocation();
  const [isProjectHovered, setIsProjectHovered] = useState(false);

  const projectMenuItems: MenuProps["items"] = [];

  const isDeploySection = !location.pathname.startsWith("/tasks");
  const isTopLevel = location.pathname.split("/").length <= 2;
  const showSidebarInline = isDeploySection && isTopLevel;
  const showSidebarOverlay = isDeploySection && !isTopLevel && isProjectHovered;

  return (
    <div
      className="page flex h-screen w-full flex-col"
      style={{ background: "#F5F6F8" }}
    >
      {/* Header - dark theme */}
      <div
        className="page-top-bar flex items-center justify-between px-6 py-3"
        style={{ backgroundColor: "#0a151e" }}
      >
        <div className="left-box flex items-center gap-4">
          <Dropdown menu={{ items: projectMenuItems }} trigger={["click"]}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-white/10 px-3 py-2 rounded-md transition-colors">
              <div className="flex items-center justify-center w-8 h-8 bg-squid-blue rounded">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <span className="font-medium text-white">Default</span>
              <DownOutlined className="text-gray-400 text-xs" />
            </div>
          </Dropdown>

          <Input
            placeholder="Type Ctrl+Space to search or switch projects..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="w-80"
            style={{
              height: "36px",
              borderRadius: "6px",
              backgroundColor: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
            }}
          />
        </div>

        <div className="right-box flex items-center gap-4">
          <Badge count={1} size="small">
            <BellOutlined className="text-gray-300 hover:text-white cursor-pointer text-xl transition-colors" />
          </Badge>
          <QuestionCircleOutlined className="text-gray-300 hover:text-white cursor-pointer text-xl transition-colors" />
        </div>
      </div>

      <div className="page-content flex flex-1 min-h-0">
        {/* Left icon bar - fixed 80px */}
        <div className="flex-shrink-0" style={{ width: "80px" }}>
          <nav className="flex flex-col gap-2 mt-4">
            {menuItems.map((item) => {
              const active = item.isActive(location.pathname);
              const isDeployItem = item.path === "/";
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={isDeployItem ? () => setIsProjectHovered(true) : undefined}
                  onMouseLeave={isDeployItem ? () => setIsProjectHovered(false) : undefined}
                  className={[
                    "group relative flex flex-col items-center justify-center h-16 px-4 rounded-lg font-medium text-sm transition-all duration-200",
                    "text-gray-500",
                    "hover:bg-white hover:text-squid-blue",
                    active ? "bg-white text-squid-blue" : "",
                  ].join(" ")}
                >
                  <Icon className="text-2xl" />
                  <span className="truncate mt-1">{item.label}</span>
                  <span
                    className={[
                      "absolute right-0 top-0 w-1 h-full rounded-full transition-all duration-200",
                      active ? "bg-squid-blue opacity-100" : "bg-transparent opacity-0",
                    ].join(" ")}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Deploy Sidebar */}
        {isDeploySection && (
          <div
            className={[
              "page-content-deploy-sidebar shadow-[-2px_-2px_10px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out overflow-hidden",
              !isTopLevel ? "absolute left-[80px] top-[56px] h-[calc(100%-56px)] z-10 bg-white" : "",
              showSidebarInline || showSidebarOverlay
                ? "w-[220px] opacity-100"
                : "w-0 opacity-0 pointer-events-none",
            ].join(" ")}
            onMouseEnter={() => setIsProjectHovered(true)}
            onMouseLeave={() => setIsProjectHovered(false)}
          >
            <DeploySidebar />
          </div>
        )}

        <div className="page-content-right flex-1 bg-white rounded-md shadow-[-2px_-2px_10px_rgba(0,0,0,0.1)] overflow-y-auto min-h-0">
          <Routes>
            {renderRoutes(routes)}
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
