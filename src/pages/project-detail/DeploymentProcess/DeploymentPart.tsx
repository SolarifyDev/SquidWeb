import React from "react";
import { Button, Dropdown, Tag } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { DeploymentStepDto, getTargetRoles } from "pages/apis/deploymentProcess";
import { StepType } from "./types";
import { stepIconMap, stepColorMap, stepLabelMap } from "./constants";

interface DeploymentPartProps {
  step: DeploymentStepDto;
  index: number;
  onClick: (stepId: number) => void;
  onToggleEnabled: (stepId: number) => void;
  onClone: (stepId: number) => void;
  onDelete: (stepId: number) => void;
}

const DeploymentPart: React.FC<DeploymentPartProps> = ({
  step,
  index,
  onClick,
  onToggleEnabled,
  onClone,
  onDelete,
}) => {
  const type = step.stepType as StepType;
  const roles = getTargetRoles(step);

  return (
    <div
      className={`group relative flex items-center gap-4 w-full p-4 pl-5 mb-2 rounded-lg border cursor-pointer overflow-hidden transition-all duration-200 ${
        !step.isDisabled
          ? "bg-white border-gray-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] hover:border-gray-300"
          : "bg-gray-50 border-gray-200 opacity-60"
      }`}
      onClick={() => onClick(step.id)}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg scale-y-0 group-hover:scale-y-100 transition-transform duration-200 ${stepColorMap[type] ?? "bg-gray-400"}`}
      />

      {/* Step number */}
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-semibold text-sm shrink-0 transition-colors duration-200 group-hover:bg-gray-300 group-hover:text-gray-700">
        {index + 1}
      </div>

      {/* Icon */}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg shrink-0 ${stepColorMap[type] ?? "bg-gray-400"}`}
      >
        {stepIconMap[type] ?? null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate transition-colors duration-200 group-hover:text-squid-blue">
          {step.name}
        </div>
        <div className="text-sm text-gray-500">
          {stepLabelMap[type] ?? step.stepType}
        </div>
      </div>

      {/* Roles */}
      <div className="flex gap-1 flex-wrap shrink-0">
        {roles.map((role) => (
          <Tag key={role} color="blue">
            {role}
          </Tag>
        ))}
      </div>

      {/* Overflow menu */}
      <Dropdown
        menu={{
          items: [
            {
              key: "disable",
              label: step.isDisabled ? "Enable" : "Disable",
              onClick: (e) => {
                e.domEvent.stopPropagation();
                onToggleEnabled(step.id);
              },
            },
            {
              key: "clone",
              label: "Clone",
              onClick: (e) => {
                e.domEvent.stopPropagation();
                onClone(step.id);
              },
            },
            {
              key: "delete",
              label: "Delete",
              danger: true,
              onClick: (e) => {
                e.domEvent.stopPropagation();
                onDelete(step.id);
              },
            },
          ],
        }}
        trigger={["click"]}
      >
        <Button
          type="text"
          icon={<MoreOutlined />}
          className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        />
      </Dropdown>
    </div>
  );
};

export default DeploymentPart;
