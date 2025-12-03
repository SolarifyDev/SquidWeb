import { useMemo, useState, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button, Input, Tag, Select } from "antd";
import {
  MoreOutlined,
  DownOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import type {
  StepJson,
  ActionJson,
  ConfigItem,
} from "./useStepEditor";

interface UnderlineInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function UnderlineInput({
  label,
  value,
  onChange,
  placeholder,
}: UnderlineInputProps) {
  return (
    <div className="mb-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <input
        className="w-full border-0 border-b border-gray-300 focus:border-blue-500 focus:outline-none text-sm text-gray-900 bg-transparent pb-0.5"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface CollapsibleSectionProps {
  expanded: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  expanded,
  children,
}: CollapsibleSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useMemo(() => {
    if (expanded && ref.current) {
      setHeight(ref.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [expanded, children]);

  return (
    <div
      style={{
        height: expanded ? height : 0,
        overflow: "hidden",
        transition: "height 200ms ease, opacity 200ms ease",
        opacity: expanded ? 1 : 0,
        marginTop: expanded ? 8 : 0,
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

type ConfigMapItemRow = {
  key: string;
  value: string;
};

const parseConfigMapValues = (raw: string): ConfigMapItemRow[] => {
  if (!raw) {
    return [];
  }

  try {
    const obj = JSON.parse(raw);

    if (!obj || typeof obj !== "object") {
      return [];
    }

    return Object.entries(obj).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
  } catch {
    return [];
  }
};

const stringifyConfigMapValues = (items: ConfigMapItemRow[]): string => {
  const obj: Record<string, string> = {};

  items.forEach((item) => {
    if (!item.key) {
      return;
    }

    obj[item.key] = item.value;
  });

  return JSON.stringify(obj);
};

type FieldControlType = "underline" | "textarea";

interface FieldConfig {
  id: string;
  type: FieldControlType;
  label?: string;
  propKey: string;
  placeholder?: string;
  rows?: number;
}

type UIOptionType = "input" | "dropdown" | "text";

interface UIOptionConfig {
  key: string;
  name: string;
  type: UIOptionType;
}

interface UIPanelConfig {
  panelName: string;
  panelValue: string;
  options: UIOptionConfig[];
}

const sectionFieldConfigs: Record<string, FieldConfig[]> = {
  deploymentConfig: [
    {
      id: "deploymentName",
      type: "underline",
      label: "Deployment name",
      propKey: "Octopus.Action.KubernetesContainers.DeploymentName",
      placeholder: "Deployment name",
    },
    {
      id: "replicas",
      type: "underline",
      label: "Replicas",
      propKey: "Octopus.Action.KubernetesContainers.Replicas",
      placeholder: "Replicas",
    },
    {
      id: "namespace",
      type: "underline",
      label: "Namespace",
      propKey: "Octopus.Action.KubernetesContainers.Namespace",
      placeholder: "Namespace",
    },
  ],
  ingressBasic: [
    {
      id: "ingressName",
      type: "underline",
      label: "Ingress name",
      propKey: "Octopus.Action.KubernetesContainers.IngressName",
      placeholder: "Ingress name",
    },
    {
      id: "namespace",
      type: "underline",
      label: "Namespace",
      propKey: "Octopus.Action.KubernetesContainers.Namespace",
      placeholder: "Namespace",
    },
    {
      id: "ingressClassName",
      type: "underline",
      label: "Ingress class name",
      propKey:
        "Octopus.Action.KubernetesContainers.IngressClassName",
      placeholder: "IngressClassName",
    },
  ],
  service: [
    {
      id: "serviceName",
      type: "underline",
      label: "Service name",
      propKey: "Octopus.Action.KubernetesContainers.ServiceName",
      placeholder: "ServiceName",
    },
    {
      id: "servicePorts",
      type: "textarea",
      propKey: "Octopus.Action.KubernetesContainers.ServicePorts",
      placeholder: "ServicePorts JSON",
      rows: 3,
    },
  ],
  ingressRules: [
    {
      id: "ingressRules",
      type: "textarea",
      propKey: "Octopus.Action.KubernetesContainers.IngressRules",
      placeholder: "IngressRules JSON",
      rows: 4,
    },
  ],
  ingressTls: [
    {
      id: "ingressTls",
      type: "textarea",
      propKey:
        "Octopus.Action.KubernetesContainers.IngressTlsCertificates",
      placeholder: "IngressTlsCertificates JSON",
      rows: 4,
    },
  ],
  ingressAnnotations: [
    {
      id: "ingressAnnotations",
      type: "textarea",
      propKey:
        "Octopus.Action.KubernetesContainers.IngressAnnotations",
      placeholder: "IngressAnnotations JSON",
      rows: 4,
    },
  ],
  volumes: [
    {
      id: "volumes",
      type: "textarea",
      propKey:
        "Octopus.Action.KubernetesContainers.CombinedVolumes",
      placeholder: "CombinedVolumes JSON",
      rows: 3,
    },
  ],
  containers: [
    {
      id: "containers",
      type: "textarea",
      propKey: "Octopus.Action.KubernetesContainers.Containers",
      placeholder: "Containers JSON",
      rows: 6,
    },
  ],
};

interface StepConfigPanelProps {
  stepJson: StepJson;
  setStepJson: Dispatch<SetStateAction<StepJson>>;
  currentAction: ActionJson | undefined;
  configItems: ConfigItem[];
  isDirty: boolean;
  markSaved: () => void;
}

export function StepConfigPanel({
  stepJson,
  setStepJson,
  currentAction,
  configItems,
  isDirty,
  markSaved,
}: StepConfigPanelProps) {
  const currentTargetRole =
    stepJson.Properties["Octopus.Action.TargetRoles"] || "";
  const targetRoleOptions = [
    "Aliyun-HK-03",
    "Aliyun-HK-01",
    "Aliyun-HK-02",
  ];

  const currentResourceType =
    currentAction?.Properties[
      "Octopus.Action.KubernetesContainers.DeploymentResourceType"
    ] || "";

  const currentServiceType =
    currentAction?.Properties[
      "Octopus.Action.KubernetesContainers.ServiceType"
    ] || "";

  const currentDeploymentWait =
    currentAction?.Properties[
      "Octopus.Action.KubernetesContainers.DeploymentWait"
    ] || "";

  const currentDeploymentStyle =
    currentAction?.Properties[
      "Octopus.Action.KubernetesContainers.DeploymentStyle"
    ] || "";

  const configMapItems = useMemo(
    () =>
      parseConfigMapValues(
        currentAction?.Properties[
          "Octopus.Action.KubernetesContainers.ConfigMapValues"
        ] || ""
      ),
    [currentAction]
  );

  const updateActionProperty = (propKey: string, value: string) => {
    setStepJson((prev) => ({
      ...prev,
      Actions: prev.Actions.map((a, index) =>
        index === 0
          ? {
              ...a,
              Properties: {
                ...a.Properties,
                [propKey]: value,
              },
            }
          : a
      ),
    }));
  };

  const updateConfigMapItems = (items: ConfigMapItemRow[]) => {
    const json = stringifyConfigMapValues(items);

    setStepJson((prev) => ({
      ...prev,
      Actions: prev.Actions.map((a, index) =>
        index === 0
          ? {
              ...a,
              Properties: {
                ...a.Properties,
                "Octopus.Action.KubernetesContainers.ConfigMapValues": json,
              },
            }
          : a
      ),
    }));
  };

  const handleConfigMapItemChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const next = configMapItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );

    updateConfigMapItems(next);
  };

  const handleAddConfigMapItem = () => {
    updateConfigMapItems([...configMapItems, { key: "", value: "" }]);
  };

  const handleRemoveConfigMapItem = (index: number) => {
    const next = configMapItems.filter((_, i) => i !== index);

    updateConfigMapItems(next);
  };

  const ConfigSectionRenderer = ({ sectionKey }: { sectionKey: string }) => {
    const fields = sectionFieldConfigs[sectionKey];

    if (!fields || fields.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        {fields.map((field) => {
          if (field.type === "underline") {
            return (
              <UnderlineInput
                key={field.id}
                label={field.label || ""}
                value={currentAction?.Properties[field.propKey] || ""}
                onChange={(value) =>
                  updateActionProperty(field.propKey, value)
                }
                placeholder={field.placeholder || field.label || ""}
              />
            );
          }

          return (
            <Input.TextArea
              key={field.id}
              rows={field.rows ?? 3}
              value={currentAction?.Properties[field.propKey] || ""}
              onChange={(e) =>
                updateActionProperty(field.propKey, e.target.value)
              }
              placeholder={field.placeholder || field.propKey}
            />
          );
        })}
      </div>
    );
  };

  const expandableKeys = configItems
    .filter((item) => item.expandable)
    .map((item) => item.key);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const allExpanded = expandableKeys.every((key) =>
    expandedKeys.includes(key)
  );

  const toggleItem = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(expandableKeys);
    }
  };

  const renderSummary = (item: ConfigItem) => {
    if (item.type === "tags" && item.tags && item.tags.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <Tag key={tag} className="bg-gray-100 border-gray-300">
              {tag}
            </Tag>
          ))}
        </div>
      );
    }

    return (
      <span className="text-gray-600">
        {item.summary}
        {item.summaryNote && (
          <span className="text-gray-400 ml-1">
            ({item.summaryNote})
          </span>
        )}
      </span>
    );
  };

  const renderDetailText = (item: ConfigItem) => {
    const hasDetail =
      (item.detailParagraphs && item.detailParagraphs.length > 0) ||
      (item.detailBullets && item.detailBullets.length > 0);

    if (!hasDetail) {
      return null;
    }

    return (
      <div className="space-y-1 text-xs text-gray-500">
        {item.detailParagraphs?.map((text) => (
          <p key={text}>{text}</p>
        ))}
        {item.detailBullets && item.detailBullets.length > 0 && (
          <ul className="list-disc list-inside space-y-1">
            {item.detailBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 顶部标题区 */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-2xl shrink-0">
            ☸️
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              CONFIGURE AND APPLY KUBERNETES RESOURCES
            </p>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                1. {stepJson.Name}
              </h2>
              <a
                href="#"
                className="text-blue-600 text-sm hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs ↗
              </a>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">Can deploy to</span>
              <Tag className="bg-gray-600 text-white border-0 rounded-full text-xs">
                ☸️ {stepJson.Properties["Octopus.Action.TargetRoles"] || "N/A"}
              </Tag>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="primary" disabled={!isDirty} onClick={markSaved}>
              Save
            </Button>
            <Button className="border-blue-500 text-blue-500">
              Configure features
            </Button>
            <Button icon={<MoreOutlined />} className="border-gray-300" />
          </div>
        </div>
      </div>

      {/* 配置项列表 */}
      <div className="p-6">
        <div className="flex justify-end mb-4">
          <Button
            type="link"
            className="text-gray-500 text-sm p-0"
            onClick={handleToggleAll}
          >
            {allExpanded ? "COLLAPSE ALL" : "EXPAND ALL"}
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {configItems.map((item, index) => {
            const isExpanded = expandedKeys.includes(item.key);
            const hasDetailText =
              (item.detailParagraphs && item.detailParagraphs.length > 0) ||
              (item.detailBullets && item.detailBullets.length > 0);

            return (
              <div
                key={item.key}
                className={`${index > 0 ? "border-t border-gray-200" : ""}`}
              >
                <div
                  className={`flex items-start px-4 py-4 ${
                    item.expandable
                      ? "cursor-pointer bg-gray-50 hover:bg-gray-100"
                      : item.isSection
                      ? "bg-gray-50"
                      : ""
                  }`}
                  onClick={
                    item.expandable ? () => toggleItem(item.key) : undefined
                  }
                >
                  <div className="w-56 shrink-0">
                    <span
                      className={`text-sm ${
                        item.isSection
                          ? "font-semibold text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className="flex-1 text-sm">
                    {!item.isSection && renderSummary(item)}
                  </div>
                  {item.expandable && (
                    <Button
                      type="text"
                      size="small"
                      icon={
                        <DownOutlined
                          className={`transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      }
                      className="text-blue-500 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(item.key);
                      }}
                    />
                  )}
                </div>

                {item.expandable && (
                  <CollapsibleSection expanded={isExpanded}>
                    <div className="flex px-4 pb-4">
                      <div className="w-56 shrink-0" />
                      <div className="flex-1 space-y-3">
                        {hasDetailText && renderDetailText(item)}

                        {item.key === "stepName" && (
                          <div className="space-y-2">
                            <UnderlineInput
                              label="Step name"
                              value={stepJson.Name}
                              onChange={(value) =>
                                setStepJson((prev) => ({
                                  ...prev,
                                  Name: value,
                                }))
                              }
                              placeholder="Step name"
                            />
                            <UnderlineInput
                              label="Action slug"
                              value={currentAction?.Slug ?? ""}
                              onChange={(value) =>
                                setStepJson((prev) => ({
                                  ...prev,
                                  Actions: prev.Actions.map((a, index) =>
                                    index === 0 ? { ...a, Slug: value } : a
                                  ),
                                }))
                              }
                              placeholder="Action slug"
                            />
                          </div>
                        )}

                        {item.key === "targetTags" && (
                          <div className="mb-3">
                            <div className="text-xs text-gray-500 mb-0.5">
                              Target roles
                            </div>
                            <div className="border-b border-gray-300 pb-0.5">
                              <Select
                                showSearch
                                size="small"
                                style={{ width: "100%" }}
                                value={currentTargetRole || undefined}
                                options={Array.from(
                                  new Set(targetRoleOptions.filter(Boolean))
                                ).map((role) => ({
                                  label: role,
                                  value: role,
                                }))}
                                filterOption={(input, option) =>
                                  (option?.label as string)
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                                onChange={(value) =>
                                  setStepJson((prev) => ({
                                    ...prev,
                                    Properties: {
                                      ...prev.Properties,
                                      "Octopus.Action.TargetRoles": value,
                                    },
                                  }))
                                }
                                placeholder="Select target role"
                                bordered={false}
                              />
                            </div>
                          </div>
                        )}

                        {item.key === "resourceType" && (
                          <div className="space-y-3">
                            <div className="text-xs text-gray-500">
                              Select whether to deploy a Deployment, StatefulSet,
                              DaemonSet or Job.
                            </div>
                            <button
                              type="button"
                              className="flex items-start gap-3"
                              onClick={() =>
                                setStepJson((prev) => ({
                                  ...prev,
                                  Actions: prev.Actions.map((a, index) =>
                                    index === 0
                                      ? {
                                          ...a,
                                          Properties: {
                                            ...a.Properties,
                                            "Octopus.Action.KubernetesContainers.DeploymentResourceType":
                                              "Deployment",
                                          },
                                        }
                                      : a
                                  ),
                                }))
                              }
                            >
                              <span
                                className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                  currentResourceType === "Deployment"
                                    ? "border-blue-500"
                                    : "border-gray-400"
                                }`}
                              >
                                {currentResourceType === "Deployment" && (
                                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                                )}
                              </span>
                              <div className="text-left">
                                <div className="text-sm text-gray-900">
                                  Deployment
                                </div>
                                <div className="text-xs text-gray-500">
                                  A Deployment provides declarative updates for
                                  Pods ReplicaSets.
                                </div>
                              </div>
                            </button>

                            <div className="mt-3 space-y-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-0.5">
                                  Service type
                                </div>
                                <div className="border-b border-gray-300 pb-0.5">
                                  <Select
                                    size="small"
                                    style={{ width: "100%" }}
                                    value={currentServiceType || "ClusterIP"}
                                    options={[
                                      {
                                        label: "ClusterIP",
                                        value: "ClusterIP",
                                      },
                                    ]}
                                    onChange={(value) =>
                                      setStepJson((prev) => ({
                                        ...prev,
                                        Actions: prev.Actions.map(
                                          (a, index) =>
                                            index === 0
                                              ? {
                                                  ...a,
                                                  Properties: {
                                                    ...a.Properties,
                                                    "Octopus.Action.KubernetesContainers.ServiceType":
                                                      value,
                                                  },
                                                }
                                              : a
                                        ),
                                      }))
                                    }
                                    bordered={false}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-gray-500 mb-0.5">
                                  Deployment wait
                                </div>
                                <div className="border-b border-gray-300 pb-0.5">
                                  <Select
                                    size="small"
                                    style={{ width: "100%" }}
                                    value={currentDeploymentWait || "Wait"}
                                    options={[
                                      {
                                        label: "Wait",
                                        value: "Wait",
                                      },
                                    ]}
                                    onChange={(value) =>
                                      setStepJson((prev) => ({
                                        ...prev,
                                        Actions: prev.Actions.map(
                                          (a, index) =>
                                            index === 0
                                              ? {
                                                  ...a,
                                                  Properties: {
                                                    ...a.Properties,
                                                    "Octopus.Action.KubernetesContainers.DeploymentWait":
                                                      value,
                                                  },
                                                }
                                              : a
                                        ),
                                      }))
                                    }
                                    bordered={false}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {item.key === "ingressBasic" && (
                          <ConfigSectionRenderer sectionKey="ingressBasic" />
                        )}

                        {item.key === "ingressRules" && (
                          <ConfigSectionRenderer sectionKey="ingressRules" />
                        )}

                        {item.key === "ingressTls" && (
                          <ConfigSectionRenderer sectionKey="ingressTls" />
                        )}

                        {item.key === "ingressAnnotations" && (
                          <ConfigSectionRenderer sectionKey="ingressAnnotations" />
                        )}

                        {item.key === "deploymentConfig" && (
                          <ConfigSectionRenderer sectionKey="deploymentConfig" />
                        )}

                        {item.key === "deploymentStrategy" && (
                          <div className="mb-3">
                            <div className="text-xs text-gray-500 mb-0.5">
                              Deployment strategy
                            </div>
                            <div className="border-b border-gray-300 pb-0.5">
                              <Select
                                size="small"
                                style={{ width: "100%" }}
                                value={currentDeploymentStyle || "RollingUpdate"}
                                options={[
                                  {
                                    label: "RollingUpdate",
                                    value: "RollingUpdate",
                                  },
                                ]}
                                onChange={(value) =>
                                  setStepJson((prev) => ({
                                    ...prev,
                                    Actions: prev.Actions.map((a, index) =>
                                      index === 0
                                        ? {
                                            ...a,
                                            Properties: {
                                              ...a.Properties,
                                              "Octopus.Action.KubernetesContainers.DeploymentStyle":
                                                value,
                                            },
                                          }
                                        : a
                                    ),
                                  }))
                                }
                                bordered={false}
                              />
                            </div>
                          </div>
                        )}

                        {item.key === "service" && (
                          <ConfigSectionRenderer sectionKey="service" />
                        )}

                        {item.key === "volumes" && (
                          <ConfigSectionRenderer sectionKey="volumes" />
                        )}

                        {item.key === "containers" && (
                          <ConfigSectionRenderer sectionKey="containers" />
                        )}

                        {item.key === "configMap" && (
                          <div className="space-y-4">
                            <UnderlineInput
                              label="ConfigMap name"
                              value={
                                currentAction?.Properties[
                                  "Octopus.Action.KubernetesContainers.ConfigMapName"
                                ] || ""
                              }
                              onChange={(value) =>
                                setStepJson((prev) => ({
                                  ...prev,
                                  Actions: prev.Actions.map((a, index) =>
                                    index === 0
                                      ? {
                                          ...a,
                                          Properties: {
                                            ...a.Properties,
                                            "Octopus.Action.KubernetesContainers.ConfigMapName":
                                              value,
                                          },
                                        }
                                      : a
                                  ),
                                }))
                              }
                              placeholder="ConfigMap Name"
                            />

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="text-sm text-gray-700">
                                    Config Map Items
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    The config map resource values
                                  </div>
                                </div>
                                <Button
                                  size="small"
                                  type="default"
                                  className="border-blue-500 text-blue-500 px-4 py-3"
                                  onClick={() => handleAddConfigMapItem()}
                                >
                                  Add Config map item
                                </Button>
                              </div>

                              <div className="space-y-3">
                                {configMapItems.map((cm, idx) => (
                                  <div
                                    key={`${cm.key}-${idx}`}
                                    className="border border-gray-200 rounded-md bg-white p-4 shadow-sm"
                                  >
                                    <div className="flex gap-4 items-start">
                                      <div className="flex-1">
                                        <UnderlineInput
                                          label="Key"
                                          value={cm.key}
                                          onChange={(value) =>
                                            handleConfigMapItemChange(
                                              idx,
                                              "key",
                                              value
                                            )
                                          }
                                          placeholder="Key"
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <UnderlineInput
                                          label="Value"
                                          value={cm.value}
                                          onChange={(value) =>
                                            handleConfigMapItemChange(
                                              idx,
                                              "value",
                                              value
                                            )
                                          }
                                          placeholder="Value"
                                        />
                                      </div>
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<CloseOutlined />}
                                        onClick={() =>
                                          handleRemoveConfigMapItem(idx)
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                                {configMapItems.length === 0 && (
                                  <div className="text-xs text-gray-400">
                                    No config map items defined.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
