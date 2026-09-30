import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Spin, message } from "antd";
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
  OctopusImportPreviewAction,
  previewOctopusImport,
  OctopusImportSessionState,
  type OctopusImportBlockerSummary,
  type OctopusImportPreviewPlan,
  type OctopusImportSession,
  type OctopusImportValidation,
  type OctopusImportUploadResponseData,
  uploadOctopusImport,
  validateOctopusImport,
} from "pages/apis/octopusImport";

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

const MAX_IMPORT_UPLOAD_BYTES = 100 * 1024 * 1024;
const IMPORT_POLL_INITIAL_DELAY_MS = 1500;
const IMPORT_POLL_MAX_DELAY_MS = 15000;
const IMPORT_POLL_TIMEOUT_MS = 10 * 60 * 1000;

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isZipFile = (file: File) => file.name.toLowerCase().endsWith(".zip");

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

  const projectListPath = `/${space.slug}/projects`;
  const isProcessingFile =
    workflowPhase === "uploading" ||
    workflowPhase === "extracting" ||
    workflowPhase === "previewing";
  const isFinalizingImport =
    workflowPhase === "validating" || workflowPhase === "confirming";
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
  const canImport = Boolean(
    previewPlan &&
      !hasPreviewBlockers &&
      !workflowError &&
      workflowPhase === "ready" &&
      !isFinalizingImport,
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

  const runImportWorkflow = async (file: File) => {
    const token = ++workflowTokenRef.current;
    workflowAbortRef.current?.abort();
    clearWorkflow();
    const controller = new AbortController();
    workflowAbortRef.current = controller;
    setWorkflowPhase("uploading");
    setWorkflowMessage("Uploading archive...");
    let uploadCompleted = false;

    try {
      const uploadEnvelope = await uploadOctopusImport(
        file,
        draftPassword,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      if (uploadEnvelope.code !== 200) {
        setWorkflowPhase("idle");
        setWorkflowMessage(null);
        setUploadError(uploadEnvelope.msg || "Upload failed.");
        return;
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
        return;
      }
      uploadCompleted = true;
      closePicker();

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
        controller.signal,
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
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if ((error as Error)?.name === "AbortError") return;
      if (!uploadCompleted) {
        setWorkflowPhase("idle");
        setWorkflowMessage(null);
        setUploadError(getErrorMessage(error));
        return;
      }
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

      const statusEnvelope = await getOctopusImportStatus(
        sessionId,
        space.id,
        signal,
      );
      if (workflowTokenRef.current !== token) {
        throw new DOMException("Aborted", "AbortError");
      }

      const statusSession = statusEnvelope.data?.session ?? null;
      setBlockerSummary(statusEnvelope.data?.blockerSummary ?? null);
      if (!statusSession) return null;
      if (isImportTerminalState(statusSession.state)) return statusSession;

      await wait(delay);
      delay = Math.min(
        Math.ceil(delay * 1.5),
        IMPORT_POLL_MAX_DELAY_MS,
      );
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
    setValidation(null);
    setBlockerSummary(null);

    try {
      const validateEnvelope = await validateOctopusImport(
        session.sessionId,
        space.id,
        previewPlan,
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

      const confirmEnvelope = await confirmOctopusImport(
        session.sessionId,
        space.id,
        controller.signal,
      );
      if (workflowTokenRef.current !== token) return;

      const confirmedSession = confirmEnvelope.data?.session ?? null;
      setBlockerSummary(confirmEnvelope.data?.blockerSummary ?? null);
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
    } catch (error) {
      if (workflowTokenRef.current !== token) return;
      if ((error as Error)?.name === "AbortError") return;
      if (
        error instanceof Error &&
        error.message.startsWith(
          "The import is still running after 10 minutes.",
        )
      ) {
        setWorkflowPhase("confirming");
        setWorkflowMessage("Import is still running...");
        setWorkflowWarning(
          "Polling stopped after 10 minutes. Refresh the page or check back later.",
        );
        setWorkflowError(null);
        return;
      }
      setWorkflowPhase("ready");
      setWorkflowMessage(null);
      setWorkflowError(getErrorMessage(error));
    }
  };

  const previewResources = useMemo(() => {
    const resources = previewPlan?.resources ?? [];
    const isImportable = (resource: (typeof resources)[number]) =>
      resource.previewAction === OctopusImportPreviewAction.Create ||
      resource.previewAction === OctopusImportPreviewAction.ReuseExisting;
    const byType = (type: string) =>
      resources.filter(
        (resource) =>
          isImportable(resource) &&
          resource.sourceType.trim().toLowerCase() === type.toLowerCase(),
      );

    return {
      projects: byType("Project"),
      environments: byType("Environment"),
      lifecycles: byType("Lifecycle"),
    };
  }, [previewPlan]);

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
                  {selectedFile ? (
                    <div className="mt-4 text-sm font-medium text-slate-900">
                      Selected file:{" "}
                      <span className="font-semibold">{selectedFile.name}</span>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button type="primary" ghost onClick={openPicker}>
                      Select zip file
                    </Button>
                  </div>
                </div>

                {isProcessingFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <Spin indicator={<LoadingOutlined spin />} />
                    {workflowMessage}
                  </div>
                ) : null}
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
                    />
                  ) : null}

                  {!blockerSummary?.hasBlockers &&
                  workflowWarning &&
                  !workflowError &&
                  !isProcessingFile ? (
                    <Alert type="warning" showIcon message={workflowWarning} />
                  ) : null}

                  {previewPlan ? (
                    <div className="space-y-5 text-sm text-slate-900">
                      {previewResources.projects.length ? (
                        <section>
                          <h2 className="mb-3 text-base font-semibold">
                            The following projects will be imported:
                          </h2>
                          <ul className="list-disc space-y-1 pl-8">
                            {previewResources.projects.map((resource) => (
                              <li
                                key={`${resource.sourceType}-${resource.sourceId}`}
                              >
                                {resource.sourceName}
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
                                {previewResources.environments.map(
                                  (resource) => (
                                    <li
                                      key={`${resource.sourceType}-${resource.sourceId}`}
                                    >
                                      {resource.sourceName}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          ) : null}

                          {previewResources.lifecycles.length ? (
                            <div>
                              <div className="font-semibold">Lifecycles</div>
                              <ul className="list-disc space-y-1 pl-8">
                                {previewResources.lifecycles.map((resource) => (
                                  <li
                                    key={`${resource.sourceType}-${resource.sourceId}`}
                                  >
                                    {resource.sourceName}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {previewResources.projects.length ? (
                            <div>
                              <div className="font-semibold">Projects</div>
                              <ul className="list-disc space-y-1 pl-8">
                                {previewResources.projects.map((resource) => (
                                  <li
                                    key={`${resource.sourceType}-resource-${resource.sourceId}`}
                                  >
                                    <div className="font-semibold">
                                      {resource.sourceName}
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
