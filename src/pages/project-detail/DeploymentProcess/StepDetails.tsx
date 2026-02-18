import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Collapse,
  Radio,
  Select,
  Checkbox,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  DeploymentStepDto,
  getStepProperty,
  setStepProperty,
  getTargetRoles,
} from "pages/apis/deploymentProcess";
import { StepType } from "./types";
import { stepIconMap, stepColorMap } from "./constants";

interface StepDetailsProps {
  step: DeploymentStepDto;
  saving: boolean;
  onSave: (updated: DeploymentStepDto) => void;
  onDelete: (stepId: number) => void;
  onBack: () => void;
}

// --- Property key constants ---
const PROP_TARGET_ROLES = "Squid.Action.TargetRoles";
const PROP_EXECUTION_LOCATION = "Squid.Step.ExecutionLocation";
const PROP_SUBSTITUTE_VARS = "Squid.Action.SubstituteInFiles.Enabled";
const PROP_CONFIG_TRANSFORMS = "Squid.Action.ConfigTransforms";
const PROP_CONFIG_VARIABLES = "Squid.Action.ConfigVariables";
const PROP_CUSTOM_SCRIPTS = "Squid.Action.CustomScripts";
const PROP_IIS_CONFIG = "Squid.Action.IISWebSite";
const PROP_NGINX_CONFIG = "Squid.Action.NginxWebServer";

const cloneStep = (step: DeploymentStepDto): DeploymentStepDto =>
  JSON.parse(JSON.stringify(step));

const StepDetails: React.FC<StepDetailsProps> = ({
  step,
  saving,
  onSave,
  onDelete,
  onBack,
}) => {
  const [editStep, setEditStep] = useState<DeploymentStepDto>(() =>
    cloneStep(step)
  );

  useEffect(() => {
    setEditStep(cloneStep(step));
  }, [step.id]);

  const type = editStep.stepType as StepType;
  const firstAction = editStep.actions[0];

  // --- Property getters ---
  const targetRoles = getTargetRoles(editStep);
  const executionLocation =
    getStepProperty(editStep, PROP_EXECUTION_LOCATION) ?? "worker";
  const getPropBool = (key: string) =>
    getStepProperty(editStep, key) === "True";

  // --- Updaters ---
  const updateDirect = (partial: Partial<DeploymentStepDto>) =>
    setEditStep((prev) => ({ ...prev, ...partial }));

  const updateProp = (key: string, value: string) =>
    setEditStep((prev) => setStepProperty(prev, key, value));

  const updateRoles = (roles: string[]) =>
    updateProp(PROP_TARGET_ROLES, roles.join(","));

  const updateAction = (partial: Partial<typeof firstAction>) => {
    if (!firstAction) return;
    setEditStep((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) =>
        i === 0 ? { ...a, ...partial } : a
      ),
    }));
  };

  const updateActionEnvs = (envs: number[]) => updateAction({ environments: envs });

  // --- Handlers ---
  const handleSave = () => onSave(editStep);
  const handleDelete = () => onDelete(editStep.id);

  const showPackage =
    type === StepType.DeployPackage || type === StepType.DeployIIS;

  const collapseItems = [
    {
      key: "name",
      label: "Step Name",
      children: (
        <Input
          value={editStep.name}
          onChange={(e) => updateDirect({ name: e.target.value })}
          placeholder="Step name"
        />
      ),
    },
    {
      key: "execution",
      label: "Execution Location",
      children: (
        <Radio.Group
          value={executionLocation}
          onChange={(e) =>
            updateProp(PROP_EXECUTION_LOCATION, e.target.value)
          }
        >
          <div className="flex flex-col gap-3">
            <Radio value="worker">Run on a worker</Radio>
            <Radio value="target">Run on each deployment target</Radio>
            <Radio value="worker-on-behalf">
              Run on a worker on behalf of each deployment target
            </Radio>
          </div>
        </Radio.Group>
      ),
    },
    {
      key: "roles",
      label: "Target Roles",
      children: (
        <Select
          mode="tags"
          value={targetRoles}
          onChange={updateRoles}
          placeholder="Add target roles..."
          className="w-full"
          options={[
            { value: "web-server", label: "web-server" },
            { value: "api-server", label: "api-server" },
            { value: "db-server", label: "db-server" },
          ]}
        />
      ),
    },
    ...(showPackage && firstAction
      ? [
          {
            key: "package",
            label: "Package",
            children: (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Package ID
                  </label>
                  <Input
                    value={firstAction.packageId ?? ""}
                    onChange={(e) =>
                      updateAction({ packageId: e.target.value })
                    }
                    placeholder="e.g. MyApp.Web"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Package Feed
                  </label>
                  <Select
                    value={firstAction.feedId ?? undefined}
                    onChange={(val) => updateAction({ feedId: val })}
                    className="w-full"
                    allowClear
                    placeholder="Select a feed"
                    options={[
                      { value: 1, label: "Squid Server (built-in)" },
                      { value: 2, label: "NuGet.org" },
                      { value: 3, label: "Docker Hub" },
                    ]}
                  />
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "features",
      label: "Configuration Features",
      children: (
        <div className="grid grid-cols-2 gap-3">
          <Checkbox
            checked={getPropBool(PROP_SUBSTITUTE_VARS)}
            onChange={(e) =>
              updateProp(PROP_SUBSTITUTE_VARS, e.target.checked ? "True" : "False")
            }
          >
            Substitute Variables in Templates
          </Checkbox>
          <Checkbox
            checked={getPropBool(PROP_CONFIG_TRANSFORMS)}
            onChange={(e) =>
              updateProp(PROP_CONFIG_TRANSFORMS, e.target.checked ? "True" : "False")
            }
          >
            .NET Configuration Transforms
          </Checkbox>
          <Checkbox
            checked={getPropBool(PROP_CONFIG_VARIABLES)}
            onChange={(e) =>
              updateProp(PROP_CONFIG_VARIABLES, e.target.checked ? "True" : "False")
            }
          >
            .NET Configuration Variables
          </Checkbox>
          <Checkbox
            checked={getPropBool(PROP_CUSTOM_SCRIPTS)}
            onChange={(e) =>
              updateProp(PROP_CUSTOM_SCRIPTS, e.target.checked ? "True" : "False")
            }
          >
            Custom Deployment Scripts
          </Checkbox>
          <Checkbox
            checked={getPropBool(PROP_IIS_CONFIG)}
            onChange={(e) =>
              updateProp(PROP_IIS_CONFIG, e.target.checked ? "True" : "False")
            }
          >
            IIS Web Site and Application Pool
          </Checkbox>
          <Checkbox
            checked={getPropBool(PROP_NGINX_CONFIG)}
            onChange={(e) =>
              updateProp(PROP_NGINX_CONFIG, e.target.checked ? "True" : "False")
            }
          >
            NGINX Web Server
          </Checkbox>
        </div>
      ),
    },
    {
      key: "conditions",
      label: "Conditions",
      children: (
        <div className="flex flex-col gap-4">
          {firstAction && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Environments
              </label>
              <Select
                mode="multiple"
                value={firstAction.environments}
                onChange={updateActionEnvs}
                placeholder="Run in all environments"
                className="w-full"
                options={[
                  { value: 1, label: "Test" },
                  { value: 2, label: "UAT" },
                  { value: 3, label: "Staging" },
                  { value: 4, label: "Production" },
                ]}
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Run Condition
            </label>
            <Select
              value={editStep.condition}
              onChange={(val) => updateDirect({ condition: val })}
              className="w-full"
              options={[
                { value: "Success", label: "Success: only run when previous steps are successful" },
                { value: "Failure", label: "Failure: only run when a previous step has failed" },
                { value: "Always", label: "Always run" },
                { value: "Variable", label: "Variable: only run when the variable expression is true" },
              ]}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="text-gray-500"
          />
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg text-white text-base ${stepColorMap[type] ?? "bg-gray-400"}`}
          >
            {stepIconMap[type] ?? null}
          </div>
          <h2 className="text-xl font-semibold text-gray-800 m-0">
            {editStep.name}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            type="primary"
            className="bg-squid-green hover:!bg-green-600 border-squid-green"
            onClick={handleSave}
            loading={saving}
          >
            Save
          </Button>
          <Button danger onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Collapsible sections */}
      <Collapse
        defaultActiveKey={[
          "name",
          "execution",
          "roles",
          "package",
          "features",
          "conditions",
        ]}
        items={collapseItems}
      />
    </div>
  );
};

export default StepDetails;
