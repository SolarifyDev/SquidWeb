import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button, Spin, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getProjects, ProjectDto } from "pages/apis/project";
import {
  DeploymentStepDto,
  getDeploymentSteps,
  createDeploymentStep,
  updateDeploymentStep,
  deleteDeploymentSteps,
} from "pages/apis/deploymentProcess";
import { StepType, StepTemplate } from "./types";
import DeploymentPart from "./DeploymentPart";
import StepTemplateSelector from "./StepTemplateSelector";
import StepDetails from "./StepDetails";

// --- View state ---

type ViewState =
  | { view: "overview" }
  | { view: "add-step" }
  | { view: "step-detail"; stepId: number };

// --- Component ---

const DeploymentProcessOverview: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [steps, setSteps] = useState<DeploymentStepDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ view: "overview" });

  const processIdRef = useRef<number>(0);

  // ---- Fetch project + steps on mount ----

  const fetchSteps = useCallback(async (processId: number) => {
    const res = await getDeploymentSteps({
      processId,
      pageIndex: 1,
      pageSize: 200,
    });
    setSteps(res.steps ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        const projectRes = await getProjects({
          keyword: projectName,
          pageIndex: 1,
          pageSize: 10,
        });
        const matched = projectRes.projects.find(
          (p) => p.name === projectName || p.slug === projectName
        );
        if (!matched) {
          message.error(`Project "${projectName}" not found`);
          return;
        }
        if (cancelled) return;
        setProject(matched);
        processIdRef.current = matched.deploymentProcessId;
        await fetchSteps(matched.deploymentProcessId);
      } catch (err) {
        if (!cancelled) message.error("Failed to load deployment process");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [projectName, fetchSteps]);

  const reload = () => fetchSteps(processIdRef.current);

  // ---- Step actions ----

  const handleToggleEnabled = async (stepId: number) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    try {
      const updated = { ...step, isDisabled: !step.isDisabled };
      await updateDeploymentStep({ id: stepId, step: updated });
      await reload();
    } catch {
      message.error("Failed to update step");
    }
  };

  const handleClone = async (stepId: number) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    try {
      const cloned: DeploymentStepDto = {
        ...step,
        id: 0,
        name: `${step.name} (Clone)`,
        actions: step.actions.map((a) => ({ ...a, id: 0, stepId: 0 })),
        properties: step.properties.map((p) => ({ ...p, id: 0, stepId: 0 })),
      };
      await createDeploymentStep({
        processId: processIdRef.current,
        step: cloned,
      });
      await reload();
      message.success("Step cloned");
    } catch {
      message.error("Failed to clone step");
    }
  };

  const handleDelete = async (stepId: number) => {
    try {
      await deleteDeploymentSteps([stepId]);
      await reload();
      message.success("Step deleted");
      if (viewState.view === "step-detail" && viewState.stepId === stepId) {
        setViewState({ view: "overview" });
      }
    } catch {
      message.error("Failed to delete step");
    }
  };

  const handleSave = async (updated: DeploymentStepDto) => {
    try {
      setSaving(true);
      await updateDeploymentStep({ id: updated.id, step: updated });
      await reload();
      message.success("Step saved");
      setViewState({ view: "overview" });
    } catch {
      message.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = async (template: StepTemplate) => {
    try {
      const newStep: DeploymentStepDto = {
        id: 0,
        processId: processIdRef.current,
        stepOrder: steps.length + 1,
        name: template.name,
        stepType: template.type,
        condition: "Success",
        startTrigger: "StartAfterPrevious",
        packageRequirement: "LetSquidDecide",
        isDisabled: false,
        isRequired: false,
        createdAt: new Date().toISOString(),
        properties: [],
        actions: [
          {
            id: 0,
            stepId: 0,
            actionOrder: 1,
            name: template.name,
            actionType: template.type,
            workerPoolId: null,
            feedId: null,
            packageId:
              template.type === StepType.DeployPackage ||
              template.type === StepType.DeployIIS
                ? ""
                : "",
            isDisabled: false,
            isRequired: false,
            canBeUsedForProjectVersioning: false,
            createdAt: new Date().toISOString(),
            properties: [],
            environments: [],
            excludedEnvironments: [],
            channels: [],
          },
        ],
      };

      const created = await createDeploymentStep({
        processId: processIdRef.current,
        step: newStep,
      });
      await reload();
      setViewState({ view: "step-detail", stepId: created.id });
    } catch {
      message.error("Failed to create step");
    }
  };

  // ---- Render: Overview ----

  const renderOverview = () => (
    <div>
      {/* Header — z-10 so card hover shadows stay underneath */}
      <div className="relative z-10 bg-white pb-4 mb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            Deployment Process
          </h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            className="bg-squid-green hover:!bg-green-600 border-squid-green"
            onClick={() => setViewState({ view: "add-step" })}
          >
            ADD STEP
          </Button>
        </div>
      </div>

      {/* Pipeline — z-0, card shadows clipped by header above */}
      <div className="relative z-0 pt-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="relative flex items-stretch">
            {idx < steps.length - 1 && (
              <div className="absolute left-5 top-12 w-0.5 h-[calc(100%-24px)] bg-gray-300" />
            )}

            <DeploymentPart
              step={step}
              index={idx}
              onClick={(id) =>
                setViewState({ view: "step-detail", stepId: id })
              }
              onToggleEnabled={handleToggleEnabled}
              onClone={handleClone}
              onDelete={handleDelete}
            />
          </div>
        ))}

        {/* Add step placeholder */}
        <div
          className="group flex items-center gap-4 w-full p-4 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-squid-blue/50 hover:bg-blue-50/50 transition-all duration-200"
          onClick={() => setViewState({ view: "add-step" })}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-all duration-200 group-hover:border-squid-blue/50 group-hover:text-squid-blue">
            <PlusOutlined />
          </div>
          <span className="text-gray-400 transition-colors duration-200 group-hover:text-squid-blue">
            Add a step
          </span>
        </div>
      </div>
    </div>
  );

  // ---- Render: Step Detail ----

  const renderStepDetail = () => {
    if (viewState.view !== "step-detail") return null;
    const step = steps.find((s) => s.id === viewState.stepId);
    if (!step) return null;

    return (
      <StepDetails
        step={step}
        saving={saving}
        onSave={handleSave}
        onDelete={handleDelete}
        onBack={() => setViewState({ view: "overview" })}
      />
    );
  };

  // ---- Main render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin tip="Loading deployment process..." />
      </div>
    );
  }

  return (
    <div className="p-10 bg-white min-h-screen text-base">
      {viewState.view === "overview" && renderOverview()}
      {viewState.view === "step-detail" && renderStepDetail()}
      <StepTemplateSelector
        open={viewState.view === "add-step"}
        onClose={() => setViewState({ view: "overview" })}
        onSelect={handleSelectTemplate}
      />
    </div>
  );
};

export default DeploymentProcessOverview;
