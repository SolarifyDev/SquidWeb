import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Progress,
  Select,
  Spin,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileZipOutlined,
  LoadingOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSpace } from "contexts/SpaceContext";
import {
  confirmOctopusImport,
  connectOctopusImport,
  extractOctopusImport,
  fetchOctopusImportHistory,
  getOctopusImportProjects,
  getOctopusImportStatus,
  isImportTerminalState,
  listOctopusServerProjects,
  previewOctopusImport,
  probeOctopusServer,
  selectOctopusImportProjects,
  OctopusImportSessionState,
  type OctopusHistoryFetchProgress,
  type OctopusImportBlockerSummary,
  type OctopusImportEnvelope,
  type OctopusImportMissingSensitiveValue,
  type OctopusImportPreviewPlan,
  type OctopusImportProjectList,
  type OctopusImportSession,
  type OctopusImportValidation,
  type OctopusImportUploadResponseData,
  type OctopusImportValidateResponseData,
  type OctopusServerConnection,
  type OctopusServerProbe,
  uploadOctopusImport,
  validateOctopusImport,
} from "pages/apis/octopusImport";
import {
  errorKindHint,
  fetchFailureRecovery,
  fetchPositionLabel,
  fetchProgressPercent,
  historyFetchNotices,
  importSections,
  isTransientStatus,
  isUpToDate,
  permissionProblem,
  planToValidate,
  selectionChanged,
  withSelection,
  linksEarlierImport,
  originNotice,
  originProof,
  SESSION_MAX_AGE_REACHED,
  type FetchFailureRecovery,
  type ImportSection,
  type ImportSectionId,
  type ImportSource,
} from "./importPreviewSummary";
import {
  FillPairingConfirmation,
  ImportPreviewOverview,
  LegacyPreviewOverview,
  MissingSecretsAfterImport,
  WithheldSecretsPanel,
} from "./ImportPreviewDetails";
import { IMPORT_SOURCE_CARDS, ImportSourceCards } from "./ImportSourceCards";
import { ImportStepSection } from "./ImportStepSection";
import { ImportMetricTiles } from "./ImportMetricTiles";
import { ImportStatusBanner } from "./ImportStatusBanner";
import { ImportProjectPicker } from "./ImportProjectPicker";
import {
  fileSelectionRequest,
  initialSelection,
  sameProjects,
} from "./importProjectSelection";

type ValidationState = "idle" | "validating" | "valid" | "error";
type WorkflowPhase =
  | "idle"
  | "uploading"
  | "connecting"
  | "fetching"
  | "extracting"
  | "choosing"
  | "previewing"
  | "ready"
  | "validating"
  | "confirming"
  | "statusUnknown"
  | "succeeded"
  | "failed";

const MAX_IMPORT_UPLOAD_BYTES = 100 * 1024 * 1024;
const IMPORT_POLL_INITIAL_DELAY_MS = 1500;
const IMPORT_POLL_MAX_DELAY_MS = 15000;
const IMPORT_POLL_TIMEOUT_MS = 10 * 60 * 1000;
const FETCH_RETRY_DELAYS_MS = [1000, 3000, 8000];

// The step that failed after the read, and the session it left: extract, choose and preview redo only themselves, "import" validates again.
type RetryStep =
  | { step: StepAfterRead; session: OctopusImportSession }
  | { step: "import" };

type StepAfterRead = "extract" | "choose" | "preview";

// Where a step after the read continues once the session's state is known: a session already extracted is never extracted again
// (its extract committed even if the answer was lost); the server source chose its projects before reading.
const stepForSessionState = (step: StepAfterRead, state: OctopusImportSessionState, serverSource: boolean): StepAfterRead => {
  if (Number(state) === OctopusImportSessionState.Uploaded) return "extract";
  if (step !== "extract") return step;
  return serverSource ? "preview" : "choose";
};

const isSameFile = (left: File | null, right: File | null) =>
  Boolean(left && right && left.name === right.name && left.size === right.size && left.lastModified === right.lastModified);

const SESSION_NOT_FOUND = "SessionNotFound";
const SESSION_STATE_CONFLICT = "SessionStateConflict";

// A step refused because the session moved on (its earlier answer was lost): "Try again" reads where the session is now.
const CONTINUE_FROM_SESSION_HINT = "This import session has moved on. Try again continues from where it is now.";

// The projects of a session's source being chosen before its preview.
type SessionProjectChoice = {
  session: OctopusImportSession;
  list: OctopusImportProjectList | null;
  selected: string[];
};

// A read from Octopus lists only the projects it read: choosing others is a new read.
const ADD_PROJECTS_HINT = "To add other projects, connect again.";

export const API_KEY_HINT =
  "Use a read-only key that can view the whole space. Keep this tab open while reading; resuming needs the key again.";

// The one accent button of the page: the next step the user takes.
export type PrimaryAction = "connect" | "read" | "readFile" | "previewProjects" | "updatePreview" | "import" | "goToProjects";

// How many projects the preview was generated for; kept for the step header once the picker closes.
type ChoiceCount = { selected: number; total: number };

type ResumableHistoryFetch = {
  session: OctopusImportSession;
  serverUrl: string;
  octopusSpaceId: string | null;
  /** `reconnect`: connect again (another key, or the right server) before resuming. */
  recovery: "resume" | "reconnect";
  /** The projects the stopped read reads (stored on its session); the picker shows them while the read can be resumed. */
  projectIds: string[];
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const formatDuration = (seconds: number) =>
  seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;

const chosenText = (count: ChoiceCount) => `${count.selected} of ${count.total} chosen`;

const isZipFile = (file: File) => file.name.toLowerCase().endsWith(".zip");

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unexpected request failure.";
};

const isAbortError = (error: unknown) => {
  const name = (error as Error)?.name;
  return name === "AbortError" || name === "CanceledError";
};

// A transient status is retried in place, unless its kind says the session cannot continue (e.g. a 409 state conflict).
const isRetryableChunkFailure = (
  envelope: Pick<OctopusImportEnvelope<unknown>, "code" | "errorKind">,
) =>
  isTransientStatus(envelope.code) &&
  fetchFailureRecovery(envelope.code, envelope.errorKind, false) === "resume";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const ImportProjects: React.FC = () => {
  const navigate = useNavigate();
  const { space } = useSpace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationTimerRef = useRef<number | null>(null);
  const workflowAbortRef = useRef<AbortController | null>(null);
  const workflowTokenRef = useRef(0);
  const probeTokenRef = useRef(0);
  const projectListTokenRef = useRef(0);
  // The phase the workflow was in before it failed: the step bar marks that step.
  const lastActivePhaseRef = useRef<WorkflowPhase | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [session, setSession] = useState<OctopusImportSession | null>(null);
  const [previewPlan, setPreviewPlan] =
    useState<OctopusImportPreviewPlan | null>(null);
  // The plan the server last returned: the counts describe its choices, not ticks changed since.
  const [previewedPlan, setPreviewedPlan] =
    useState<OctopusImportPreviewPlan | null>(null);
  const [validation, setValidation] = useState<OctopusImportValidation | null>(
    null,
  );
  const [workflowPhase, setWorkflowPhaseState] =
    useState<WorkflowPhase>("idle");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  // What the user can do about the error (from its errorKind).
  const [workflowHint, setWorkflowHint] = useState<string | null>(null);
  // Set when the failed session cannot continue and the import has to start again.
  const [failureRecovery, setFailureRecovery] =
    useState<FetchFailureRecovery | null>(null);
  const [pairingConfirmed, setPairingConfirmed] = useState(false);
  // Secrets the finished import left empty; the page stays to list them.
  const [completedMissingSecrets, setCompletedMissingSecrets] = useState<
    OctopusImportMissingSensitiveValue[] | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [blockerSummary, setBlockerSummary] =
    useState<OctopusImportBlockerSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPassword, setDraftPassword] = useState("");
  const [draftValidation, setDraftValidation] =
    useState<ValidationState>("idle");
  const [draftError, setDraftError] = useState("");
  const [source, setSource] = useState<ImportSource>("file");
  const [serverUrl, setServerUrl] = useState("");
  // Held in memory only for the fetch loop; never written to storage.
  const [apiKey, setApiKey] = useState("");
  const [probe, setProbe] = useState<OctopusServerProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [octopusSpaceId, setOctopusSpaceId] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] =
    useState<OctopusHistoryFetchProgress | null>(null);
  // The server keeps the fetch cursor on the session, so an interrupted fetch resumes on it.
  const [resumableFetch, setResumableFetch] =
    useState<ResumableHistoryFetch | null>(null);
  // A step after the read (extract, preview, validate) that failed for a passing reason: "Try again" redoes only that step.
  const [retryStep, setRetryStep] = useState<RetryStep | null>(null);
  // The projects of the chosen Octopus space, listed before anything is read; only the chosen ones are read.
  const [serverProjects, setServerProjects] =
    useState<OctopusImportProjectList | null>(null);
  const [serverProjectsLoading, setServerProjectsLoading] = useState(false);
  const [serverProjectsError, setServerProjectsError] = useState<string | null>(null);
  const [serverChosenIds, setServerChosenIds] = useState<string[]>([]);
  const [projectChoice, setProjectChoice] =
    useState<SessionProjectChoice | null>(null);
  // What the steps above the preview read and chose: kept for their headers while the session lasts.
  const [previewedChoice, setPreviewedChoice] = useState<ChoiceCount | null>(null);
  const [fileDocumentCount, setFileDocumentCount] = useState<number | null>(null);
  const [readSeconds, setReadSeconds] = useState<number | null>(null);
  const readStartedAtRef = useRef(0);

  const projectListPath = `/${space.slug}/projects`;
  const useServerSource = source === "server";
  const isServerReady = Boolean(
    useServerSource && probe && serverUrl.trim() && apiKey.trim(),
  );
  const canReadChosen = isServerReady && serverChosenIds.length > 0;
  const isChoosing = workflowPhase === "choosing";
  const isProcessingFile =
    workflowPhase === "uploading" ||
    workflowPhase === "connecting" ||
    workflowPhase === "fetching" ||
    workflowPhase === "extracting" ||
    workflowPhase === "previewing";
  const isFinalizingImport =
    workflowPhase === "validating" || workflowPhase === "confirming";
  // An import was handed to the server (or may have been): nothing that starts over may run until its outcome is known.
  const isImportPending = isFinalizingImport || workflowPhase === "statusUnknown";
  const inputsDisabled = isProcessingFile || isImportPending;
  const canResumeFetch = Boolean(
    resumableFetch &&
      resumableFetch.recovery === "resume" &&
      isServerReady &&
      serverUrl.trim() === resumableFetch.serverUrl &&
      octopusSpaceId === resumableFetch.octopusSpaceId &&
      sameProjects(serverChosenIds, resumableFetch.projectIds) &&
      (workflowPhase === "failed" || workflowPhase === "idle"),
  );
  const hasPreviewBlockers = Boolean(
    blockerSummary?.hasBlockers ||
      previewPlan?.hasBlockers ||
      validation?.hasBlockers,
  );
  const hasImportErrorOrBlocker = Boolean(
    workflowError ||
      blockerSummary?.hasBlockers ||
      previewPlan?.hasBlockers ||
      validation?.hasBlockers,
  );
  const nothingNew = previewPlan ? isUpToDate(previewPlan) : false;
  const pairingPending = Boolean(
    previewPlan?.fillPairing?.required && !pairingConfirmed,
  );
  const choicesPending = Boolean(
    previewPlan && previewedPlan && selectionChanged(previewPlan, previewedPlan),
  );
  // Ticks changed since the preview: the server re-plans them before anything can be imported.
  const canUpdatePreview = Boolean(
    choicesPending && !pairingPending && workflowPhase === "ready",
  );
  const canImport = Boolean(
    previewPlan &&
      !choicesPending &&
      !nothingNew &&
      !pairingPending &&
      !hasPreviewBlockers &&
      !workflowError &&
      workflowPhase === "ready" &&
      !isFinalizingImport,
  );
  const sections = importSections(source, {
    phase: workflowPhase,
    lastActivePhase: lastActivePhaseRef.current,
    probed: Boolean(probe),
    fetchStarted: Boolean(resumableFetch),
  });
  // Messages about the workflow show in the step it is on (or failed in); a finished import shows them in the last step.
  const activeSectionId: ImportSectionId =
    sections.find((section) => section.status === "current" || section.status === "error")?.id ?? "preview";
  const primaryAction: PrimaryAction = (() => {
    if (workflowPhase === "succeeded") return "goToProjects";
    if (previewPlan) return choicesPending ? "updatePreview" : "import";
    if (isChoosing) return "previewProjects";
    if (useServerSource) return probe ? "read" : "connect";
    return "readFile";
  })();
  const buttonType = (action: PrimaryAction) => (primaryAction === action ? "primary" : "default");
  const keyPermissionProblem = permissionProblem(
    probe?.permissions,
    probe?.spaceless ? null : octopusSpaceId,
  );
  const fetchNotices =
    fetchProgress?.done && useServerSource
      ? historyFetchNotices(fetchProgress)
      : null;
  const canProbe = Boolean(
    serverUrl.trim() && apiKey.trim() && !inputsDisabled && !probing,
  );

  useEffect(() => {
    return () => {
      if (validationTimerRef.current !== null)
        window.clearTimeout(validationTimerRef.current);
      workflowAbortRef.current?.abort();
    };
  }, []);

  const showServerPlan = (plan: OctopusImportPreviewPlan | null) => {
    setPreviewPlan(plan);
    setPreviewedPlan(plan);
  };

  const changeChoices = useCallback(
    (sourceIds: string[], selected: boolean) => setPreviewPlan((plan) => (plan ? withSelection(plan, sourceIds, selected) : plan)),
    [],
  );

  const setWorkflowPhase = (phase: WorkflowPhase) => {
    if (phase !== "failed" && phase !== "idle") lastActivePhaseRef.current = phase;
    setWorkflowPhaseState(phase);
  };

  const clearWorkflow = () => {
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    showServerPlan(null);
    setValidation(null);
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowWarning(null);
    setWorkflowError(null);
    setWorkflowHint(null);
    setFailureRecovery(null);
    setRetryStep(null);
    setPairingConfirmed(false);
    setCompletedMissingSecrets(null);
    setUploadError(null);
    setBlockerSummary(null);
    setFetchProgress(null);
    setProjectChoice(null);
  };

  // A new session: what earlier steps read and chose no longer describes it.
  const clearSessionSteps = () => {
    setPreviewedChoice(null);
    setFileDocumentCount(null);
    setReadSeconds(null);
  };

  // An input changed: the previous attempt's result no longer describes what the user will import (inputs are disabled while
  // a request runs or an import is pending, so nothing is in flight). A stopped read survives edits of the server, space and
  // projects: Resume is offered again once they match it.
  const invalidateAttempt = (keepResume: boolean) => {
    clearWorkflow();
    clearSessionSteps();
    if (!keepResume) setResumableFetch(null);
  };

  const failWith = (
    envelope: Pick<OctopusImportEnvelope<unknown>, "msg" | "errorKind">,
    fallback: string,
  ) => {
    setWorkflowPhase("failed");
    setWorkflowMessage(null);
    setWorkflowError(envelope.msg || fallback);
    setWorkflowHint(errorKindHint(envelope.errorKind));
  };

  // A step after the read failed: a session the server no longer has can only start again; any other failure keeps the step to retry.
  const failStep = (
    envelope: Pick<OctopusImportEnvelope<unknown>, "msg" | "errorKind">,
    fallback: string,
  ) => {
    failWith(envelope, fallback);
    if (envelope.errorKind === SESSION_NOT_FOUND) {
      setRetryStep(null);
      setFailureRecovery("restart");
      return;
    }
    if (envelope.errorKind === SESSION_STATE_CONFLICT) setWorkflowHint(CONTINUE_FROM_SESSION_HINT);
  };

  const validateDraftFile = (file: File | null) => {
    if (validationTimerRef.current !== null)
      window.clearTimeout(validationTimerRef.current);

    setDraftFile(file);
    setDraftError("");
    setUploadError(null);

    if (!file) {
      setDraftValidation("idle");
      return;
    }

    setDraftValidation("validating");
    validationTimerRef.current = window.setTimeout(() => {
      if (!isZipFile(file)) {
        setDraftValidation("error");
        setDraftError("Select a .zip file exported from Octopus Deploy.");
        return;
      }

      if (file.size === 0) {
        setDraftValidation("error");
        setDraftError("The selected file is empty.");
        return;
      }

      if (file.size > MAX_IMPORT_UPLOAD_BYTES) {
        setDraftValidation("error");
        setDraftError("The selected file exceeds the 100 MB upload limit.");
        return;
      }

      setDraftValidation("valid");
    }, 300);
  };

  // Picking another file (or removing it) starts over: what was read, and a failure, described the file read before. Picking the
  // same file again keeps the attempt.
  const restartForFile = (file: File | null) => {
    if (workflowPhase === "failed" || (workflowPhase !== "idle" && !isSameFile(file, selectedFile))) invalidateAttempt(false);
  };

  const cancelUpload = () => {
    workflowTokenRef.current += 1;
    clearWorkflow();
  };

  const handleBrowseKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const applyUploadResult = (
    uploadData: OctopusImportUploadResponseData | null,
    file: File,
    token: number,
  ) => {
    if (!uploadData?.session?.sessionId) {
      setWorkflowPhase("failed");
      setWorkflowError("Upload did not return a session.");
      return null;
    }
    if (workflowTokenRef.current !== token) return null;
    setSelectedFile(file);
    setSession(uploadData.session);
    return uploadData.session;
  };

  const uploadFileSource = async (
    file: File,
    signal: AbortSignal,
    token: number,
  ) => {
    setWorkflowPhase("uploading");
    setWorkflowMessage("Uploading archive...");

    const uploadEnvelope = await uploadOctopusImport(
      file,
      draftPassword,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return null;

    if (uploadEnvelope.code !== 200) {
      setWorkflowPhase("idle");
      setWorkflowMessage(null);
      setUploadError(uploadEnvelope.msg || "Upload failed.");
      return null;
    }
    setBlockerSummary(uploadEnvelope.data?.blockerSummary ?? null);

    const uploadSession = applyUploadResult(
      uploadEnvelope.data ?? null,
      file,
      token,
    );
    if (!uploadSession) {
      setWorkflowPhase("idle");
      setWorkflowMessage(null);
      setWorkflowError(null);
      setUploadError("Upload did not return a session.");
      return null;
    }
    return uploadSession;
  };

  const connectServerSource = async (signal: AbortSignal, token: number) => {
    setWorkflowPhase("connecting");
    setWorkflowMessage("Checking the API key and creating the import session...");

    // The key is checked before the session exists: a key that cannot read the whole space is refused here.
    const connectEnvelope = await connectOctopusImport(
      space.id,
      { serverUrl: serverUrl.trim(), apiKey, octopusSpaceId },
      signal,
    );
    if (workflowTokenRef.current !== token) return null;

    const connectedSession = connectEnvelope.data?.session ?? null;
    if (connectEnvelope.code !== 200 || !connectedSession?.sessionId) {
      failWith(connectEnvelope, "Could not create a session.");
      return null;
    }
    setSelectedFile(null);
    setSession(connectedSession);
    return connectedSession;
  };

  // Transient failures are retried with backoff; the server resumes from its persisted cursor.
  const fetchHistoryChunk = async (
    sessionId: string,
    connection: OctopusServerConnection,
    fetchSpaceId: string | null,
    signal: AbortSignal,
  ) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const fetchEnvelope = await fetchOctopusImportHistory(
          sessionId,
          space.id,
          connection,
          fetchSpaceId,
          signal,
        );
        if (fetchEnvelope.code === 200 && fetchEnvelope.data)
          return fetchEnvelope;
        if (
          !isRetryableChunkFailure(fetchEnvelope) ||
          attempt >= FETCH_RETRY_DELAYS_MS.length
        )
          return fetchEnvelope;
      } catch (error) {
        if (isAbortError(error) || attempt >= FETCH_RETRY_DELAYS_MS.length)
          throw error;
      }

      setWorkflowMessage(
        `Fetch interrupted. Retrying (${attempt + 1} of ${FETCH_RETRY_DELAYS_MS.length})...`,
      );
      await wait(FETCH_RETRY_DELAYS_MS[attempt], signal);
    }
  };

  // Each call fetches one chunk; the server keeps the cursor, so loop until it reports done.
  const fetchServerHistory = async (
    sessionToFetch: OctopusImportSession,
    connection: OctopusServerConnection,
    fetchSpaceId: string | null,
    signal: AbortSignal,
    token: number,
  ) => {
    setWorkflowPhase("fetching");
    setWorkflowMessage("Reading from Octopus...");
    readStartedAtRef.current = Date.now();
    setReadSeconds(null);
    const resumeTarget: ResumableHistoryFetch = {
      session: sessionToFetch,
      serverUrl: connection.serverUrl,
      octopusSpaceId: fetchSpaceId,
      recovery: "resume",
      projectIds: serverChosenIds,
    };
    setResumableFetch(resumeTarget);

    for (;;) {
      const fetchEnvelope = await fetchHistoryChunk(
        sessionToFetch.sessionId,
        connection,
        fetchSpaceId,
        signal,
      );
      if (workflowTokenRef.current !== token) return false;

      const progress = fetchEnvelope.data ?? null;
      if (fetchEnvelope.code !== 200 || !progress) {
        failWith(fetchEnvelope, "Reading from Octopus failed.");
        keepResumeTargetFor(
          resumeTarget,
          fetchFailureRecovery(fetchEnvelope.code, fetchEnvelope.errorKind, false),
        );
        return false;
      }

      setFetchProgress(progress);
      setWorkflowMessage("Reading from Octopus...");
      if (progress.done) {
        setResumableFetch(null);
        setReadSeconds(Math.round((Date.now() - readStartedAtRef.current) / 1000));
        return true;
      }
    }
  };

  // A failure the same session can recover from keeps the resume target; otherwise "Start again" (or nothing) is offered.
  const keepResumeTargetFor = (
    target: ResumableHistoryFetch,
    recovery: FetchFailureRecovery,
  ) => {
    if (recovery === "resume" || recovery === "reconnect") {
      setResumableFetch({ ...target, recovery });
      return;
    }
    setResumableFetch(null);
    setFailureRecovery(recovery);
  };

  const cancelHistoryFetch = () => {
    workflowTokenRef.current += 1;
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowError(null);
    setWorkflowWarning(
      "Reading from Octopus cancelled. Resume it to continue where it stopped.",
    );
  };

  const beginWorkflow = () => {
    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    clearWorkflow();
    const controller = new AbortController();
    workflowAbortRef.current = controller;
    return { token, controller };
  };

  // Only the server source reads from Octopus; an export file is never combined with a server read.
  const currentConnection = (): OctopusServerConnection | null =>
    isServerReady ? { serverUrl: serverUrl.trim(), apiKey } : null;

  const failWorkflow = (error: unknown, token: number) => {
    if (workflowTokenRef.current !== token) return;
    if (isAbortError(error)) return;
    setWorkflowPhase("failed");
    setWorkflowMessage(null);
    setWorkflowError(getErrorMessage(error));
  };

  const runImportWorkflow = async (file: File | null) => {
    const { token, controller } = beginWorkflow();
    setResumableFetch(null);
    clearSessionSteps();
    const connection = currentConnection();
    let uploadCompleted = false;

    try {
      const uploadSession = file
        ? await uploadFileSource(file, controller.signal, token)
        : await connectServerSource(controller.signal, token);
      if (!uploadSession || workflowTokenRef.current !== token) return;
      uploadCompleted = true;
      // Only the chosen projects are read; a resumed read keeps the selection already on its session.
      if (!file && !(await saveProjectSelection(uploadSession, serverChosenIds, controller.signal, token))) return;

      await processImportSession(
        uploadSession,
        connection,
        controller.signal,
        token,
      );
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if (isAbortError(error)) return;
      if (!uploadCompleted && file) {
        setWorkflowPhase("idle");
        setWorkflowMessage(null);
        setUploadError(getErrorMessage(error));
        return;
      }
      failWorkflow(error, token);
    }
  };

  // Redo only the step that failed after the read, on the same session: the session stays where the step left it.
  const retryFailedStep = async () => {
    if (!retryStep) return;
    if (retryStep.step === "import") {
      await (choicesPending ? handleUpdatePreview() : handleImport());
      return;
    }

    const failed = retryStep;
    const { token, controller } = beginWorkflow();
    try {
      await continueFromSessionState(failed.session, failed.step, controller.signal, token);
    } catch (error) {
      failWorkflow(error, token);
    }
  };

  // The failed step's answer may have been lost after the server committed it: the session's state says where to continue. When
  // the state cannot be read, the step is redone as it was.
  const continueFromSessionState = async (
    failedSession: OctopusImportSession,
    step: StepAfterRead,
    signal: AbortSignal,
    token: number,
  ) => {
    const current = (await readImportStatus(failedSession.sessionId, signal))?.session ?? null;
    if (workflowTokenRef.current !== token) return;

    if (!current) {
      await continueAfterRead(failedSession, step, signal, token);
      return;
    }

    setSession(current);
    if (isImportTerminalState(current.state)) {
      applyFinalSession(current);
      return;
    }
    if (Number(current.state) === OctopusImportSessionState.Importing) {
      await followRunningImport(current.sessionId, signal, token);
      return;
    }

    await continueAfterRead(current, stepForSessionState(step, current.state, useServerSource), signal, token);
  };

  // Stores the chosen projects on the session (null: the whole space); false, with the reason shown, when the server refused.
  const saveProjectSelection = async (
    sessionToScope: OctopusImportSession,
    projectIds: string[] | null,
    signal: AbortSignal,
    token: number,
  ) => {
    setWorkflowMessage("Saving the chosen projects...");

    const selectEnvelope = await selectOctopusImportProjects(
      sessionToScope.sessionId,
      space.id,
      projectIds,
      signal,
    );
    if (workflowTokenRef.current !== token) return false;

    if (selectEnvelope.code !== 200) {
      failWith(selectEnvelope, "Could not save the chosen projects.");
      return false;
    }
    if (selectEnvelope.data?.sessionId) setSession(selectEnvelope.data);
    return true;
  };

  // Lists the projects of the session's source and waits for the user to choose; until the list arrives a failure keeps the step to retry.
  const chooseProjects = async (
    sessionToScope: OctopusImportSession,
    signal: AbortSignal,
    token: number,
  ) => {
    setRetryStep({ step: "choose", session: sessionToScope });
    setProjectChoice({ session: sessionToScope, list: null, selected: [] });
    setWorkflowPhase("choosing");
    setWorkflowMessage(null);

    const listEnvelope = await getOctopusImportProjects(
      sessionToScope.sessionId,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return;

    const list = listEnvelope.data ?? null;
    if (listEnvelope.code !== 200 || !list) {
      failStep(listEnvelope, "Could not list the projects.");
      return;
    }

    setRetryStep(null);
    setProjectChoice({
      session: sessionToScope,
      list,
      // An export file starts with every project ticked: whoever exported it already scoped it.
      selected: initialSelection(list, true),
    });
  };

  const changeChosenInSession = (selected: string[]) =>
    setProjectChoice((choice) => (choice ? { ...choice, selected } : choice));

  // An export file sends nothing for an untouched picker (the whole space); a read from Octopus always sends what is ticked.
  const selectionRequestOf = (choice: SessionProjectChoice, list: OctopusImportProjectList) =>
    useServerSource
      ? { send: true, projectIds: choice.selected }
      : fileSelectionRequest(list, choice.selected);

  const previewChosenProjects = async () => {
    const choice = projectChoice;
    if (!choice?.list || !choice.selected.length) return;

    const request = selectionRequestOf(choice, choice.list);
    const { token, controller } = beginWorkflow();
    setPreviewedChoice({ selected: choice.selected.length, total: choice.list.projects.length });
    try {
      setRetryStep({ step: "choose", session: choice.session });
      setWorkflowPhase("previewing");
      if (request.send && !(await saveProjectSelection(choice.session, request.projectIds, controller.signal, token))) return;

      await continueAfterRead(choice.session, "preview", controller.signal, token);
    } catch (error) {
      failWorkflow(error, token);
    }
  };

  // Reopens the project choice of the previewed session; the preview is generated again for the new choice.
  const changeProjects = async () => {
    if (!session?.sessionId) return;

    const { token, controller } = beginWorkflow();
    try {
      await chooseProjects(session, controller.signal, token);
    } catch (error) {
      failWorkflow(error, token);
    }
  };

  const resumeHistoryFetch = async () => {
    const connection = currentConnection();
    if (!resumableFetch || !connection || !canResumeFetch) return;

    const { token, controller } = beginWorkflow();
    try {
      await processImportSession(
        resumableFetch.session,
        connection,
        controller.signal,
        token,
      );
    } catch (error) {
      failWorkflow(error, token);
    }
  };

  const processImportSession = async (
    uploadSession: OctopusImportSession,
    connection: OctopusServerConnection | null,
    signal: AbortSignal,
    token: number,
  ) => {
    if (connection) {
      const fetched = await fetchServerHistory(
        uploadSession,
        connection,
        octopusSpaceId,
        signal,
        token,
      );
      if (!fetched) return;
    }

    await continueAfterRead(uploadSession, "extract", signal, token);
  };

  // Extract (unless it already succeeded), choose the projects of an export file, then preview. Until the preview arrives, a failure
  // keeps the step to retry. A read from Octopus chose its projects before reading.
  const continueAfterRead = async (
    uploadSession: OctopusImportSession,
    from: "extract" | "choose" | "preview",
    signal: AbortSignal,
    token: number,
  ) => {
    const extractedSession =
      from === "extract"
        ? await extractSession(uploadSession, signal, token)
        : uploadSession;
    if (!extractedSession) return;

    if (from === "choose" || (from === "extract" && !useServerSource)) {
      await chooseProjects(extractedSession, signal, token);
      return;
    }

    await previewSession(extractedSession, signal, token);
  };

  const extractSession = async (
    uploadSession: OctopusImportSession,
    signal: AbortSignal,
    token: number,
  ): Promise<OctopusImportSession | null> => {
    setRetryStep({ step: "extract", session: uploadSession });
    setWorkflowPhase("extracting");
    setWorkflowMessage("Extracting archive...");

    const extractEnvelope = await extractOctopusImport(
      uploadSession.sessionId,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return null;

    const extractedSession = extractEnvelope.data?.session ?? uploadSession;
    setSession(extractedSession);
    const extractionData = extractEnvelope.data?.extraction ?? null;
    const extractionBlockerSummary =
      extractEnvelope.data?.blockerSummary ?? null;
    setBlockerSummary(extractionBlockerSummary);
    setFileDocumentCount(extractionData?.documentCount ?? null);

    if (!extractionData) {
      failStep(extractEnvelope, "Extraction failed.");
      return null;
    }

    if (
      extractEnvelope.code !== 200 ||
      extractionData.hasBlockers ||
      extractionBlockerSummary?.hasBlockers
    ) {
      // The source itself blocks: trying again cannot help.
      setRetryStep(null);
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(
        extractEnvelope.msg || "Extraction produced blocking diagnostics.",
      );
      return null;
    }

    return extractedSession;
  };

  const previewSession = async (
    extractedSession: OctopusImportSession,
    signal: AbortSignal,
    token: number,
  ) => {
    setRetryStep({ step: "preview", session: extractedSession });
    setWorkflowPhase("previewing");
    setWorkflowMessage("Generating preview...");

    const previewEnvelope = await previewOctopusImport(
      extractedSession.sessionId,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return;

    const previewSession = previewEnvelope.data?.session ?? extractedSession;
    const previewData = previewEnvelope.data?.previewPlan ?? null;
    const previewBlockerSummary =
      previewEnvelope.data?.blockerSummary ?? null;
    setSession(previewSession);
    showServerPlan(previewData);
    setBlockerSummary(previewBlockerSummary);
    setWorkflowMessage(null);

    if (!previewData) {
      failStep(previewEnvelope, "Preview failed.");
      return;
    }

    setRetryStep(null);
    setWorkflowPhase("ready");
    if (
      previewEnvelope.code !== 200 ||
      previewData.hasBlockers ||
      previewBlockerSummary?.hasBlockers
    ) {
      setWorkflowError(
        previewEnvelope.code !== 200
          ? previewEnvelope.msg || "Preview failed."
          : null,
      );
    } else {
      setWorkflowError(null);
      setWorkflowWarning(null);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    restartForFile(file);
    if (
      file &&
      (!selectedFile ||
        file.name !== selectedFile.name ||
        file.size !== selectedFile.size)
    ) {
      setDraftPassword("");
    }
    validateDraftFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    restartForFile(file);
    if (
      file &&
      (!selectedFile ||
        file.name !== selectedFile.name ||
        file.size !== selectedFile.size)
    ) {
      setDraftPassword("");
    }
    validateDraftFile(file);
  };

  const canReadFile = Boolean(
    draftFile && draftValidation === "valid" && draftPassword.trim() && !inputsDisabled,
  );

  const handleReadFile = () => {
    if (!canReadFile || !draftFile) return;
    void runImportWorkflow(draftFile);
  };

  const handleSourceChange = (next: ImportSource) => {
    if (next === source) return;
    setSource(next);
    invalidateAttempt(false);
  };

  // The secrets an API import left missing are filled by importing the export file of the same space.
  const fillFromExportFile = () => {
    handleSourceChange("file");
    window.requestAnimationFrame(() => document.getElementById("import-zip-file-input")?.closest("section")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const handleServerUrlChange = (value: string) => {
    setServerUrl(value);
    resetProbe();
    invalidateAttempt(true);
  };

  // A new key may resume the same session (after connecting with it), so the resume target is kept.
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    resetProbe();
    invalidateAttempt(true);
  };

  const handleOctopusSpaceChange = (value: string) => {
    setOctopusSpaceId(value);
    invalidateAttempt(true);
    void loadServerProjects(value);
  };

  // Another choice of projects is another import: the previous attempt's result no longer describes it. A stopped read (which
  // reads the choice stored on its session) is resumable again once its projects are chosen again.
  const handleServerChosenChange = (selected: string[]) => {
    setServerChosenIds(selected);
    invalidateAttempt(true);
  };

  const clearServerProjects = () => {
    projectListTokenRef.current += 1;
    setServerProjects(null);
    setServerProjectsLoading(false);
    setServerProjectsError(null);
    setServerChosenIds([]);
  };

  // A read that can be resumed in this space reads the projects it was started with: listing again (after connecting again) shows them.
  const resumedChoice = (listSpaceId: string | null) =>
    resumableFetch && resumableFetch.octopusSpaceId === listSpaceId ? resumableFetch.projectIds : null;

  // Only the space's projects and project groups are listed (no history); nothing is chosen until the user ticks it.
  const loadServerProjects = async (listSpaceId: string | null) => {
    clearServerProjects();
    const token = projectListTokenRef.current;
    setServerProjectsLoading(true);
    try {
      const listEnvelope = await listOctopusServerProjects(
        { serverUrl: serverUrl.trim(), apiKey },
        listSpaceId,
        space.id,
      );
      if (projectListTokenRef.current !== token) return;
      if (listEnvelope.code !== 200 || !listEnvelope.data) {
        setServerProjectsError(listEnvelope.msg || "Could not list the projects of this space.");
        return;
      }
      setServerProjects(listEnvelope.data);
      setServerChosenIds(initialSelection({ ...listEnvelope.data, selectedProjectIds: resumedChoice(listSpaceId) }, false));
    } catch (error) {
      if (projectListTokenRef.current === token) setServerProjectsError(getErrorMessage(error));
    } finally {
      if (projectListTokenRef.current === token) setServerProjectsLoading(false);
    }
  };

  const handleChangeConnection = () => {
    resetProbe();
    invalidateAttempt(true);
  };

  // Bumping the token makes any in-flight probe for the old inputs land as a no-op.
  const resetProbe = () => {
    probeTokenRef.current += 1;
    setProbe(null);
    setProbeError(null);
    setOctopusSpaceId(null);
    setProbing(false);
    clearServerProjects();
  };

  const handleProbe = async () => {
    if (!canProbe) return;

    resetProbe();
    const token = probeTokenRef.current;
    setProbing(true);
    try {
      const probeEnvelope = await probeOctopusServer(
        { serverUrl: serverUrl.trim(), apiKey },
        space.id,
      );
      if (probeTokenRef.current !== token) return;
      const probeData = probeEnvelope.data ?? null;
      if (probeEnvelope.code !== 200 || !probeData) {
        setProbeError(
          probeEnvelope.msg || "Could not connect to the Octopus server.",
        );
        return;
      }
      setProbe(probeData);
      // Connecting again (e.g. with a new key) is what a "reconnect" failure waits for before resuming.
      setResumableFetch((current) =>
        current ? { ...current, recovery: "resume" } : current,
      );
      const defaultSpaceId =
        probeData.spaces.find((item) => item.isDefault)?.id ??
        probeData.spaces[0]?.id ??
        null;
      setOctopusSpaceId(defaultSpaceId);
      if (probeData.spaceless || defaultSpaceId) void loadServerProjects(probeData.spaceless ? null : defaultSpaceId);
    } catch (error) {
      if (probeTokenRef.current !== token) return;
      setProbeError(getErrorMessage(error));
    } finally {
      if (probeTokenRef.current === token) setProbing(false);
    }
  };

  // A failed status read says nothing about the import itself, so keep polling until the deadline.
  const readImportStatus = async (sessionId: string, signal: AbortSignal) => {
    try {
      const statusEnvelope = await getOctopusImportStatus(
        sessionId,
        space.id,
        signal,
      );
      if (statusEnvelope.code !== 200) return null;
      return statusEnvelope.data ?? null;
    } catch (error) {
      if (isAbortError(error)) throw error;
      return null;
    }
  };

  const pollFinalStatus = async (
    sessionId: string,
    signal: AbortSignal,
    token: number,
  ) => {
    const startedAt = Date.now();
    let delay = IMPORT_POLL_INITIAL_DELAY_MS;

    for (;;) {
      if (Date.now() - startedAt >= IMPORT_POLL_TIMEOUT_MS) {
        throw new Error(
          "The import is still running after 10 minutes. Check the status again later.",
        );
      }

      const statusData = await readImportStatus(sessionId, signal);
      if (workflowTokenRef.current !== token) {
        throw new DOMException("Aborted", "AbortError");
      }

      const statusSession = statusData?.session ?? null;
      if (statusSession) {
        setSession(statusSession);
        setBlockerSummary(statusData?.blockerSummary ?? null);
        if (isImportTerminalState(statusSession.state)) return statusSession;
      }

      await wait(delay, signal);
      delay = Math.min(
        Math.ceil(delay * 1.5),
        IMPORT_POLL_MAX_DELAY_MS,
      );
    }
  };

  const applyFinalSession = (finalSession: OctopusImportSession) => {
    setSession(finalSession);
    if (finalSession.state === OctopusImportSessionState.Succeeded) {
      setWorkflowPhase("succeeded");
      setWorkflowMessage(null);
      setWorkflowWarning(null);
      setWorkflowError(null);
      message.success("Import completed.");
      const missing = finalSession.result?.missingSensitiveValues ?? [];
      // Secrets the import left empty are listed before leaving, so the user knows what to fill.
      if (missing.length) {
        setCompletedMissingSecrets(missing);
        return;
      }
      navigate(projectListPath);
      return;
    }

    if (finalSession.state === OctopusImportSessionState.Expired) {
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setRetryStep(null);
      setFailureRecovery("restart");
      const maxAgeReason = finalSession.result?.diagnostics?.find(d => d.code === SESSION_MAX_AGE_REACHED)?.message;
      setWorkflowError(
        maxAgeReason ??
          (useServerSource
            ? "The import session expired. Read from the Octopus server again."
            : "The import session expired. Upload the export file again."),
      );
      return;
    }

    setWorkflowPhase("failed");
    setWorkflowMessage(null);
    setWorkflowError(
      finalSession.result?.diagnostics?.[0]?.message || "Import failed.",
    );
  };

  // Once the confirmation was accepted the import runs on the server; the page only tracks it.
  const awaitFinalSession = async (
    sessionId: string,
    signal: AbortSignal,
    token: number,
  ) => {
    try {
      const finalSession = await pollFinalStatus(sessionId, signal, token);
      if (workflowTokenRef.current !== token) return;
      applyFinalSession(finalSession);
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if (isAbortError(error)) return;
      showStatusUnknown("Polling stopped after 10 minutes. The import may still be running; check its status again.");
    }
  };

  const showStatusUnknown = (warning: string) => {
    setWorkflowPhase("statusUnknown");
    setWorkflowMessage(null);
    setWorkflowWarning(warning);
    setWorkflowError(null);
  };

  const followRunningImport = async (sessionId: string, signal: AbortSignal, token: number) => {
    setWorkflowPhase("confirming");
    setWorkflowMessage("Import is still running...");
    await awaitFinalSession(sessionId, signal, token);
  };

  // The confirmation's answer was lost or refused: the session's state says whether the import started. Running or finished, the
  // page follows it; not started, the import can be tried again; unreadable, the user checks its status later.
  const settleUnconfirmedImport = async (
    sessionId: string,
    failure: Pick<OctopusImportEnvelope<unknown>, "msg" | "errorKind">,
    signal: AbortSignal,
    token: number,
  ) => {
    const current = (await readImportStatus(sessionId, signal))?.session ?? null;
    if (workflowTokenRef.current !== token) return;

    if (!current) {
      showStatusUnknown("The import's answer was lost and its status could not be read. It may be running; check its status.");
      return;
    }

    setSession(current);
    if (isImportTerminalState(current.state)) {
      applyFinalSession(current);
      return;
    }
    if (Number(current.state) === OctopusImportSessionState.Importing) {
      await followRunningImport(current.sessionId, signal, token);
      return;
    }

    setWorkflowPhase("ready");
    setWorkflowMessage(null);
    setWorkflowWarning(null);
    setWorkflowError(failure.msg || "The import did not start.");
    setWorkflowHint(errorKindHint(failure.errorKind));
    setRetryStep({ step: "import" });
  };

  const handleCheckStatus = async () => {
    if (!session?.sessionId) return;

    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    const controller = new AbortController();
    workflowAbortRef.current = controller;

    setWorkflowPhase("confirming");
    setWorkflowMessage("Checking the import status...");
    setWorkflowWarning(null);
    setWorkflowError(null);

    await settleUnconfirmedImport(session.sessionId, { msg: "The import did not start.", errorKind: null }, controller.signal, token);
  };

  const beginValidation = (text: string) => {
    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    const controller = new AbortController();
    workflowAbortRef.current = controller;

    setRetryStep(null);
    setWorkflowPhase("validating");
    setWorkflowMessage(text);
    setWorkflowWarning(null);
    setWorkflowError(null);
    setValidation(null);
    setBlockerSummary(null);

    return { token, controller };
  };

  // Records the validation; false, back in "ready" with the reason, when it failed or has blockers.
  const applyValidation = (
    validateEnvelope: OctopusImportEnvelope<OctopusImportValidateResponseData>,
  ) => {
    const validationData = validateEnvelope.data?.validation ?? null;
    const validationBlockerSummary =
      validateEnvelope.data?.blockerSummary ?? null;
    setValidation(validationData);
    setBlockerSummary(validationBlockerSummary);

    if (
      validationData &&
      validateEnvelope.code === 200 &&
      !validationData.hasBlockers &&
      !validationBlockerSummary?.hasBlockers
    )
      return true;

    setWorkflowPhase("ready");
    setWorkflowMessage(null);
    setWorkflowError(
      validateEnvelope.code !== 200
        ? validateEnvelope.msg || "Validation failed."
        : null,
    );
    setWorkflowHint(errorKindHint(validateEnvelope.errorKind));
    if (validateEnvelope.code !== 200) setRetryStep({ step: "import" });
    return false;
  };

  const failValidation = (error: unknown, token: number) => {
    if (workflowTokenRef.current !== token) return;
    if (isAbortError(error)) return;
    setWorkflowPhase("ready");
    setWorkflowMessage(null);
    setWorkflowError(getErrorMessage(error));
    setRetryStep({ step: "import" });
  };

  // The server re-plans the ticked choices (it posts nothing to import): its plan replaces the counts and the ticks.
  const handleUpdatePreview = async () => {
    if (!session?.sessionId || !previewPlan) return;

    const { token, controller } = beginValidation("Updating preview...");

    try {
      const validateEnvelope = await validateOctopusImport(
        session.sessionId,
        space.id,
        planToValidate(previewPlan, pairingConfirmed),
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const serverPlan = validateEnvelope.data?.previewPlan ?? null;
      if (serverPlan) showServerPlan(serverPlan);
      if (!applyValidation(validateEnvelope)) return;

      setWorkflowPhase("ready");
      setWorkflowMessage(null);
    } catch (error) {
      failValidation(error, token);
    }
  };

  // The confirmation, or null when its answer was lost: the server may have started the import anyway, so its state decides.
  const confirmImport = async (sessionId: string, signal: AbortSignal, token: number) => {
    try {
      return await confirmOctopusImport(sessionId, space.id, signal, true);
    } catch (error) {
      if (isAbortError(error) || workflowTokenRef.current !== token) throw error;
      await settleUnconfirmedImport(sessionId, { msg: getErrorMessage(error), errorKind: null }, signal, token);
      return null;
    }
  };

  const handleImport = async () => {
    if (!session?.sessionId || !previewPlan) {
      message.warning("Wait for the import preview to load.");
      return;
    }
    if (hasPreviewBlockers) {
      message.warning("Resolve the preview blockers before importing.");
      return;
    }

    const { token, controller } = beginValidation("Validating preview plan...");

    try {
      const validateEnvelope = await validateOctopusImport(
        session.sessionId,
        space.id,
        planToValidate(previewPlan, pairingConfirmed),
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;
      if (!applyValidation(validateEnvelope)) return;

      setWorkflowPhase("confirming");
      setWorkflowMessage("Importing...");

      // Large history imports run as a background job; the session is polled until it settles.
      const confirmEnvelope = await confirmImport(session.sessionId, controller.signal, token);
      if (!confirmEnvelope || workflowTokenRef.current !== token) return;

      const confirmedSession = confirmEnvelope.data?.session ?? null;
      setBlockerSummary(confirmEnvelope.data?.blockerSummary ?? null);
      if (confirmEnvelope.code !== 200 || !confirmedSession) {
        await settleUnconfirmedImport(session.sessionId, { msg: confirmEnvelope.msg || "Import confirmation failed.", errorKind: confirmEnvelope.errorKind }, controller.signal, token);
        return;
      }

      setSession(confirmedSession);

      if (isImportTerminalState(confirmedSession.state)) {
        applyFinalSession(confirmedSession);
        return;
      }

      await awaitFinalSession(
        confirmedSession.sessionId,
        controller.signal,
        token,
      );
    } catch (error) {
      failValidation(error, token);
    }
  };

  const workflowAction =
    workflowPhase === "statusUnknown" ? (
      <Button size="small" onClick={() => void handleCheckStatus()}>
        Check status
      </Button>
    ) : failureRecovery === "restart" ? (
      <Button
        size="small"
        disabled={useServerSource ? !canReadChosen : !canReadFile}
        onClick={() => void runImportWorkflow(useServerSource ? null : draftFile)}
      >
        Start again
      </Button>
    ) : retryStep && (workflowPhase === "failed" || workflowPhase === "ready") ? (
      <Button size="small" onClick={() => void retryFailedStep()}>
        Try again
      </Button>
    ) : null;

  const showResumeNotice = Boolean(
    resumableFetch &&
      useServerSource &&
      (workflowPhase === "failed" || workflowPhase === "idle"),
  );

  const resumeNoticeText = () => {
    if (!resumableFetch) return "";
    if (resumableFetch.recovery === "reconnect")
      return "Fix the cause below and connect again (for example with a new API key), then resume. Everything read so far is kept.";
    if (
      serverUrl.trim() !== resumableFetch.serverUrl ||
      octopusSpaceId !== resumableFetch.octopusSpaceId
    )
      return `This read belongs to ${resumableFetch.serverUrl}${resumableFetch.octopusSpaceId ? ` (${resumableFetch.octopusSpaceId})` : ""}. Switch back to it to resume.`;
    if (!sameProjects(serverChosenIds, resumableFetch.projectIds))
      return `This read reads ${pluralize(resumableFetch.projectIds.length, "project")} chosen before. Choose them again to resume, or read the new choice from the start.`;
    return "Resume continues on the same import session where it stopped; nothing read so far is read again.";
  };

  const renderResumeNotice = () => (
    <ImportStatusBanner
      testId="resume-notice"
      type="info"
      message="Reading from Octopus stopped."
      action={
        <Button
          size="small"
          disabled={!canResumeFetch}
          onClick={() => void resumeHistoryFetch()}
        >
          Resume fetch
        </Button>
      }
    >
      {resumeNoticeText()}
    </ImportStatusBanner>
  );

  const renderServerProjectPicker = () =>
    serverProjectsError ? (
      <ImportStatusBanner
        type="error"
        message={serverProjectsError}
        action={
          <Button size="small" onClick={() => void loadServerProjects(probe?.spaceless ? null : octopusSpaceId)}>
            Try again
          </Button>
        }
      />
    ) : (
      <ImportProjectPicker
        list={serverProjects}
        loading={serverProjectsLoading}
        selected={serverChosenIds}
        onChange={handleServerChosenChange}
        disabled={inputsDisabled}
      />
    );

  const renderSessionProjectChoice = () => (
    <div data-testid="session-project-choice" className="space-y-3">
      <ImportProjectPicker
        list={projectChoice?.list ?? null}
        loading={!projectChoice?.list}
        selected={projectChoice?.selected ?? []}
        onChange={changeChosenInSession}
      />
      {useServerSource && projectChoice?.list ? (
        <div className="text-xs text-slate-500">{ADD_PROJECTS_HINT}</div>
      ) : null}
    </div>
  );

  const previewImportButton = (
    <Button
      type={buttonType("previewProjects")}
      disabled={!projectChoice?.list || !projectChoice.selected.length}
      onClick={() => void previewChosenProjects()}
    >
      Preview import
    </Button>
  );

  // Blockers are never folded away: every reason is listed under the line.
  const renderBlockerSummary = (summary: OctopusImportBlockerSummary) => (
    <ImportStatusBanner
      testId="blocker-summary"
      type="error"
      message={`${pluralize(summary.blockerCount, "blocking issue")} across ${pluralize(summary.affectedResourceCount, "resource")}: the import cannot continue.`}
    >
      {summary.blockingReasons.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {summary.blockingReasons.map((reason) => (
            <li key={reason.code}>
              <span>{reason.message}</span>
              <span className="ml-1 text-xs opacity-75">
                ({pluralize(reason.occurrenceCount, "occurrence")},{" "}
                {pluralize(reason.affectedResourceCount, "affected resource")})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ImportStatusBanner>
  );

  // The workflow's own messages (blockers, the error with what to do about it, a warning), in the step it is on.
  const renderWorkflowBanners = () => {
    if (isProcessingFile) return null;
    if (blockerSummary?.hasBlockers) return renderBlockerSummary(blockerSummary);

    if (hasImportErrorOrBlocker)
      return (
        <ImportStatusBanner
          testId="workflow-error"
          type="error"
          message={workflowError || "Import cannot continue: resolve the blocking issues first."}
          action={workflowAction}
        >
          {workflowHint ? <div data-testid="workflow-hint">{workflowHint}</div> : null}
        </ImportStatusBanner>
      );

    return workflowWarning ? (
      <ImportStatusBanner testId="workflow-warning" type="warning" message={workflowWarning} action={workflowAction} />
    ) : null;
  };

  const renderFetchProgress = () => (
    <div>
      <div className="flex items-center gap-2">
        <Progress
          className="!mb-0 flex-1"
          percent={fetchProgressPercent(fetchProgress)}
          size="small"
        />
        <Button size="small" onClick={cancelHistoryFetch}>
          Cancel
        </Button>
      </div>
      {fetchProgress ? (
        <div
          data-testid="history-fetch-progress"
          className="space-y-0.5 text-xs text-slate-500"
        >
          <div className="font-medium text-slate-700">
            {fetchPositionLabel(fetchProgress)}
          </div>
          <div>
            {pluralize(
              fetchProgress.counts.configurationDocuments ?? 0,
              "configuration document",
            )}
            , {pluralize(fetchProgress.counts.releases, "release")},{" "}
            {pluralize(fetchProgress.counts.deployments, "deployment")},{" "}
            {pluralize(fetchProgress.counts.serverTasks, "task")},{" "}
            {fetchProgress.counts.detailsFetched} details fetched,{" "}
            {fetchProgress.counts.detailsSkipped} unchanged
          </div>
        </div>
      ) : null}
    </div>
  );

  // What the active step is doing right now; a read from Octopus shows its progress and can be cancelled, an upload too.
  const renderProcessing = () =>
    (isProcessingFile || isFinalizingImport) && workflowMessage ? (
      <div data-testid="workflow-processing" className="space-y-2 rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Spin size="small" indicator={<LoadingOutlined spin />} />
          <span className="min-w-0 flex-1">{workflowMessage}</span>
          {workflowPhase === "uploading" ? (
            <Button size="small" onClick={cancelUpload}>
              Cancel
            </Button>
          ) : null}
        </div>
        {workflowPhase === "fetching" ? renderFetchProgress() : null}
      </div>
    ) : null;

  const renderFetchSummary = () => {
    if (!fetchProgress || !fetchNotices) return null;

    const skippedItems =
      (fetchProgress.counts.itemsRejected ?? 0) +
      (fetchProgress.counts.itemsAbandoned ?? 0);

    return (
      <div data-testid="history-fetch-summary" className="space-y-3">
        <div className="text-sm text-slate-700">
          {pluralize(fetchProgress.projectCount, "project")} read from Octopus
          {octopusSpaceId ? ` space ${octopusSpaceId}` : ""}.
        </div>
        <ImportMetricTiles
          testIdPrefix="fetch-tile"
          metrics={[
            { id: "configuration", label: "Configuration", value: fetchProgress.counts.configurationDocuments ?? 0 },
            { id: "releases", label: "Releases", value: fetchProgress.counts.releases },
            { id: "deployments", label: "Deployments", value: fetchProgress.counts.deployments },
            { id: "secretsWithheld", label: "Secrets withheld", value: fetchProgress.counts.secretsWithheld ?? 0 },
          ]}
          details={[
            { id: "tasks", label: "Tasks", value: fetchProgress.counts.serverTasks },
            { id: "detailsFetched", label: "Details fetched", value: fetchProgress.counts.detailsFetched },
            { id: "unchanged", label: "Unchanged", value: fetchProgress.counts.detailsSkipped },
          ]}
        />
        {fetchNotices.projectsNotFound > 0 ? (
          <ImportStatusBanner
            type={fetchNotices.nothingFound ? "error" : "warning"}
            message={`${pluralize(fetchNotices.projectsNotFound, "project")} ${
              fetchNotices.projectsNotFound === 1 ? "was" : "were"
            } not found in this Octopus space — wrong space, or deleted in Octopus.`}
          >
            {fetchNotices.nothingFound
              ? "No history was found for any project. Choose another Octopus space and load again."
              : null}
          </ImportStatusBanner>
        ) : null}
        {skippedItems > 0 ? (
          <ImportStatusBanner
            type="warning"
            message={`${pluralize(skippedItems, "item")} could not be read (the Octopus server refused the request, or it kept timing out) and ${skippedItems === 1 ? "was" : "were"} skipped.`}
          />
        ) : null}
        {fetchNotices.detailsTooLarge > 0 ? (
          <ImportStatusBanner
            type="info"
            message={`${pluralize(fetchNotices.detailsTooLarge, "task")} had logs too large to fetch and will be imported without logs.`}
          />
        ) : null}
      </div>
    );
  };

  // Stable across renders: the memoised preview panels then re-render only when their plan changes, not on every tick of the page.
  const latestPreviewActionsRef = useRef({ changeProjects, fillFromExportFile });
  latestPreviewActionsRef.current = { changeProjects, fillFromExportFile };
  const changeProjectsOfPreview = useCallback(() => void latestPreviewActionsRef.current.changeProjects(), []);
  const fillFromExportFileOfPreview = useCallback(() => latestPreviewActionsRef.current.fillFromExportFile(), []);

  // ── Step headers ───────────────────────────────────────────────────────────

  const statusOf = (id: ImportSectionId) => sections.find((section) => section.id === id)?.status ?? "future";

  const spaceName = probe?.spaces.find((item) => item.id === octopusSpaceId)?.name ?? null;

  const choiceCount = (): ChoiceCount | null => {
    if (projectChoice?.list) return { selected: projectChoice.selected.length, total: projectChoice.list.projects.length };
    if (previewedChoice) return previewedChoice;
    if (useServerSource && serverProjects) return { selected: serverChosenIds.length, total: serverProjects.projects.length };
    return null;
  };

  const projectsSummary = () => {
    const count = choiceCount();
    const parts = [useServerSource ? spaceName : null, count ? chosenText(count) : null];
    return parts.filter(Boolean).join(" · ");
  };

  const readSummary = () => {
    if (statusOf("read") === "error") return "Failed";
    if (workflowPhase === "uploading") return "Uploading…";
    if (workflowPhase === "extracting" && !useServerSource) return "Extracting…";
    if (workflowPhase === "connecting") return "Connecting…";
    if (workflowPhase === "fetching") return `${fetchProgressPercent(fetchProgress)}%`;
    if (useServerSource && fetchProgress?.done) return readSeconds === null ? "Done" : `Done in ${formatDuration(readSeconds)}`;
    if (useServerSource && resumableFetch) return "Stopped";
    if (!useServerSource && fileDocumentCount !== null) return `${pluralize(fileDocumentCount, "document")} read`;
    return "";
  };

  const PREVIEW_PHASE_SUMMARIES: Record<string, string> = {
    extracting: "Extracting…",
    previewing: "Generating preview…",
    validating: "Validating…",
    confirming: "Importing…",
    statusUnknown: "Status unknown",
    succeeded: "Imported",
  };

  const previewSummary = () => {
    if (statusOf("preview") === "error") return "Failed";
    if (workflowPhase in PREVIEW_PHASE_SUMMARIES) return PREVIEW_PHASE_SUMMARIES[workflowPhase];
    if (!previewPlan) return "";
    if (hasPreviewBlockers) return "Blocked";
    if (choicesPending) return "Choices changed";
    if (pairingPending) return "Confirmation needed";
    if (nothingNew) return "Up to date";
    return "Ready to import";
  };

  const connectSummary = () => {
    if (probe) return `Octopus ${probe.octopusVersion}`;
    return probing ? "Connecting…" : "";
  };

  const fileSummary = () => (draftFile ? `${draftFile.name} · ${formatFileSize(draftFile.size)}` : "");

  const sourceSummary = IMPORT_SOURCE_CARDS.find((card) => card.source === source)?.title ?? "";

  // ── Step bodies ────────────────────────────────────────────────────────────

  const activeContent = (id: ImportSectionId) =>
    activeSectionId === id ? (
      <>
        {renderProcessing()}
        {renderWorkflowBanners()}
      </>
    ) : null;

  const connectButton = probe ? (
    <Button key="change" disabled={inputsDisabled} onClick={handleChangeConnection}>
      Change
    </Button>
  ) : (
    <Button key="connect" type={buttonType("connect")} onClick={() => void handleProbe()} loading={probing} disabled={!serverUrl.trim() || !apiKey.trim() || inputsDisabled}>
      Connect
    </Button>
  );

  const renderConnect = () => (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="import-octopus-server-url" className="mb-1.5 block text-sm font-medium text-slate-700">
            Server URL
          </label>
          <Input
            id="import-octopus-server-url"
            value={serverUrl}
            disabled={inputsDisabled}
            onChange={(event) => handleServerUrlChange(event.target.value)}
            onPressEnter={() => void handleProbe()}
            placeholder="https://octopus.example.com"
            autoComplete="off"
          />
        </div>
        <div className="min-w-[14rem] flex-1">
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <label htmlFor="import-octopus-api-key" className="text-sm font-medium text-slate-700">
              API key
            </label>
            <span className="text-xs text-slate-500">· never stored</span>
          </div>
          <Input.Password
            id="import-octopus-api-key"
            value={apiKey}
            disabled={inputsDisabled}
            onChange={(event) => handleApiKeyChange(event.target.value)}
            onPressEnter={() => void handleProbe()}
            placeholder="API-XXXXXXXX"
            autoComplete="new-password"
          />
        </div>
        {connectButton}
      </div>
      <div data-testid="api-key-hint" className="text-xs text-slate-500">{API_KEY_HINT}</div>
      {probeError ? <ImportStatusBanner type="error" message={probeError} /> : null}
    </>
  );

  const renderKeyPermissionProblem = () =>
    keyPermissionProblem ? (
      <ImportStatusBanner
        testId="key-permission-problem"
        type="error"
        message="This API key cannot read the whole space, so the import will be refused."
      >
        <ul className="list-disc pl-5">
          {keyPermissionProblem.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div>
          Use a dedicated read-only service account with unrestricted view permissions in this space, ideally with an expiring key.
        </div>
      </ImportStatusBanner>
    ) : null;

  const renderSpaceSelect = () =>
    probe && !probe.spaceless ? (
      <div>
        <label htmlFor="import-octopus-space" className="mb-1.5 block text-sm font-medium text-slate-700">
          Octopus space
          <span className="ml-2 text-xs font-normal text-slate-500">
            {pluralize(probe.spaces.length, "space")} available
          </span>
        </label>
        <Select
          id="import-octopus-space"
          className="w-full max-w-md"
          value={octopusSpaceId ?? undefined}
          disabled={inputsDisabled}
          onChange={(value: string) => handleOctopusSpaceChange(value)}
          options={probe.spaces.map((item) => ({ label: item.name, value: item.id }))}
        />
      </div>
    ) : null;

  const renderServerProjects = () => (
    <>
      {renderSpaceSelect()}
      {renderKeyPermissionProblem()}
      {isChoosing
        ? renderSessionProjectChoice()
        : probe && (probe.spaceless || octopusSpaceId)
          ? renderServerProjectPicker()
          : null}
      {activeContent("projects")}
    </>
  );

  const readFromOctopusButton = (
    <Button type={buttonType("read")} disabled={!canReadChosen || inputsDisabled} onClick={() => void runImportWorkflow(null)}>
      Read {pluralize(serverChosenIds.length, "chosen project")} from Octopus
    </Button>
  );

  const renderServerRead = () => (
    <>
      {activeContent("read")}
      {showResumeNotice ? renderResumeNotice() : null}
      {renderFetchSummary()}
    </>
  );

  const fileDisabled = inputsDisabled;

  const renderFileDraft = (file: File) => (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
      <FileZipOutlined className="flex-shrink-0 text-squid-blue" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">{file.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">{formatFileSize(file.size)}</span>
          {draftValidation === "validating" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-squid-blue">
              <LoadingOutlined spin /> Checking file
            </span>
          ) : draftValidation === "valid" ? (
            <span className="font-medium text-emerald-600">Ready to read</span>
          ) : draftValidation === "error" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
              <ExclamationCircleOutlined /> {draftError}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label="Remove selected zip file"
        disabled={fileDisabled}
        onClick={() => {
          restartForFile(null);
          validateDraftFile(null);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <DeleteOutlined />
      </button>
    </div>
  );

  const renderFile = () => (
    <>
      {uploadError ? <ImportStatusBanner type="error" message={uploadError} /> : null}
      <div className="text-sm font-medium text-slate-700">Upload file containing exported data</div>
      <label
        htmlFor="import-zip-file-input"
        role="button"
        tabIndex={0}
        onDragOver={(event) => {
          event.preventDefault();
          if (!fileDisabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => (fileDisabled ? event.preventDefault() : handleDrop(event))}
        onKeyDown={handleBrowseKeyDown}
        className={[
          "flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors",
          fileDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          isDragging ? "border-squid-blue bg-blue-50" : "border-slate-300 bg-white hover:border-squid-blue hover:bg-blue-50/40",
        ].join(" ")}
      >
        <input
          id="import-zip-file-input"
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="sr-only"
          disabled={fileDisabled}
          onChange={handleInputChange}
        />
        <UploadOutlined className="text-xl text-squid-blue" />
        <div className="mt-2 text-sm text-slate-700">
          <span className="font-semibold text-squid-blue">Browse</span>
          <span> or drag and drop the .zip exported from Octopus</span>
        </div>
      </label>
      {draftFile ? renderFileDraft(draftFile) : null}
      <div className="max-w-sm">
        <label htmlFor="import-zip-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Password
        </label>
        <Input.Password
          id="import-zip-password"
          value={draftPassword}
          disabled={fileDisabled}
          onChange={(event) => {
            setDraftPassword(event.target.value);
            setUploadError(null);
          }}
          onPressEnter={handleReadFile}
          placeholder="Enter password"
          autoComplete="new-password"
        />
      </div>
    </>
  );

  const readFileButton = (
    <Button type={buttonType("readFile")} loading={workflowPhase === "uploading"} disabled={!canReadFile} onClick={handleReadFile}>
      Read file
    </Button>
  );

  const renderFileProjects = () => (
    <>
      {isChoosing ? renderSessionProjectChoice() : null}
      {activeContent("projects")}
    </>
  );

  const renderPreviewContent = () => (
    <>
      {completedMissingSecrets?.length ? (
        <MissingSecretsAfterImport
          missing={completedMissingSecrets}
          spaceSlug={space.slug}
          onFillFromFile={fillFromExportFile}
        />
      ) : null}

      {activeContent("preview")}

      {originNotice(previewPlan) ? (
        <ImportStatusBanner testId="import-origin-notice" type="error" message={originNotice(previewPlan)?.title}>
          {originNotice(previewPlan)?.origins.length ? (
            <ul className="list-disc pl-5">
              {originNotice(previewPlan)?.origins.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <div>{originNotice(previewPlan)?.hint}</div>
        </ImportStatusBanner>
      ) : null}

      {originProof(previewPlan) ? (
        <div data-testid="import-origin-proof" className="text-xs text-slate-500">
          {originProof(previewPlan)}
        </div>
      ) : null}

      {previewPlan?.fillPairing?.required ? (
        <FillPairingConfirmation
          pairing={previewPlan.fillPairing}
          linksEarlierImport={linksEarlierImport(previewPlan)}
          confirmed={pairingConfirmed}
          disabled={isFinalizingImport || workflowPhase === "succeeded"}
          onChange={setPairingConfirmed}
        />
      ) : null}

      {previewPlan && !completedMissingSecrets ? (
        <WithheldSecretsPanel
          resources={previewPlan.resources}
          onFillFromFile={fillFromExportFileOfPreview}
          disabled={isFinalizingImport}
        />
      ) : null}

      {previewPlan?.summary ? (
        <ImportPreviewOverview
          plan={previewPlan}
          spaceSlug={space.slug}
          onChoiceChange={changeChoices}
          onChangeProjects={workflowPhase === "ready" && session?.sessionId ? changeProjectsOfPreview : undefined}
          choicesPending={choicesPending}
          choicesDisabled={isFinalizingImport || workflowPhase === "succeeded"}
        />
      ) : null}

      {previewPlan && !previewPlan.summary ? (
        <div className="space-y-5 text-sm text-slate-900">
          <LegacyPreviewOverview resources={previewPlan.resources} spaceSlug={space.slug} />

          {nothingNew ? (
            <ImportStatusBanner type="info" message="Nothing new to import">
              Everything in this source was already imported or is skipped.
            </ImportStatusBanner>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const previewActions = () => {
    if (workflowPhase === "succeeded")
      return (
        <>
          <Button key="more" onClick={() => invalidateAttempt(false)}>Import more projects</Button>
          <Button key="done" type={buttonType("goToProjects")} onClick={() => navigate(projectListPath)}>
            Go to projects
          </Button>
        </>
      );
    if (!previewPlan) return null;

    return (
      <Button
        key="import"
        type={buttonType(choicesPending ? "updatePreview" : "import")}
        loading={isFinalizingImport}
        disabled={choicesPending ? !canUpdatePreview : !canImport}
        onClick={choicesPending ? handleUpdatePreview : handleImport}
      >
        {choicesPending ? "Update preview" : "Import"}
      </Button>
    );
  };

  type SectionView = { summary: React.ReactNode; body: React.ReactNode; actions?: React.ReactNode };

  const sectionView = (id: ImportSectionId): SectionView => {
    switch (id) {
      case "source":
        return {
          summary: sourceSummary,
          body: <ImportSourceCards value={source} disabled={inputsDisabled} onChange={handleSourceChange} />,
        };
      case "connect":
        return { summary: connectSummary(), body: renderConnect() };
      case "file":
        return { summary: fileSummary(), body: renderFile(), actions: readFileButton };
      case "projects":
        return useServerSource
          ? { summary: projectsSummary(), body: renderServerProjects(), actions: isChoosing ? previewImportButton : readFromOctopusButton }
          : { summary: projectsSummary(), body: renderFileProjects(), actions: isChoosing ? previewImportButton : null };
      case "read":
        return { summary: readSummary(), body: useServerSource ? renderServerRead() : activeContent("read") };
      default:
        return { summary: previewSummary(), body: renderPreviewContent(), actions: previewActions() };
    }
  };

  const renderSection = (section: ImportSection, index: number) => {
    const view = sectionView(section.id);

    return (
      <ImportStepSection
        key={section.id}
        id={section.id}
        number={index + 1}
        title={section.title}
        status={section.status}
        summary={view.summary}
        actions={view.actions}
      >
        {view.body}
      </ImportStepSection>
    );
  };

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-5xl">
          <button
            type="button"
            onClick={() => navigate(projectListPath)}
            className="mb-4 inline-flex items-center gap-2 border-0 bg-transparent p-0 text-sm font-medium text-squid-blue hover:opacity-80"
          >
            <ArrowLeftOutlined className="text-xs" />
            <span>Projects</span>
          </button>

          <h1 className="m-0 text-2xl font-bold text-slate-900">Import projects</h1>

          <div data-testid={`${source}-import-sections`} className="mt-6 space-y-4">
            {sections.map(renderSection)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProjects;
