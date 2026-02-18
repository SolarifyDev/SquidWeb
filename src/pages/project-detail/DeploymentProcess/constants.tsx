import React from "react";
import {
  InboxOutlined,
  CodeOutlined,
  GlobalOutlined,
  PauseCircleOutlined,
  MailOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  BuildOutlined,
} from "@ant-design/icons";
import { StepType } from "./types";

export const stepIconMap: Record<StepType, React.ReactNode> = {
  [StepType.DeployPackage]: <InboxOutlined />,
  [StepType.RunScript]: <CodeOutlined />,
  [StepType.DeployIIS]: <GlobalOutlined />,
  [StepType.ManualIntervention]: <PauseCircleOutlined />,
  [StepType.SendEmail]: <MailOutlined />,
  [StepType.RunKubectl]: <CloudServerOutlined />,
  [StepType.DeployHelm]: <DeploymentUnitOutlined />,
  [StepType.RunTerraform]: <BuildOutlined />,
};

export const stepColorMap: Record<StepType, string> = {
  [StepType.DeployPackage]: "bg-blue-500",
  [StepType.RunScript]: "bg-amber-500",
  [StepType.DeployIIS]: "bg-teal-500",
  [StepType.ManualIntervention]: "bg-orange-500",
  [StepType.SendEmail]: "bg-purple-500",
  [StepType.RunKubectl]: "bg-cyan-600",
  [StepType.DeployHelm]: "bg-indigo-500",
  [StepType.RunTerraform]: "bg-emerald-600",
};

export const stepLabelMap: Record<StepType, string> = {
  [StepType.DeployPackage]: "Deploy a Package",
  [StepType.RunScript]: "Run a Script",
  [StepType.DeployIIS]: "Deploy to IIS",
  [StepType.ManualIntervention]: "Manual Intervention",
  [StepType.SendEmail]: "Send an Email",
  [StepType.RunKubectl]: "Run kubectl",
  [StepType.DeployHelm]: "Deploy Helm Chart",
  [StepType.RunTerraform]: "Run Terraform",
};
