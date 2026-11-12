import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  Progress,
  Select,
  Spin,
  Steps,
  Table,
  Tag,
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
  fetchPhaseLabel,
  fetchProgressPercent,
  historyFetchNotices,
  isNothingNew,
  listedResources,
  serverImportStep,
  summarizeActions,
  summarizeByProject,
  withoutHistoryRows,
  type ListedPreviewResource,
  type ProjectPreviewSummary,
} from "./importPreviewSummary";

type ValidationState = "idle" | "validating" | "valid" | "error";
type ImportSourceKind = "file" | "server";
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
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const SERVER_IMPORT_STEPS = [
  { title: "Connect" },
  { title: "Choose space" },
  { title: "Fetch history" },
  { title: "Preview" },
  { title: "Import" },
];

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

// Lease conflicts, timeouts, rate limits and server errors are worth retrying.
const isTransientStatus = (code: number) =>
  code === 408 || code === 409 || code === 429 || code >= 500;

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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [session, setSession] = useState<OctopusImportSession | null>(null);
  const [previewPlan, setPreviewPlan] =
    useState<OctopusImportPreviewPlan | null>(null);
  const [validation, setValidation] = useState<OctopusImportValidation | null>(
    null,
  );
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>("idle");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
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
  const [sources, setSources] = useState<ImportSourceKind[]>(["file"]);
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
  const useFileSource = sources.includes("file");
  const useServerSource = sources.includes("server");
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
  const nothingNew = previewPlan ? isNothingNew(previewPlan.resources) : false;
  const canImport = Boolean(
    previewPlan &&
      !nothingNew &&
      !hasPreviewBlockers &&
      !workflowError &&
      workflowPhase === "ready" &&
      !isFinalizingImport,
  );
  const serverStep = serverImportStep({
    phase: workflowPhase,
    probed: Boolean(probe),
    fetchStarted: Boolean(resumableFetch),
    fetchDone: Boolean(fetchProgress?.done),
    previewed: Boolean(previewPlan),
  });
  const fetchNotices =
    fetchProgress?.done && useServerSource
      ? historyFetchNotices(fetchProgress)
      : null;
  const canProbe = Boolean(
    serverUrl.trim() && apiKey.trim() && !isProcessingFile && !probing,
  );
  const showPreviewSection = Boolean(
    previewPlan ||
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

  const clearWorkflow = () => {
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    setPreviewPlan(null);
    setValidation(null);
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowWarning(null);
    setWorkflowError(null);
    setUploadError(null);
    setBlockerSummary(null);
    setFetchProgress(null);
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
    setWorkflowMessage("Creating import session...");

    const connectEnvelope = await connectOctopusImport(space.id, signal);
    if (workflowTokenRef.current !== token) return null;

    const connectedSession = connectEnvelope.data?.session ?? null;
    if (connectEnvelope.code !== 200 || !connectedSession?.sessionId) {
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(connectEnvelope.msg || "Could not create a session.");
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
          !isTransientStatus(fetchEnvelope.code) ||
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
    setWorkflowMessage("Fetching deployment history from Octopus...");
    setResumableFetch({
      session: sessionToFetch,
      serverUrl: connection.serverUrl,
      octopusSpaceId: fetchSpaceId,
    });

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
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError(fetchEnvelope.msg || "History fetch failed.");
        return false;
      }

      setFetchProgress(progress);
      setWorkflowMessage("Fetching deployment history from Octopus...");
      if (progress.done) {
        setResumableFetch(null);
        return true;
      }
    }
  };

  const cancelHistoryFetch = () => {
    workflowTokenRef.current += 1;
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowError(null);
    setWorkflowWarning(
      "History fetch cancelled. Resume it to continue where it stopped.",
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
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(extractEnvelope.msg || "Extraction failed.");
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
      setWorkflowPhase("failed");
      setWorkflowError(previewEnvelope.msg || "Preview failed.");
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
    if (useServerSource && !isServerReady) return;
    void runImportWorkflow(draftFile);
  };

  const handleSourcesChange = (values: ImportSourceKind[]) => {
    if (!values.length) return;
    setSources(values);
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
      navigate(projectListPath);
      return;
    }

    if (finalSession.state === OctopusImportSessionState.Expired) {
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(
        "The import session expired. Upload the export file again.",
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
        withoutHistoryRows(previewPlan),
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
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError(confirmEnvelope.msg || "Import confirmation failed.");
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

  const previewResources = useMemo(() => {
    const resources = previewPlan?.resources ?? [];

    return {
      projects: listedResources(resources, "Project"),
      environments: listedResources(resources, "Environment"),
      lifecycles: listedResources(resources, "Lifecycle"),
      actionCounts: summarizeActions(resources),
      projectRows: summarizeByProject(resources),
    };
  }, [previewPlan]);

  const renderResourceName = ({ resource, label }: ListedPreviewResource) => (
    <>
      {resource.sourceName}
      {label ? (
        <Tag className="ml-2" color="default">
          {label}
        </Tag>
      ) : null}
    </>
  );

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
    ) : resumableFetch &&
      (workflowPhase === "failed" || workflowPhase === "idle") ? (
      <Button
        size="small"
        disabled={!canResumeFetch}
        onClick={() => void resumeHistoryFetch()}
      >
        Resume fetch
      </Button>
    ) : null;

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
            {fetchPhaseLabel(fetchProgress.phase)} (project{" "}
            {fetchProgress.projectIndex} of {fetchProgress.projectCount})
          </div>
          <div>
            {pluralize(fetchProgress.counts.releases, "release")},{" "}
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

    const summaryTiles = [
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
    ];

    return (
      <div
        data-testid="history-fetch-summary"
        className="space-y-3 rounded-md border border-slate-200 p-4"
      >
        <div className="text-sm font-semibold text-slate-900">
          History fetched from {pluralize(fetchProgress.projectCount, "project")}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

          {useServerSource ? (
            <Steps
              data-testid="server-import-steps"
              className="mt-6"
              size="small"
              current={serverStep.current}
              status={serverStep.status}
              items={SERVER_IMPORT_STEPS}
            />
          ) : null}

          <div className="mt-10 border-t border-slate-200 pt-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="text-base font-semibold text-slate-900">
                Import Source
              </div>

              <div className="w-full space-y-5">
                <Checkbox.Group
                  value={sources}
                  disabled={isProcessingFile || isFinalizingImport}
                  onChange={(values) =>
                    handleSourcesChange(values as ImportSourceKind[])
                  }
                  options={[
                    { label: "Export file", value: "file" },
                    { label: "Octopus server", value: "server" },
                  ]}
                />

                {useServerSource ? (
                  <div className="space-y-3 rounded-md border border-slate-200 p-4">
                    <div className="text-base font-semibold text-slate-900">
                      Fetch deployment history from an Octopus server.
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
                        onChange={(event) => {
                          setServerUrl(event.target.value);
                          resetProbe();
                        }}
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
                        onChange={(event) => {
                          setApiKey(event.target.value);
                          resetProbe();
                        }}
                        onPressEnter={() => void handleProbe()}
                        placeholder="API-XXXXXXXX"
                        autoComplete="new-password"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        The key is used only for this import and is never
                        stored. A read-only Octopus user is enough.
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
                            onClick={resetProbe}
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
                          onChange={(value: string) => setOctopusSpaceId(value)}
                          options={probe.spaces.map((item) => ({
                            label: item.name,
                            value: item.id,
                          }))}
                        />
                      </div>
                    ) : null}
                    {!useFileSource ? (
                      <Button
                        type="primary"
                        ghost
                        disabled={!isServerReady || isProcessingFile}
                        onClick={() => void runImportWorkflow(null)}
                      >
                        Load from server
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {useFileSource ? (
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      Select a Zip file to import projects.
                    </div>
                    {useServerSource && !isServerReady ? (
                      <div className="mt-2 text-sm text-slate-500">
                        Connect to the Octopus server before selecting the file.
                      </div>
                    ) : null}
                    {selectedFile ? (
                      <div className="mt-4 text-sm font-medium text-slate-900">
                        Selected file:{" "}
                        <span className="font-semibold">
                          {selectedFile.name}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="primary"
                        ghost
                        onClick={openPicker}
                        disabled={useServerSource && !isServerReady}
                      >
                        Select zip file
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isProcessingFile ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Spin indicator={<LoadingOutlined spin />} />
                      {workflowMessage}
                    </div>
                    {workflowPhase === "fetching" ? renderFetchProgress() : null}
                  </div>
                ) : null}

                {renderFetchSummary()}
              </div>
            </div>

            {showPreviewSection ? (
              <div className="mt-5 w-full">
                <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900">
                  Import Preview
                </div>
                <div className="space-y-5 px-4 py-4">
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
                        workflowError ||
                        "Resolve the blocking issues before importing."
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

                  {previewPlan ? (
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

                      {previewResources.projects.length ? (
                        <section>
                          <h2 className="mb-3 text-base font-semibold">
                            The following projects will be imported:
                          </h2>
                          <ul className="list-disc space-y-1 pl-8">
                            {previewResources.projects.map((item) => (
                              <li
                                key={`${item.resource.sourceType}-${item.resource.sourceId}`}
                              >
                                {renderResourceName(item)}
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}

                      <section>
                        <h2 className="mb-3 text-base font-semibold">
                          The following resources will be imported:
                        </h2>
                        <div className="space-y-1">
                          {previewResources.environments.length ? (
                            <div>
                              <div className="font-semibold">Environments</div>
                              <ul className="list-disc space-y-1 pl-8">
                                {previewResources.environments.map((item) => (
                                  <li
                                    key={`${item.resource.sourceType}-${item.resource.sourceId}`}
                                  >
                                    {renderResourceName(item)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {previewResources.lifecycles.length ? (
                            <div>
                              <div className="font-semibold">Lifecycles</div>
                              <ul className="list-disc space-y-1 pl-8">
                                {previewResources.lifecycles.map((item) => (
                                  <li
                                    key={`${item.resource.sourceType}-${item.resource.sourceId}`}
                                  >
                                    {renderResourceName(item)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {previewResources.projects.length ? (
                            <div>
                              <div className="font-semibold">Projects</div>
                              <ul className="list-disc space-y-1 pl-8">
                                {previewResources.projects.map((item) => (
                                  <li
                                    key={`${item.resource.sourceType}-resource-${item.resource.sourceId}`}
                                  >
                                    <div className="font-semibold">
                                      {renderResourceName(item)}
                                    </div>
                                    <div className="ml-4 italic">Channels</div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </section>
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
              isProcessingFile ||
              (useServerSource && !isServerReady)
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
