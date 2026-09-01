import { axiosInstance } from "utils/request";
import { getAuthToken, handleUnauthorizedSession } from "utils/auth";

const IMPORT_API_ROOT = "/octopus-import";

type QueryValue = string | number | boolean | null | undefined;

export interface OctopusImportEnvelope<T> {
  msg: string | null;
  code: number;
  data: T | null;
}

export type OctopusImportSessionState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type OctopusImportPreviewAction = 0 | 1 | 2 | 3 | 4 | 5;
export type OctopusImportResourceOutcomeState = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type OctopusImportCompatibilitySeverity = 0 | 1 | 2;
export type OctopusImportRequiredInputKind = 0;

export interface OctopusImportDiagnostic {
  severity: OctopusImportCompatibilitySeverity;
  code: string;
  message: string;
}

export interface OctopusImportRequiredInput {
  kind: OctopusImportRequiredInputKind;
  resourceId?: string | null;
  resourceType?: string | null;
  resourceName?: string | null;
  propertyName?: string | null;
  message?: string | null;
}

export interface OctopusImportSourceFile {
  path: string;
  documentType: string;
  sizeBytes: number;
  sha256: string | null;
}

export interface OctopusImportSourceSummary {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  detectedFormat: string;
  sha256: string | null;
  files?: OctopusImportSourceFile[];
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
}

export interface OctopusImportExtractResponseData {
  session: OctopusImportSession;
  extraction: OctopusImportExtraction;
}

export interface OctopusImportPreviewResponseData {
  session: OctopusImportSession;
  previewPlan: OctopusImportPreviewPlan;
}

export interface OctopusImportValidateResponseData {
  session: OctopusImportSession;
  previewPlan: OctopusImportPreviewPlan;
  validation: OctopusImportValidation;
}

export interface OctopusImportConfirmResponseData {
  session: OctopusImportSession;
}

export interface OctopusImportStatusResponseData {
  session: OctopusImportSession;
}

export function isImportTerminalState(
  state: OctopusImportSessionState | number | null | undefined,
) {
  const value = Number(state);
  return value === 5 || value === 6 || value === 7;
}

function buildImportUrl(path: string, query?: Record<string, QueryValue>) {
  const resolved = new URL(
    axiosInstance.getUri({ url: `${IMPORT_API_ROOT}${path}` }),
    window.location.origin,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;
      resolved.searchParams.set(key, String(value));
    }
  }
  return resolved.toString();
}

function buildHeaders(spaceId?: number, includeJson = false) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (spaceId != null) {
    headers["X-Space-Id"] = String(spaceId);
  }

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
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
  },
): Promise<OctopusImportEnvelope<T>> {
  const response = await fetch(buildImportUrl(path, options.query), {
    method: options.method,
    headers: buildHeaders(options.spaceId, options.includeJson),
    body: options.body ?? undefined,
    signal: options.signal,
  });

  if (response.status === 401) {
    handleUnauthorizedSession();
    throw new Error("Unauthorized");
  }

  const text = await response.text();
  if (!text) return { msg: null, code: response.status, data: null };

  try {
    return toEnvelope<T>(JSON.parse(text), response.status);
  } catch {
    return {
      msg: null,
      code: response.status,
      data: null,
    };
  }
}

export function uploadOctopusImport(
  file: File,
  spaceId: number,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.append("file", file);
  form.append("spaceId", String(spaceId));

  return requestImport<OctopusImportUploadResponseData>("/upload", {
    method: "POST",
    spaceId,
    body: form,
    signal,
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
) {
  return requestImport<OctopusImportConfirmResponseData>(
    `/${sessionId}/confirm`,
    {
      method: "POST",
      spaceId,
      query: { spaceId },
      signal,
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
