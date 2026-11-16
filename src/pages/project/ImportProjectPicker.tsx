import React, { useMemo, useState } from "react";
import { Button, Checkbox, Collapse, Input, Spin, Tag, Tooltip } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import type { OctopusImportProjectList, OctopusImportProjectOption } from "pages/apis/octopusImport";
import { filterProjects, groupProjects, groupState, setChosen, type ProjectGroupView } from "./importProjectSelection";

export interface ImportProjectPickerProps {
  list: OctopusImportProjectList | null;
  selected: string[];
  onChange: (selected: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Above this many projects the groups start collapsed, so a large space mounts no row until a group is opened or searched. */
export const EXPANDED_PROJECT_LIMIT = 200;

const REIMPORT_HINT = "Re-importing it only adds what is missing in Squid; nothing already there is overwritten.";

const ProjectRow: React.FC<{ project: OctopusImportProjectOption; checked: boolean; disabled?: boolean; onToggle: (checked: boolean) => void }> = ({ project, checked, disabled, onToggle }) => (
  <div data-testid={`picker-project-${project.id}`} className="flex flex-wrap items-center gap-2 py-0.5">
    <Checkbox checked={checked} disabled={disabled} onChange={(event) => onToggle(event.target.checked)}>
      {project.name}
    </Checkbox>
    {project.previouslyImported ? (
      <Tooltip title={REIMPORT_HINT}>
        <Tag color="blue">Imported before</Tag>
      </Tooltip>
    ) : null}
    {project.isDisabled ? <Tag>Disabled in Octopus</Tag> : null}
  </div>
);

const GroupHeader: React.FC<{ group: ProjectGroupView; selected: ReadonlySet<string>; disabled?: boolean; onToggle: (checked: boolean) => void }> = ({ group, selected, disabled, onToggle }) => {
  const state = groupState(group, selected);

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <Checkbox checked={state.checked} indeterminate={state.indeterminate} disabled={disabled} onChange={(event) => onToggle(event.target.checked)}>
        {group.name} ({state.chosen}/{state.total})
      </Checkbox>
    </span>
  );
};

/** Chooses the Octopus projects to import: searchable, grouped by project group, with per-group and global select-all on what is shown. */
export const ImportProjectPicker: React.FC<ImportProjectPickerProps> = ({ list, selected, onChange, loading, disabled }) => {
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState<string[] | null>(null);
  const visible = useMemo(() => (list ? filterProjects(list, search) : []), [list, search]);
  const groups = useMemo(() => (list ? groupProjects(list, visible) : []), [list, visible]);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const startsOpen = (list?.projects.length ?? 0) <= EXPANDED_PROJECT_LIMIT;
  const openKeys = search.trim() ? groups.map((group) => group.key) : opened ?? (startsOpen ? groups.map((group) => group.key) : []);

  if (loading || !list) {
    return (
      <div data-testid="project-picker-loading" className="flex items-center gap-2 text-sm text-slate-600">
        <Spin indicator={<LoadingOutlined spin />} /> Listing projects in this space…
      </div>
    );
  }

  const toggle = (projects: OctopusImportProjectOption[], checked: boolean) => onChange(setChosen(selected, projects, checked));

  return (
    <div data-testid="project-picker" className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">Choose the projects to import</div>
        <div className="mt-1 text-xs text-slate-500">
          Only the chosen projects, and the environments, lifecycles, feeds, libraries and teams they use, are read and imported. Projects
          you do not choose are left untouched in Squid.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input.Search
          aria-label="Search projects"
          className="max-w-sm"
          allowClear
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects or project groups"
        />
        <Button size="small" disabled={disabled || !visible.length} onClick={() => toggle(visible, true)}>
          Select all
        </Button>
        <Button size="small" disabled={disabled || !visible.length} onClick={() => toggle(visible, false)}>
          Clear
        </Button>
      </div>
      <div data-testid="project-picker-count" className="text-sm text-slate-700">
        {selected.length} of {list.projects.length} projects chosen
      </div>
      {groups.length ? (
        <Collapse
          size="small"
          activeKey={openKeys}
          onChange={(keys) => setOpened(Array.isArray(keys) ? keys : [keys])}
          items={groups.map((group) => ({
            key: group.key,
            label: <GroupHeader group={group} selected={chosen} disabled={disabled} onToggle={(checked) => toggle(group.projects, checked)} />,
            children: group.projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                checked={chosen.has(project.id)}
                disabled={disabled}
                onToggle={(checked) => toggle([project], checked)}
              />
            )),
          }))}
        />
      ) : (
        <div className="text-sm text-slate-500">{list.projects.length ? "No project matches the search." : "This source has no projects."}</div>
      )}
    </div>
  );
};
