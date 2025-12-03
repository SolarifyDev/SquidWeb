import { useState, useEffect } from "react";
import { Button, Input } from "antd";
import { useParams, useLocation } from "react-router-dom";
import {
  SearchOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { useStepEditor } from "./useStepEditor";
import { StepConfigPanel } from "./StepConfigPanel";

interface ProcessStep {
  key: string;
  order: number;
  name: string;
  icon: string;
  actionType: string;
}

const mockSteps: ProcessStep[] = [
  {
    key: "1",
    order: 1,
    name: "Deploy deployment",
    icon: "☸️",
    actionType: "Octopus.KubernetesDeployContainers",
  },
  {
    key: "2",
    order: 2,
    name: "Deploy ingress",
    icon: "☸️",
    actionType: "Octopus.KubernetesDeployIngress",
  },
];

const stepTypeMap: Record<string, string> = mockSteps.reduce(
  (acc, step) => {
    acc[step.key] = step.actionType;
    return acc;
  },
  {} as Record<string, string>
);

function ProcessEditor() {
  const { stepId } = useParams<{ stepId?: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const actionTypeFromUrl = searchParams.get("actionType") || undefined;

  const initialStepKey = stepId ?? mockSteps[0].key;
  const initialActionType =
    actionTypeFromUrl ||
    stepTypeMap[initialStepKey] ||
    "Octopus.KubernetesDeployContainers";

  const [filterText, setFilterText] = useState("");
  const [selectedStep, setSelectedStep] = useState(initialStepKey);
  const [currentActionType, setCurrentActionType] =
    useState<string | undefined>(initialActionType);

  const {
    stepJson,
    setStepJson,
    currentAction,
    configItems,
    isDirty,
    markSaved,
    uiValues,
    setFieldValue,
  } = useStepEditor(currentActionType);

  useEffect(() => {
    if (stepId) {
      setSelectedStep(stepId);
      const t = actionTypeFromUrl || stepTypeMap[stepId];
      if (t) {
        setCurrentActionType(t);
      }
    }
  }, [stepId, actionTypeFromUrl]);

  const filteredSteps = mockSteps.filter((step) =>
    step.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* 左侧步骤列表 */}
      <div className="w-56 border-r border-gray-200 flex flex-col">
        {/* 搜索框 */}
        <div className="p-3 flex items-center gap-2">
          <Input
            placeholder="Filter by name..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="flex-1"
            size="small"
          />
          <Button
            icon={<MoreOutlined />}
            size="small"
            className="border-gray-300"
          />
        </div>

        {/* 步骤列表 */}
        <div className="flex-1 overflow-y-auto">
          {filteredSteps.map((step) => (
            <div
              key={step.key}
              onClick={() => {
                setSelectedStep(step.key);
                const t = stepTypeMap[step.key];
                if (t) {
                  setCurrentActionType(t);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 ${
                selectedStep === step.key
                  ? "border-l-blue-500 bg-blue-50"
                  : "border-l-transparent hover:bg-gray-50"
              }`}
            >
              <span className="text-lg">{step.icon}</span>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm ${
                    selectedStep === step.key ? "text-blue-600" : "text-gray-700"
                  }`}
                >
                  {step.order}.{" "}
                  <span
                    className={
                      selectedStep === step.key ? "text-blue-600 font-medium" : ""
                    }
                  >
                    {step.name}
                  </span>
                </span>
              </div>
              <Button
                icon={<MoreOutlined />}
                type="text"
                size="small"
                className="text-gray-400 opacity-0 group-hover:opacity-100"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 右侧配置区域组件 */}
      <StepConfigPanel
        stepJson={stepJson}
        setStepJson={setStepJson}
        currentAction={currentAction}
        configItems={configItems}
        isDirty={isDirty}
        markSaved={markSaved}
        uiValues={uiValues}
        setFieldValue={setFieldValue}
      />
    </div>
  );
}

export default ProcessEditor;
