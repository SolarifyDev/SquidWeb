import {
  OctopusHistoryFetchPhase,
  OctopusImportPreviewAction,
  OctopusImportProjectDestinationState,
  OctopusImportRequiredInputKind,
  type OctopusHistoryFetchCounts,
  type OctopusHistoryFetchProgress,
  type OctopusImportFillDestination,
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

/** The plan posted to validate: without history rows (the server re-plans them), with the user's pairing confirmation. */
export const planToValidate = (plan: OctopusImportPreviewPlan, pairingConfirmed: boolean): OctopusImportPreviewPlan => {
  const posted = withoutHistoryRows(plan);
  if (!plan.fillPairing) return posted;

  return { ...posted, fillPairing: { ...plan.fillPairing, confirmed: pairingConfirmed } };
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
