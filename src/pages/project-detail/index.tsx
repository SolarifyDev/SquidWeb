import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useParams, Link } from "react-router-dom";
import { getProjects, ProjectDto } from "pages/apis/project";
import { getProjectGroups, ProjectGroupDto } from "pages/apis/projectGroup";
import { addRecentProject } from "utils/recentProjects";

// ── Icons ─────────────────────────────────────────────────────────────────────

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
    <path
      fill="currentColor"
      d="M4.46829 18.9062L12.96 10.4688C13.522 9.84375 14.4585 9.84375 15.0205 10.4688C15.6449 11.0312 15.6449 11.9688 15.0205 12.5312L9.08878 18.4688H34.5015C35.3132 18.4688 36 19.1562 36 19.9688C36 20.8438 35.3132 21.4688 34.5015 21.4688L9.08878 21.5312L15.0205 27.4688C15.6449 28.0312 15.6449 28.9688 15.0205 29.5312C14.4585 30.1562 13.522 30.1562 12.96 29.5312L4.46829 21.0312C3.8439 20.4688 3.8439 19.5312 4.46829 18.9062Z"
    />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    {filled ? (
      <path
        fill="currentColor"
        d="M19.9687 4C20.5941 4 21.0944 4.37466 21.3445 4.8742L25.6595 13.6786L35.2274 15.1148C35.7902 15.1773 36.228 15.5519 36.4156 16.1139C36.6032 16.6759 36.4781 17.2379 36.0404 17.675L29.0989 24.5437L30.7248 34.2224C30.8499 34.7843 30.5998 35.4088 30.162 35.721C29.6617 36.0332 29.0364 36.0956 28.5361 35.8459L19.9687 31.2251L11.4639 35.8459C10.9011 36.0956 10.3383 36.0332 9.83798 35.721C9.40023 35.3463 9.15008 34.7843 9.27516 34.2224L10.9011 24.5437L3.95964 17.675C3.52189 17.2379 3.39682 16.6759 3.58442 16.1139C3.77203 15.6144 4.20978 15.1773 4.7726 15.1148L14.3405 13.6786L18.6555 4.8742C18.9056 4.37466 19.4059 4 19.9687 4Z"
      />
    ) : (
      <path
        fill="currentColor"
        d="M19.9687 4C20.5941 4 21.0944 4.37466 21.3445 4.8742L25.6595 13.6786L35.2274 15.1148C35.7902 15.1773 36.228 15.5519 36.4156 16.1139C36.6032 16.6759 36.4781 17.2379 36.0404 17.675L29.0989 24.5437L30.7248 34.2224C30.8499 34.7843 30.5998 35.4088 30.162 35.721C29.6617 36.0332 29.0364 36.0956 28.5361 35.8459L19.9687 31.2251L11.4639 35.8459C10.9011 36.0956 10.3383 36.0332 9.83798 35.721C9.40023 35.3463 9.15008 34.7843 9.27516 34.2224L10.9011 24.5437L3.95964 17.675C3.52189 17.2379 3.39682 16.6759 3.58442 16.1139C3.77203 15.6144 4.20978 15.1773 4.7726 15.1148L14.3405 13.6786L18.6555 4.8742C18.9056 4.37466 19.4059 4 19.9687 4ZM19.9687 8.93299L16.7169 15.7393C16.4667 16.1764 16.0915 16.4886 15.5912 16.551L8.21205 17.6126L13.5276 22.9202C13.9028 23.2949 14.0904 23.7944 13.9653 24.2315L12.7146 31.7246L19.2808 28.2278C19.7186 27.9781 20.2814 27.9781 20.7192 28.2278L27.2854 31.7246L26.0347 24.2939C25.9096 23.7944 26.0972 23.2949 26.4724 22.9826L31.7879 17.6126L24.4088 16.551C23.9085 16.4886 23.5333 16.1764 23.2831 15.7393L19.9687 8.93299Z"
      />
    )}
  </svg>
);

// ── Nav definition ────────────────────────────────────────────────────────────

interface NavItemDef {
  label: string;
  path: string;
}

const navSections: NavItemDef[][] = [
  [
    { label: "Deployments", path: "deployments" },
    { label: "Process", path: "deployments/process" },
    { label: "Channels", path: "deployments/channels" },
    { label: "Releases", path: "releases" },
    { label: "Triggers", path: "triggers" },
    { label: "Settings", path: "deployments/settings" },
  ],
  [
    { label: "Operations", path: "operations" },
    { label: "Runbooks", path: "operations/runbooks" },
    { label: "Runbook Triggers", path: "operations/triggers" },
  ],
  [
    { label: "Project Variables", path: "variables" },
    { label: "Variable Sets", path: "variables/library" },
    { label: "All Variables", path: "variables/all" },
    { label: "Variable Preview", path: "variables/preview" },
  ],
  [{ label: "Tasks", path: "tasks" }],
  [
    { label: "Project Settings", path: "settings" },
    { label: "Version Control", path: "settings/versioncontrol" },
  ],
];

// ── Component ─────────────────────────────────────────────────────────────────

const ProjectDetail: React.FC = () => {
  const location = useLocation();
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [projectGroup, setProjectGroup] = useState<ProjectGroupDto | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!projectName) return;
    getProjects({ pageSize: 500 })
      .then((res) => {
        const found = res.projects.find(
          (p) => p.slug === projectName || p.name === projectName
        );
        if (found) {
          setProject(found);
          return getProjectGroups({ pageSize: 1000 }).then((groupRes) => {
            const group = groupRes.projectGroups.find((g) => g.id === found.projectGroupId);
            if (group) setProjectGroup(group);
          });
        }
      })
      .catch(() => {});
  }, [projectName]);

  useEffect(() => {
    if (!project || !spaceId) return;
    addRecentProject(spaceId, { name: project.name, group: projectGroup?.name });
  }, [project, projectGroup, spaceId]);

  const encodedProjectName = encodeURIComponent(projectName ?? "");
  const base = `/${spaceId}/projects/${encodedProjectName}`;

  const currentSubPath = (() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const projectsIndex = segments.indexOf("projects");

    if (projectsIndex < 0 || projectsIndex + 1 >= segments.length) return "";

    let rest = segments.slice(projectsIndex + 2);
    if (rest[0] === "project-detail") {
      rest = rest.slice(1);
    }

    return rest.join("/");
  })();

  const activeNavPath = navSections
    .flat()
    .map((item) => item.path)
    .filter((path) => currentSubPath === path || currentSubPath.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  const isDeployCreatePath = /^releases\/[^/]+\/deploy(?:ments\/create)?$/.test(currentSubPath);

  const isActive = (path: string) => {
    return activeNavPath === path;
  };

  const displayName = project?.name || projectName || "";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white">
        {/* Breadcrumb */}
        <div className="px-6 pt-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 text-sm">
              <li>
                <Link
                  to={`/${spaceId}/projects`}
                  className="flex items-center gap-1.5 text-squid-blue hover:text-blue-800 font-medium transition-colors"
                >
                  <ArrowLeftIcon />
                  <span>Projects</span>
                </Link>
              </li>
              {projectGroup && (
                <>
                  <li aria-hidden="true">
                    <span className="text-slate-300 mx-0.5">/</span>
                  </li>
                  <li>
                    <Link
                      to={`/${spaceId}/projects`}
                      className="text-squid-blue hover:text-blue-800 transition-colors"
                    >
                      {projectGroup.name}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>
        </div>

        {/* Project header: logo + name + favorite */}
        <div className="px-6 py-3 flex items-center gap-4">
          {/* Logo / avatar */}
          <div className="relative group flex-shrink-0">
            <Link to={`${base}/settings`} className="block">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-sm select-none"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                }}
              >
                {initials}
              </div>
              <div className="absolute inset-0 flex items-end justify-center pb-1 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-white text-[10px] font-semibold">Edit</span>
              </div>
            </Link>
          </div>

          {/* Name + star */}
          <div className="flex items-center gap-2 min-w-0">
            <h2
              className="text-lg font-semibold text-slate-900 truncate"
              title={displayName}
            >
              {displayName}
            </h2>
            <button
              type="button"
              aria-label={`${isFavorite ? "Remove" : "Add"} project ${displayName} ${isFavorite ? "from" : "to"} favorites`}
              onClick={() => setIsFavorite((v) => !v)}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                isFavorite
                  ? "text-yellow-400 hover:text-yellow-500"
                  : "text-slate-300 hover:text-slate-400"
              }`}
            >
              <StarIcon filled={isFavorite} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar nav ─────────────────────────────────────────────────── */}
        <nav
          aria-label="Project navigation"
          className="flex-shrink-0 w-52 bg-white overflow-y-auto flex flex-col"
        >
          <div className="flex-1 py-2">
            {navSections.map((section, sectionIdx) => (
              <React.Fragment key={sectionIdx}>
                {sectionIdx > 0 && (
                  <div className="my-1">
                    <hr className="border-slate-200" />
                  </div>
                )}
                {section.map((item, itemIdx) => {
                  const active = isActive(item.path);
                  const isFirstInSection = itemIdx === 0;
                  const isLastInSection = itemIdx === section.length - 1;
                  const spacingClass = (() => {
                    if (sectionIdx > 0 && isFirstInSection && isLastInSection) return "mt-2 mb-2";
                    if (sectionIdx > 0 && isFirstInSection) return "mt-2 mb-0.5";
                    if (isLastInSection) return "mt-0.5 mb-2";
                    return "my-0.5";
                  })();
                  return (
                    <Link
                      key={item.path}
                      to={`${base}/${item.path}`}
                      className={[
                        "relative flex items-center mx-3 rounded-lg px-3 py-2 text-sm transition-all select-none",
                        spacingClass,
                        active
                          ? "text-squid-blue bg-blue-50/80 font-semibold shadow-sm ring-1 ring-blue-100"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-squid-blue" />
                      )}
                      <span className="leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Bottom scroll pad (matches Octopus css-1ptb5uj) */}
          <div className="h-4 flex-shrink-0" />
        </nav>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className={`flex-1 min-h-0 overflow-auto ${isDeployCreatePath ? 'pt-0' : 'pt-[10px]'} px-4 pb-4`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
