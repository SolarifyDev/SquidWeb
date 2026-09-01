import { useState, useRef, useEffect } from "react";
import routes from "../routes";
import { Link, Route, Routes, useLocation, Navigate, useNavigate, Outlet, matchPath } from "react-router-dom";
import DeploySidebar from "./DeploySidebar";
import TopProgressBar from "./TopProgressBar";
import SpaceSwitcherDropdown from "./SpaceSwitcherDropdown";
import ProjectSearchPalette from "./ProjectSearchPalette";
import { SpaceContext, SpaceInfo } from "../contexts/SpaceContext";
import { PermissionProvider } from "../contexts/PermissionContext";
import { getSpaces, SpaceDto } from "pages/apis/space";
import SignInPage from "pages/signin";
import ChangePasswordPage from "pages/account/ChangePasswordPage";
import PersonalSettingsPage from "pages/account/PersonalSettingsPage";
import { clearAuthSession, getAuthUser, getMustChangePassword, isAuthenticated as hasAuthSession } from "utils/auth";

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
    ) : route.children ? (
      <Outlet />
    ) : undefined;

    return (
      <Route key={route.path} path={route.path} element={element}>
        {route.children && renderRoutes(route.children)}
      </Route>
    );
  });
}

// ── Octopus-style SVG icons ──────────────────────────────────────────────────

const DeployIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M7.5 10.2C7.5 8.43269 8.89911 7 10.625 7C12.3509 7 13.75 8.43269 13.75 10.2C13.75 11.9673 12.3509 13.4 10.625 13.4C8.89911 13.4 7.5 11.9673 7.5 10.2ZM24.6875 9.2C22.9616 9.2 21.5625 10.6327 21.5625 12.4V27.6C21.5625 31.1346 18.7643 34 15.3125 34C11.8607 34 9.0625 31.1346 9.0625 27.6V18.2C9.0625 17.3163 9.76206 16.6 10.625 16.6C11.4879 16.6 12.1875 17.3163 12.1875 18.2V27.6C12.1875 29.3673 13.5866 30.8 15.3125 30.8C17.0384 30.8 18.4375 29.3673 18.4375 27.6V12.4C18.4375 8.86538 21.2357 6 24.6875 6C28.1393 6 30.9375 8.86538 30.9375 12.4V21.8C30.9375 22.6837 30.2379 23.4 29.375 23.4C28.5121 23.4 27.8125 22.6837 27.8125 21.8V12.4C27.8125 10.6327 26.4134 9.2 24.6875 9.2ZM26.25 29.8C26.25 28.0327 27.6491 26.6 29.375 26.6C31.1009 26.6 32.5 28.0327 32.5 29.8C32.5 31.5673 31.1009 33 29.375 33C27.6491 33 26.25 31.5673 26.25 29.8Z"
    />
  </svg>
);

const InsightsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fill="currentColor"
      d="M37.4818 8.41074C38.1244 9.00188 38.1765 10.0135 37.5982 10.6704L23.5112 26.6703C23.224 26.9966 22.8182 27.1879 22.389 27.1994C21.9597 27.211 21.5447 27.0418 21.241 26.7314L15.3043 20.6627L4.67199 31.5314C4.06074 32.1562 3.0697 32.1562 2.45844 31.5314C1.84719 30.9065 1.84719 29.8935 2.45844 29.2686L14.1976 17.2686C14.8088 16.6438 15.7999 16.6438 16.4111 17.2686L22.288 23.2762L35.2714 8.52967C35.8496 7.87285 36.8393 7.81961 37.4818 8.41074Z"
    />
  </svg>
);

const TasksIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fill="currentColor"
      d="M5 13C5 11.625 6.0625 10.5 7.5 10.5H10.5C11.875 10.5 13 11.625 13 13V16C13 17.4375 11.875 18.5 10.5 18.5H7.5C6.0625 18.5 5 17.4375 5 16V13ZM5 24C5 22.625 6.0625 21.5 7.5 21.5H10.5C11.875 21.5 13 22.625 13 24V27C13 28.4375 11.875 29.5 10.5 29.5H7.5C6.0625 29.5 5 28.4375 5 27V24ZM18.5 10.5H21.5C22.875 10.5 24 11.625 24 13V16C24 17.4375 22.875 18.5 21.5 18.5H18.5C17.0625 18.5 16 17.4375 16 16V13C16 11.625 17.0625 10.5 18.5 10.5ZM16 24C16 22.625 17.0625 21.5 18.5 21.5H21.5C22.875 21.5 24 22.625 24 24V27C24 28.4375 22.875 29.5 21.5 29.5H18.5C17.0625 29.5 16 28.4375 16 27V24ZM32.5 13H29.5V16H32.5V13ZM29.5 10.5H32.5C33.875 10.5 35 11.625 35 13V16C35 17.4375 33.875 18.5 32.5 18.5H29.5C28.0625 18.5 27 17.4375 27 16V13C27 11.625 28.0625 10.5 29.5 10.5ZM29.5 24V27H32.5V24H29.5ZM27 24C27 22.625 28.0625 21.5 29.5 21.5H32.5C33.875 21.5 35 22.625 35 24V27C35 28.4375 33.875 29.5 32.5 29.5H29.5C28.0625 29.5 27 28.4375 27 27V24Z"
    />
  </svg>
);

const ConfigIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      fill="currentColor"
      d="M20.0078 4C21.0654 4 22.0608 4.125 23.0562 4.3125C23.5539 4.4375 24.4249 4.6875 24.9226 5.5625C25.047 5.8125 25.1093 6.0625 25.1715 6.3125L25.7936 8.75C25.8558 9.0625 26.4779 9.4375 26.8512 9.3125L29.2153 8.625C29.4642 8.5625 29.713 8.5 29.9619 8.5C30.9573 8.5 31.6416 9.125 31.9527 9.5C33.3214 11.0625 34.379 12.875 35.0634 14.875C35.25 15.375 35.4366 16.25 34.8767 17.0625C34.7523 17.3125 34.5657 17.5 34.379 17.6875L32.637 19.4375C32.326 19.6875 32.326 20.375 32.637 20.625L34.379 22.375C34.5657 22.5625 34.7523 22.75 34.8767 23C35.3744 23.8125 35.1878 24.6875 35.0634 25.1875C34.379 27.1875 33.3214 29 31.9527 30.5625C31.6416 30.9375 30.9573 31.5625 29.9619 31.5625C29.713 31.5625 29.4642 31.5 29.2153 31.4375L26.8512 30.6875C26.4779 30.625 25.8558 30.9375 25.7936 31.3125L25.1715 33.75C25.1093 34 25.047 34.25 24.9226 34.5C24.4249 35.375 23.5539 35.625 23.0562 35.75C22.0608 35.9375 21.0654 36 20.0078 36C18.9502 36 17.8925 35.9375 16.8971 35.75C16.3994 35.625 15.5284 35.375 15.0307 34.5C14.9063 34.25 14.8441 34 14.7819 33.75L14.1597 31.3125C14.0975 30.9375 13.4754 30.625 13.1643 30.6875L10.8002 31.4375C10.5514 31.5 10.2403 31.5 9.99146 31.5625C8.99605 31.5625 8.3117 30.9375 8.00064 30.5625C6.63195 29 5.57432 27.1875 4.88998 25.1875C4.76555 24.6875 4.57891 23.8125 5.07662 22.9375C5.20105 22.75 5.38768 22.5 5.57432 22.3125L7.37851 20.625C7.62736 20.375 7.62736 19.6875 7.37851 19.4375L5.57432 17.6875C5.38768 17.5 5.20105 17.3125 5.07662 17.0625C4.57891 16.25 4.76555 15.375 4.88998 14.875C5.57432 12.875 6.63195 11.0625 8.00064 9.5C8.3117 9.125 8.99605 8.5 9.99146 8.5C10.2403 8.5 10.5514 8.5625 10.8002 8.625L13.1643 9.3125C13.4754 9.4375 14.0975 9.0625 14.1597 8.75L14.7819 6.3125C14.8441 6.0625 14.9063 5.8125 15.0307 5.5625C15.5284 4.6875 16.3994 4.4375 16.8971 4.3125C17.8925 4.125 18.9502 4 20.0078 4ZM17.6437 7.25L17.0838 9.4375C16.5861 11.4375 14.2842 12.8125 12.2933 12.25L10.1159 11.5625C9.12047 12.8125 8.3117 14.1875 7.75178 15.6875L9.43154 17.25C10.9247 18.6875 10.9247 21.375 9.43154 22.8125L7.75178 24.375C8.3117 25.875 9.12047 27.25 10.1159 28.5L12.2933 27.8125C14.2842 27.25 16.5861 28.625 17.0838 30.625L17.6437 32.8125C19.1368 33.125 20.8165 33.125 22.3719 32.8125L22.8696 30.625C23.3673 28.625 25.6692 27.25 27.66 27.8125L29.8375 28.5C30.8329 27.25 31.6416 25.875 32.2016 24.375L30.584 22.8125C29.0909 21.375 29.0909 18.6875 30.584 17.25L32.2016 15.6875C31.6416 14.1875 30.8329 12.8125 29.8375 11.5625L27.66 12.25C25.7314 12.8125 23.3673 11.4375 22.8696 9.4375L22.3719 7.25C20.8165 6.9375 19.1368 6.9375 17.6437 7.25ZM17.0215 20C17.0215 21.125 17.5815 22.0625 18.5147 22.625C19.3856 23.1875 20.5677 23.1875 21.5009 22.625C22.3719 22.0625 22.994 21.125 22.994 20C22.994 18.9375 22.3719 18 21.5009 17.4375C20.5677 16.875 19.3856 16.875 18.5147 17.4375C17.5815 18 17.0215 18.9375 17.0215 20ZM20.0078 26C17.8303 26 15.9017 24.875 14.7819 23C13.7242 21.1875 13.7242 18.875 14.7819 17C15.9017 15.1875 17.8303 14 20.0078 14C22.123 14 24.0516 15.1875 25.1715 17C26.2291 18.875 26.2291 21.1875 25.1715 23C24.0516 24.875 22.123 26 20.0078 26Z"
    />
  </svg>
);

// ── Nav item helper ──────────────────────────────────────────────────────────

function NavItem({
  to,
  label,
  active,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  to: string;
  label: string;
  active: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={[
        "relative my-1 flex flex-col items-center justify-center h-14 px-1 font-medium text-sm transition-colors duration-200 select-none",
        active
          ? "text-squid-blue"
          : "text-slate-500 hover:text-squid-blue",
      ].join(" ")}
    >
      {children}
      <span className="text-[10px] mt-0.5 leading-tight tracking-[0.02em]">{label}</span>
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-squid-blue rounded-r-full" />
      )}
    </Link>
  );
}

// ── Header SVG icons ─────────────────────────────────────────────────────────

const BellIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fill="currentColor" d="M20.0313 4C21.0942 4 22.0322 4.9375 22.0322 6V7.125C26.5342 7.875 30.0357 11.8125 30.0357 16.5V18.625C30.0357 21.4375 30.9736 24.1875 32.7244 26.4375L33.6623 27.5625C34.0375 28.0625 34.1 28.6875 33.8499 29.1875C33.5998 29.6875 33.0996 30 32.5368 30H7.52568C6.9004 30 6.40018 29.6875 6.15007 29.1875C5.89996 28.6875 5.96248 28.0625 6.33765 27.5625L7.27557 26.4375C9.02635 24.1875 10.0268 21.4375 10.0268 18.625V16.5C10.0268 11.8125 13.4658 7.875 18.0304 7.125V6C18.0304 4.9375 18.9058 4 20.0313 4ZM20.0313 10H19.531C15.9044 10 13.0281 12.9375 13.0281 16.5V18.625C13.0281 21.625 12.1527 24.5 10.527 27H29.473C27.8473 24.5 27.0344 21.625 27.0344 18.625V16.5C27.0344 12.9375 24.0956 10 20.5315 10H20.0313ZM24.0331 32C24.0331 33.0625 23.5954 34.125 22.845 34.875C22.0947 35.625 21.0942 36 20.0313 36C18.9683 36 17.9053 35.625 17.155 34.875C16.4046 34.125 16.0295 33.0625 16.0295 32H20.0313H24.0331Z" />
  </svg>
);

const HelpIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fill="currentColor" d="M20 4C28.8125 4 36 11.1875 36 20C36 28.875 28.8125 36 20 36C11.125 36 4 28.875 4 20C4 11.1875 11.125 4 20 4ZM20 33C27.125 33 33 27.1875 33 20C33 12.875 27.125 7 20 7C12.8125 7 7 12.875 7 20C7 27.1875 12.8125 33 20 33ZM20 25C21.0625 25 22 25.875 22 27C22 28.125 21.0625 29 20 29C18.8125 29 18.125 28.125 18 27C18 25.875 18.875 25 20 25ZM22.0625 12C24.5625 12 26.5 13.9375 26.4375 16.375C26.4375 17.875 25.625 19.3125 24.3125 20.125L21.5 21.875V22C21.5 22.8125 20.8125 23.5 20 23.5C19.1875 23.5 18.5 22.8125 18.5 22V21C18.5 20.5 18.75 20 19.25 19.6875L22.8125 17.5625C23.25 17.3125 23.5 16.875 23.5 16.375C23.5 15.625 22.8125 15 22 15H18.8125C18.0625 15 17.5 15.625 17.5 16.375C17.5 17.1875 16.8125 17.875 16 17.875C15.1875 17.875 14.5 17.1875 14.5 16.375C14.5 13.9375 16.4375 12 18.875 12H22.0625Z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fill="currentColor" d="M18.5625 29.4375C19.3125 30.25 20.625 30.25 21.375 29.4375L33.375 17.4375C34.1875 16.6875 34.1875 15.375 33.375 14.625C32.625 13.8125 31.3125 13.8125 30.5625 14.625L20 25.1875L9.375 14.625C8.625 13.8125 7.3125 13.8125 6.5625 14.625C5.75 15.375 5.75 16.6875 6.5625 17.4375L18.5625 29.4375Z" />
  </svg>
);

// ── App ──────────────────────────────────────────────────────────────────────

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = hasAuthSession();
  const mustChangePassword = getMustChangePassword();
  const isSignInRoute = location.pathname.startsWith("/users/sign-in");
  const isChangePasswordRoute = location.pathname.startsWith("/users/change-password");
  const isPersonalSettingsRoute = location.pathname.startsWith("/users/me");
  const isImportProjectsPage = Boolean(
    matchPath("/:spaceId/projects/import", location.pathname),
  );
  const [isProjectHovered, setIsProjectHovered] = useState(false);
  const [showSpaceSwitcher, setShowSpaceSwitcher] = useState(false);
  const spaceSwitcherRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const authUser = getAuthUser();
  const userDisplayName = authUser?.displayName || authUser?.userName || "User";
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || "U";

  // Canonical space routes always use /Spaces-{id}/...
  const rawSegment = location.pathname.split('/')[1] ?? '';
  const routeSpaceMatch = rawSegment.match(/^Spaces-(\d+)$/i);
  const routeSpaceId = routeSpaceMatch ? parseInt(routeSpaceMatch[1], 10) || 1 : null;
  const matchedSpaceByLegacySlug = spaces.find((space) => space.slug === rawSegment);
  const currentSpaceId = routeSpaceId ?? matchedSpaceByLegacySlug?.id ?? 1;
  const spaceSlug = `Spaces-${currentSpaceId}`;
  const matchedSpace = spaces.find((space) => space.id === currentSpaceId) ?? matchedSpaceByLegacySlug;
  const currentSpace: SpaceInfo = matchedSpace
    ? {
      id: matchedSpace.id,
      slug: `Spaces-${matchedSpace.id}`,
      name: matchedSpace.name,
    }
    : {
      id: currentSpaceId,
      slug: spaceSlug,
      name: spaces.length === 0 ? 'Default' : `Space ${currentSpaceId}`,
    };

  useEffect(() => {
    if (!isAuthenticated) return;
    getSpaces().then(setSpaces).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!matchedSpaceByLegacySlug) return;
    if (rawSegment === spaceSlug) return;
    const suffix = location.pathname.slice(`/${rawSegment}`.length);
    navigate(`/${spaceSlug}${suffix}${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, matchedSpaceByLegacySlug, navigate, rawSegment, spaceSlug]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isInsideModalOrDropdown = Boolean(target?.closest('.ant-modal-root') || target?.closest('.ant-select-dropdown'));
      if (isInsideModalOrDropdown) return;
      if (spaceSwitcherRef.current && !spaceSwitcherRef.current.contains(e.target as Node)) {
        setShowSpaceSwitcher(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showSpaceSwitcher || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpaceSwitcher, showUserMenu]);

  const handleSelectSpace = (space: SpaceDto) => {
    navigate(`/Spaces-${space.id}/projects`);
    setShowSpaceSwitcher(false);
  };

  const handleCreateSpaceFromSwitcher = (space: SpaceDto) => {
    setSpaces((previous) => {
      const nextMap = new Map<number, SpaceDto>();
      for (const item of previous) nextMap.set(item.id, item);
      nextMap.set(space.id, space);
      return Array.from(nextMap.values()).sort((left, right) => left.name.localeCompare(right.name));
    });
    handleSelectSpace(space);
  };

  const handleLogout = () => {
    clearAuthSession();
    setShowUserMenu(false);
    navigate("/users/sign-in", { replace: true });
  };

  const settingsBasePath = `/${spaceSlug}/settings`;
  const deployHomePath = `/${spaceSlug}/projects`;
  const isSettingsActive = location.pathname.startsWith(settingsBasePath) || location.pathname.startsWith("/configuration");
  const isDeployActive =
    !isPersonalSettingsRoute &&
    !isSettingsActive &&
    !location.pathname.startsWith("/tasks") &&
    !location.pathname.startsWith("/insights");
  const isInsightsActive = location.pathname.startsWith("/insights");
  const isTasksActive = location.pathname.startsWith("/tasks");

  const isDeploySection = isDeployActive;
  const isProjectDetailPage =
    Boolean(matchPath("/:spaceId/projects/:projectName/*", location.pathname)) &&
    !isImportProjectsPage;
  const showSidebarInline = isDeploySection && !isProjectDetailPage;
  const showSidebarOverlay = isDeploySection && isProjectDetailPage && isProjectHovered;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  if (!isAuthenticated) {
    const to = `/users/sign-in?redirect=${encodeURIComponent(currentPath)}`;

    return (
      <Routes>
        <Route path="/users/sign-in" element={<SignInPage />} />
        <Route path="*" element={<Navigate to={to} replace />} />
      </Routes>
    );
  }

  if (mustChangePassword && !isChangePasswordRoute) {
    return <Navigate to={`/users/change-password?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  if (isSignInRoute) {
    return <Navigate to={mustChangePassword ? "/users/change-password" : deployHomePath} replace />;
  }

  if (isChangePasswordRoute) {
    if (!mustChangePassword) return <Navigate to="/users/me" replace />;
    return <ChangePasswordPage />;
  }

  return (
    <SpaceContext.Provider value={{ space: currentSpace }}>
    <PermissionProvider>
    <div className="page flex h-screen w-full flex-col bg-[#f1f2f4]">
      <div
        className="page-top-bar flex-shrink-0 flex items-center px-4 gap-3 bg-[#f1f2f4]"
        style={{ height: "64px" }}
      >
        <div className="relative flex-shrink-0" ref={spaceSwitcherRef}>
          <button
            aria-label="Space switcher"
            aria-haspopup="dialog"
            aria-expanded={showSpaceSwitcher}
            onClick={() => setShowSpaceSwitcher(p => !p)}
            className={`group relative flex h-9 items-center rounded-xl pl-[50px] pr-3 text-left transition-colors ${showSpaceSwitcher ? 'bg-squid-blue' : 'bg-slate-100 hover:bg-squid-blue'}`}
            style={{
              width: 'clamp(200px, 17vw, 248px)',
              boxShadow: '0 1px 2px rgba(15,23,42,0.07)',
            }}
          >
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '11px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 6px rgba(15,23,42,0.14)',
              }}
            >
              <img src="/squid-logo.png" alt="Space Default Logo" className="w-full h-full object-contain p-1" />
            </span>
            <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] transition-colors ${showSpaceSwitcher ? 'text-white' : 'text-slate-700 group-hover:text-white'}`}>
              {currentSpace.name}
            </span>
            <ChevronDownIcon className={`w-4 h-4 flex-shrink-0 transition-all ${showSpaceSwitcher ? 'text-white rotate-180' : 'text-slate-500 group-hover:text-white'}`} />
          </button>
          {showSpaceSwitcher && (
            <SpaceSwitcherDropdown
              spaces={spaces}
              currentSpaceId={currentSpace.id}
              onSelectSpace={handleSelectSpace}
              onCreateSpace={handleCreateSpaceFromSwitcher}
              onClose={() => setShowSpaceSwitcher(false)}
            />
          )}
        </div>

        <ProjectSearchPalette />

        {/* Spacer */}
        <div className="flex-1" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            aria-label="Notifications"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-transparent bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white hover:border-slate-200 transition-colors cursor-pointer"
          >
            <BellIcon className="w-5 h-5" />
            <div
              className="absolute rounded-full bg-blue-500"
              style={{ width: 7, height: 7, top: 9, right: 9 }}
            />
          </button>

          <button
            aria-label="Help"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-transparent bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white hover:border-slate-200 transition-colors cursor-pointer"
          >
            <HelpIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="page-content relative flex flex-1 min-h-0 bg-[#f1f2f4]">
        <div
          className="flex-shrink-0 flex flex-col bg-[#f1f2f4]"
          style={{ width: "72px", height: "100%" }}
        >
          <nav className="flex flex-col pt-2">
            <NavItem
              to={deployHomePath}
              label="Deploy"
              active={isDeployActive}
              onMouseEnter={() => setIsProjectHovered(true)}
              onMouseLeave={() => setIsProjectHovered(false)}
            >
              <DeployIcon className="w-6 h-6" />
            </NavItem>

            <NavItem to="/insights" label="Insights" active={isInsightsActive}>
              <InsightsIcon className="w-6 h-6" />
            </NavItem>

            <NavItem to="/tasks" label="Tasks" active={isTasksActive}>
              <TasksIcon className="w-6 h-6" />
            </NavItem>
          </nav>

          <div className="flex-1" />

          <div className="mx-3 mb-2 border-t border-slate-200/80" />

          <div className="flex flex-col items-center pb-3 gap-1">
            <Link
              to={settingsBasePath}
              title="Settings"
              className={[
                "relative flex flex-col items-center justify-center h-12 w-full self-stretch px-2 transition-colors duration-200",
                isSettingsActive
                  ? "text-squid-blue"
                  : "text-slate-500 hover:text-squid-blue",
              ].join(" ")}
            >
              <ConfigIcon className="w-6 h-6" />
              {isSettingsActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-squid-blue rounded-r-full" />
              )}
            </Link>

            <div className="relative mb-1" ref={userMenuRef}>
              <button
                type="button"
                aria-label="User account"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
                onClick={() => setShowUserMenu((v) => !v)}
                className={[
                  "w-9 h-9 rounded-full bg-white border shadow-sm flex items-center justify-center cursor-pointer transition-all",
                  showUserMenu
                    ? "border-squid-blue ring-2 ring-blue-100"
                    : "border-slate-200 hover:ring-2 hover:ring-blue-100 hover:border-squid-blue",
                ].join(" ")}
                title={userDisplayName}
              >
                <span className="text-xs font-bold text-slate-600 select-none">{userInitial}</span>
              </button>

              {showUserMenu && (
                <div
                  role="menu"
                  aria-label="User account"
                  className="absolute left-full bottom-0 ml-3 w-64 rounded-xl border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.14)] overflow-hidden z-30"
                >
                  <div className="px-3 py-3 flex items-center gap-3 bg-white">
                    <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-sm font-semibold text-slate-700 flex-shrink-0">
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{userDisplayName}</div>
                      {authUser?.userName && authUser.userName !== userDisplayName && (
                        <div className="text-xs text-slate-500 truncate">{authUser.userName}</div>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-slate-200" />

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false)
                      navigate("/users/me")
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-0 bg-transparent cursor-pointer"
                  >
                    My Profile
                  </button>

                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-0 bg-transparent cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isDeploySection && (
          <div
            className={[
              "page-content-deploy-sidebar transition-all duration-300 ease-in-out overflow-hidden rounded-tl-md",
              isProjectDetailPage ? "absolute left-[72px] top-0 h-full z-10 bg-[#fbfcfd]" : "",
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

        <div className={`page-content-right relative z-0 flex flex-1 flex-col min-h-0 bg-white overflow-hidden ${showSidebarInline ? '' : 'rounded-tl-md'}`}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Routes>
              {renderRoutes(routes)}
            </Routes>
          </div>
        </div>

        <div className="pointer-events-none absolute left-[72px] right-0 top-0 z-50">
          <TopProgressBar />
        </div>
      </div>
    </div>
    </PermissionProvider>
    </SpaceContext.Provider>
  );
}

export default App;
