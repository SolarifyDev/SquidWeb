/**
 * StepType — used for icon/color/label mapping in the UI.
 * Values match the `stepType` string stored in the backend DeploymentStepDto.
 */
export enum StepType {
  DeployPackage = "deploy-package",
  RunScript = "run-script",
  DeployIIS = "deploy-iis",
  ManualIntervention = "manual-intervention",
  SendEmail = "send-email",
  RunKubectl = "run-kubectl",
  DeployHelm = "deploy-helm",
  RunTerraform = "run-terraform",
}

/**
 * StepTemplate — UI-only concept for the "Add Step" modal.
 * No corresponding backend endpoint.
 */
export interface StepTemplate {
  type: StepType;
  name: string;
  description: string;
  category: "installed" | "community";
}

/** All available step templates for the selector modal */
export const stepTemplates: StepTemplate[] = [
  {
    type: StepType.DeployPackage,
    name: "Deploy a Package",
    description: "Deploy a NuGet or ZIP package to one or more machines",
    category: "installed",
  },
  {
    type: StepType.RunScript,
    name: "Run a Script",
    description: "Run a PowerShell, Bash, C#, or F# script",
    category: "installed",
  },
  {
    type: StepType.DeployIIS,
    name: "Deploy to IIS",
    description: "Deploy a package to an IIS Web Site or Virtual Directory",
    category: "installed",
  },
  {
    type: StepType.ManualIntervention,
    name: "Manual Intervention",
    description: "Pause deployment for manual approval or action",
    category: "installed",
  },
  {
    type: StepType.SendEmail,
    name: "Send an Email",
    description: "Send an email notification as part of a deployment",
    category: "installed",
  },
  {
    type: StepType.RunKubectl,
    name: "Run kubectl",
    description: "Execute a kubectl CLI command against a Kubernetes cluster",
    category: "community",
  },
  {
    type: StepType.DeployHelm,
    name: "Deploy Helm Chart",
    description: "Deploy or upgrade a Helm chart on a Kubernetes cluster",
    category: "community",
  },
  {
    type: StepType.RunTerraform,
    name: "Run Terraform",
    description: "Execute Terraform plan and apply for infrastructure provisioning",
    category: "community",
  },
];
