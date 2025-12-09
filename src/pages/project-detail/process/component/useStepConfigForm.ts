import { useMemo, useState } from "react";
import type { StepJson, ActionJson } from "../constraints";

/**
 * UI 层的通用配置模型（完全不关心 StepJson 结构）
 */

export type UiControlType = "input" | "textarea" | "select" | "radio" | "keyValueList";

export interface UiFieldConfig {
  key: string; // 在某个 section 内的字段 key，例如 "serviceName" / "servicePorts"
  control: UiControlType;
  label?: string;
  placeholder?: string;
  rows?: number; // textarea 用
  options?: { label: string; value: string }[]; // select / radio 用
}

export interface UiSectionConfig {
  key: string; // 栏目 key，例如 "stepName" / "service" / "volumes"
  label: string;
  expandable: boolean;
  isSectionHeader?: boolean; // 纯分组标题
  summary?: string;
  detailParagraphs?: string[];
  detailBullets?: string[];
  fields?: UiFieldConfig[]; // 纯字段型 section
  // 将来可以在这里扩展特殊 UI（例如 keyValueList）
}

export type UiSectionValue = Record<string, string>;
export type UiValueJson = Record<string, UiSectionValue>;

/**
 * StepJson 与 UI 值之间的映射配置
 */

type StepFieldSource =
  | { kind: "step"; key: keyof StepJson }
  | { kind: "action"; key: keyof ActionJson }
  | { kind: "property"; propKey: string };

export interface FieldMapping {
  sectionKey: string;
  fieldKey: string; // 对应 UiFieldConfig.key
  source: StepFieldSource;
}

/**
 * 针对当前 Demo，只配置一部分典型字段的映射。
 * 后续可以按需补充。
 */
export const defaultFieldMappings: FieldMapping[] = [
  // Step 名称 & Action slug
  {
    sectionKey: "stepName",
    fieldKey: "stepName",
    source: { kind: "step", key: "Name" },
  },
  {
    sectionKey: "stepName",
    fieldKey: "actionSlug",
    source: { kind: "action", key: "Slug" },
  },

  // TargetRoles
  {
    sectionKey: "targetTags",
    fieldKey: "targetRoles",
    source: { kind: "step", key: "Properties" }, // 特殊：后面用固定 key 取 "Octopus.Action.TargetRoles"
  },

  // Deployment Config
  {
    sectionKey: "deploymentConfig",
    fieldKey: "deploymentName",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.DeploymentName",
    },
  },
  {
    sectionKey: "deploymentConfig",
    fieldKey: "replicas",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.Replicas",
    },
  },
  {
    sectionKey: "deploymentConfig",
    fieldKey: "namespace",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.Namespace",
    },
  },

  // Service
  {
    sectionKey: "service",
    fieldKey: "serviceName",
    source: {
      kind: "property",
      propKey: "Octopus.Action.KubernetesContainers.ServiceName",
    },
  },
  {
    sectionKey: "service",
    fieldKey: "servicePorts",
    source: {
      kind: "property",
      propKey: "Octopus.Action.KubernetesContainers.ServicePorts",
    },
  },

  // Volumes
  {
    sectionKey: "volumes",
    fieldKey: "combinedVolumes",
    source: {
      kind: "property",
      propKey: "Octopus.Action.KubernetesContainers.CombinedVolumes",
    },
  },

  // Containers
  {
    sectionKey: "containers",
    fieldKey: "containersJson",
    source: {
      kind: "property",
      propKey: "Octopus.Action.KubernetesContainers.Containers",
    },
  },

  // Ingress Rules / TLS / Annotations
  {
    sectionKey: "ingressRules",
    fieldKey: "ingressRules",
    source: {
      kind: "property",
      propKey: "Octopus.Action.KubernetesContainers.IngressRules",
    },
  },
  {
    sectionKey: "ingressTls",
    fieldKey: "ingressTls",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.IngressTlsCertificates",
    },
  },
  {
    sectionKey: "ingressAnnotations",
    fieldKey: "ingressAnnotations",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.IngressAnnotations",
    },
  },

  // ConfigMap 名称（不包含 KeyValueList 的具体项）
  {
    sectionKey: "configMap",
    fieldKey: "configMapName",
    source: {
      kind: "property",
      propKey:
        "Octopus.Action.KubernetesContainers.ConfigMapName",
    },
  },
];

/**
 * 根据 StepJson + 映射表构建 UI 值 Json
 */
export function buildUiValuesFromStep(
  step: StepJson,
  mappings: FieldMapping[] = defaultFieldMappings
): UiValueJson {
  const action = step.Actions[0];
  const values: UiValueJson = {};

  mappings.forEach((m) => {
    if (!values[m.sectionKey]) {
      values[m.sectionKey] = {};
    }

    let rawValue = "";

    switch (m.source.kind) {
      case "step":
        if (m.source.key === "Properties") {
          // 特殊处理 TargetRoles
          rawValue =
            step.Properties["Octopus.Action.TargetRoles"] || "";
        } else {
          rawValue = String(step[m.source.key] ?? "");
        }
        break;

      case "action":
        rawValue = action
          ? String(action[m.source.key] ?? "")
          : "";
        break;

      case "property":
        rawValue = action
          ? action.Properties[m.source.propKey] || ""
          : "";
        break;
    }

    values[m.sectionKey][m.fieldKey] = rawValue;
  });

  return values;
}

/**
 * 将 UiValueJson 应用到 StepJson 副本上，生成新的 StepJson。
 * （不会修改传入的 step 引用）
 */
export function applyUiValuesToStep(
  step: StepJson,
  uiValues: UiValueJson,
  mappings: FieldMapping[] = defaultFieldMappings
): StepJson {
  const next: StepJson = JSON.parse(JSON.stringify(step));
  const action = next.Actions[0];

  mappings.forEach((m) => {
    const sectionValues = uiValues[m.sectionKey];
    if (!sectionValues) {
      return;
    }

    const newValue = sectionValues[m.fieldKey] ?? "";

    switch (m.source.kind) {
      case "step":
        if (m.source.key === "Properties") {
          // 特殊处理 TargetRoles
          next.Properties["Octopus.Action.TargetRoles"] = newValue;
        } else {
          (next as any)[m.source.key] = newValue;
        }
        break;

      case "action":
        if (action) {
          (action as any)[m.source.key] = newValue;
        }
        break;

      case "property":
        if (action) {
          action.Properties[m.source.propKey] = newValue;
        }
        break;
    }
  });

  return next;
}

/**
 * Hook：对外暴露 UI 的值状态 + 一个构建最新 StepJson 的方法
 * - UI 组件只关心 uiValues / setFieldValue
 * - 上层在保存时调用 buildUpdatedStepJson 得到新的 StepJson
 */
export function useStepConfigForm(
  stepJson: StepJson,
  mappings: FieldMapping[] = defaultFieldMappings
) {
  const initialUiValues = useMemo(
    () => buildUiValuesFromStep(stepJson, mappings),
    // 这里简单用 JSON.stringify 做依赖（StepJson 现在比较小）
    // 如有性能问题可再优化
    [JSON.stringify(stepJson)]
  );

  const [uiValues, setUiValues] = useState<UiValueJson>(initialUiValues);

  const setFieldValue = (
    sectionKey: string,
    fieldKey: string,
    value: string
  ) => {
    setUiValues((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const buildUpdatedStepJson = () =>
    applyUiValuesToStep(stepJson, uiValues, mappings);

  return {
    uiValues,
    setFieldValue,
    buildUpdatedStepJson,
  };
}
