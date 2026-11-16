import React from "react";
import { Alert, Button, Checkbox, Table, Tag } from "antd";
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
  choiceKindText,
  followersText,
  type ChoiceRow,
  changedResources,
  describeFillDestination,
  fillDestinationLink,
  fillResources,
  missingSecretLink,
  pairingCopyOf,
  projectDestinationLink,
  requiredInputKindLabel,
  skippedResources,
  withheldSecrets,
  type WithheldSecretRow,
} from "./importPreviewSummary";

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

const countColumns = <T,>(countsOf: (row: T) => OctopusImportChangeCounts) =>
  COUNT_COLUMNS.map((column) => ({
    title: column.title,
    key: column.key,
    align: "right" as const,
    render: (row: T) => countOf(countsOf(row), column.key) || <span className="text-slate-300">0</span>,
  }));

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const CountTile: React.FC<{ id: string; label: string; value: number; hint?: string }> = ({ id, label, value, hint }) => (
  <div data-testid={`summary-tile-${id}`} className="rounded-md border border-slate-200 px-4 py-3">
    <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
    {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
  </div>
);

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

// ── Groups (one project, or the space-level resources) ───────────────────────

interface GroupRow {
  key: string;
  projectSourceId: string | null;
  name: string;
  project: OctopusImportProjectPreview | null;
  counts: OctopusImportChangeCounts;
  kinds: OctopusImportKindChangeCounts[];
  isUpToDate: boolean;
}

const SPACE_ROW_KEY = "__space__";

const DestinationCell: React.FC<{ row: GroupRow; spaceSlug: string }> = ({ row, spaceSlug }) => {
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

const GroupDetail: React.FC<{ row: GroupRow; resources: OctopusImportPreviewResource[] }> = ({ row, resources }) => {
  const changed = changedResources(resources, row.projectSourceId);
  const skipped = skippedResources(resources, row.projectSourceId);

  return (
    <div data-testid={`group-detail-${row.key}`} className="space-y-4 py-2">
      <Table
        size="small"
        pagination={false}
        rowKey="kind"
        dataSource={row.kinds}
        columns={[{ title: "Kind", dataIndex: "kind", key: "kind" }, ...countColumns<OctopusImportKindChangeCounts>((kind) => kind.counts)]}
      />
      {changed.length ? (
        <div className="space-y-3">
          <div className="font-semibold">What changes</div>
          {changed.map((resource) => (
            <FieldChanges key={`${resource.sourceType}-${resource.sourceId}`} resource={resource} />
          ))}
        </div>
      ) : null}
      {skipped.length ? (
        <div>
          <div className="mb-1 font-semibold">Not imported</div>
          <ul className="list-disc space-y-0.5 pl-6">
            {skipped.map((resource) => (
              <li key={`${resource.sourceType}-${resource.sourceId}`}>
                {resource.sourceType} {resource.sourceName}: {resource.skipReason?.message}
              </li>
            ))}
          </ul>
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

const groupRows = (plan: OctopusImportPreviewPlan): GroupRow[] => {
  const summary = plan.summary!;
  const rows = [...summary.projects].sort((a, b) => a.sourceName.localeCompare(b.sourceName)).map(projectRow);
  if (summary.space.counts.total === 0) return rows;

  return [
    ...rows,
    {
      key: SPACE_ROW_KEY,
      projectSourceId: null,
      name: "Space resources (no project)",
      project: null,
      counts: summary.space.counts,
      kinds: summary.space.kinds,
      isUpToDate: summary.space.isUpToDate,
    },
  ];
};

// ── Sections ─────────────────────────────────────────────────────────────────

const OverallSummary: React.FC<{ counts: OctopusImportChangeCounts }> = ({ counts }) => (
  <div className="space-y-2">
    <div data-testid="summary-incremental" className="text-sm text-slate-700">
      This import changes {pluralize(counts.incremental, "resource")} in Squid; {counts.alreadyImported} already in Squid stay
      as they are.
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <CountTile id="alreadyImported" label="Already in Squid" value={counts.alreadyImported} hint="never overwritten" />
      <CountTile id="create" label="Create" value={counts.create} />
      <CountTile id="update" label="Update" value={counts.update} hint="history changed in Octopus" />
      <CountTile id="fill" label="Fill secret" value={counts.fill} hint="only missing values" />
      <CountTile id="reused" label="Link existing" value={counts.reused} />
      <CountTile id="skip" label="Skip" value={counts.skip + counts.unsupported} />
      <CountTile id="blocked" label="Blocked" value={counts.blocked} />
    </div>
  </div>
);

const SkipReasons: React.FC<{ reasons: OctopusImportSkipReasonCount[] }> = ({ reasons }) => (
  <section data-testid="skip-reasons">
    <h2 className="mb-3 text-base font-semibold">Not imported, and why</h2>
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
  </section>
);

const FillList: React.FC<{ resources: OctopusImportPreviewResource[]; spaceSlug: string }> = ({ resources, spaceSlug }) => (
  <section data-testid="secret-fills">
    <h2 className="mb-1 text-base font-semibold">Missing secrets this import fills</h2>
    <div className="mb-3 text-xs text-slate-500">
      Only values that are still empty in Squid are filled. Values you set in Squid are never overwritten, and values are never shown.
    </div>
    <Table
      size="small"
      pagination={false}
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

// ── Choices (deleted in Squid, added in Octopus since) ───────────────────────

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
    <h2 className="mb-1 text-base font-semibold">{title}</h2>
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

/** What the user decides on: items deleted in Squid after an earlier import, and items added in Octopus since. */
const ChoicesPanel: React.FC<{ plan: OctopusImportPreviewPlan } & PreviewChoiceProps> = ({ plan, ...choiceProps }) => {
  const groups = choiceGroups(plan.resources);
  if (!groups.deleted.length && !groups.added.length) return null;

  return (
    <section data-testid="preview-choices" className="space-y-4">
      {choiceProps.choicesPending ? (
        <Alert
          data-testid="choices-pending"
          type="info"
          showIcon
          message="You changed what to import. Update the preview to see the new counts before importing."
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

/** The incremental preview: overall and per-project counts, where each project lands in Squid, field-level changes, fills and skips. */
export const ImportPreviewOverview: React.FC<{ plan: OctopusImportPreviewPlan; spaceSlug: string } & PreviewChoiceProps> = ({ plan, spaceSlug, ...choiceProps }) => {
  const summary = plan.summary;
  if (!summary) return null;

  const fills = fillResources(plan.resources);
  const rows = groupRows(plan);
  const choices = choiceGroups(plan.resources);
  const offersLeft = choices.deleted.length + choices.added.length > 0;

  return (
    <div className="space-y-6">
      {summary.isUpToDate ? (
        <Alert
          data-testid="preview-up-to-date"
          type="success"
          showIcon
          message="Everything is up to date"
          description={
            offersLeft
              ? "Everything this source contains is already in Squid, except the items offered below. Importing again would change nothing unless you tick one of them."
              : "Everything this source contains is already in Squid. Importing again would change nothing."
          }
        />
      ) : null}

      <OverallSummary counts={summary.counts} />

      <ChoicesPanel plan={plan} {...choiceProps} />

      {rows.length ? (
        <section>
          <h2 className="mb-1 text-base font-semibold">By project</h2>
          <div className="mb-3 text-xs text-slate-500">Expand a row to see what changes for each kind of resource.</div>
          <Table
            data-testid="preview-projects"
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={rows}
            expandable={{ expandedRowRender: (row: GroupRow) => <GroupDetail row={row} resources={plan.resources} /> }}
            columns={[
              { title: "Octopus project", dataIndex: "name", key: "name" },
              { title: "Lands on in Squid", key: "destination", render: (row: GroupRow) => <DestinationCell row={row} spaceSlug={spaceSlug} /> },
              ...countColumns<GroupRow>((row) => row.counts),
              {
                title: "",
                key: "status",
                render: (row: GroupRow) => (row.isUpToDate ? <Tag color="green">Up to date</Tag> : null),
              },
            ]}
          />
        </section>
      ) : null}

      {summary.kinds.length ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">By kind</h2>
          <Table
            data-testid="preview-kinds"
            size="small"
            pagination={false}
            rowKey="kind"
            dataSource={summary.kinds}
            columns={[{ title: "Kind", dataIndex: "kind", key: "kind" }, ...countColumns<OctopusImportKindChangeCounts>((kind) => kind.counts)]}
          />
        </section>
      ) : null}

      {fills.length ? <FillList resources={fills} spaceSlug={spaceSlug} /> : null}

      {summary.skipReasons.length ? <SkipReasons reasons={summary.skipReasons} /> : null}
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

/** Secrets the Octopus API does not return: imported empty and listed so they can be filled later. Names only. */
export const WithheldSecretsPanel: React.FC<{
  resources: OctopusImportPreviewResource[];
  onFillFromFile: () => void;
  disabled?: boolean;
}> = ({ resources, onFillFromFile, disabled }) => {
  const rows = withheldSecrets(resources);
  if (!rows.length) return null;

  const anyFillable = rows.some(row => row.fillable);

  return (
    <section data-testid="withheld-secrets" className="space-y-3">
      <Alert
        type="warning"
        showIcon
        message={`${pluralize(rows.length, "secret value")} will be imported as missing`}
        description={`The Octopus API never returns secret values. These are created without their value, and deployments that use a missing variable value fail with a clear message until it is set. ${fillHint(anyFillable)}`}
        action={anyFillable ? <FillFromFileButton onFillFromFile={onFillFromFile} disabled={disabled} /> : null}
      />
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={rows}
        columns={[
          { title: "Kind", dataIndex: "kind", key: "kind" },
          { title: "Name", dataIndex: "name", key: "name" },
          { title: "Where", dataIndex: "where", key: "where" },
          { title: "Field", dataIndex: "field", key: "field" },
          { title: "Scope", dataIndex: "scope", key: "scope" },
          {
            title: "Fill",
            key: "fillable",
            render: (row: WithheldSecretRow) => (row.fillable ? "From the export file" : "Set it in Squid"),
          },
        ]}
      />
    </section>
  );
};

/** After an import from the API: the secrets it left empty, each linking to where it is set. */
export const MissingSecretsAfterImport: React.FC<{
  missing: OctopusImportMissingSensitiveValue[];
  spaceSlug: string;
  onFillFromFile: () => void;
  onDone: () => void;
}> = ({ missing, spaceSlug, onFillFromFile, onDone }) => {
  const anyFillable = missing.some(item => item.fillable);

  return (
  <section data-testid="missing-secrets-after-import" className="space-y-3">
    <Alert
      type="success"
      showIcon
      message="Import completed"
      description={`${pluralize(missing.length, "secret value")} could not be read from the Octopus API and ${missing.length === 1 ? "is" : "are"} still missing. ${fillHint(anyFillable)}`}
      action={
        <div className="flex flex-col gap-2">
          {anyFillable ? <FillFromFileButton onFillFromFile={onFillFromFile} /> : null}
          <Button size="small" type="primary" onClick={onDone}>
            Go to projects
          </Button>
        </div>
      }
    />
    <Table
      size="small"
      pagination={false}
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
        {
          title: "Fill",
          key: "fillable",
          render: (item: OctopusImportMissingSensitiveValue) => (item.fillable ? "From the export file" : "Set it in Squid"),
        },
      ]}
    />
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
    <Alert
      data-testid="fill-pairing"
      type="warning"
      showIcon
      message={copy.title}
      description={
        <div className="space-y-2">
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
        </div>
      }
    />
  );
};
