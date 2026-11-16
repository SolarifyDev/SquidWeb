import type { OctopusImportProjectList, OctopusImportProjectOption } from "pages/apis/octopusImport";

/** The bucket of projects whose project group the source does not list. */
export const NO_PROJECT_GROUP_KEY = "__no-project-group__";
export const NO_PROJECT_GROUP_NAME = "No project group";

export interface ProjectGroupView {
  key: string;
  name: string;
  projects: OctopusImportProjectOption[];
}

export interface ProjectGroupState {
  chosen: number;
  total: number;
  checked: boolean;
  indeterminate: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const groupNames = (list: OctopusImportProjectList) => new Map(list.groups.map((group) => [group.id, group.name]));

const groupKeyOf = (project: OctopusImportProjectOption, names: Map<string, string>) =>
  project.projectGroupId && names.has(project.projectGroupId) ? project.projectGroupId : NO_PROJECT_GROUP_KEY;

/** Projects bucketed by project group, groups and projects by name; projects of an unknown group go last, into "No project group". */
export const groupProjects = (list: OctopusImportProjectList, projects: OctopusImportProjectOption[] = list.projects): ProjectGroupView[] => {
  const names = groupNames(list);
  const buckets = new Map<string, OctopusImportProjectOption[]>();

  projects.forEach((project) => {
    const key = groupKeyOf(project, names);
    buckets.set(key, [...(buckets.get(key) ?? []), project]);
  });

  const groups = [...buckets.entries()].map(([key, members]) => ({
    key,
    name: names.get(key) ?? NO_PROJECT_GROUP_NAME,
    projects: [...members].sort(byName),
  }));

  return [...groups.filter((group) => group.key !== NO_PROJECT_GROUP_KEY).sort(byName), ...groups.filter((group) => group.key === NO_PROJECT_GROUP_KEY)];
};

/** Projects whose name or project group name contains the search text, ignoring case; every project for an empty search. */
export const filterProjects = (list: OctopusImportProjectList, search: string): OctopusImportProjectOption[] => {
  const text = search.trim().toLowerCase();
  if (!text) return list.projects;

  const names = groupNames(list);
  const matches = (value: string | undefined) => (value ?? "").toLowerCase().includes(text);

  return list.projects.filter((project) => matches(project.name) || matches(names.get(project.projectGroupId ?? "")));
};

/** Ticks (or unticks) the given projects; set lookups keep it linear for a space with thousands of projects. */
export const setChosen = (selected: string[], projects: OctopusImportProjectOption[], chosen: boolean) => {
  const current = new Set(selected);
  const changed = new Set(projects.map((project) => project.id));

  return chosen ? [...selected, ...[...changed].filter((id) => !current.has(id))] : selected.filter((id) => !changed.has(id));
};

/** The tri-state checkbox of a group: how many of its projects are chosen. */
export const groupState = (group: ProjectGroupView, selected: ReadonlySet<string>): ProjectGroupState => {
  const chosen = group.projects.filter((project) => selected.has(project.id)).length;
  const total = group.projects.length;

  return { chosen, total, checked: total > 0 && chosen === total, indeterminate: chosen > 0 && chosen < total };
};

/** The selection the picker starts with: the session's, else every project (an export file) or none (an Octopus server). */
export const initialSelection = (list: OctopusImportProjectList, defaultAll: boolean) => {
  const known = new Set(list.projects.map((project) => project.id));
  if (list.selectedProjectIds) return list.selectedProjectIds.filter((id) => known.has(id));

  return defaultAll ? list.projects.map((project) => project.id) : [];
};

/** The same projects, in any order. */
export const sameProjects = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

export interface SelectionRequest {
  /** False: the session already holds this selection, nothing is sent. */
  send: boolean;
  /** null imports the whole space. */
  projectIds: string[] | null;
}

/**
 * What an export file sends for the chosen projects: every project ticked is the whole space (null), sent only to clear an earlier
 * selection, so an untouched picker previews exactly what it did before projects could be chosen.
 */
export const fileSelectionRequest = (list: OctopusImportProjectList, selected: string[]): SelectionRequest => {
  const everyProject = list.projects.every((project) => selected.includes(project.id));
  if (everyProject) return { send: list.selectedProjectIds != null, projectIds: null };

  return { send: true, projectIds: list.projects.filter((project) => selected.includes(project.id)).map((project) => project.id) };
};
