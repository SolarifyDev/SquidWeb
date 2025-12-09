import { useState } from "react";
import routes from "../routes";
import { Link, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Input, Badge, Dropdown, Menu } from "antd";
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  DownOutlined,
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

// function renderRoutes(routesArr: RouteConfig[]): React.ReactNode {
//   const arr = routesArr.map((route) => {
//     if (route.redirect) {
//       return (
//         <Route
//           key={route.path}
//           path={route.path}
//           element={<Navigate to={route.redirect} replace />}
//         />
//       );
//     }
//     if (route.children && route.children.length > 0) {
//       return (
//         <Route
//           key={route.path}
//           path={route.path}
//           element={route.component ? <route.component /> : undefined}
//         >
//           {renderRoutes(route.children)}
//         </Route>
//       );
//     }
//     return (
//       <Route
//         key={route.path}
//         path={route.path}
//         element={route.component ? <route.component /> : undefined}
//       />
//     );
//   });
//   console.log(arr);

//   return arr;
// }

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
    icon: "🏠",
    label: "Deploy",
    isActive: (pathname: string) =>
      pathname === "/" || !pathname.startsWith("/tasks"),
  },
  {
    path: "/tasks",
    icon: "📝",
    label: "Tasks",
    isActive: (pathname: string) => pathname === "/tasks",
  },
];

function App() {
  const location = useLocation();
  const [isProjectHovered, setIsProjectHovered] = useState(false);

  console.log(location);

  // 项目切换菜单
  const projectMenuItems: MenuProps["items"] = [];

  return (
    <div
      className="page flex h-screen w-full flex-col"
      style={{ background: "#F5F6F8" }}
    >
      <div className="page-top-bar flex items-center justify-between px-6 py-3">
        <div className="left-box flex items-center gap-4">
          {/* Logo/Project Selector */}
          <Dropdown menu={{ items: projectMenuItems }} trigger={["click"]}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-md transition-colors">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <span className="font-medium text-gray-900">Default</span>
              <DownOutlined className="text-gray-500 text-xs" />
            </div>
          </Dropdown>

          {/* Search Box */}
          <Input
            placeholder="Type Ctrl+Space to search or switch projects..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="w-80"
            style={{
              height: "36px",
              borderRadius: "6px",
              backgroundColor: "#F5F6F8",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div className="right-box flex items-center gap-4">
          {/* Notification Bell with Badge */}
          <Badge count={1} size="small">
            <BellOutlined className="text-gray-600 hover:text-gray-900 cursor-pointer text-xl transition-colors" />
          </Badge>

          {/* Help Icon */}
          <QuestionCircleOutlined className="text-gray-600 hover:text-gray-900 cursor-pointer text-xl transition-colors" />
        </div>
      </div>

      <div className="page-content flex flex-1 min-h-0">
        {/* 主导航栏 */}
        <div className="page-content-left-bar">
          <nav className="flex flex-col gap-2 mt-4">
            {menuItems.map((item) => {
              const active = item.isActive(location.pathname);
              const isDeployItem = item.path === "/";
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={isDeployItem ? () => setIsProjectHovered(true) : undefined}
                  onMouseLeave={isDeployItem ? () => setIsProjectHovered(false) : undefined}
                  className={[
                    "group relative flex flex-col items-center justify-center h-16 px-4 rounded-lg font-medium text-base transition-all duration-200 border",
                    "text-gray-700 border border-transparent",
                    "hover:bg-white hover:text-blue-600",
                    active ? "bg-white text-blue-600" : "",
                  ].join(" ")}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="truncate mt-1">{item.label}</span>
                  <span
                    className={[
                      "absolute right-0 top-0 w-1.5 h-full rounded-full transition-all duration-200",
                      active ? "bg-blue-500 opacity-100" : "bg-transparent opacity-0",
                    ].join(" ")}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
        {/* DeploySidebar 只在点击 Deploy 时显示 */}
        {(location.pathname === "/" || !location.pathname.startsWith("/tasks")) ? (
        <div
        className={`page-content-deploy-sidebar shadow-[-2px_-2px_10px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out overflow-hidden ${
          location.pathname.split("/").length > 3
          ? "absolute left-[85px] top-0 h-full z-10 bg-white"
          : ""
        } ${
          location.pathname.split("/").length <= 3 || isProjectHovered
          ? "w-[220px] opacity-100"
          : "w-0 opacity-0 pointer-events-none"
        }`}
        onMouseEnter={() => setIsProjectHovered(true)}
        onMouseLeave={() => setIsProjectHovered(false)}
        >
          <DeploySidebar />
        </div>
         ) : null}

        <div className="page-content-right flex-1 bg-white rounded-md shadow-[-2px_-2px_10px_rgba(0,0,0,0.1)] overflow-y-auto min-h-0">
        <Routes>
             {routes.map((route) => {
                   const Component = route.component;

                return (
                   <Route
                      key={route.path}
                      path={route.path}
                      element={Component ? <Component /> : null}
               />
              );
              })}
        </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
