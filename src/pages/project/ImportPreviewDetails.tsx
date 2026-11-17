import React, { useMemo, useState } from "react";
import { Button, Checkbox, Table, Tag } from "antd";
import { Link } from "react-router-dom";
import {
  OctopusImportProjectDestinationState,
  type OctopusImportChangeCounts,
  type OctopusImportFieldChange,
  type OctopusImportFillPairing,
  type OctopusImportKindChangeCounts,
  type OctopusImportMissingSensitiveValue,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
  type OctopusImportProjectPreview,
  type OctopusImportSkipReasonCount,
} from "pages/apis/octopusImport";
import {
  choiceGroups,
  hasChoices,
  choiceKindText,
  followersText,
  type ChoiceGroups,
  type ChoiceRow,
  changeCountsOf,
  changedResources,
  describeFillDestination,
  fillDestinationLink,
  fillResources,
  missingSecretLink,
  outsideSelectionResources,
  pairingCopyOf,
  projectDestinationLink,
  requiredInputKindLabel,
  kindCountsOf,
  skippedResources,
  summarizeByProject,
  withheldSecrets,
  type WithheldSecretRow,
} from "./importPreviewSummary";
import { ImportDisclosure } from "./ImportDisclosure";
import { ImportMetricTiles, type ImportMetric } from "./ImportMetricTiles";
import { ImportStatusBanner } from "./ImportStatusBanner";

// ── Counts ───────────────────────────────────────────────────────────────────

type CountKey = "alreadyImported" | "create" | "update" | "fill" | "reused" | "notImported" | "blocked";

const COUNT_COLUMNS: { key: CountKey; title: string }[] = [
  { key: "alreadyImported", title: "Already in Squid" },
  { key: "create", title: "Create" },
  { key: "update", title: "Update" },
  { key: "fill", title: "Fill secret" },
  { key: "reused", title: "Link existing" },
  { key: "notImported", title: "Skip" },
  { key: "blocked", title: "Blocked" },
];

const countOf = (counts: OctopusImportChangeCounts, key: CountKey) =>
  key === "notImported" ? counts.skip + counts.unsupported : counts[key];

const zeroMuted = (value: number) => value || <span className="text-slate-300">0</span>;

const countColumns = <T,>(countsOf: (row: T) => OctopusImportChangeCounts) =>
  COUNT_COLUMNS.map((column) => ({
    title: column.title,
    key: column.key,
    align: "right" as const,
    render: (row: T) => zeroMuted(countOf(countsOf(row), column.key)),
  }));

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// ── Large previews ───────────────────────────────────────────────────────────

/** How many rows a list or table of the preview shows at once: a project can bring thousands of history rows. */
export const PREVIEW_PAGE_SIZE = 50;

/** One page at a time once a table outgrows a page; a short table stays a plain list. */
const pageOf = (rowCount: number) =>
  rowCount > PREVIEW_PAGE_SIZE ? { pageSize: PREVIEW_PAGE_SIZE, size: "small" as const, showSizeChanger: false } : false;

/** The first page of a long list, and a button that shows every item. */
const CappedList = <T,>({ items, children }: { items: T[]; children: (shown: T[]) => React.ReactNode }) => {
  const [showAll, setShowAll] = useState(false);
  const capped = !showAll && items.length > PREVIEW_PAGE_SIZE;

  return (
    <>
      {children(capped ? items.slice(0, PREVIEW_PAGE_SIZE) : items)}
      {capped ? (
        <Button type="link" size="small" className="!px-0" onClick={() => setShowAll(true)}>
          Show all {items.length}
        </Button>
      ) : null}
    </>
  );
};

// ── Field changes ────────────────────────────────────────────────────────────

const valueCell = (change: OctopusImportFieldChange, value: string | null) => {
  if (change.valueHidden) return <span className="italic text-slate-500">secret, not shown</span>;
  if (value === null || value === "") return <span className="text-slate-400">(none)</span>;
  return <span className="whitespace-pre-wrap break-all font-mono text-xs">{value}</span>;
};

const FieldChanges: React.FC<{ resource: OctopusImportPreviewResource }> = ({ resource }) => (
  <div data-testid={`changes-${resource.sourceType}-${resource.sourceId}`} className="space-y-1">
    <div className="font-medium">
      {resource.sourceType} <span className="font-semibold">{resource.sourceName}</span>
    </div>
    <Table
      size="small"
      pagination={false}
      rowKey="field"
      dataSource={resource.changes ?? []}
      columns={[
        { title: "Field", dataIndex: "field", key: "field", width: 160 },
        { title: "Squid now", key: "old", render: (change: OctopusImportFieldChange) => valueCell(change, change.oldValue) },
        { title: "After import", key: "new", render: (change: OctopusImportFieldChange) => valueCell(change, change.newValue) },
        { title: "", key: "description", render: (change: OctopusImportFieldChange) => change.description ?? "" },
      ]}
    />
  </div>
);

// ── Groups (one project, the space-level resources, or what lies outside the chosen projects) ──

interface GroupRow {
  key: string;
  projectSourceId: string | null;
  name: string;
  project: OctopusImportProjectPreview | null;
  counts: OctopusImportChangeCounts;
  kinds: OctopusImportKindChangeCounts[];
  isUpToDate: boolean;
  /** Set on the one row that gathers every resource outside the chosen projects. */
  outside?: OctopusImportPreviewResource[];
  /** An older server does not report where a project lands. */
  destinationUnknown?: boolean;
}

const SPACE_ROW_KEY = "__space__";
export const NOT_CHOSEN_ROW_KEY = "__not_chosen__";
export const NOT_CHOSEN_ROW_NAME = "Not used by the chosen projects";

const DestinationCell: React.FC<{ row: GroupRow; spaceSlug: string }> = ({ row, spaceSlug }) => {
  if (row.outside) return <span className="text-slate-500">Not imported</span>;
  if (row.destinationUnknown) return <span className="text-slate-500">Not reported</span>;
  if (!row.project) return <span className="text-slate-500">This Squid space</span>;

  const destination = row.project.destination;
  const state = Number(destination.state);
  if (state === OctopusImportProjectDestinationState.New) return <Tag color="blue">New project</Tag>;
  if (state === OctopusImportProjectDestinationState.NotImported) return <Tag>Not imported</Tag>;

  const link = projectDestinationLink(spaceSlug, destination);
  const label = destination.projectName ?? `Project ${destination.projectId}`;

  return (
    <span>
      {link ? <Link to={link}>{label}</Link> : label}
      {destination.projectId ? <span className="ml-1 text-xs text-slate-500">(id {destination.projectId})</span> : null}
    </span>
  );
};

// A blocked resource is never hidden behind the expand: the row says so next to its name.
const GroupName: React.FC<{ row: GroupRow }> = ({ row }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <span>{row.name}</span>
    {row.counts.blocked > 0 ? <Tag color="red">{row.counts.blocked} blocked</Tag> : null}
    {row.isUpToDate && !row.outside ? <Tag color="green">Up to date</Tag> : null}
  </span>
);

const OutsideList: React.FC<{ resources: OctopusImportPreviewResource[] }> = ({ resources }) => (
  <div className="py-2">
    <CappedList items={resources}>
      {(shown) => (
        <ul data-testid="not-chosen-resources" className="list-disc space-y-0.5 pl-6">
          {shown.map((resource) => (
            <li key={`${resource.sourceType}-${resource.sourceId}`}>
              {resource.sourceType} {resource.sourceName}: {resource.skipReason?.message ?? resource.diagnostics[0]?.message}
            </li>
          ))}
        </ul>
      )}
    </CappedList>
  </div>
);

const GroupDetail: React.FC<{ row: GroupRow; resources: OctopusImportPreviewResource[] }> = ({ row, resources }) => {
  if (row.outside) return <OutsideList resources={row.outside} />;

  const changed = changedResources(resources, row.projectSourceId);
  const skipped = skippedResources(resources, row.projectSourceId);

  return (
    <div data-testid={`group-detail-${row.key}`} className="space-y-4 py-2">
      <Table
        size="small"
        pagination={false}
        rowKey="kind"
        scroll={{ x: "max-content" }}
        dataSource={row.kinds}
        columns={[{ title: "Kind", dataIndex: "kind", key: "kind" }, ...countColumns<OctopusImportKindChangeCounts>((kind) => kind.counts)]}
      />
      {changed.length ? (
        <div className="space-y-3">
          <div className="font-semibold">What changes</div>
          <CappedList items={changed}>
            {(shown) => shown.map((resource) => <FieldChanges key={`${resource.sourceType}-${resource.sourceId}`} resource={resource} />)}
          </CappedList>
        </div>
      ) : null}
      {skipped.length ? (
        <div>
          <div className="mb-1 font-semibold">Not imported</div>
          <CappedList items={skipped}>
            {(shown) => (
              <ul className="list-disc space-y-0.5 pl-6">
                {shown.map((resource) => (
                  <li key={`${resource.sourceType}-${resource.sourceId}`}>
                    {resource.sourceType} {resource.sourceName}: {resource.skipReason?.message}
                  </li>
                ))}
              </ul>
            )}
          </CappedList>
        </div>
      ) : null}
    </div>
  );
};

const projectRow = (project: OctopusImportProjectPreview): GroupRow => ({
  key: project.sourceId,
  projectSourceId: project.sourceId,
  name: project.sourceName,
  project,
  counts: project.counts,
  kinds: project.kinds,
  isUpToDate: project.isUpToDate,
});

const withoutSkips = (counts: OctopusImportChangeCounts, skips: number): OctopusImportChangeCounts => ({
  ...counts,
  skip: Math.max(0, counts.skip - skips),
  total: Math.max(0, counts.total - skips),
});

// Each kind without its shared resources no chosen project uses; a kind left with nothing is dropped.
const kindsWithoutOutside = (kinds: OctopusImportKindChangeCounts[], unowned: OctopusImportPreviewResource[]): OctopusImportKindChangeCounts[] =>
  kinds
    .map((kind) => ({ kind: kind.kind, counts: withoutSkips(kind.counts, unowned.filter((resource) => resource.sourceType === kind.kind).length) }))
    .filter((kind) => kind.counts.total > 0);

// The space's own resources, without the shared ones no chosen project uses (they are listed on the "not used" row).
const spaceRow = (plan: OctopusImportPreviewPlan, outside: OctopusImportPreviewResource[]): GroupRow | null => {
  const space = plan.summary!.space;
  const unowned = outside.filter((resource) => !resource.ownerProjectSourceId);
  const counts = withoutSkips(space.counts, unowned.length);
  if (counts.total === 0) return null;

  return { key: SPACE_ROW_KEY, projectSourceId: null, name: "Space resources (no project)", project: null, counts, kinds: kindsWithoutOutside(space.kinds, unowned), isUpToDate: space.isUpToDate };
};

const ZERO_COUNTS: OctopusImportChangeCounts = { alreadyImported: 0, reused: 0, create: 0, update: 0, fill: 0, skip: 0, unsupported: 0, blocked: 0, total: 0, incremental: 0 };

const notChosenRow = (outside: OctopusImportPreviewResource[]): GroupRow => ({
  key: NOT_CHOSEN_ROW_KEY,
  projectSourceId: null,
  name: NOT_CHOSEN_ROW_NAME,
  project: null,
  counts: { ...ZERO_COUNTS, skip: outside.length, total: outside.length },
  kinds: [],
  isUpToDate: false,
  outside,
});

const groupRows = (plan: OctopusImportPreviewPlan, outside: OctopusImportPreviewResource[]): GroupRow[] => {
  const rows = [...plan.summary!.projects].sort((a, b) => a.sourceName.localeCompare(b.sourceName)).map(projectRow);
  const space = spaceRow(plan, outside);

  return [...rows, ...(space ? [space] : []), ...(outside.length ? [notChosenRow(outside)] : [])];
};

// Plans of an older server carry no summary: the same rows, counted from the resources; where a project lands is not reported.
const legacyGroupRows = (resources: OctopusImportPreviewResource[], outside: OctopusImportPreviewResource[]): GroupRow[] => {
  const inside = resources.filter((resource) => !outside.includes(resource));
  const ownedBy = (owner: string | null) => inside.filter((resource) => (resource.ownerProjectSourceId || null) === owner);

  const legacyRow = (key: string, projectSourceId: string | null, name: string): GroupRow => {
    const owned = ownedBy(projectSourceId);
    const counts = changeCountsOf(owned);
    return { key, projectSourceId, name, project: null, counts, kinds: kindCountsOf(owned), isUpToDate: counts.incremental === 0 && counts.blocked === 0, destinationUnknown: true };
  };

  const projects = summarizeByProject(inside).map((project) => legacyRow(project.projectSourceId, project.projectSourceId, project.projectName));
  const space = ownedBy(null).length ? [{ ...legacyRow(SPACE_ROW_KEY, null, "Space resources (no project)"), destinationUnknown: false }] : [];

  return [...projects, ...space, ...(outside.length ? [notChosenRow(outside)] : [])];
};

const GroupTable: React.FC<{ rows: GroupRow[]; resources: OctopusImportPreviewResource[]; spaceSlug: string }> = ({ rows, resources, spaceSlug }) => (
  <section>
    <h3 className="mb-1 text-sm font-semibold text-slate-900">By project</h3>
    <div className="mb-3 text-xs text-slate-500">Expand a row for the other counts and what changes for each kind of resource.</div>
    <Table
      data-testid="preview-projects"
      size="small"
      pagination={pageOf(rows.length)}
      rowKey="key"
      dataSource={rows}
      expandable={{ expandedRowRender: (row: GroupRow) => <GroupDetail row={row} resources={resources} /> }}
      columns={[
        { title: "Octopus project", key: "name", render: (row: GroupRow) => <GroupName row={row} /> },
        { title: "Lands on", key: "destination", render: (row: GroupRow) => <DestinationCell row={row} spaceSlug={spaceSlug} /> },
        { title: "Create", key: "create", align: "right" as const, render: (row: GroupRow) => zeroMuted(row.counts.create) },
        { title: "Skip", key: "skip", align: "right" as const, render: (row: GroupRow) => zeroMuted(countOf(row.counts, "notImported")) },
      ]}
    />
  </section>
);

// ── Sections ─────────────────────────────────────────────────────────────────

/** The preview's headline numbers; a non-zero Blocked count is always in the headline row. */
export const previewMetrics = (counts: OctopusImportChangeCounts, notChosen: number): { metrics: ImportMetric[]; details: ImportMetric[] } => ({
  metrics: [
    { id: "create", label: "Create", value: counts.create },
    { id: "alreadyImported", label: "Already in Squid", value: counts.alreadyImported },
    { id: "update", label: "Update history", value: counts.update },
    { id: "notChosen", label: "Not chosen", value: notChosen },
  ],
  details: [
    { id: "fill", label: "Fill secret", value: counts.fill },
    { id: "reused", label: "Link existing", value: counts.reused },
    { id: "skip", label: "Other skips", value: Math.max(0, counts.skip + counts.unsupported - notChosen) },
    { id: "blocked", label: "Blocked", value: counts.blocked, alwaysVisibleWhenNonZero: true },
  ],
});

const OverallSummary: React.FC<{ counts: OctopusImportChangeCounts; notChosen: number }> = ({ counts, notChosen }) => (
  <div className="space-y-2">
    <div data-testid="summary-incremental" className="text-sm text-slate-700">
      This import changes {pluralize(counts.incremental, "resource")} in Squid; {counts.alreadyImported} already in Squid stay
      as they are.
    </div>
    <ImportMetricTiles testIdPrefix="summary-tile" {...previewMetrics(counts, notChosen)} />
  </div>
);

const SkipReasons: React.FC<{ reasons: OctopusImportSkipReasonCount[] }> = ({ reasons }) => (
  <ImportDisclosure summary="Not imported, and why" testId="skip-reasons">
    <Table
      size="small"
      pagination={false}
      rowKey={(reason: OctopusImportSkipReasonCount) => `${reason.resourceType}-${reason.code}`}
      dataSource={reasons}
      columns={[
        { title: "Kind", dataIndex: "resourceType", key: "resourceType", width: 180 },
        { title: "Reason", dataIndex: "message", key: "message" },
        { title: "Count", dataIndex: "count", key: "count", align: "right" as const, width: 80 },
      ]}
    />
  </ImportDisclosure>
);

const FillList: React.FC<{ resources: OctopusImportPreviewResource[]; spaceSlug: string }> = ({ resources, spaceSlug }) => (
  <section data-testid="secret-fills">
    <h3 className="mb-1 text-sm font-semibold text-slate-900">Missing secrets this import fills</h3>
    <div className="mb-3 text-xs text-slate-500">
      Only values that are still empty in Squid are filled. Values you set in Squid are never overwritten, and values are never shown.
    </div>
    <Table
      size="small"
      pagination={pageOf(resources.length)}
      rowKey={(resource: OctopusImportPreviewResource) => `${resource.sourceType}-${resource.sourceId}`}
      dataSource={resources}
      columns={[
        { title: "Name", dataIndex: "sourceName", key: "name" },
        { title: "Kind", dataIndex: "sourceType", key: "kind" },
        {
          title: "Field",
          key: "field",
          render: (resource: OctopusImportPreviewResource) => (resource.changes ?? []).map((change) => change.field).join(", "),
        },
        {
          title: "Filled in",
          key: "destination",
          render: (resource: OctopusImportPreviewResource) => {
            if (!resource.fillDestination) return "";
            const link = fillDestinationLink(spaceSlug, resource.fillDestination);
            const text = describeFillDestination(resource.fillDestination);
            return link ? <Link to={link}>{text}</Link> : text;
          },
        },
      ]}
    />
  </section>
);

// ── Choices (deleted in Squid, added in Octopus since, missed by an earlier import) ─

export interface PreviewChoiceProps {
  /** Ticks or unticks the given choice rows; without it the choices are shown read-only. */
  onChoiceChange?: (sourceIds: string[], selected: boolean) => void;
  /** The ticks differ from the plan the counts were computed for. */
  choicesPending?: boolean;
  choicesDisabled?: boolean;
}

const CHOICE_SECTIONS = [
  {
    id: "deleted",
    title: "Deleted in Squid",
    hint: "Imported before, then deleted (or renamed) in Squid. They stay deleted unless you tick them. A channel you tick is created again and takes back the releases and deployments imported on it.",
  },
  {
    id: "added",
    title: "Added in Octopus since the last import",
    hint: "Added in Octopus after what they belong to was imported. Imported configuration is never changed unless you tick it: ticked items are added, and nothing already in Squid is overwritten. New channels are ticked because their releases and deployments need them.",
  },
  {
    id: "missed",
    title: "Missed by an earlier import",
    hint: "What they belong to was imported, but an earlier import skipped them: Octopus gave them the same ids as in the project it was cloned from. They are ticked so the project is complete; ticked items are added, and nothing already in Squid is overwritten.",
  },
] as const;

const choiceRowKey = (row: ChoiceRow) => row.resource.sourceId;

const projectNameOf = (plan: OctopusImportPreviewPlan, projectSourceId: string | null | undefined) =>
  plan.summary?.projects.find((project) => project.sourceId === projectSourceId)?.sourceName ?? "";

const ChoiceName: React.FC<{ row: ChoiceRow }> = ({ row }) => {
  const followers = followersText(row.followers);

  return (
    <span>
      {row.resource.sourceName}
      {followers ? <span className="ml-1 text-xs text-slate-500">{followers}</span> : null}
    </span>
  );
};

const ChoiceSection: React.FC<{ id: string; title: string; hint: string; rows: ChoiceRow[]; plan: OctopusImportPreviewPlan } & PreviewChoiceProps> = ({ id, title, hint, rows, plan, onChoiceChange, choicesDisabled }) => (
  <div data-testid={`choices-${id}`}>
    <h3 className="mb-1 text-sm font-semibold text-slate-900">{title}</h3>
    <div className="mb-3 text-xs text-slate-500">{hint}</div>
    <Table
      size="small"
      pagination={false}
      rowKey={choiceRowKey}
      dataSource={rows}
      rowSelection={{
        selectedRowKeys: rows.filter((row) => row.resource.choice?.selected).map(choiceRowKey),
        getCheckboxProps: () => ({ disabled: !onChoiceChange || choicesDisabled }),
        onSelect: (row: ChoiceRow, selected: boolean) => onChoiceChange?.([choiceRowKey(row)], selected),
        onSelectAll: (selected: boolean) => onChoiceChange?.(rows.map(choiceRowKey), selected),
      }}
      columns={[
        { title: "Kind", key: "kind", width: 140, render: (row: ChoiceRow) => choiceKindText(row.resource.sourceType) },
        { title: "Name", key: "name", render: (row: ChoiceRow) => <ChoiceName row={row} /> },
        { title: "In", key: "owner", render: (row: ChoiceRow) => row.resource.choice?.ownerName ?? "" },
        { title: "Project", key: "project", render: (row: ChoiceRow) => projectNameOf(plan, row.resource.ownerProjectSourceId) },
      ]}
    />
  </div>
);

/** What the user decides on: items deleted in Squid after an earlier import, items added in Octopus since, and items an earlier import missed. */
const ChoicesPanel: React.FC<{ plan: OctopusImportPreviewPlan; groups: ChoiceGroups } & PreviewChoiceProps> = ({ plan, groups, ...choiceProps }) => {
  if (!hasChoices(groups)) return null;

  return (
    <section data-testid="preview-choices" className="space-y-4">
      {choiceProps.choicesPending ? (
        <ImportStatusBanner
          testId="choices-pending"
          type="info"
          message="You changed what to import: update the preview to see the new counts before importing."
        />
      ) : null}
      {CHOICE_SECTIONS.filter((section) => groups[section.id].length).map((section) => (
        <ChoiceSection key={section.id} {...section} rows={groups[section.id]} plan={plan} {...choiceProps} />
      ))}
      <div data-testid="choices-footer" className="text-xs text-slate-500">
        Unticked items are not remembered: the next import offers them again.
      </div>
    </section>
  );
};

// ── Project selection ────────────────────────────────────────────────────────

const ConfigAsCodeScope: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <ImportStatusBanner
      testId="project-scope-config-as-code"
      type="info"
      message={`${pluralize(count, "project")} ${count === 1 ? "is" : "are"} version-controlled (Config as Code) in Octopus and ${count === 1 ? "is" : "are"} not imported: Squid does not import Config-as-Code projects.`}
    />
  ) : null;

const ProjectScope: React.FC<{ notChosen: number; onChangeProjects?: () => void }> = ({ notChosen, onChangeProjects }) => {
  const change = onChangeProjects ? (
    <Button type="link" size="small" onClick={onChangeProjects}>
      Change projects
    </Button>
  ) : null;
  if (notChosen <= 0) return change ? <div data-testid="project-scope" className="flex justify-end">{change}</div> : null;

  return (
    <ImportStatusBanner
      testId="project-scope"
      type="info"
      message={`${pluralize(notChosen, "project")} ${notChosen === 1 ? "was" : "were"} not chosen and ${notChosen === 1 ? "is" : "are"} not imported.`}
      action={change}
    />
  );
};

/** The incremental preview: headline counts, choices, per-project counts and where each project lands in Squid, field-level changes, fills and skips. */
const PreviewOverview: React.FC<{ plan: OctopusImportPreviewPlan; spaceSlug: string; onChangeProjects?: () => void } & PreviewChoiceProps> = ({ plan, spaceSlug, onChangeProjects, ...choiceProps }) => {
  // Derived once per plan: the page re-renders on every tick and status poll while the plan stays the same.
  const derived = useMemo(() => {
    if (!plan.summary) return null;
    const outside = outsideSelectionResources(plan.resources);
    return { outside, fills: fillResources(plan.resources), rows: groupRows(plan, outside), choices: choiceGroups(plan.resources) };
  }, [plan]);
  const summary = plan.summary;
  if (!summary || !derived) return null;

  const { outside, fills, rows, choices } = derived;
  const offersLeft = hasChoices(choices);

  return (
    <div className="space-y-5">
      {summary.isUpToDate ? (
        <ImportStatusBanner
          testId="preview-up-to-date"
          type="success"
          message={
            offersLeft
              ? "Everything this source contains is already in Squid, except the items offered below; importing again changes nothing unless you tick one of them."
              : "Everything this source contains is already in Squid; importing again would change nothing."
          }
        />
      ) : null}

      <ProjectScope notChosen={summary.notChosenProjectCount ?? 0} onChangeProjects={onChangeProjects} />

      <ConfigAsCodeScope count={summary.configAsCodeProjectCount ?? 0} />

      <OverallSummary counts={summary.counts} notChosen={outside.length} />

      <ChoicesPanel plan={plan} groups={choices} {...choiceProps} />

      {rows.length ? <GroupTable rows={rows} resources={plan.resources} spaceSlug={spaceSlug} /> : null}

      {fills.length ? <FillList resources={fills} spaceSlug={spaceSlug} /> : null}

      {summary.kinds.length ? (
        <ImportDisclosure summary="By kind" testId="preview-kinds-disclosure">
          <Table
            data-testid="preview-kinds"
            size="small"
            pagination={false}
            scroll={{ x: "max-content" }}
            rowKey="kind"
            dataSource={summary.kinds}
            columns={[{ title: "Kind", dataIndex: "kind", key: "kind" }, ...countColumns<OctopusImportKindChangeCounts>((kind) => kind.counts)]}
          />
        </ImportDisclosure>
      ) : null}

      {summary.skipReasons.length ? <SkipReasons reasons={summary.skipReasons} /> : null}
    </div>
  );
};

// Memoised: the page re-renders on every status poll while the plan it shows stays the same.
export const ImportPreviewOverview = React.memo(PreviewOverview);

/** The preview of an older server's plan (no summary): the same tiles and by-project table, counted from the resources. */
export const LegacyPreviewOverview: React.FC<{ resources: OctopusImportPreviewResource[]; spaceSlug: string }> = ({ resources, spaceSlug }) => {
  const outside = outsideSelectionResources(resources);
  const rows = legacyGroupRows(resources, outside);

  return (
    <div className="space-y-5">
      <ImportMetricTiles testIdPrefix="import-tile" {...previewMetrics(changeCountsOf(resources), outside.length)} />
      {rows.length ? <GroupTable rows={rows} resources={resources} spaceSlug={spaceSlug} /> : null}
    </div>
  );
};

// ── Secrets ──────────────────────────────────────────────────────────────────

// The export file fills sensitive variables and feed passwords only; account keys and certificate private keys are set in Squid.
const fillHint = (anyFillable: boolean) =>
  anyFillable
    ? "Importing the Octopus export file of the same space later fills only the values marked \"From the export file\"; values you set in Squid are never overwritten. The others are set in Squid."
    : "An Octopus export file cannot supply these. Set them in Squid.";

const FillFromFileButton: React.FC<{ onFillFromFile: () => void; disabled?: boolean }> = ({ onFillFromFile, disabled }) => (
  <Button size="small" onClick={onFillFromFile} disabled={disabled}>
    Fill from export file
  </Button>
);

/** "Db.Password" or "Db.Password +2 more": the first secret by name, the rest counted. */
export const firstAndMore = (names: string[]) => (names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0] ?? "");

const fillColumn = <T,>(fillableOf: (row: T) => boolean) => ({
  title: "Fill",
  key: "fillable",
  render: (row: T) => (fillableOf(row) ? "From the export file" : "Set it in Squid"),
});

/** Secrets the Octopus API does not return: imported empty and listed so they can be filled later. Names only. */
const WithheldSecretsPanelView: React.FC<{
  resources: OctopusImportPreviewResource[];
  onFillFromFile: () => void;
  disabled?: boolean;
}> = ({ resources, onFillFromFile, disabled }) => {
  const rows = useMemo(() => withheldSecrets(resources), [resources]);
  if (!rows.length) return null;

  const anyFillable = rows.some(row => row.fillable);

  return (
    <section data-testid="withheld-secrets">
      <ImportStatusBanner
        type="warning"
        message={`${pluralize(rows.length, "secret value")} will be imported as missing: ${firstAndMore(rows.map((row) => row.name))}.`}
        action={anyFillable ? <FillFromFileButton onFillFromFile={onFillFromFile} disabled={disabled} /> : null}
      >
        <ImportDisclosure summary="Which secrets, and how to fill them" bordered={false}>
          <div className="space-y-2">
            <div className="text-xs text-slate-600">
              The Octopus API never returns secret values. These are created without their value, and deployments that use a missing
              variable value fail with a clear message until it is set. {fillHint(anyFillable)}
            </div>
            <Table
              size="small"
              pagination={pageOf(rows.length)}
              rowKey="key"
              scroll={{ x: "max-content" }}
              dataSource={rows}
              columns={[
                { title: "Kind", dataIndex: "kind", key: "kind" },
                { title: "Name", dataIndex: "name", key: "name" },
                { title: "Where", dataIndex: "where", key: "where" },
                { title: "Field", dataIndex: "field", key: "field" },
                { title: "Scope", dataIndex: "scope", key: "scope" },
                fillColumn<WithheldSecretRow>((row) => row.fillable),
              ]}
            />
          </div>
        </ImportDisclosure>
      </ImportStatusBanner>
    </section>
  );
};

// Memoised: the rows are derived once per plan, not on every render of the page.
export const WithheldSecretsPanel = React.memo(WithheldSecretsPanelView);

/** After an import from the API: one line naming the secrets it left empty, the full list (each linking to where it is set) behind it. */
export const MissingSecretsAfterImport: React.FC<{
  missing: OctopusImportMissingSensitiveValue[];
  spaceSlug: string;
  onFillFromFile: () => void;
}> = ({ missing, spaceSlug, onFillFromFile }) => {
  const anyFillable = missing.some(item => item.fillable);
  const still = missing.length === 1 ? "is still missing" : "are still missing";

  return (
    <section data-testid="missing-secrets-after-import">
      <ImportStatusBanner
        type="success"
        message={`Import completed; ${pluralize(missing.length, "secret value")} ${still}: ${firstAndMore(missing.map((item) => item.name))}.`}
        action={anyFillable ? <FillFromFileButton onFillFromFile={onFillFromFile} /> : null}
      >
        <ImportDisclosure summary="Where to set them" bordered={false} defaultOpen={missing.length === 1}>
          <div className="space-y-2">
            <div className="text-xs text-slate-600">The Octopus API never returns secret values. {fillHint(anyFillable)}</div>
            <Table
              size="small"
              pagination={pageOf(missing.length)}
              scroll={{ x: "max-content" }}
              rowKey={(item: OctopusImportMissingSensitiveValue) => `${item.kind}-${item.ownerName}-${item.name}-${item.field}-${item.scopeSummary}`}
              dataSource={missing}
              columns={[
                { title: "Kind", key: "kind", render: (item: OctopusImportMissingSensitiveValue) => requiredInputKindLabel(item.kind) },
                {
                  title: "Name",
                  key: "name",
                  render: (item: OctopusImportMissingSensitiveValue) => {
                    const link = missingSecretLink(spaceSlug, item);
                    return link ? <Link to={link}>{item.name}</Link> : item.name;
                  },
                },
                { title: "Where", key: "owner", render: (item: OctopusImportMissingSensitiveValue) => item.ownerName ?? "" },
                { title: "Field", dataIndex: "field", key: "field" },
                { title: "Scope", key: "scope", render: (item: OctopusImportMissingSensitiveValue) => item.scopeSummary ?? "" },
                fillColumn<OctopusImportMissingSensitiveValue>((item) => Boolean(item.fillable)),
              ]}
            />
          </div>
        </ImportDisclosure>
      </ImportStatusBanner>
    </section>
  );
};

/**
 * The first pairing of an import source (an export file or an Octopus server) with the Octopus this space was imported from: the
 * user confirms both are the same Octopus before the import links to what earlier imports created, or fills secrets they left missing.
 */
export const FillPairingConfirmation: React.FC<{
  pairing: OctopusImportFillPairing;
  confirmed: boolean;
  onChange: (confirmed: boolean) => void;
  /** The import would link to earlier imported resources (otherwise it fills secrets). */
  linksEarlierImport?: boolean;
  disabled?: boolean;
}> = ({ pairing, confirmed, onChange, linksEarlierImport = false, disabled }) => {
  const copy = pairingCopyOf(pairing, linksEarlierImport);

  return (
    <ImportStatusBanner testId="fill-pairing" type="warning" message={copy.title}>
      <div>{copy.intro}</div>
      <ul className="list-disc pl-5">
        {copy.recorded.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {copy.incoming.length ? <div>This source: {copy.incoming.join(", ")}</div> : null}
      <Checkbox checked={confirmed} disabled={disabled} onChange={(event) => onChange(event.target.checked)}>
        {copy.confirmLabel}
      </Checkbox>
    </ImportStatusBanner>
  );
};
