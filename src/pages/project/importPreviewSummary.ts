import {
  OctopusHistoryFetchPhase,
  OctopusImportChoiceReason,
  OctopusImportPreviewAction,
  OctopusImportProjectDestinationState,
  OctopusImportRequiredInputKind,
  type OctopusHistoryFetchCounts,
  type OctopusHistoryFetchProgress,
  type OctopusImportFillDestination,
  type OctopusImportFillPairing,
  type OctopusImportOriginEvidence,
  OctopusImportFillEvidenceState,
  type OctopusImportMissingSensitiveValue,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
  type OctopusImportProjectDestination,
  type OctopusServerPermissions,
} from 'pages/apis/octopusImport';
import { formatVariableSetRouteId } from 'pages/apis/variableSet';

/** Deployment-history kinds. The server owns these rows: it re-plans them on validate. */
export const HISTORY_SOURCE_TYPES = ['Release', 'Deployment', 'ServerTask'];

export type PreviewActionBucket = 'create' | 'reuse' | 'alreadyImported' | 'update' | 'fill' | 'skip' | 'other';

export type PreviewActionCounts = Record<PreviewActionBucket, number>;

export interface ProjectPreviewSummary {
  projectSourceId: string;
  projectName: string;
  counts: PreviewActionCounts;
  newReleases: number;
  newDeployments: number;
}

export interface ListedPreviewResource {
  resource: OctopusImportPreviewResource;
  label: string | null;
}

const normalizeType = (sourceType: string) => sourceType.trim().toLowerCase();

const isOfType = (resource: OctopusImportPreviewResource, type: string) =>
  normalizeType(resource.sourceType) === type.toLowerCase();

export const isHistoryResource = (resource: OctopusImportPreviewResource) =>
  HISTORY_SOURCE_TYPES.some(type => isOfType(resource, type));

/** The plan to post to validate: history rows are dropped because the server merges its own. */
export const withoutHistoryRows = (plan: OctopusImportPreviewPlan): OctopusImportPreviewPlan => ({
  ...plan,
  resources: plan.resources.filter(resource => !isHistoryResource(resource)),
});

export const actionBucket = (action: OctopusImportPreviewAction): PreviewActionBucket => {
  switch (Number(action)) {
    case OctopusImportPreviewAction.Create:
      return 'create';
    case OctopusImportPreviewAction.ReuseExisting:
      return 'reuse';
    case OctopusImportPreviewAction.AlreadyImported:
      return 'alreadyImported';
    case OctopusImportPreviewAction.Update:
      return 'update';
    case OctopusImportPreviewAction.FillMissingSecret:
      return 'fill';
    case OctopusImportPreviewAction.Skip:
      return 'skip';
    default:
      return 'other';
  }
};

const emptyCounts = (): PreviewActionCounts => ({
  create: 0,
  reuse: 0,
  alreadyImported: 0,
  update: 0,
  fill: 0,
  skip: 0,
  other: 0,
});

export const summarizeActions = (resources: OctopusImportPreviewResource[]): PreviewActionCounts =>
  resources.reduce((counts, resource) => {
    counts[actionBucket(resource.previewAction)] += 1;
    return counts;
  }, emptyCounts());

const writesHistory = (resource: OctopusImportPreviewResource, type: string) => {
  const bucket = actionBucket(resource.previewAction);
  return isOfType(resource, type) && (bucket === 'create' || bucket === 'update');
};

const projectNameOf = (resources: OctopusImportPreviewResource[], projectSourceId: string) =>
  resources.find(resource => isOfType(resource, 'Project') && resource.sourceId === projectSourceId)?.sourceName
  ?? projectSourceId;

/** One row per Octopus project, grouped by `ownerProjectSourceId`; shared resources are left out. */
export const summarizeByProject = (resources: OctopusImportPreviewResource[]): ProjectPreviewSummary[] => {
  const groups = new Map<string, OctopusImportPreviewResource[]>();

  for (const resource of resources) {
    const owner = resource.ownerProjectSourceId;
    if (!owner) continue;
    groups.set(owner, [...(groups.get(owner) ?? []), resource]);
  }

  return Array.from(groups, ([projectSourceId, owned]) => ({
    projectSourceId,
    projectName: projectNameOf(resources, projectSourceId),
    counts: summarizeActions(owned),
    newReleases: owned.filter(resource => writesHistory(resource, 'Release')).length,
    newDeployments: owned.filter(resource => writesHistory(resource, 'Deployment')).length,
  })).sort((left, right) => left.projectName.localeCompare(right.projectName));
};

/** True when confirming would write nothing: no resource is created, updated or filled. */
export const isNothingNew = (resources: OctopusImportPreviewResource[]) =>
  !resources.some(resource => {
    const bucket = actionBucket(resource.previewAction);
    return bucket === 'create' || bucket === 'update' || bucket === 'fill';
  });

/** Importing again changes nothing in Squid. The server decides; plans of an older server fall back to the resource actions. */
export const isUpToDate = (plan: OctopusImportPreviewPlan) =>
  plan.summary ? plan.summary.isUpToDate : isNothingNew(plan.resources);

/** The plan posted to validate: without history rows (the server re-plans them), with the user's pairing confirmation and choices. */
export const planToValidate = (plan: OctopusImportPreviewPlan, pairingConfirmed: boolean): OctopusImportPreviewPlan => {
  const posted = withoutHistoryRows(plan);
  if (!plan.fillPairing) return posted;

  return { ...posted, fillPairing: { ...plan.fillPairing, confirmed: pairingConfirmed } };
};

export interface ChoiceRow {
  resource: OctopusImportPreviewResource;
  /** Rows that follow it (the actions of a step): imported with it, never chosen on their own. */
  followers: OctopusImportPreviewResource[];
}

export interface ChoiceGroups {
  deleted: ChoiceRow[];
  added: ChoiceRow[];
}

/** A row the user ticks: it has a choice and follows no other row. */
const isChoiceRoot = (resource: OctopusImportPreviewResource) => Boolean(resource.choice && !resource.choice.followsSourceId);

const choiceRowsOf = (resources: OctopusImportPreviewResource[], reason: OctopusImportChoiceReason): ChoiceRow[] =>
  resources
    .filter(resource => isChoiceRoot(resource) && Number(resource.choice?.reason) === reason)
    .map(resource => ({ resource, followers: resources.filter(follower => follower.choice?.followsSourceId === resource.sourceId) }));

/** The rows the user decides on, by reason: deleted in Squid after an earlier import, or added in Octopus since. */
export const choiceGroups = (resources: OctopusImportPreviewResource[]): ChoiceGroups => ({
  deleted: choiceRowsOf(resources, OctopusImportChoiceReason.DeletedInSquid),
  added: choiceRowsOf(resources, OctopusImportChoiceReason.AddedInOctopus),
});

/** The plan with `selected` set on the given choice roots; followers and every other row are left as they are. */
export const withSelection = (plan: OctopusImportPreviewPlan, sourceIds: string[], selected: boolean): OctopusImportPreviewPlan => ({
  ...plan,
  resources: plan.resources.map(resource =>
    isChoiceRoot(resource) && sourceIds.includes(resource.sourceId) ? { ...resource, choice: { ...resource.choice!, selected } } : resource),
});

const selectionOf = (plan: OctopusImportPreviewPlan) =>
  new Map(plan.resources.filter(isChoiceRoot).map(resource => [resource.sourceId, Boolean(resource.choice?.selected)]));

/** True when a choice differs from the plan the server last returned: its counts no longer describe what would be imported. */
export const selectionChanged = (plan: OctopusImportPreviewPlan, previewed: OctopusImportPreviewPlan) => {
  const previewedSelection = selectionOf(previewed);

  return Array.from(selectionOf(plan)).some(([sourceId, selected]) => previewedSelection.get(sourceId) !== selected);
};

const CHOICE_KIND_TEXT: Record<string, string> = {
  DeploymentStep: 'Step',
  DeploymentAction: 'Action',
  LifecyclePhase: 'Lifecycle phase',
};

export const choiceKindText = (sourceType: string) => CHOICE_KIND_TEXT[sourceType] ?? sourceType;

/** "+2 actions": what is imported along with a ticked row; null when nothing follows it. */
export const followersText = (followers: OctopusImportPreviewResource[]) => {
  if (!followers.length) return null;
  const kinds = new Set(followers.map(follower => choiceKindText(follower.sourceType).toLowerCase()));
  const noun = kinds.size === 1 ? Array.from(kinds)[0] : 'item';

  return `+${countOf(followers.length, noun)}`;
};

const LISTED_LABELS: Partial<Record<PreviewActionBucket, string | null>> = {
  create: null,
  reuse: null,
  alreadyImported: 'Already imported',
  update: 'Update',
};

/** Resources of one type shown in the preview lists, labelled when they were imported before. */
export const listedResources = (resources: OctopusImportPreviewResource[], type: string): ListedPreviewResource[] =>
  resources
    .filter(resource => isOfType(resource, type))
    .filter(resource => actionBucket(resource.previewAction) in LISTED_LABELS)
    .map(resource => ({ resource, label: LISTED_LABELS[actionBucket(resource.previewAction)] ?? null }));

/** Percent for the fetch progress bar; held below 100 until the server reports done. */
export const fetchProgressPercent = (progress: OctopusHistoryFetchProgress | null) => {
  if (!progress) return 0;
  if (progress.done) return 100;
  if (progress.projectCount <= 0) return 0;

  return Math.min(99, Math.floor((progress.projectIndex / progress.projectCount) * 100));
};

export const FETCH_PHASE_LABELS: Record<OctopusHistoryFetchPhase, string> = {
  [OctopusHistoryFetchPhase.Releases]: 'Reading releases',
  [OctopusHistoryFetchPhase.Deployments]: 'Reading deployments',
  [OctopusHistoryFetchPhase.Done]: 'Finished reading from Octopus',
  [OctopusHistoryFetchPhase.Catalog]: 'Reading space configuration',
  [OctopusHistoryFetchPhase.ProjectConfiguration]: 'Reading project configuration',
  [OctopusHistoryFetchPhase.Closure]: 'Reading referenced resources',
};

export const fetchPhaseLabel = (phase: OctopusHistoryFetchPhase) => FETCH_PHASE_LABELS[phase] ?? 'Reading from Octopus';

const PER_PROJECT_PHASES = [
  OctopusHistoryFetchPhase.ProjectConfiguration,
  OctopusHistoryFetchPhase.Releases,
  OctopusHistoryFetchPhase.Deployments,
];

const catalogPosition = (progress: OctopusHistoryFetchProgress) =>
  progress.catalogKindCount ? ` (kind ${(progress.catalogIndex ?? 0) + 1} of ${progress.catalogKindCount})` : '';

/** The phase and where the read is in it: the catalog kind, or the project. */
export const fetchPositionLabel = (progress: OctopusHistoryFetchProgress) => {
  const label = fetchPhaseLabel(progress.phase);

  if (progress.phase === OctopusHistoryFetchPhase.Catalog) return label + catalogPosition(progress);
  if (PER_PROJECT_PHASES.includes(progress.phase))
    return `${label} (project ${progress.projectIndex} of ${progress.projectCount})`;

  return label;
};

export interface HistoryFetchNotices {
  projectsNotFound: number;
  detailsTooLarge: number;
  /** Every scoped project was missing and nothing was read: almost always the wrong space. */
  nothingFound: boolean;
}

const fetchedNothing = (counts: OctopusHistoryFetchCounts) =>
  counts.releases === 0 && counts.deployments === 0 && counts.serverTasks === 0;

export const historyFetchNotices = (progress: OctopusHistoryFetchProgress): HistoryFetchNotices => {
  const projectsNotFound = progress.counts.projectsNotFound ?? 0;
  const detailsTooLarge = progress.counts.detailsTooLarge ?? 0;
  const allMissing = projectsNotFound > 0 && projectsNotFound >= progress.projectCount;

  return { projectsNotFound, detailsTooLarge, nothingFound: allMissing && fetchedNothing(progress.counts) };
};

export type ImportSource = 'file' | 'server';

export type ImportStepStatus = 'process' | 'finish' | 'error';

export interface ImportStepInput {
  phase: string;
  /** The phase the workflow was in when it failed. */
  lastActivePhase: string | null;
  probed: boolean;
  fetchStarted: boolean;
}

export interface ImportSteps {
  titles: string[];
  current: number;
  status: ImportStepStatus;
}

const FILE_STEP_TITLES = ['Select file', 'Read file', 'Preview', 'Import'];
const SERVER_STEP_TITLES = ['Connect', 'Choose space', 'Read from Octopus', 'Preview', 'Import'];

const FILE_PHASE_STEPS: Record<string, number> = {
  uploading: 1,
  extracting: 1,
  previewing: 2,
  ready: 2,
  validating: 3,
  confirming: 3,
  statusUnknown: 3,
  succeeded: 3,
};

const SERVER_PHASE_STEPS: Record<string, number> = {
  connecting: 2,
  fetching: 2,
  extracting: 3,
  previewing: 3,
  ready: 3,
  validating: 4,
  confirming: 4,
  statusUnknown: 4,
  succeeded: 4,
};

const idleStep = (source: ImportSource, input: ImportStepInput) => {
  if (source === 'file') return 0;
  if (input.fetchStarted) return 2;
  return input.probed ? 1 : 0;
};

const stepOf = (source: ImportSource, phase: string | null, input: ImportStepInput) => {
  const steps = source === 'file' ? FILE_PHASE_STEPS : SERVER_PHASE_STEPS;
  return phase && phase in steps ? steps[phase] : idleStep(source, input);
};

/** The step bar of a source; a failure marks the step the workflow was in when it failed. */
export const importSteps = (source: ImportSource, input: ImportStepInput): ImportSteps => {
  const titles = source === 'file' ? FILE_STEP_TITLES : SERVER_STEP_TITLES;

  if (input.phase === 'failed') return { titles, current: stepOf(source, input.lastActivePhase, input), status: 'error' };

  return { titles, current: stepOf(source, input.phase, input), status: input.phase === 'succeeded' ? 'finish' : 'process' };
};

// Lease conflicts, timeouts, rate limits and server errors are worth retrying.
export const isTransientStatus = (code: number) => code === 408 || code === 409 || code === 429 || code >= 500;

/**
 * How the page recovers from a failed read: `resume` the same session, `reconnect` (a new key, or the right server and space) and
 * then resume, `restart` with a new session, or `none` (retrying cannot help). Mirrors the backend's OctopusImportErrorKinds.
 */
export type FetchFailureRecovery = 'resume' | 'reconnect' | 'restart' | 'none';

const RECOVERY_BY_KIND: Record<string, FetchFailureRecovery> = {
  Unreachable: 'resume',
  Concurrency: 'resume',
  Rejected: 'resume',
  Unauthorized: 'reconnect',
  KeyRestricted: 'reconnect',
  KeyUserMismatch: 'reconnect',
  NotOctopus: 'reconnect',
  Denied: 'reconnect',
  NotFound: 'reconnect',
  ServerMismatch: 'reconnect',
  SessionNotFound: 'restart',
  SessionStateConflict: 'restart',
  NotServerSource: 'restart',
  TooLarge: 'none',
};

const recoveryWithoutKind = (code: number): FetchFailureRecovery => {
  if (isTransientStatus(code)) return 'resume';
  return code === 404 ? 'restart' : 'none';
};

export const fetchFailureRecovery = (code: number, errorKind: string | null | undefined, thrown: boolean): FetchFailureRecovery => {
  if (thrown) return 'resume';
  if (errorKind) return RECOVERY_BY_KIND[errorKind] ?? 'none';

  return recoveryWithoutKind(code);
};

const START_AGAIN = 'This import session can no longer continue. Start again: an import never overwrites what is already in Squid.';
const CHECK_SERVER = 'Check the server URL and the Octopus space, connect again, then resume.';

const ERROR_KIND_HINTS: Record<string, string> = {
  KeyRestricted:
    'The API key cannot read the whole Octopus space, so the import would silently leave data out. Use a dedicated read-only service account '
    + 'with unrestricted view permissions in this space (ideally with an expiring key), connect with its key, then resume.',
  Unauthorized: 'The Octopus server rejected the API key. Enter a valid key and connect again, then resume.',
  KeyUserMismatch: 'This key belongs to another Octopus user than the one the read started with. Use a key of the same user, or start again.',
  ServerMismatch: 'This import session reads another Octopus server or space. Switch back to it, or start again.',
  NotOctopus: CHECK_SERVER,
  Denied: CHECK_SERVER,
  NotFound: CHECK_SERVER,
  Unreachable: 'The Octopus server could not be reached. Resume when it is reachable again; everything read so far is kept.',
  Rejected: 'The Octopus server refused a request. Resume to retry; items it keeps refusing are skipped and listed.',
  Concurrency: 'A read of this session is already running. Resume once it has finished.',
  TooLarge:
    'A response exceeded the import size limit. An administrator must raise the limit (SQUID_OCTOPUS_IMPORT_HISTORY_MAX_BYTES) before '
    + 'importing again.',
  SessionNotFound: START_AGAIN,
  SessionStateConflict: START_AGAIN,
  NotServerSource: START_AGAIN,
};

/** What the user can do about a failure of the given kind; null when the kind is unknown. */
export const errorKindHint = (errorKind: string | null | undefined) => (errorKind ? ERROR_KIND_HINTS[errorKind] ?? null : null);

/** Why a key cannot import the chosen space, one line per problem; null when it can or nothing is known for that space. */
export const permissionProblem = (permissions: OctopusServerPermissions | null | undefined, octopusSpaceId: string | null) => {
  if (!permissions || permissions.sufficient) return null;
  if ((permissions.octopusSpaceId ?? null) !== octopusSpaceId) return null;

  return [
    permissions.restricted.length
      ? `Limited to some projects, environments, tenants or project groups: ${permissions.restricted.join(', ')}`
      : null,
    permissions.missing.length ? `Not granted: ${permissions.missing.join(', ')}` : null,
    permissions.incomplete ? 'Octopus could not report the complete permission set of this key.' : null,
  ].filter((line): line is string => line !== null);
};

const encodeSegment = (value: string) => encodeURIComponent(value);

/** The existing Squid project an Octopus project lands on; null for a new or not imported one. */
export const projectDestinationLink = (spaceSlug: string, destination: OctopusImportProjectDestination) => {
  if (Number(destination.state) !== OctopusImportProjectDestinationState.Existing) return null;
  const routeName = destination.projectSlug || destination.projectName;

  return routeName ? `/${spaceSlug}/projects/${encodeSegment(routeName)}` : null;
};

const projectVariablesLink = (spaceSlug: string, projectName: string | null) =>
  projectName ? `/${spaceSlug}/projects/${encodeSegment(projectName)}/variables` : null;

const libraryVariableSetLink = (spaceSlug: string, id: number | null) =>
  id ? `/${spaceSlug}/library/variables/${formatVariableSetRouteId(id)}` : null;

export const fillDestinationLink = (spaceSlug: string, destination: OctopusImportFillDestination) => {
  switch (destination.ownerKind) {
    case 'Project':
      return projectVariablesLink(spaceSlug, destination.ownerName);
    case 'LibraryVariableSet':
      return libraryVariableSetLink(spaceSlug, destination.ownerId);
    case 'Feed':
      return `/${spaceSlug}/external/feeds`;
    default:
      return null;
  }
};

const OWNER_KIND_TEXT: Record<string, string> = {
  Project: 'project',
  LibraryVariableSet: 'library variable set',
  Feed: 'feed',
};

export const describeFillDestination = (destination: OctopusImportFillDestination) => {
  const kind = OWNER_KIND_TEXT[destination.ownerKind] ?? destination.ownerKind;
  return destination.ownerName ? `${kind} "${destination.ownerName}"` : `${kind} ${destination.ownerId}`;
};

/** Where to set a secret an import left missing. */
export const missingSecretLink = (spaceSlug: string, missing: OctopusImportMissingSensitiveValue) => {
  switch (Number(missing.kind)) {
    case OctopusImportRequiredInputKind.FeedPassword:
      return `/${spaceSlug}/external/feeds`;
    case OctopusImportRequiredInputKind.AccountSecret:
      return `/${spaceSlug}/infrastructure/accounts`;
    case OctopusImportRequiredInputKind.CertificatePrivateKey:
      return `/${spaceSlug}/library/certificates`;
    case OctopusImportRequiredInputKind.SensitiveActionProperty:
      return missing.ownerName ? `/${spaceSlug}/projects/${encodeSegment(missing.ownerName)}/deployments/process` : null;
    default:
      return missing.ownerKind === 'LibraryVariableSet'
        ? libraryVariableSetLink(spaceSlug, missing.destinationOwnerId)
        : projectVariablesLink(spaceSlug, missing.ownerName);
  }
};

const ownedBy = (resource: OctopusImportPreviewResource, projectSourceId: string | null) =>
  (resource.ownerProjectSourceId ?? null) === projectSourceId;

/** Resources of a project (or, for null, of no project) whose fields this import writes, old -> new. */
export const changedResources = (resources: OctopusImportPreviewResource[], projectSourceId: string | null) =>
  resources.filter(resource => ownedBy(resource, projectSourceId) && (resource.changes?.length ?? 0) > 0);

/** Resources of a project (or, for null, of no project) that are not imported, with the reason. */
export const skippedResources = (resources: OctopusImportPreviewResource[], projectSourceId: string | null) =>
  resources.filter(resource => ownedBy(resource, projectSourceId) && resource.skipReason);

/** Secrets an earlier import left missing that this import fills. */
export const fillResources = (resources: OctopusImportPreviewResource[]) =>
  resources.filter(resource => Number(resource.previewAction) === OctopusImportPreviewAction.FillMissingSecret);

export const REQUIRED_INPUT_KIND_LABELS: Record<OctopusImportRequiredInputKind, string> = {
  [OctopusImportRequiredInputKind.SensitiveVariableValue]: 'Sensitive variable',
  [OctopusImportRequiredInputKind.FeedPassword]: 'Feed password',
  [OctopusImportRequiredInputKind.AccountSecret]: 'Account secret',
  [OctopusImportRequiredInputKind.CertificatePrivateKey]: 'Certificate private key',
  [OctopusImportRequiredInputKind.SensitiveActionProperty]: 'Step secret',
};

export const requiredInputKindLabel = (kind: OctopusImportRequiredInputKind) => REQUIRED_INPUT_KIND_LABELS[kind] ?? 'Secret';

const RESOURCE_TYPE_TEXT: Record<string, string> = {
  LibraryVariableSet: 'Library variable set',
};

const resourceTypeText = (sourceType: string) => RESOURCE_TYPE_TEXT[sourceType] ?? sourceType;

/** "Environment: Production, Test; Role: web"; empty when unscoped. */
export const scopeSummary = (scopes: Record<string, string[]> | null | undefined) =>
  Object.entries(scopes ?? {})
    .filter(([, values]) => values.length > 0)
    .map(([field, values]) => `${field}: ${values.join(', ')}`)
    .join('; ');

export interface WithheldSecretRow {
  key: string;
  kind: string;
  name: string;
  where: string;
  field: string;
  scope: string;
  fillable: boolean;
}

const whereOf = (resources: OctopusImportPreviewResource[], resource: OctopusImportPreviewResource) =>
  resource.ownerProjectSourceId
    ? `Project "${projectNameOf(resources, resource.ownerProjectSourceId)}"`
    : `${resourceTypeText(resource.sourceType)} "${resource.sourceName}"`;

/** Secrets the Octopus server withheld on resources this import creates: they are imported empty ("value missing"). Names only. */
export const withheldSecrets = (resources: OctopusImportPreviewResource[]): WithheldSecretRow[] =>
  resources
    .filter(resource => Number(resource.previewAction) === OctopusImportPreviewAction.Create)
    .flatMap(resource => resource.requiredInputs
      .filter(input => input.withheldByServer)
      .map(input => ({
        key: `${resource.sourceId}:${input.inputKey}`,
        kind: requiredInputKindLabel(input.kind),
        name: input.name,
        where: whereOf(resources, resource),
        field: input.fieldName,
        scope: scopeSummary(input.sourceScopes),
        fillable: Boolean(input.fillable),
      })));

/** The preview's origin check: the source would link to rows of another Octopus and nothing proves it is the same one. */
export const IMPORT_ORIGIN_UNPROVEN = 'octopus.preview.import_origin_unproven';

/** The preview's origin check: matching process ids tie the source to the space's Octopus; the user confirms the pairing. */
export const IMPORT_ORIGIN_PAIRING_REQUIRED = 'octopus.preview.import_origin_pairing_required';

export interface PairingCopy {
  title: string;
  intro: string;
  /** The incoming source, as the pairing names it. */
  incoming: string[];
  /** What the space was imported from. */
  recorded: string[];
  confirmLabel: string;
}

export interface OriginNotice {
  title: string;
  /** Both origins as the server names them; empty when the server sent no verdict. */
  origins: string[];
  hint: string;
}

const hasDiagnostic = (plan: OctopusImportPreviewPlan | null | undefined, code: string) => Boolean(plan?.diagnostics?.some(d => d.code === code));

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const listed = (lines: Array<[string, string | null | undefined]>) => lines.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);

const isServerSource = (pairing: OctopusImportFillPairing) => Boolean(pairing.sourceInstallationId);

const incomingLines = (pairing: OctopusImportFillPairing) =>
  isServerSource(pairing)
    ? listed([['Server', pairing.sourceServerHost], ['Space', pairing.sourceOctopusSpaceId], ['Installation', pairing.sourceInstallationId]])
    : listed([['Export file fingerprint', pairing.fileExportSourceId]]);

// The space's API import names its server (unknown parts shown as such); a file-imported space names the pinned fingerprint.
const recordedLines = (pairing: OctopusImportFillPairing) =>
  pairing.installationId || !pairing.recordedExportSourceId
    ? [`Server: ${pairing.serverHost ?? 'unknown'}`, `Space: ${pairing.octopusSpaceId ?? 'unknown'}`, `Version: ${pairing.octopusVersion ?? 'unknown'}`, `Installation: ${pairing.installationId ?? 'unknown'}`]
    : listed([['Export file fingerprint', pairing.recordedExportSourceId]]);

const pairingIntro = (pairing: OctopusImportFillPairing, links: boolean) => {
  const subject = isServerSource(pairing) ? 'This Octopus server' : 'This export file';
  const action = links ? 'link to what an earlier import created in this space' : 'fill secrets an earlier import read from the Octopus API';

  return `${subject} would ${action}. Ids like Projects-1 repeat across Octopus servers, and only ${countOf(pairing.matchingStructureIds, 'matching step, action or phase id')} tie it to this space's Octopus. Continue only if it comes from:`;
};

/** The words of the pairing confirmation: who the incoming source is (server or export file), and whether it links or fills. */
export const pairingCopyOf = (pairing: OctopusImportFillPairing, links: boolean): PairingCopy => {
  const server = isServerSource(pairing);

  return {
    title: server ? 'Confirm this is the Octopus server this space came from' : 'Confirm where this export file comes from',
    intro: pairingIntro(pairing, links),
    incoming: incomingLines(pairing),
    recorded: recordedLines(pairing),
    confirmLabel: server ? 'This is the same Octopus server this space was imported from' : 'This export file comes from the same Octopus server this space was imported from',
  };
};

/** The pairing's words for a preview plan: it links when the origin check asks for the pairing, otherwise it fills. */
export const pairingCopy = (plan: OctopusImportPreviewPlan): PairingCopy => pairingCopyOf(plan.fillPairing as OctopusImportFillPairing, linksEarlierImport(plan));

/** The origin check asks the pairing: the source would link to what an earlier import created. */
export const linksEarlierImport = (plan: OctopusImportPreviewPlan | null | undefined) => hasDiagnostic(plan, IMPORT_ORIGIN_PAIRING_REQUIRED);

const DIFFERENT_OCTOPUS_TITLE = 'This import comes from a different Octopus than this space';

const ORIGIN_REFUSAL_TITLES: Record<string, string> = {
  'installation-mismatch': 'This import comes from another Octopus installation than this space',
  'other-origin-rows': 'This import would link to resources another Octopus source created in this space',
  'export-fingerprint-mismatch': "This export file's fingerprint is not one this space was imported from",
};

const ORIGIN_REFUSAL_HINT = 'Ids like Projects-1 repeat across Octopus servers, and nothing ties this source to the Octopus this space was imported from. Nothing will be linked or written. Import it into another space, or import the Octopus server or export file this space came from.';

const ORIGIN_PROOF_BASIS: Record<string, string> = {
  installation: 'its installation id',
  'export-fingerprint': 'its export file fingerprint',
  'confirmed-pairing': 'the pairing you confirmed',
};

const hasOriginVerdict = (plan: OctopusImportPreviewPlan | null | undefined, state: OctopusImportFillEvidenceState) =>
  plan?.origin != null && Number(plan.origin.state) === state;

// "a, b and c", or "a, b, c and 2 more" beyond the origins the server names.
const creatorsText = (creators: string[], more: number) => {
  const names = more > 0 ? [...creators, `${more} more`] : creators;

  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const creatorLines = (origin: OctopusImportOriginEvidence) =>
  origin.creators?.length ? [`Resources it would link to were created by: ${creatorsText(origin.creators, origin.moreCreators ?? 0)}`] : [];

const refusedOriginNotice = (origin: OctopusImportOriginEvidence): OriginNotice => ({
  title: ORIGIN_REFUSAL_TITLES[origin.basis ?? ''] ?? DIFFERENT_OCTOPUS_TITLE,
  origins: [`This source: ${origin.source}`, `This space was imported from: ${origin.recorded}`, ...creatorLines(origin)],
  hint: ORIGIN_REFUSAL_HINT,
});

/**
 * Shown when the origin check refuses the import: the server's verdict names both origins; a server without the verdict is still
 * recognised by its blocker diagnostic.
 */
export const originNotice = (plan: OctopusImportPreviewPlan | null | undefined): OriginNotice | null => {
  if (hasOriginVerdict(plan, OctopusImportFillEvidenceState.Unproven)) return refusedOriginNotice(plan?.origin as OctopusImportOriginEvidence);

  return hasDiagnostic(plan, IMPORT_ORIGIN_UNPROVEN) ? { title: DIFFERENT_OCTOPUS_TITLE, origins: [], hint: ORIGIN_REFUSAL_HINT } : null;
};

/** One quiet line when the import links to earlier imports of a proven Octopus: what proved it. */
export const originProof = (plan: OctopusImportPreviewPlan | null | undefined): string | null =>
  hasOriginVerdict(plan, OctopusImportFillEvidenceState.Proven)
    ? `Same Octopus as this space, proven by ${ORIGIN_PROOF_BASIS[plan?.origin?.basis ?? ''] ?? 'its recorded origin'}: it links to what earlier imports created.`
    : null;
