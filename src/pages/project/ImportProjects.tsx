import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Modal, Spin, Typography, message } from "antd";
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
  extractOctopusImport,
  getOctopusImportStatus,
  isImportTerminalState,
  previewOctopusImport,
  type OctopusImportDiagnostic,
  type OctopusImportExtraction,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
  type OctopusImportResult,
  type OctopusImportSession,
  type OctopusImportValidation,
  type OctopusImportUploadResponseData,
  uploadOctopusImport,
  validateOctopusImport,
} from "pages/apis/octopusImport";

const { Text } = Typography;

type ValidationState = "idle" | "validating" | "valid" | "error";
type WorkflowPhase =
  | "idle"
  | "uploading"
  | "extracting"
  | "previewing"
  | "ready"
  | "validating"
  | "confirming"
  | "succeeded"
  | "failed";

interface ResourceGroup {
  title: string;
  items: OctopusImportPreviewResource[];
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isZipFile = (file: File) => file.name.toLowerCase().endsWith(".zip");

const formatPreviewAction = (value: number) => {
  switch (value) {
    case 0:
      return "Create";
    case 1:
      return "Reuse existing";
    case 2:
      return "Rename required";
    case 3:
      return "Skip";
    case 4:
      return "Unsupported";
    case 5:
      return "Blocked";
    default:
      return `Action ${value}`;
  }
};

const formatOutcomeState = (value: number) => {
  switch (value) {
    case 0:
      return "Pending";
    case 1:
      return "Created";
    case 2:
      return "Reused";
    case 3:
      return "Skipped";
    case 4:
      return "Unsupported";
    case 5:
      return "Blocked";
    case 6:
      return "Failed";
    default:
      return `Outcome ${value}`;
  }
};

const formatSeverity = (value: number) => {
  switch (value) {
    case 0:
      return "Info";
    case 1:
      return "Warning";
    case 2:
      return "Blocker";
    default:
      return `Severity ${value}`;
  }
};

const getSeverityClass = (value: number) => {
  switch (value) {
    case 0:
      return "border-slate-200 bg-slate-50 text-slate-600";
    case 1:
      return "border-amber-200 bg-amber-50 text-amber-800";
    case 2:
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const groupPreviewResources = (
  resources: OctopusImportPreviewResource[],
): ResourceGroup[] => {
  const grouped = new Map<string, OctopusImportPreviewResource[]>();
  for (const resource of resources) {
    const key = resource.sourceType || "Other";
    const existing = grouped.get(key);
    if (existing) {
      existing.push(resource);
    } else {
      grouped.set(key, [resource]);
    }
  }
  return Array.from(grouped.entries()).map(([title, items]) => ({
    title,
    items,
  }));
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unexpected request failure.";
};

const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const ImportProjects: React.FC = () => {
  const navigate = useNavigate();
  const { space } = useSpace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationTimerRef = useRef<number | null>(null);
  const workflowAbortRef = useRef<AbortController | null>(null);
  const workflowTokenRef = useRef(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [session, setSession] = useState<OctopusImportSession | null>(null);
  const [extraction, setExtraction] = useState<OctopusImportExtraction | null>(
    null,
  );
  const [previewPlan, setPreviewPlan] =
    useState<OctopusImportPreviewPlan | null>(null);
  const [validation, setValidation] = useState<OctopusImportValidation | null>(
    null,
  );
  const [result, setResult] = useState<OctopusImportResult | null>(null);
  const [workflowPhase, setWorkflowPhase] = useState<WorkflowPhase>("idle");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowDiagnostics, setWorkflowDiagnostics] = useState<
    OctopusImportDiagnostic[]
  >([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftValidation, setDraftValidation] =
    useState<ValidationState>("idle");
  const [draftError, setDraftError] = useState("");

  const projectListPath = `/${space.slug}/projects`;
  const isProcessingFile =
    workflowPhase === "uploading" ||
    workflowPhase === "extracting" ||
    workflowPhase === "previewing";
  const isFinalizingImport =
    workflowPhase === "validating" || workflowPhase === "confirming";
  const hasPreviewBlockers = Boolean(
    previewPlan?.hasBlockers || validation?.hasBlockers,
  );
  const canImport = Boolean(
    previewPlan &&
      !hasPreviewBlockers &&
      workflowPhase === "ready" &&
      !isFinalizingImport,
  );
  const showPreviewSection = Boolean(
    isProcessingFile ||
      previewPlan ||
      extraction ||
      validation ||
      result ||
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
    setSession(null);
    setExtraction(null);
    setPreviewPlan(null);
    setValidation(null);
    setResult(null);
    setWorkflowPhase("idle");
    setWorkflowMessage(null);
    setWorkflowWarning(null);
    setWorkflowError(null);
    setWorkflowDiagnostics([]);
  };

  const validateDraftFile = (file: File | null) => {
    if (validationTimerRef.current !== null)
      window.clearTimeout(validationTimerRef.current);

    setDraftFile(file);
    setDraftError("");

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

      setDraftValidation("valid");
    }, 300);
  };

  const openPicker = () => {
    setDraftFile(selectedFile);
    setDraftError("");
    setDraftValidation(selectedFile ? "valid" : "idle");
    setIsDragging(false);
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setIsDragging(false);
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

  const runImportWorkflow = async (file: File) => {
    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    clearWorkflow();
    const controller = new AbortController();
    workflowAbortRef.current = controller;
    setSelectedFile(file);
    setWorkflowPhase("uploading");
    setWorkflowMessage("Uploading archive...");

    try {
      const uploadEnvelope = await uploadOctopusImport(
        file,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const uploadSession = applyUploadResult(
        uploadEnvelope.data ?? null,
        file,
        token,
      );
      if (!uploadSession) return;

      if (uploadEnvelope.code !== 200) {
        setWorkflowPhase("failed");
        setWorkflowError(uploadEnvelope.msg || "Upload failed.");
        return;
      }

      setWorkflowPhase("extracting");
      setWorkflowMessage("Extracting archive...");

      const extractEnvelope = await extractOctopusImport(
        uploadSession.sessionId,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const extractedSession = extractEnvelope.data?.session ?? uploadSession;
      setSession(extractedSession);
      const extractionData = extractEnvelope.data?.extraction ?? null;
      setExtraction(extractionData);

      if (!extractionData) {
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError(extractEnvelope.msg || "Extraction failed.");
        return;
      }

      if (extractEnvelope.code !== 200 || extractionData.hasBlockers) {
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError(
          extractEnvelope.msg || "Extraction produced blocking diagnostics.",
        );
        setWorkflowDiagnostics(extractionData.diagnostics ?? []);
        return;
      }

      setWorkflowPhase("previewing");
      setWorkflowMessage("Generating preview...");

      const previewEnvelope = await previewOctopusImport(
        uploadSession.sessionId,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const previewSession = previewEnvelope.data?.session ?? extractedSession;
      const previewData = previewEnvelope.data?.previewPlan ?? null;
      setSession(previewSession);
      setPreviewPlan(previewData);
      setWorkflowMessage(null);

      if (!previewData) {
        setWorkflowPhase("failed");
        setWorkflowError(previewEnvelope.msg || "Preview failed.");
        return;
      }

      setWorkflowPhase("ready");
      if (previewEnvelope.code !== 200 || previewData.hasBlockers) {
        setWorkflowWarning(previewEnvelope.msg || "Preview contains blockers.");
        setWorkflowDiagnostics(previewData.diagnostics ?? []);
      } else {
        setWorkflowWarning(null);
        setWorkflowDiagnostics([]);
      }
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if ((error as Error)?.name === "AbortError") return;
      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(getErrorMessage(error));
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
      clearWorkflow();
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
      clearWorkflow();
    }
    validateDraftFile(file);
  };

  const handleConfirmPicker = () => {
    if (!draftFile || draftValidation !== "valid") return;
    closePicker();
    void runImportWorkflow(draftFile);
  };

  const handleClearSource = () => {
    workflowAbortRef.current?.abort();
    workflowAbortRef.current = null;
    workflowTokenRef.current += 1;
    setSelectedFile(null);
    setDraftFile(null);
    setDraftValidation("idle");
    setDraftError("");
    clearWorkflow();
  };

  const pollFinalStatus = async (
    sessionId: string,
    signal: AbortSignal,
    token: number,
  ) => {
    for (;;) {
      const statusEnvelope = await getOctopusImportStatus(
        sessionId,
        space.id,
        signal,
      );
      if (workflowTokenRef.current !== token) {
        throw new DOMException("Aborted", "AbortError");
      }

      const statusSession = statusEnvelope.data?.session ?? null;
      if (!statusSession) return null;
      if (isImportTerminalState(statusSession.state)) return statusSession;
      await wait(1500);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
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

    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    const controller = new AbortController();
    workflowAbortRef.current = controller;

    setWorkflowPhase("validating");
    setWorkflowMessage("Validating preview plan...");
    setWorkflowWarning(null);
    setWorkflowError(null);
    setWorkflowDiagnostics([]);
    setValidation(null);

    try {
      const validateEnvelope = await validateOctopusImport(
        session.sessionId,
        space.id,
        previewPlan,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const validationData = validateEnvelope.data?.validation ?? null;
      setValidation(validationData);

      if (
        !validationData ||
        validateEnvelope.code !== 200 ||
        validationData.hasBlockers
      ) {
        setWorkflowPhase("ready");
        setWorkflowMessage(null);
        setWorkflowWarning(
          validateEnvelope.msg || "Validation produced blockers.",
        );
        setWorkflowDiagnostics(validationData?.diagnostics ?? []);
        return;
      }

      setWorkflowPhase("confirming");
      setWorkflowMessage("Importing...");

      const confirmEnvelope = await confirmOctopusImport(
        session.sessionId,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const confirmedSession = confirmEnvelope.data?.session ?? null;
      if (!confirmedSession) {
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError(confirmEnvelope.msg || "Import confirmation failed.");
        return;
      }

      setSession(confirmedSession);

      const finalSession = isImportTerminalState(confirmedSession.state)
        ? confirmedSession
        : await pollFinalStatus(
            confirmedSession.sessionId,
            controller.signal,
            token,
          );

      if (workflowTokenRef.current !== token) return;

      if (!finalSession) {
        setWorkflowPhase("failed");
        setWorkflowMessage(null);
        setWorkflowError("Import did not return a final session state.");
        return;
      }

      setSession(finalSession);
      setResult(finalSession.result ?? null);

      if (finalSession.state === 5) {
        setWorkflowPhase("succeeded");
        setWorkflowMessage(null);
        setWorkflowWarning(null);
        setWorkflowError(null);
        message.success("Import completed.");
        navigate(projectListPath);
        return;
      }

      setWorkflowPhase("failed");
      setWorkflowMessage(null);
      setWorkflowError(
        finalSession.result?.diagnostics?.[0]?.message || "Import failed.",
      );
      setWorkflowDiagnostics(finalSession.result?.diagnostics ?? []);
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if ((error as Error)?.name === "AbortError") return;
      setWorkflowPhase("ready");
      setWorkflowMessage(null);
      setWorkflowError(getErrorMessage(error));
    }
  };

  const previewResourceGroups = useMemo(() => {
    if (!previewPlan) return [];
    return groupPreviewResources(previewPlan.resources);
  }, [previewPlan]);

  const renderDiagnostics = (diagnostics: OctopusImportDiagnostic[]) => {
    if (!diagnostics.length) return null;
    return (
      <div className="space-y-2">
        {diagnostics.map((diagnostic, index) => (
          <div
            key={`${diagnostic.code}-${index}`}
            className={`rounded-md border px-3 py-2 text-sm ${getSeverityClass(
              diagnostic.severity,
            )}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {formatSeverity(diagnostic.severity)}
              </span>
              <span className="text-xs opacity-70">{diagnostic.code}</span>
            </div>
            <div className="mt-1">{diagnostic.message}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderResourceCard = (resource: OctopusImportPreviewResource) => {
    const actionLabel = formatPreviewAction(resource.previewAction);
    const outcomeLabel = formatOutcomeState(resource.outcomeState);
    const actionTone =
      resource.previewAction === 0
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : resource.previewAction === 1
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : resource.previewAction === 2
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : resource.previewAction === 5
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-slate-200 bg-slate-50 text-slate-600";

    return (
      <div
        key={`${resource.sourceType}-${resource.sourceId}`}
        className="rounded-lg border border-slate-200 bg-white px-4 py-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {resource.sourceName}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {resource.sourceType}
              {resource.destinationId != null
                ? ` · Destination ${resource.destinationId}`
                : ""}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${actionTone}`}
            >
              {actionLabel}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
              {outcomeLabel}
            </span>
          </div>
        </div>

        {resource.requiredInputs.length ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {resource.requiredInputs.length} required input
            {resource.requiredInputs.length > 1 ? "s" : ""} need to be
            re-entered after import.
          </div>
        ) : null}

        {resource.diagnostics.length ? (
          <div className="mt-3 space-y-2">
            {renderDiagnostics(resource.diagnostics)}
          </div>
        ) : null}
      </div>
    );
  };

  const sourceSummary = selectedFile
    ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
    : "No file selected";

  const sessionSummary = session?.sourceSummary
    ? `${session.sourceSummary.fileName} · ${formatFileSize(
        session.sourceSummary.sizeBytes,
      )}`
    : sourceSummary;

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

          <div className="mt-10 border-t border-slate-200 pt-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="text-base font-semibold text-slate-900">
                Import Source
              </div>

              <div className="w-full space-y-5">
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Select a Zip file to import projects.
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button type="primary" ghost onClick={openPicker}>
                      Select zip file
                    </Button>
                    <Text className="text-sm text-slate-500">
                      {sessionSummary}
                    </Text>
                  </div>
                </div>

                {selectedFile ? (
                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-squid-blue">
                        <FileZipOutlined className="text-lg" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {selectedFile.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatFileSize(selectedFile.size)}
                        </div>
                      </div>
                      <Button onClick={openPicker}>Change</Button>
                      <Button
                        aria-label="Remove selected zip file"
                        icon={<DeleteOutlined />}
                        onClick={handleClearSource}
                      />
                    </div>
                  </div>
                ) : null}

                {isProcessingFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <Spin indicator={<LoadingOutlined spin />} />
                    {workflowMessage}
                  </div>
                ) : null}

                {showPreviewSection ? (
                  <div className="w-full rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-slate-900">
                          Import Preview
                        </div>
                        <div className="text-xs text-slate-500">
                          {workflowPhase === "ready"
                            ? "Parsed from the selected archive."
                            : workflowPhase === "failed"
                              ? "The archive has blocking issues."
                              : workflowMessage || "Preparing preview..."}
                        </div>
                      </div>
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

                    <div className="space-y-4 px-4 py-4">
                      {extraction ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
                              Documents
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {extraction.documentCount}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
                              Resources
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {extraction.resourceCount}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-500">
                              Blockers
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {extraction.hasBlockers ? "Yes" : "No"}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {workflowWarning ? (
                        <Alert
                          type="warning"
                          showIcon
                          message={workflowWarning}
                          description={
                            workflowDiagnostics.length
                              ? renderDiagnostics(workflowDiagnostics)
                              : null
                          }
                        />
                      ) : null}

                      {workflowError ? (
                        <Alert
                          type="error"
                          showIcon
                          icon={<ExclamationCircleOutlined />}
                          message={workflowError}
                          description={
                            workflowDiagnostics.length
                              ? renderDiagnostics(workflowDiagnostics)
                              : null
                          }
                        />
                      ) : null}

                      {previewPlan ? (
                        <div className="space-y-4">
                          {previewPlan.requiredInputs.length ? (
                            <Alert
                              type="info"
                              showIcon
                              message={`${
                                previewPlan.requiredInputs.length
                              } required input${
                                previewPlan.requiredInputs.length > 1 ? "s" : ""
                              } will need to be re-entered after import.`}
                            />
                          ) : null}

                          {previewPlan.diagnostics.length ? (
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-slate-900">
                                Preview diagnostics
                              </div>
                              {renderDiagnostics(previewPlan.diagnostics)}
                            </div>
                          ) : null}

                          <div className="space-y-4">
                            {previewResourceGroups.map((group) => (
                              <div key={group.title}>
                                <div className="mb-2 text-sm font-semibold text-slate-900">
                                  {group.title}
                                  <span className="ml-2 text-xs font-normal text-slate-500">
                                    ({group.items.length})
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {group.items.map((resource) =>
                                    renderResourceCard(resource),
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Source: {previewPlan.generatedAt}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                      <Button onClick={() => navigate(projectListPath)}>
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        loading={isFinalizingImport}
                        disabled={!canImport}
                        onClick={handleImport}
                        className={
                          canImport
                            ? "!bg-green-700 hover:!bg-green-800 !border-green-700 !text-white"
                            : "!border-slate-300 !bg-slate-100 !text-slate-400"
                        }
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Select Zip File"
        open={isPickerOpen}
        onCancel={closePicker}
        width={600}
        className="select-zip-file-modal"
        destroyOnClose
        footer={[
          <Button
            key="cancel"
            onClick={closePicker}
            className="border-slate-300 bg-white text-slate-700 hover:!border-slate-400 hover:!text-slate-900"
          >
            Cancel
          </Button>,
          <Button
            key="select"
            type="primary"
            disabled={!draftFile || draftValidation !== "valid"}
            onClick={handleConfirmPicker}
            className="!bg-squid-blue hover:!bg-blue-600 disabled:!bg-slate-200 disabled:!text-slate-500"
          >
            Select
          </Button>,
        ]}
      >
        <div className="space-y-4 bg-white">
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
        </div>
      </Modal>
    </div>
  );
};

export default ImportProjects;
