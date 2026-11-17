import { AxiosError } from "axios";
import { axiosInstance, type RequestConfig } from "utils/request";

const IMPORT_API_ROOT = "/octopus-import";
const IMPORT_REQUEST_TIMEOUT_MS = 60 * 1000;
const IMPORT_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
// Extracting a large export, or planning a project with thousands of releases, takes longer than an ordinary request.
const IMPORT_HEAVY_STEP_TIMEOUT_MS = 5 * 60 * 1000;

type QueryValue = string | number | boolean | null | undefined;

export interface OctopusImportEnvelope<T> {
  msg: string | null;
  code: number;
  data: T | null;
  /** Machine-readable failure kind (`SquidResponse.errorKind`); null for success and for failures without one. */
  errorKind?: string | null;
}

export enum OctopusImportSessionState {
  Uploaded,
  Extracted,
  Previewed,
  Validated,
  Importing,
  Succeeded,
  Failed,
  Expired,
}

export enum OctopusImportPreviewAction {
  Create,
  ReuseExisting,
  RenameRequired,
  Skip,
  Unsupported,
  Blocked,
  // Append-only: mirrors the backend ordinals.
  AlreadyImported = 6,
  Update = 7,
  FillMissingSecret = 8,
}

export enum OctopusImportResourceOutcomeState {
  Pending,
  Created,
  Reused,
  Skipped,
  Unsupported,
  Blocked,
  Failed,
  // Append-only: mirrors the backend ordinals.
  Updated = 7,
  SecretFilled = 8,
}

export enum OctopusHistoryFetchPhase {
  Releases,
  Deployments,
  Done,
  // Append-only: mirrors the backend ordinals.
  Catalog = 3,
  ProjectConfiguration = 4,
  Closure = 5,
}

export enum OctopusImportCompatibilitySeverity {
  Info,
  Warning,
  Blocker,
}

export enum OctopusImportRequiredInputKind {
  SensitiveVariableValue,
  // Append-only: mirrors the backend ordinals.
  FeedPassword = 1,
  AccountSecret = 2,
  CertificatePrivateKey = 3,
  SensitiveActionProperty = 4,
}

/** Why the user decides whether a row is imported. */
export enum OctopusImportChoiceReason {
  // Append-only: mirrors the backend ordinals.
  DeletedInSquid,
  AddedInOctopus,
}

export enum OctopusImportProjectDestinationState {
  New,
  Existing,
  NotImported,
}

export interface OctopusImportDiagnostic {
  severity: OctopusImportCompatibilitySeverity;
  code: string;
  message: string;
}

export interface OctopusImportBlockingReason {
  code: string;
  message: string;
  occurrenceCount: number;
  affectedResourceCount: number;
}

export interface OctopusImportBlockerSummary {
  hasBlockers: boolean;
  blockerCount: number;
  affectedResourceCount: number;
  blockingReasons: OctopusImportBlockingReason[];
}

export interface OctopusImportRequiredInput {
  kind: OctopusImportRequiredInputKind;
  inputKey: string;
  sourceId: string;
  sourceType: string;
  name: string;
  fieldName: string;
  valueType: string;
  hasSourceValue: boolean;
  isRequired: boolean;
  /** A later import of the Octopus export file can supply this value. */
  fillable?: boolean;
  /** The Octopus server API never returns this secret; it is imported empty and listed as missing. */
  withheldByServer?: boolean;
  sourceScopes: Record<string, string[]>;
}

export interface OctopusImportSourceFile {
  path: string;
  documentType: string;
  sizeBytes: number;
  sha256: string | null;
}

export interface OctopusHistoryFetchCounts {
  releases: number;
  deployments: number;
  serverTasks: number;
  detailsFetched: number;
  detailsSkipped: number;
  /** Tasks over the per-response cap; imported without their logs. */
  detailsTooLarge?: number;
  /** Scoped projects the Octopus space does not have (wrong space, or deleted there). */
  projectsNotFound?: number;
  /** Requests the Octopus server refused; each item is skipped. */
  itemsRejected?: number;
  /** Items skipped after outliving the chunk deadline too many times. */
  itemsAbandoned?: number;
  /** Configuration documents read (everything but releases, deployments and tasks). */
  configurationDocuments?: number;
  /** Secret values the server did not return; imported as "value missing". */
  secretsWithheld?: number;
}

export interface OctopusImportHistoryFetch {
  serverHost: string | null;
  octopusSpaceId: string | null;
  installationId: string | null;
  octopusVersion: string | null;
  spaceless: boolean;
  projectIds: string[];
  projectIndex: number;
  phase: OctopusHistoryFetchPhase;
  counts: OctopusHistoryFetchCounts;
  totalBytes: number;
  done: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface OctopusImportSourceSummary {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  detectedFormat: string;
  sha256: string | null;
  files?: OctopusImportSourceFile[];
  historyFetch?: OctopusImportHistoryFetch | null;
  /** The Octopus projects chosen for this import; null (or absent) imports the whole space. Set by the server from the selection. */
  selectedProjectIds?: string[] | null;
}

export interface OctopusServerSpace {
  id: string;
  name: string;
  isDefault: boolean;
}

/** Whether an API key can read a whole Octopus space; an import with an insufficient key is refused. */
export interface OctopusServerPermissions {
  octopusSpaceId: string | null;
  sufficient: boolean;
  restricted: string[];
  missing: string[];
  incomplete: boolean;
}

export interface OctopusServerProbe {
  octopusVersion: string;
  installationId: string;
  spaceless: boolean;
  spaces: OctopusServerSpace[];
  /** What the key can read in the default space; null when unknown. */
  permissions?: OctopusServerPermissions | null;
}

export interface OctopusHistoryFetchProgress {
  phase: OctopusHistoryFetchPhase;
  projectIndex: number;
  projectCount: number;
  /** The catalog kind being read, of `catalogKindCount`, while the phase is Catalog. */
  catalogIndex?: number;
  catalogKindCount?: number;
  /** Items of the current phase already read: the current project's releases or deployments, or the current catalog kind's resources. Absent on older servers. */
  phaseItemsDone?: number;
  /** What Octopus reported in all for the same thing; null until the phase's first page is read, and absent on older servers. */
  phaseItemsTotal?: number | null;
  counts: OctopusHistoryFetchCounts;
  totalBytes: number;
  done: boolean;
}

export interface OctopusServerConnection {
  serverUrl: string;
  apiKey: string;
}

/** The server and space an import session reads; the key is checked before the session exists. */
export interface OctopusServerTarget extends OctopusServerConnection {
  octopusSpaceId: string | null;
}

export interface OctopusImportSession {
  sessionId: string;
  destinationSpaceId: number;
  ownerUserId?: number;
  state: OctopusImportSessionState;
  sourceSummary?: OctopusImportSourceSummary | null;
  result?: OctopusImportResult | null;
  expiresAt?: string | null;
  /** The latest the session can ever be kept until (creation plus the server's maximum session age); activity never extends it. */
  maxExpiresAt?: string | null;
  completedAt?: string | null;
  lastStateChangedAt?: string | null;
}

export interface OctopusImportExtractionCount {
  documentType: string;
  count: number;
}

export interface OctopusImportExtractionFile {
  path: string;
  documentType: string;
  sizeBytes: number;
  sha256: string | null;
}

export interface OctopusImportExtraction {
  extractedAt: string;
  documentCount: number;
  resourceCount: number;
  counts: OctopusImportExtractionCount[];
  files: OctopusImportExtractionFile[];
  diagnostics: OctopusImportDiagnostic[];
  hasBlockers: boolean;
}

export interface OctopusImportFieldChange {
  field: string;
  /** Squid's current value; null when Squid holds none or the value is hidden. */
  oldValue: string | null;
  /** The value the import writes; null when it writes none or the value is hidden. */
  newValue: string | null;
  /** A secret: only the field is named, never a value. */
  valueHidden: boolean;
  description: string | null;
}

export interface OctopusImportSkipReason {
  code: string;
  message: string;
}

/** The Squid project, library variable set or feed a missing secret is (or would be) filled in. */
export interface OctopusImportFillDestination {
  ownerKind: 'Project' | 'LibraryVariableSet' | 'Feed' | string;
  ownerId: number;
  ownerName: string | null;
  variableSetId: number | null;
}

export interface OctopusImportFillPairing {
  required: boolean;
  confirmed: boolean;
  installationId: string | null;
  serverHost: string | null;
  octopusSpaceId: string | null;
  octopusVersion: string | null;
  /** The Octopus installation the incoming source reads (an Octopus server); null for an export file. */
  sourceInstallationId?: string | null;
  /** The Octopus server (host[:port]) the incoming source reads; null for an export file or when unknown. */
  sourceServerHost?: string | null;
  /** The Octopus space the incoming source reads; null for an export file or when unknown. */
  sourceOctopusSpaceId?: string | null;
  fileExportSourceId: string | null;
  recordedExportSourceId: string | null;
  matchingStructureIds: number;
}

/** The origin check's verdict on an import that would link to rows an import of another origin created. */
export enum OctopusImportFillEvidenceState {
  Proven,
  PairingRequired,
  Unproven,
}

export interface OctopusImportOriginEvidence {
  state: OctopusImportFillEvidenceState;
  /**
   * installation / export-fingerprint / confirmed-pairing (proven); installation-mismatch / other-origin-rows (refused);
   * export-fingerprint-mismatch (an export file whose fingerprint the space does not know: refused without process ids in common, pairing
   * with them); null when only process ids could tie it.
   */
  basis: string | null;
  /** Process step, action and lifecycle phase ids of this source that an import of the space's recorded origin created. */
  matchingStructureIds: number;
  /** The incoming source, named by the server (installation, server, space, version or export fingerprint). */
  source: string;
  /** What the space was imported from. */
  recorded: string;
  /** For other-origin-rows: the origins that created the resources it would link to (at most three); absent on older servers. */
  creators?: string[] | null;
  /** How many more such origins beyond `creators`. */
  moreCreators?: number;
}

export interface OctopusImportChangeCounts {
  /** Imported by an earlier import: nothing is written. */
  alreadyImported: number;
  /** An existing Squid resource is linked as-is. */
  reused: number;
  create: number;
  update: number;
  fill: number;
  skip: number;
  unsupported: number;
  blocked: number;
  total: number;
  /** create + update + fill + reused (serialized by the server; ignored when posted back). */
  incremental: number;
}

export interface OctopusImportKindChangeCounts {
  kind: string;
  counts: OctopusImportChangeCounts;
}

export interface OctopusImportPreviewGroup {
  counts: OctopusImportChangeCounts;
  kinds: OctopusImportKindChangeCounts[];
  isUpToDate: boolean;
}

export interface OctopusImportProjectDestination {
  state: OctopusImportProjectDestinationState;
  /** The existing Squid project; null for a new or not imported project. */
  projectId: number | null;
  /** The Squid project's current name (it may differ from the Octopus name). */
  projectName: string | null;
  projectSlug: string | null;
}

export interface OctopusImportProjectPreview extends OctopusImportPreviewGroup {
  sourceId: string;
  sourceName: string;
  destination: OctopusImportProjectDestination;
}

export interface OctopusImportSkipReasonCount {
  resourceType: string;
  code: string;
  message: string;
  count: number;
}

/**
 * A row the user decides on: deleted in Squid after an earlier import, or added in Octopus after its owner was imported. The server
 * sets every field; the client only sets `selected` on a root row (`followsSourceId` null) and posts the plan back to validate.
 */
export interface OctopusImportChoice {
  reason: OctopusImportChoiceReason;
  /** The effective selection: whether the row is imported. */
  selected: boolean;
  defaultSelected: boolean;
  /** Set on a row that follows a choosable root (the actions of a choosable step); it has no checkbox of its own. */
  followsSourceId: string | null;
  /** What the row belongs to, for display ("Deployment process of 'Web'"). */
  ownerName: string | null;
}

export interface OctopusImportChoiceCount {
  reason: OctopusImportChoiceReason;
  total: number;
  selected: number;
}

export interface OctopusImportPreviewSummary {
  isUpToDate: boolean;
  counts: OctopusImportChangeCounts;
  kinds: OctopusImportKindChangeCounts[];
  projects: OctopusImportProjectPreview[];
  /** Resources no Octopus project owns (environments, feeds, library variable sets, teams, ...). */
  space: OctopusImportPreviewGroup;
  skipReasons: OctopusImportSkipReasonCount[];
  /** Choosable root rows per reason, offered and selected; absent on older servers. */
  choices?: OctopusImportChoiceCount[] | null;
  /** Octopus projects in the source that were not chosen for this import; absent on older servers. */
  notChosenProjectCount?: number;
}

export interface OctopusImportProjectGroupOption {
  id: string;
  name: string;
}

export interface OctopusImportProjectOption {
  id: string;
  name: string;
  projectGroupId: string | null;
  isDisabled: boolean;
  /** An earlier import into this Squid space recorded this Octopus project. Advisory only: the preview decides. */
  previouslyImported: boolean;
}

/** The projects of an Octopus space or export file, to choose which are imported. */
export interface OctopusImportProjectList {
  groups: OctopusImportProjectGroupOption[];
  projects: OctopusImportProjectOption[];
  /** The session's current selection; null = whole space (nothing chosen yet). */
  selectedProjectIds: string[] | null;
}

export interface OctopusImportPreviewResource {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  previewAction: OctopusImportPreviewAction;
  outcomeState: OctopusImportResourceOutcomeState;
  destinationId: number | null;
  /** The Octopus project the resource belongs to (the project itself for a project); null for shared resources. */
  ownerProjectSourceId?: string | null;
  /** For a resource that fills a secret an earlier import left missing: where it is filled. */
  fillDestination?: OctopusImportFillDestination | null;
  /** For an Update or a Fill: the fields written, old -> new (a secret is named, never shown). */
  changes?: OctopusImportFieldChange[];
  /** For a resource that is not imported (Skip, Unsupported): why. */
  skipReason?: OctopusImportSkipReason | null;
  /** Set when the user decides whether this row is imported; null for every other row and on older servers. */
  choice?: OctopusImportChoice | null;
  requiredInputs: OctopusImportRequiredInput[];
  diagnostics: OctopusImportDiagnostic[];
}

export interface OctopusImportPreviewPlan {
  generatedAt: string;
  resources: OctopusImportPreviewResource[];
  requiredInputs: OctopusImportRequiredInput[];
  diagnostics: OctopusImportDiagnostic[];
  hasBlockers: boolean;
  /** Set when the import (its links to earlier imported rows, or its secret fills) needs the user to confirm the source's Octopus. */
  fillPairing?: OctopusImportFillPairing | null;
  /** The origin check's verdict when the import would link to rows of another origin; absent when nothing needs proof. */
  origin?: OctopusImportOriginEvidence | null;
  /** Totals, per-kind and per-project counts, skip reasons and the "up to date" flag. */
  summary?: OctopusImportPreviewSummary | null;
}

export interface OctopusImportValidation {
  requiredInputs: OctopusImportRequiredInput[];
  diagnostics: OctopusImportDiagnostic[];
  hasBlockers: boolean;
}

export interface OctopusImportIdMapping {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  destinationType: string;
  destinationId: number;
  outcomeState: OctopusImportResourceOutcomeState;
}

/** A secret an import wrote empty because the Octopus server withheld it. Names only, never a value. */
export interface OctopusImportMissingSensitiveValue {
  kind: OctopusImportRequiredInputKind;
  name: string;
  ownerName: string | null;
  /** `Project` or `LibraryVariableSet` when `ownerName` is set. */
  ownerKind: string | null;
  field: string;
  scopeSummary: string | null;
  destinationId: number | null;
  destinationOwnerId: number | null;
  fillable: boolean;
}

export interface OctopusImportResult {
  succeeded: boolean;
  completedAt: string;
  resources: OctopusImportPreviewResource[];
  idMappings: OctopusImportIdMapping[];
  diagnostics: OctopusImportDiagnostic[];
  missingSensitiveValues?: OctopusImportMissingSensitiveValue[];
}

export interface OctopusImportUploadResponseData {
  session: OctopusImportSession;
  blockerSummary: OctopusImportBlockerSummary;
}

export interface OctopusImportExtractResponseData {
  session: OctopusImportSession;
  extraction: OctopusImportExtraction;
  blockerSummary: OctopusImportBlockerSummary;
}

export interface OctopusImportPreviewResponseData {
  session: OctopusImportSession;
  previewPlan: OctopusImportPreviewPlan;
  blockerSummary: OctopusImportBlockerSummary;
}

export interface OctopusImportValidateResponseData {
  session: OctopusImportSession;
  previewPlan: OctopusImportPreviewPlan;
  validation: OctopusImportValidation;
  blockerSummary: OctopusImportBlockerSummary;
}

export interface OctopusImportConfirmResponseData {
  session: OctopusImportSession;
  blockerSummary: OctopusImportBlockerSummary;
}

export interface OctopusImportConnectResponseData {
  session: OctopusImportSession;
}

export interface OctopusImportStatusResponseData {
  session: OctopusImportSession;
  blockerSummary: OctopusImportBlockerSummary;
}

export function isImportTerminalState(
  state: OctopusImportSessionState | number | null | undefined,
) {
  const value = Number(state);
  return value === 5 || value === 6 || value === 7;
}

function toEnvelope<T>(body: any, status: number): OctopusImportEnvelope<T> {
  if (body && typeof body === "object" && "code" in body && "data" in body) {
    return {
      msg: body.msg ?? null,
      code: Number(body.code ?? status) || status,
      data: (body.data ?? null) as T | null,
      errorKind: body.errorKind ?? null,
    };
  }

  if (body && typeof body === "object" && "code" in body && !("data" in body)) {
    return {
      msg: body.msg ?? null,
      code: Number(body.code ?? status) || status,
      data: null,
      errorKind: body.errorKind ?? null,
    };
  }

  return {
    msg: null,
    code: status,
    data: body as T | null,
  };
}

async function requestImport<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "PUT";
    spaceId: number;
    query?: Record<string, QueryValue>;
    body?: BodyInit | null;
    includeJson?: boolean;
    signal?: AbortSignal;
    timeout?: number;
  },
): Promise<OctopusImportEnvelope<T>> {
  try {
    const response = await axiosInstance.request<OctopusImportEnvelope<T>>({
      url: `${IMPORT_API_ROOT}${path}`,
      method: options.method,
      params: options.query,
      data: options.body ?? undefined,
      signal: options.signal,
      timeout: options.timeout ?? IMPORT_REQUEST_TIMEOUT_MS,
      skipSpaceIdInjection: true,
      headers: options.includeJson
        ? { "Content-Type": "application/json" }
        : undefined,
    } as RequestConfig);

    return toEnvelope<T>(response.data, response.status);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      return toEnvelope<T>(error.response.data, error.response.status);
    }
    throw error;
  }
}

export function uploadOctopusImport(
  file: File,
  password: string,
  spaceId: number,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.append("file", file);
  form.append("spaceId", String(spaceId));
  form.append("password", password);

  return requestImport<OctopusImportUploadResponseData>("/upload", {
    method: "POST",
    spaceId,
    body: form,
    signal,
    timeout: IMPORT_UPLOAD_TIMEOUT_MS,
  });
}

export function extractOctopusImport(
  sessionId: string,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportExtractResponseData>(
    `/${sessionId}/extract`,
    {
      method: "POST",
      spaceId,
      query: { spaceId },
      signal,
      timeout: IMPORT_HEAVY_STEP_TIMEOUT_MS,
    },
  );
}

export function previewOctopusImport(
  sessionId: string,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportPreviewResponseData>(
    `/${sessionId}/preview`,
    {
      method: "GET",
      spaceId,
      query: { spaceId },
      signal,
      timeout: IMPORT_HEAVY_STEP_TIMEOUT_MS,
    },
  );
}

export function validateOctopusImport(
  sessionId: string,
  spaceId: number,
  previewPlan: OctopusImportPreviewPlan,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportValidateResponseData>(
    `/${sessionId}/validate`,
    {
      method: "POST",
      spaceId,
      query: { spaceId },
      body: JSON.stringify({ previewPlan }),
      includeJson: true,
      signal,
      timeout: IMPORT_HEAVY_STEP_TIMEOUT_MS,
    },
  );
}

export function confirmOctopusImport(
  sessionId: string,
  spaceId: number,
  signal?: AbortSignal,
  runInBackground = false,
) {
  return requestImport<OctopusImportConfirmResponseData>(
    `/${sessionId}/confirm`,
    {
      method: "POST",
      spaceId,
      query: runInBackground ? { spaceId, runInBackground } : { spaceId },
      signal,
    },
  );
}

// The server URL and API key travel only in POST bodies, never in a query string.
export function probeOctopusServer(
  connection: OctopusServerConnection,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusServerProbe>("/history/probe", {
    method: "POST",
    spaceId,
    body: JSON.stringify({ spaceId, ...connection }),
    includeJson: true,
    signal,
  });
}

// With a target the key is checked before the session exists: a key that cannot read the whole space is refused.
export function connectOctopusImport(
  spaceId: number,
  target: OctopusServerTarget | null,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportConnectResponseData>("/connect", {
    method: "POST",
    spaceId,
    body: JSON.stringify({ spaceId, ...(target ?? {}) }),
    includeJson: true,
    signal,
  });
}

export function fetchOctopusImportHistory(
  sessionId: string,
  spaceId: number,
  connection: OctopusServerConnection,
  octopusSpaceId: string | null,
  signal?: AbortSignal,
) {
  return requestImport<OctopusHistoryFetchProgress>(
    `/${sessionId}/history/fetch`,
    {
      method: "POST",
      spaceId,
      body: JSON.stringify({ spaceId, ...connection, octopusSpaceId }),
      includeJson: true,
      signal,
      timeout: IMPORT_UPLOAD_TIMEOUT_MS,
    },
  );
}

export function getOctopusImportStatus(
  sessionId: string,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportStatusResponseData>(
    `/${sessionId}/status`,
    {
      method: "GET",
      spaceId,
      query: { spaceId },
      signal,
    },
  );
}

// Lists a space's projects and project groups only (no history), before a session exists; the key travels only in the body.
export function listOctopusServerProjects(
  connection: OctopusServerConnection,
  octopusSpaceId: string | null,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportProjectList>("/history/projects", {
    method: "POST",
    spaceId,
    body: JSON.stringify({ spaceId, ...connection, octopusSpaceId }),
    includeJson: true,
    signal,
  });
}

// The projects of a session's source (an extracted export file, or what a server read staged).
export function getOctopusImportProjects(
  sessionId: string,
  spaceId: number,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportProjectList>(`/${sessionId}/projects`, {
    method: "GET",
    spaceId,
    query: { spaceId },
    signal,
  });
}

// Stores the chosen projects on the session; null imports the whole space.
export function selectOctopusImportProjects(
  sessionId: string,
  spaceId: number,
  projectIds: string[] | null,
  signal?: AbortSignal,
) {
  return requestImport<OctopusImportSession>(
    `/${sessionId}/projects/selection`,
    {
      method: "PUT",
      spaceId,
      query: { spaceId },
      body: JSON.stringify({ spaceId, projectIds }),
      includeJson: true,
      signal,
    },
  );
}
