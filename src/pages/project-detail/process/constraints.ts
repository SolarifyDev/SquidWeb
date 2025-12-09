// Shared type definitions and constraints for Process pages

export interface ProcessStep {
  key: string;
  order: number;
  name: string;
  description?: string;
  icon: string;
  actionType: string;
}

export interface LifecycleEnv {
  key: string;
  name: string;
}

// Simplified Octopus step JSON types
export interface ActionJson {
  Id: string;
  Name: string;
  Slug: string;
  ActionType: string;
  Properties: Record<string, string>;
  Condition: string;
  [key: string]: any;
}

export interface StepJson {
  Id: string;
  Name: string;
  Slug: string;
  PackageRequirement: string;
  Properties: Record<string, string>;
  Condition: string;
  StartTrigger: string;
  Actions: ActionJson[];
  [key: string]: any;
}

// Right-side configuration panel item types
export type UiControlType =
  | "input"
  | "textarea"
  | "select"
  | "radioGroup"
  | "sectionFields"
  | "keyValueList";

export interface ConfigItem {
  key: string;
  label: string;
  summary: string;
  summaryNote?: string;
  type?: "tags" | "text";
  tags?: string[];
  expandable?: boolean;
  isSection?: boolean;
  detailParagraphs?: string[];
  detailBullets?: string[];
  uiType?: UiControlType;
  uiConfig?: any;
}
