import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';
import { getProjects, type ProjectDto } from 'pages/apis/project';
import { getProjectGroups } from 'pages/apis/projectGroup';
import { addRecentProject, getRecentProjects, type RecentProject } from 'utils/recentProjects';

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="6" />
    <path d="m17 17-3.6-3.6" />
  </svg>
);

const ProjectGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#0a151e" />
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5V9H3V6.5Z" fill="#1f2d3a" />
    <circle cx="6.2" cy="6.4" r="0.7" fill="#64748b" />
    <circle cx="8.5" cy="6.4" r="0.7" fill="#64748b" />
    <rect x="6" y="11.5" width="9" height="1.6" rx="0.8" fill="#cbd5e1" />
    <rect x="6" y="15" width="6" height="1.6" rx="0.8" fill="#64748b" />
  </svg>
);

const ProjectSearchPalette: React.FC = () => {
  const navigate = useNavigate();
  const { space } = useSpace();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const groupsLoadedRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [groupNames, setGroupNames] = useState<Record<number, string>>({});
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  // Load recent list + project-group names (once per space) when the palette opens.
  useEffect(() => {
    if (!open) return;

    setRecent(getRecentProjects(space.slug));

    if (groupsLoadedRef.current === space.id) return;

    getProjectGroups({ spaceId: space.id, pageSize: 1000 }, { silentLoading: true })
      .then((res) => {
        const map: Record<number, string> = {};
        (res.projectGroups ?? []).forEach((group) => { map[group.id] = group.name; });
        setGroupNames(map);
        groupsLoadedRef.current = space.id;
      })
      .catch(() => {});
  }, [open, space.slug, space.id]);

  // Debounced project fetch (server-side keyword search).
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      getProjects({ keyword: trimmed || undefined, spaceId: space.id, pageSize: 50 }, { silentLoading: true })
        .then((res) => {
          if (cancelled) return;
          setProjects(res.projects ?? []);
          setTotal(res.count ?? 0);
          setActiveIndex(-1);
        })
        .catch(() => { if (!cancelled) { setProjects([]); setTotal(0); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 180);

    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, trimmed, space.id]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Global Ctrl+Space focuses the palette.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const goToProject = useCallback((name: string, group?: string) => {
    addRecentProject(space.slug, { name, group });
    setOpen(false);
    setQuery('');
    navigate(`/${space.slug}/projects/${encodeURIComponent(name)}`);
  }, [navigate, space.slug]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!projects.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, projects.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const picked = projects[activeIndex];
      if (picked) goToProject(picked.name, groupNames[picked.projectGroupId]);
    }
  };

  const renderRow = (key: string, name: string, group: string | undefined, isActive: boolean, onSelect: () => void) => (
    <button
      key={key}
      ref={isActive ? activeRowRef : undefined}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
      ].join(' ')}
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <ProjectGlyph />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{name}</span>
        {group && <span className="block truncate text-xs text-slate-400">{group}</span>}
      </span>
    </button>
  );

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <div
        className={[
          'flex h-9 w-[440px] max-w-[46vw] items-center rounded-lg border bg-white/90 px-3 shadow-sm transition-colors',
          open ? 'border-squid-blue ring-2 ring-blue-100' : 'border-slate-300/80',
        ].join(' ')}
      >
        <SearchIcon className="mr-2 h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          aria-label="Search projects"
          autoComplete="off"
          placeholder="Type Ctrl+Space to search or switch projects..."
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400"
        />
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Project search"
          className="absolute z-50 overflow-hidden rounded-lg bg-white"
          style={{
            top: 'calc(100% + 4px)',
            left: 0,
            width: 'clamp(360px, 46vw, 600px)',
            boxShadow: '0 20px 40px rgba(15,23,42,0.16), 0 6px 14px rgba(15,23,42,0.09)',
            border: '1px solid rgba(148,163,184,0.24)',
          }}
        >
          <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
            {!searching && recent.length > 0 && (
              <div className="mb-1">
                <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Recently viewed
                </div>
                {recent.map((item, index) => renderRow(`recent-${index}`, item.name, item.group, false, () => goToProject(item.name, item.group)))}
                <div className="mx-3 my-2 h-px bg-slate-100" />
              </div>
            )}

            <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {searching ? 'Projects' : 'All projects'}
              </span>
              {total > 0 && (
                <span className="text-[11px] text-slate-400">
                  {searching ? `${total} match${total === 1 ? '' : 'es'}` : `Showing ${projects.length} of ${total}`}
                </span>
              )}
            </div>

            {projects.length > 0 ? (
              projects.map((project, index) =>
                renderRow(
                  `project-${project.id}`,
                  project.name,
                  groupNames[project.projectGroupId],
                  index === activeIndex,
                  () => goToProject(project.name, groupNames[project.projectGroupId]),
                ),
              )
            ) : loading ? (
              <div className="py-6" />
            ) : (
              <div className="px-3 py-8 text-center text-sm text-slate-400">
                {searching ? `No projects match "${trimmed}"` : 'No projects'}
              </div>
            )}
          </div>
          {loading && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-blue-100/70">
              <div className="absolute top-0 bottom-0 w-[45%] rounded-full bg-squid-blue animate-indeterminate" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSearchPalette;
