export interface RecentProject {
  name: string;
  group?: string;
}

const STORAGE_KEY = (spaceSlug: string) => `squid:recentProjects:${spaceSlug}`;
const MAX_RECENT = 6;

export function getRecentProjects(spaceSlug: string): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(spaceSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentProject => typeof item?.name === 'string')
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecentProject(spaceSlug: string, project: RecentProject): void {
  try {
    const deduped = getRecentProjects(spaceSlug).filter((item) => item.name !== project.name);
    const next = [{ name: project.name, group: project.group }, ...deduped].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY(spaceSlug), JSON.stringify(next));
  } catch {
    // Ignore storage failures (private mode, quota exceeded).
  }
}
