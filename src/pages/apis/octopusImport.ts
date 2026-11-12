import { AxiosError } from "axios";
import { axiosInstance, type RequestConfig } from "utils/request";

const IMPORT_API_ROOT = "/octopus-import";
const IMPORT_REQUEST_TIMEOUT_MS = 60 * 1000;
const IMPORT_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

type QueryValue = string | number | boolean | null | undefined;

export interface OctopusImportEnvelope<T> {
  msg: string | null;
  code: number;
  data: T | null;
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
}

export enum OctopusHistoryFetchPhase {
  Releases,
  Deployments,
  Done,
}

export enum OctopusImportCompatibilitySeverity {
  Info,
  Warning,
  Blocker,
}

export enum OctopusImportRequiredInputKind {
  SensitiveVariableValue,
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
}

export interface OctopusServerSpace {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface OctopusServerProbe {
  octopusVersion: string;
  installationId: string;
  spaceless: boolean;
  spaces: OctopusServerSpace[];
}

export interface OctopusHistoryFetchProgress {
  phase: OctopusHistoryFetchPhase;
  projectIndex: number;
  projectCount: number;
  counts: OctopusHistoryFetchCounts;
  totalBytes: number;
  done: boolean;
}

export interface OctopusServerConnection {
  serverUrl: string;
  apiKey: string;
}

export interface OctopusImportSession {
  sessionId: string;
  destinationSpaceId: number;
  ownerUserId?: number;
  state: OctopusImportSessionState;
  sourceSummary?: OctopusImportSourceSummary | null;
  result?: OctopusImportResult | null;
  expiresAt?: string | null;
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

export interface OctopusImportPreviewResource {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  previewAction: OctopusImportPreviewAction;
  outcomeState: OctopusImportResourceOutcomeState;
  destinationId: number | null;
  /** The Octopus project the resource belongs to (the project itself for a project); null for shared resources. */
  ownerProjectSourceId?: string | null;
  requiredInputs: OctopusImportRequiredInput[];
  diagnostics: OctopusImportDiagnostic[];
}

export interface OctopusImportPreviewPlan {
  generatedAt: string;
  resources: OctopusImportPreviewResource[];
  requiredInputs: OctopusImportRequiredInput[];
  diagnostics: OctopusImportDiagnostic[];
  hasBlockers: boolean;
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

export interface OctopusImportResult {
  succeeded: boolean;
  completedAt: string;
  resources: OctopusImportPreviewResource[];
  idMappings: OctopusImportIdMapping[];
  diagnostics: OctopusImportDiagnostic[];
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
    };
  }

  if (body && typeof body === "object" && "code" in body && !("data" in body)) {
    return {
      msg: body.msg ?? null,
      code: Number(body.code ?? status) || status,
      data: null,
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
    method: "GET" | "POST";
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

export function connectOctopusImport(spaceId: number, signal?: AbortSignal) {
  return requestImport<OctopusImportConnectResponseData>("/connect", {
    method: "POST",
    spaceId,
    body: JSON.stringify({ spaceId }),
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
