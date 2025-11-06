import routes from 'routes'
import { Link, Route, Routes, useLocation } from 'react-router-dom'

function App() {
  const location = useLocation();

  return (
    <div className="page flex h-screen w-full flex-col" style={{ background: '#F5F6F8' }}>
      <div className="page-top-bar flex p-4">
        <div className="left-box">
          <div className="logo"></div>
          <div className="search-box"></div>
        </div>
        <div className="right-box flex-1"></div>
      </div>
      <div className="page-content flex flex-1">
        <div className="page-content-left-bar">
          <nav className="flex flex-col gap-2 mt-4">
            {routes
              .filter((route) => route.meta?.showInNav)
              .map((route) => {
                const isActive =
                  route.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(route.path);

                return (
                  <Link
                    key={route.path}
                    to={route.path}
                    className={
                      [
                        "group relative flex flex-col items-center justify-center h-16 px-4 rounded-lg font-medium text-base transition-all duration-200 border",
                        "text-gray-700 border border-transparent",
                        "hover:bg-white hover:text-blue-600",
                        isActive
                          ? "bg-white text-blue-600"
                          : ""
                      ].join(" ")
                    }
                  >
                    <span className="text-2xl">{route.meta.icon}</span>
                    <span className="truncate mt-1">{route.name}</span>
                    <span
                      className={[
                        "absolute right-0 top-0 w-1.5 h-full rounded-full transition-all duration-200",
                        isActive ? "bg-blue-500 opacity-100" : "bg-transparent opacity-0"
                      ].join(" ")}
                    />
                  </Link>
                );
              })}
          </nav>
        </div>
        <div className="page-content-right flex-1 bg-white rounded-md shadow-[-2px_-2px_10px_rgba(0,0,0,0.1)]">
          <Routes>
            {/* 使用路由配置动态生成 Route 组件 */}
            {routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<route.component />}
              />
            ))}
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App
