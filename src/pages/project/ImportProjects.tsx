import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Progress,
  Select,
  Spin,
  Steps,
  Table,
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
  getOctopusImportStatus,
  isImportTerminalState,
  previewOctopusImport,
  probeOctopusServer,
  OctopusImportSessionState,
  type OctopusHistoryFetchProgress,
  type OctopusImportBlockerSummary,
  type OctopusImportEnvelope,
  type OctopusImportMissingSensitiveValue,
  type OctopusImportPreviewPlan,
  type OctopusImportSession,
  type OctopusImportValidation,
  type OctopusImportUploadResponseData,
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
  importSteps,
  isTransientStatus,
  isUpToDate,
  permissionProblem,
  planToValidate,
  summarizeActions,
  summarizeByProject,
  type FetchFailureRecovery,
  type ImportSource,
  type ProjectPreviewSummary,
} from "./importPreviewSummary";
import {
  FillPairingConfirmation,
  ImportPreviewOverview,
  MissingSecretsAfterImport,
  WithheldSecretsPanel,
} from "./ImportPreviewDetails";
import { ImportSourceCards } from "./ImportSourceCards";

type ValidationState = "idle" | "validating" | "valid" | "error";
type WorkflowPhase =
  | "idle"
  | "uploading"
  | "connecting"
  | "fetching"
  | "extracting"
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

type ResumableHistoryFetch = {
  session: OctopusImportSession;
  serverUrl: string;
  octopusSpaceId: string | null;
  /** `reconnect`: connect again (another key, or the right server) before resuming. */
  recovery: "resume" | "reconnect";
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

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
  // The phase the workflow was in before it failed: the step bar marks that step.
  const lastActivePhaseRef = useRef<WorkflowPhase | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [session, setSession] = useState<OctopusImportSession | null>(null);
  const [previewPlan, setPreviewPlan] =
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
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

  const projectListPath = `/${space.slug}/projects`;
  const useServerSource = source === "server";
  const isServerReady = Boolean(
    useServerSource && probe && serverUrl.trim() && apiKey.trim(),
  );
  const isProcessingFile =
    workflowPhase === "uploading" ||
    workflowPhase === "connecting" ||
    workflowPhase === "fetching" ||
    workflowPhase === "extracting" ||
    workflowPhase === "previewing";
  const isFinalizingImport =
    workflowPhase === "validating" || workflowPhase === "confirming";
  const canResumeFetch = Boolean(
    resumableFetch &&
      resumableFetch.recovery === "resume" &&
      isServerReady &&
      serverUrl.trim() === resumableFetch.serverUrl &&
      octopusSpaceId === resumableFetch.octopusSpaceId &&
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
  const canImport = Boolean(
    previewPlan &&
      !nothingNew &&
      !pairingPending &&
      !hasPreviewBlockers &&
      !workflowError &&
      workflowPhase === "ready" &&
      !isFinalizingImport,
  );
  const steps = importSteps(source, {
    phase: workflowPhase,
    lastActivePhase: lastActivePhaseRef.current,
    probed: Boolean(probe),
    fetchStarted: Boolean(resumableFetch),
  });
  const keyPermissionProblem = permissionProblem(
    probe?.permissions,
    probe?.spaceless ? null : octopusSpaceId,
  );
  const fetchNotices =
    fetchProgress?.done && useServerSource
      ? historyFetchNotices(fetchProgress)
      : null;
  const canProbe = Boolean(
    serverUrl.trim() && apiKey.trim() && !isProcessingFile && !probing,
  );
  const showPreviewSection = Boolean(
    previewPlan ||
      completedMissingSecrets?.length ||
      validation ||
      blockerSummary?.hasBlockers ||
      workflowWarning ||
      workflowError,
  );

  useEffect(() => {
    return () => {
      if (validationTimerRef.current !== null)
        window.clearTimeout(validationTimerRef.current);
      workflowAbortRef.current?.abort();
    };
  }, []);

  const setWorkflowPhase = (phase: WorkflowPhase) => {
    if (phase !== "failed" && phase !== "idle") lastActivePhaseRef.current = phase;
    setWorkflowPhaseState(phase);
  };

  const clearWorkflow = () => {
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    setPreviewPlan(null);
    setValidation(null);
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowWarning(null);
    setWorkflowError(null);
    setWorkflowHint(null);
    setFailureRecovery(null);
    setPairingConfirmed(false);
    setCompletedMissingSecrets(null);
    setUploadError(null);
    setBlockerSummary(null);
    setFetchProgress(null);
  };

  // An input changed: the previous attempt's result no longer describes what the user will import (inputs are disabled while
  // a request runs, so nothing is in flight). The resume target survives only while it still matches the server and space.
  const invalidateAttempt = (keepResume: boolean) => {
    clearWorkflow();
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

  const openPicker = () => {
    if (workflowPhase === "failed") invalidateAttempt(false);
    setDraftFile(selectedFile);
    setDraftPassword("");
    setDraftError("");
    setDraftValidation(selectedFile ? "valid" : "idle");
    setIsDragging(false);
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setIsDragging(false);
    setUploadError(null);
  };

  const cancelPicker = () => {
    if (isProcessingFile) {
      workflowTokenRef.current += 1;
      clearWorkflow();
    }
    setDraftFile(selectedFile);
    setDraftPassword("");
    setDraftError("");
    setDraftValidation(selectedFile ? "valid" : "idle");
    closePicker();
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
    closePicker();
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
    const resumeTarget: ResumableHistoryFetch = {
      session: sessionToFetch,
      serverUrl: connection.serverUrl,
      octopusSpaceId: fetchSpaceId,
      recovery: "resume",
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
    const connection = currentConnection();
    let uploadCompleted = false;

    try {
      const uploadSession = file
        ? await uploadFileSource(file, controller.signal, token)
        : await connectServerSource(controller.signal, token);
      if (!uploadSession || workflowTokenRef.current !== token) return;
      uploadCompleted = true;

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

    setWorkflowPhase("extracting");
    setWorkflowMessage("Extracting archive...");

    const extractEnvelope = await extractOctopusImport(
      uploadSession.sessionId,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return;

    const extractedSession = extractEnvelope.data?.session ?? uploadSession;
    setSession(extractedSession);
    const extractionData = extractEnvelope.data?.extraction ?? null;
    const extractionBlockerSummary =
      extractEnvelope.data?.blockerSummary ?? null;
    setBlockerSummary(extractionBlockerSummary);

    if (!extractionData) {
      failWith(extractEnvelope, "Extraction failed.");
      return;
    }

    if (
      extractEnvelope.code !== 200 ||
      extractionData.hasBlockers ||
      extractionBlockerSummary?.hasBlockers
    ) {
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(
        extractEnvelope.msg || "Extraction produced blocking diagnostics.",
      );
      return;
    }

    setWorkflowPhase("previewing");
    setWorkflowMessage("Generating preview...");

    const previewEnvelope = await previewOctopusImport(
      uploadSession.sessionId,
      space.id,
      signal,
    );
    if (workflowTokenRef.current !== token) return;

    const previewSession = previewEnvelope.data?.session ?? extractedSession;
    const previewData = previewEnvelope.data?.previewPlan ?? null;
    const previewBlockerSummary =
      previewEnvelope.data?.blockerSummary ?? null;
    setSession(previewSession);
    setPreviewPlan(previewData);
    setBlockerSummary(previewBlockerSummary);
    setWorkflowMessage(null);

    if (!previewData) {
      failWith(previewEnvelope, "Preview failed.");
      return;
    }

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

  const handleConfirmPicker = () => {
    if (!draftFile || draftValidation !== "valid" || !draftPassword.trim()) {
      return;
    }
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
    openPicker();
  };

  const handleServerUrlChange = (value: string) => {
    setServerUrl(value);
    resetProbe();
    invalidateAttempt(value.trim() === resumableFetch?.serverUrl);
  };

  // A new key may resume the same session (after connecting with it), so the resume target is kept.
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    resetProbe();
    invalidateAttempt(true);
  };

  const handleOctopusSpaceChange = (value: string) => {
    setOctopusSpaceId(value);
    invalidateAttempt(value === resumableFetch?.octopusSpaceId);
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
      setOctopusSpaceId(
        probeData.spaces.find((item) => item.isDefault)?.id ??
          probeData.spaces[0]?.id ??
          null,
      );
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
      setWorkflowError(
        useServerSource
          ? "The import session expired. Read from the Octopus server again."
          : "The import session expired. Upload the export file again.",
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
      setWorkflowPhase("statusUnknown");
      setWorkflowMessage(null);
      setWorkflowWarning(
        "Polling stopped after 10 minutes. The import may still be running; check its status again.",
      );
      setWorkflowError(null);
    }
  };

  const handleCheckStatus = async () => {
    if (!session?.sessionId) return;

    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    const controller = new AbortController();
    workflowAbortRef.current = controller;

    setWorkflowPhase("confirming");
    setWorkflowMessage("Import is still running...");
    setWorkflowWarning(null);
    setWorkflowError(null);

    await awaitFinalSession(session.sessionId, controller.signal, token);
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

    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    const controller = new AbortController();
    workflowAbortRef.current = controller;

    setWorkflowPhase("validating");
    setWorkflowMessage("Validating preview plan...");
    setWorkflowWarning(null);
    setWorkflowError(null);
    setValidation(null);
    setBlockerSummary(null);

    try {
      const validateEnvelope = await validateOctopusImport(
        session.sessionId,
        space.id,
        planToValidate(previewPlan, pairingConfirmed),
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const validationData = validateEnvelope.data?.validation ?? null;
      const validationBlockerSummary =
        validateEnvelope.data?.blockerSummary ?? null;
      setValidation(validationData);
      setBlockerSummary(validationBlockerSummary);

      if (
        !validationData ||
        validateEnvelope.code !== 200 ||
        validationData.hasBlockers ||
        validationBlockerSummary?.hasBlockers
      ) {
        setWorkflowPhase("ready");
        setWorkflowMessage(null);
        setWorkflowError(
          validateEnvelope.code !== 200
            ? validateEnvelope.msg || "Validation failed."
            : null,
        );
        setWorkflowHint(errorKindHint(validateEnvelope.errorKind));
        return;
      }

      setWorkflowPhase("confirming");
      setWorkflowMessage("Importing...");

      // Large history imports run as a background job; the session is polled until it settles.
      const confirmEnvelope = await confirmOctopusImport(
        session.sessionId,
        space.id,
        controller.signal,
        true,
      );
      if (workflowTokenRef.current !== token) return;

      const confirmedSession = confirmEnvelope.data?.session ?? null;
      setBlockerSummary(confirmEnvelope.data?.blockerSummary ?? null);
      if (confirmEnvelope.code !== 200 || !confirmedSession) {
        failWith(confirmEnvelope, "Import confirmation failed.");
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
      if (workflowTokenRef.current !== token) return;
      if (isAbortError(error)) return;
      setWorkflowPhase("ready");
      setWorkflowMessage(null);
      setWorkflowError(getErrorMessage(error));
    }
  };

  // Plans of a server without the incremental summary fall back to counts computed from the resources.
  const previewResources = useMemo(() => {
    const resources = previewPlan?.resources ?? [];

    return {
      actionCounts: summarizeActions(resources),
      projectRows: summarizeByProject(resources),
    };
  }, [previewPlan]);

  const actionTiles = [
    { key: "create", label: "Create", value: previewResources.actionCounts.create },
    {
      key: "alreadyImported",
      label: "Already imported",
      value: previewResources.actionCounts.alreadyImported,
    },
    { key: "update", label: "Update", value: previewResources.actionCounts.update },
    { key: "skip", label: "Skipped", value: previewResources.actionCounts.skip },
  ];

  const projectColumns = [
    { title: "Project", dataIndex: "projectName", key: "projectName" },
    {
      title: "Create",
      key: "create",
      render: (row: ProjectPreviewSummary) => row.counts.create,
    },
    {
      title: "Already imported",
      key: "alreadyImported",
      render: (row: ProjectPreviewSummary) => row.counts.alreadyImported,
    },
    {
      title: "Update",
      key: "update",
      render: (row: ProjectPreviewSummary) => row.counts.update,
    },
    {
      title: "Skipped",
      key: "skip",
      render: (row: ProjectPreviewSummary) => row.counts.skip,
    },
    { title: "New releases", dataIndex: "newReleases", key: "newReleases" },
    {
      title: "New deployments",
      dataIndex: "newDeployments",
      key: "newDeployments",
    },
  ];

  const workflowAction =
    workflowPhase === "statusUnknown" ? (
      <Button size="small" onClick={() => void handleCheckStatus()}>
        Check status
      </Button>
    ) : failureRecovery === "restart" && useServerSource ? (
      <Button
        size="small"
        disabled={!isServerReady}
        onClick={() => void runImportWorkflow(null)}
      >
        Start again
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
    return "Resume continues on the same import session where it stopped; nothing read so far is read again.";
  };

  const renderResumeNotice = () => (
    <Alert
      data-testid="resume-notice"
      type="info"
      showIcon
      message="Reading from Octopus stopped"
      description={resumeNoticeText()}
      action={
        <Button
          size="small"
          disabled={!canResumeFetch}
          onClick={() => void resumeHistoryFetch()}
        >
          Resume fetch
        </Button>
      }
    />
  );

  const renderBlockerSummary = (summary: OctopusImportBlockerSummary) => {
    if (!summary.hasBlockers) return null;

    return (
      <Alert
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="Import cannot continue."
        description={
          <div className="space-y-2">
            <div>
              {summary.blockerCount} blocking issue
              {summary.blockerCount === 1 ? "" : "s"} found across{" "}
              {summary.affectedResourceCount} resource
              {summary.affectedResourceCount === 1 ? "" : "s"}.
            </div>
            {summary.blockingReasons.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {summary.blockingReasons.map((reason) => (
                  <li key={reason.code}>
                    <span>{reason.message}</span>
                    <span className="ml-1 text-xs opacity-75">
                      ({reason.occurrenceCount} occurrence
                      {reason.occurrenceCount === 1 ? "" : "s"},{" "}
                      {reason.affectedResourceCount} affected resource
                      {reason.affectedResourceCount === 1 ? "" : "s"})
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        }
      />
    );
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

  const renderFetchSummary = () => {
    if (!fetchProgress || !fetchNotices) return null;

    const skippedItems =
      (fetchProgress.counts.itemsRejected ?? 0) +
      (fetchProgress.counts.itemsAbandoned ?? 0);
    const summaryTiles = [
      {
        key: "configuration",
        label: "Configuration",
        value: fetchProgress.counts.configurationDocuments ?? 0,
      },
      { key: "releases", label: "Releases", value: fetchProgress.counts.releases },
      {
        key: "deployments",
        label: "Deployments",
        value: fetchProgress.counts.deployments,
      },
      { key: "tasks", label: "Tasks", value: fetchProgress.counts.serverTasks },
      {
        key: "detailsFetched",
        label: "Details fetched",
        value: fetchProgress.counts.detailsFetched,
      },
      {
        key: "unchanged",
        label: "Unchanged",
        value: fetchProgress.counts.detailsSkipped,
      },
      {
        key: "secretsWithheld",
        label: "Secrets withheld",
        value: fetchProgress.counts.secretsWithheld ?? 0,
      },
    ];

    return (
      <div
        data-testid="history-fetch-summary"
        className="space-y-3 rounded-md border border-slate-200 p-4"
      >
        <div className="text-sm font-semibold text-slate-900">
          Read from Octopus{octopusSpaceId ? ` space ${octopusSpaceId}` : ""}:{" "}
          {pluralize(fetchProgress.projectCount, "project")}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {summaryTiles.map((tile) => (
            <div
              key={tile.key}
              data-testid={`fetch-tile-${tile.key}`}
              className="rounded-md border border-slate-200 px-3 py-2"
            >
              <div className="text-xs font-medium uppercase text-slate-500">
                {tile.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {tile.value}
              </div>
            </div>
          ))}
        </div>
        {fetchNotices.projectsNotFound > 0 ? (
          <Alert
            type={fetchNotices.nothingFound ? "error" : "warning"}
            showIcon
            message={`${pluralize(fetchNotices.projectsNotFound, "project")} ${
              fetchNotices.projectsNotFound === 1 ? "was" : "were"
            } not found in this Octopus space — wrong space, or deleted in Octopus.`}
            description={
              fetchNotices.nothingFound
                ? "No history was found for any project. Choose another Octopus space and load again."
                : undefined
            }
          />
        ) : null}
        {skippedItems > 0 ? (
          <Alert
            type="warning"
            showIcon
            message={`${pluralize(skippedItems, "item")} could not be read (the Octopus server refused the request, or it kept timing out) and ${skippedItems === 1 ? "was" : "were"} skipped.`}
          />
        ) : null}
        {fetchNotices.detailsTooLarge > 0 ? (
          <Alert
            type="info"
            showIcon
            message={`${pluralize(fetchNotices.detailsTooLarge, "task")} had logs too large to fetch and will be imported without logs.`}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col bg-white">
      <style>{`
        .select-zip-file-modal .ant-modal-content {
          background: #ffffff;
          border-radius: 6px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
        }
        .select-zip-file-modal .ant-modal-header {
          margin: 0;
          padding: 18px 24px 14px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }
        .select-zip-file-modal .ant-modal-title {
          color: #111827;
          font-size: 18px;
          font-weight: 700;
        }
        .select-zip-file-modal .ant-modal-body {
          padding: 22px 24px 24px;
          background: #ffffff;
        }
        .select-zip-file-modal .ant-modal-footer {
          margin: 0;
          padding: 14px 24px;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>

      <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="w-full">
          <button
            type="button"
            onClick={() => navigate(projectListPath)}
            className="mb-4 inline-flex items-center gap-2 border-0 bg-transparent p-0 text-sm font-medium text-squid-blue hover:opacity-80"
          >
            <ArrowLeftOutlined className="text-xs" />
            <span>Projects</span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="m-0 text-2xl font-bold text-slate-900">
              Import Projects
            </h1>
            <Button
              type={canImport ? "primary" : "default"}
              loading={isFinalizingImport}
              disabled={!canImport}
              onClick={handleImport}
              className={
                canImport
                  ? "!bg-green-700 hover:!bg-green-800 !border-green-700 !text-white"
                  : "!border-slate-300 !bg-slate-100 !text-slate-400"
              }
            >
              Import
            </Button>
          </div>

          <Steps
            data-testid={`${source}-import-steps`}
            className="mt-6"
            size="small"
            current={steps.current}
            status={steps.status}
            items={steps.titles.map((title) => ({ title }))}
          />

          <div className="mt-10 border-t border-slate-200 pt-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="text-base font-semibold text-slate-900">
                Import Source
              </div>

              <div className="w-full space-y-5">
                <ImportSourceCards
                  value={source}
                  disabled={isProcessingFile || isFinalizingImport}
                  onChange={handleSourceChange}
                />

                {useServerSource ? (
                  <div className="space-y-3 rounded-md border border-slate-200 p-4">
                    <div className="text-base font-semibold text-slate-900">
                      Read the whole space from an Octopus server.
                    </div>
                    <div>
                      <label
                        htmlFor="import-octopus-server-url"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Server URL
                      </label>
                      <Input
                        id="import-octopus-server-url"
                        value={serverUrl}
                        disabled={isProcessingFile}
                        onChange={(event) => handleServerUrlChange(event.target.value)}
                        onPressEnter={() => void handleProbe()}
                        placeholder="https://octopus.example.com"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="import-octopus-api-key"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        API key
                      </label>
                      <Input.Password
                        id="import-octopus-api-key"
                        value={apiKey}
                        disabled={isProcessingFile}
                        onChange={(event) => handleApiKeyChange(event.target.value)}
                        onPressEnter={() => void handleProbe()}
                        placeholder="API-XXXXXXXX"
                        autoComplete="new-password"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        The key is used only for this import and is never
                        stored. It must be able to read the whole space: use a
                        dedicated read-only service account. Keep this tab open
                        while reading; closing it pauses the read, and resuming
                        needs the key again.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => void handleProbe()}
                        loading={probing}
                        disabled={
                          !serverUrl.trim() || !apiKey.trim() || isProcessingFile
                        }
                      >
                        Connect
                      </Button>
                      {probe ? (
                        <>
                          <span className="text-sm text-emerald-700">
                            Connected to Octopus {probe.octopusVersion}
                          </span>
                          <Button
                            type="link"
                            size="small"
                            disabled={isProcessingFile}
                            onClick={handleChangeConnection}
                          >
                            Change
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {probeError ? (
                      <Alert type="error" showIcon message={probeError} />
                    ) : null}
                    {probe && !probe.spaceless ? (
                      <div>
                        <label
                          htmlFor="import-octopus-space"
                          className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                          Octopus space
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {pluralize(probe.spaces.length, "space")} available
                          </span>
                        </label>
                        <Select
                          id="import-octopus-space"
                          className="w-full max-w-md"
                          value={octopusSpaceId ?? undefined}
                          disabled={isProcessingFile}
                          onChange={(value: string) => handleOctopusSpaceChange(value)}
                          options={probe.spaces.map((item) => ({
                            label: item.name,
                            value: item.id,
                          }))}
                        />
                      </div>
                    ) : null}
                    {keyPermissionProblem ? (
                      <Alert
                        data-testid="key-permission-problem"
                        type="error"
                        showIcon
                        message="This API key cannot read the whole space, so the import will be refused."
                        description={
                          <div className="space-y-1">
                            <ul className="list-disc pl-5">
                              {keyPermissionProblem.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                            <div>
                              Use a dedicated read-only service account with
                              unrestricted view permissions in this space, ideally
                              with an expiring key.
                            </div>
                          </div>
                        }
                      />
                    ) : null}
                    <Button
                      type="primary"
                      ghost
                      disabled={!isServerReady || isProcessingFile}
                      onClick={() => void runImportWorkflow(null)}
                    >
                      Read from Octopus
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      Select a Zip file to import projects.
                    </div>
                    {selectedFile ? (
                      <div className="mt-4 text-sm font-medium text-slate-900">
                        Selected file:{" "}
                        <span className="font-semibold">
                          {selectedFile.name}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button type="primary" ghost onClick={openPicker}>
                        Select zip file
                      </Button>
                    </div>
                  </div>
                )}

                {isProcessingFile ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Spin indicator={<LoadingOutlined spin />} />
                      {workflowMessage}
                    </div>
                    {workflowPhase === "fetching" ? renderFetchProgress() : null}
                  </div>
                ) : null}

                {showResumeNotice ? renderResumeNotice() : null}

                {renderFetchSummary()}
              </div>
            </div>

            {showPreviewSection ? (
              <div className="mt-5 w-full">
                <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900">
                  Import Preview
                </div>
                <div className="space-y-5 px-4 py-4">
                  {completedMissingSecrets?.length ? (
                    <MissingSecretsAfterImport
                      missing={completedMissingSecrets}
                      spaceSlug={space.slug}
                      onFillFromFile={fillFromExportFile}
                      onDone={() => navigate(projectListPath)}
                    />
                  ) : null}

                  {blockerSummary?.hasBlockers && !isProcessingFile
                    ? renderBlockerSummary(blockerSummary)
                    : null}

                  {!blockerSummary?.hasBlockers &&
                  hasImportErrorOrBlocker &&
                  !isProcessingFile ? (
                    <Alert
                      type="error"
                      showIcon
                      icon={<ExclamationCircleOutlined />}
                      message="Import cannot continue."
                      description={
                        <div className="space-y-1">
                          <div>
                            {workflowError ||
                              "Resolve the blocking issues before importing."}
                          </div>
                          {workflowHint ? (
                            <div data-testid="workflow-hint">{workflowHint}</div>
                          ) : null}
                        </div>
                      }
                      action={workflowAction}
                    />
                  ) : null}

                  {!blockerSummary?.hasBlockers &&
                  workflowWarning &&
                  !workflowError &&
                  !isProcessingFile ? (
                    <Alert
                      type="warning"
                      showIcon
                      message={workflowWarning}
                      action={workflowAction}
                    />
                  ) : null}

                  {previewPlan?.fillPairing?.required ? (
                    <FillPairingConfirmation
                      pairing={previewPlan.fillPairing}
                      confirmed={pairingConfirmed}
                      disabled={isFinalizingImport || workflowPhase === "succeeded"}
                      onChange={setPairingConfirmed}
                    />
                  ) : null}

                  {previewPlan && !completedMissingSecrets ? (
                    <WithheldSecretsPanel
                      resources={previewPlan.resources}
                      onFillFromFile={fillFromExportFile}
                      disabled={isFinalizingImport}
                    />
                  ) : null}

                  {previewPlan?.summary ? (
                    <ImportPreviewOverview plan={previewPlan} spaceSlug={space.slug} />
                  ) : null}

                  {previewPlan && !previewPlan.summary ? (
                    <div className="space-y-5 text-sm text-slate-900">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {actionTiles.map((tile) => (
                          <div
                            key={tile.key}
                            data-testid={`import-tile-${tile.key}`}
                            className="rounded-md border border-slate-200 px-4 py-3"
                          >
                            <div className="text-xs font-medium uppercase text-slate-500">
                              {tile.label}
                            </div>
                            <div className="mt-1 text-2xl font-semibold">
                              {tile.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {nothingNew ? (
                        <Alert
                          type="info"
                          showIcon
                          message="Nothing new to import"
                          description="Everything in this source was already imported or is skipped."
                        />
                      ) : null}

                      {previewResources.projectRows.length ? (
                        <section>
                          <h2 className="mb-3 text-base font-semibold">
                            By project
                          </h2>
                          <Table
                            size="small"
                            pagination={false}
                            rowKey="projectSourceId"
                            columns={projectColumns}
                            dataSource={previewResources.projectRows}
                          />
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Modal
        title="Select Zip File"
        open={isPickerOpen}
        onCancel={cancelPicker}
        width={600}
        className="select-zip-file-modal"
        destroyOnClose
        footer={[
          <Button
            key="cancel"
            onClick={cancelPicker}
            className="border-slate-300 bg-white text-slate-700 hover:!border-slate-400 hover:!text-slate-900"
          >
            Cancel
          </Button>,
          <Button
            key="select"
            type="primary"
            loading={workflowPhase === "uploading"}
            disabled={
              !draftFile ||
              draftValidation !== "valid" ||
              !draftPassword.trim() ||
              isProcessingFile
            }
            onClick={handleConfirmPicker}
            className="!bg-squid-blue hover:!bg-blue-600 disabled:!bg-slate-200 disabled:!text-slate-500"
          >
            Select
          </Button>,
        ]}
      >
        <div className="space-y-4 bg-white">
          {uploadError ? (
            <Alert
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="There was a problem with your request."
              description={uploadError}
            />
          ) : null}

          <div className="text-sm font-medium text-slate-700">
            Upload file containing exported data
          </div>
          <label
            htmlFor="import-zip-file-input"
            role="button"
            tabIndex={0}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onKeyDown={handleBrowseKeyDown}
            className={[
              "flex h-[180px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors",
              isDragging
                ? "border-squid-blue bg-blue-50"
                : "border-slate-300 bg-white hover:border-squid-blue hover:bg-blue-50/40",
            ].join(" ")}
          >
            <input
              id="import-zip-file-input"
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              onChange={handleInputChange}
            />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-squid-blue">
              <UploadOutlined className="text-xl" />
            </span>
            <div className="mt-5 text-sm font-semibold text-slate-700">
              <span className="font-semibold text-squid-blue">Browse</span>
              <span> or drag and drop a file</span>
            </div>
          </label>

          {draftFile ? (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3 px-3 py-2">
                <FileZipOutlined className="flex-shrink-0 text-squid-blue" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {draftFile.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {formatFileSize(draftFile.size)}
                    </span>
                    {draftValidation === "validating" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                        <LoadingOutlined spin /> Checking file
                      </span>
                    ) : draftValidation === "valid" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <FileZipOutlined /> Ready to select
                      </span>
                    ) : draftValidation === "error" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <ExclamationCircleOutlined /> {draftError}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove selected zip file"
                  onClick={() => validateDraftFile(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <DeleteOutlined />
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="import-zip-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <Input.Password
              id="import-zip-password"
              value={draftPassword}
              onChange={(event) => {
                setDraftPassword(event.target.value);
                setUploadError(null);
              }}
              placeholder="Enter password"
              autoComplete="new-password"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ImportProjects;
