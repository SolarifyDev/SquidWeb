import { useMemo, useState } from "react";
import { useStepConfigForm } from "./useStepConfigForm";

// 真实的 Octopus 步骤 JSON（简化版类型）
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

// 右侧栏目配置（纯数据，驱动 UI）
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

// 部署 Deployment 的 stepJson
export const deploymentStepJson: StepJson = {
  Id: "5cc5ffe5-0460-416a-87e6-d2e4240b04bc",
  Name: "Deploy deployment",
  Slug: "deploy-web",
  PackageRequirement: "LetOctopusDecide",
  Properties: {
    "Octopus.Action.TargetRoles": "Aliyun-HK-03",
  },
  Condition: "Success",
  StartTrigger: "StartAfterPrevious",
  Actions: [
    {
      Id: "dde201be-1129-43b1-8bbe-835d60a101c2",
      Name: "Deploy deployment",
      Slug: "deploy-deployment",
      ActionType: "Octopus.KubernetesDeployContainers",
      Condition: "Success",
      Properties: {
        "Octopus.Action.EnabledFeatures":
          ",Octopus.Features.KubernetesService,Octopus.Features.KubernetesIngress,Octopus.Features.KubernetesConfigMap,Octopus.Features.KubernetesSecret",
        "Octopus.Action.KubernetesContainers.Replicas": "1",
        "Octopus.Action.KubernetesContainers.DeploymentStyle": "RollingUpdate",
        "Octopus.Action.KubernetesContainers.PodManagementPolicy": "OrderedReady",
        "Octopus.Action.KubernetesContainers.ServiceNameType": "External",
        "Octopus.Action.KubernetesContainers.DeploymentResourceType": "Deployment",
        "Octopus.Action.KubernetesContainers.DeploymentWait": "Wait",
        "Octopus.Action.KubernetesContainers.ServiceType": "ClusterIP",
        "Octopus.Action.KubernetesContainers.IngressAnnotations": "[]",
        "Octopus.Action.KubernetesContainers.DeploymentName": "squid-deploy",
        "Octopus.Action.KubernetesContainers.CombinedVolumes": "[]",
        "Octopus.Action.KubernetesContainers.Containers":
          '[{"Name":"squid","FeedId":"Feeds-1083","Ports":[{"key":"http","value":"8080","option":"TCP"}]}]',
        "Octopus.Action.KubernetesContainers.Namespace": "#{namespace}",
        "Octopus.Action.KubernetesContainers.ServiceName": "squid-service",
        "Octopus.Action.KubernetesContainers.ServicePorts":
          '[{"name":"http","port":"8080","targetPort":"8080","nodePort":"","protocol":"TCP"}]',
        "Octopus.Action.KubernetesContainers.ConfigMapValues":
          '{"ASPNETCORE_ENVIRONMENT":"#{ASPNETCORE_ENVIRONMENT}","Environment":"#{Environment}","Serilog__Seq__ApiKey":"#{Serilog:Seq:ApiKey}","Serilog__Seq__ServerUrl":"#{Serilog:Seq:ServerUrl}","SquidStore__Postgres__ConnectionString":"#{SquidStore:Postgres:ConnectionString}","SquidStore__Type":"#{SquidStore:Type}","Security__VariableEncryption__MasterKey":"#{Security:VariableEncryption:MasterKey}","AllowableCorsOrigins":"#{AllowableCorsOrigins}","SelfCert__Base64":"#{SelfCert:Base64}","SelfCert__Password":"#{SelfCert:Password}"}',
        "Octopus.Action.Kubernetes.ServerSideApply.Enabled": "False",
        "Octopus.Action.Kubernetes.ServerSideApply.ForceConflicts": "False",
        "Octopus.Action.KubernetesContainers.ConfigMapName": "squid-configmap",
      },
    },
  ],
};

// 你提供的 Ingress stepJson
export const ingressStepJson: StepJson = {
  Id: "1ed2f05c-a330-40ed-9936-987a61bb1df4",
  Name: "Deploy ingress",
  Slug: "deploy-ingress",
  PackageRequirement: "LetOctopusDecide",
  Properties: {
    "Octopus.Action.TargetRoles": "Aliyun-HK-03",
  },
  Condition: "Success",
  StartTrigger: "StartAfterPrevious",
  Actions: [
    {
      Id: "8ea1a5c4-1c8f-4466-901e-7c3b34e20260",
      Name: "Deploy ingress",
      Slug: "deploy-ingress",
      ActionType: "Octopus.KubernetesDeployIngress",
      Condition: "Success",
      Properties: {
        "Octopus.Action.KubernetesContainers.IngressAnnotations":
          '[{"key":"nginx.ingress.kubernetes.io/ssl-redirect","keyError":null,"value":"true","valueError":null,"option":"","optionError":null,"option2":"","option2Error":null},{"key":"prometheus.io/probe","keyError":null,"value":"true","valueError":null,"option":"","optionError":null,"option2":"","option2Error":null},{"key":"cert-manager.io/cluster-issuer","keyError":null,"value":"letsencrypt","valueError":null,"option":"","optionError":null,"option2":"","option2Error":null},{"key":"kubernetes.io/tls-acme","keyError":null,"value":"true","valueError":null,"option":"","optionError":null,"option2":"","option2Error":null},{"key":"nginx.ingress.kubernetes.io/proxy-body-size","keyError":null,"value":"0","valueError":null,"option":"","optionError":null,"option2":"","option2Error":null}]',
        "Octopus.Action.KubernetesContainers.IngressName": "squid-ingress",
        "Octopus.Action.KubernetesContainers.IngressRules":
          '[{"host":"#{IngressBaseDomainName}","http":{"paths":[{"key":"/","value":"8080","option":"squid-service","option2":"ImplementationSpecific"}]}}]',
        "Octopus.Action.KubernetesContainers.IngressTlsCertificates":
          '[{"hosts":["#{IngressBaseDomainName}"],"certificateVariableName":null,"secretName":"tls-squid-secret"}]',
        "Octopus.Action.KubernetesContainers.Namespace": "#{namespace}",
        "Octopus.Action.Kubernetes.ServerSideApply.Enabled": "False",
        "Octopus.Action.Kubernetes.ServerSideApply.ForceConflicts": "False",
        "Octopus.Action.KubernetesContainers.IngressClassName": "nginx",
      },
    },
  ],
};

// Deployment 类型的右侧栏目
const buildDeploymentConfigItems = (step: StepJson): ConfigItem[] => {
  const action = step.Actions[0];

  const targetRoles = step.Properties["Octopus.Action.TargetRoles"] || "";
  const targetRoleTags = targetRoles
    ? targetRoles.split(",").map((x) => x.trim())
    : [];

  const deploymentName =
    action?.Properties["Octopus.Action.KubernetesContainers.DeploymentName"] ||
    "";
  const replicas =
    action?.Properties["Octopus.Action.KubernetesContainers.Replicas"] || "";
  const namespaceValue =
    action?.Properties["Octopus.Action.KubernetesContainers.Namespace"] || "";
  const deploymentResourceType =
    action?.Properties[
      "Octopus.Action.KubernetesContainers.DeploymentResourceType"
    ] || "";
  const deploymentStyle =
    action?.Properties["Octopus.Action.KubernetesContainers.DeploymentStyle"] ||
    "";
  const deploymentWait =
    action?.Properties["Octopus.Action.KubernetesContainers.DeploymentWait"] ||
    "";
  const serviceType =
    action?.Properties["Octopus.Action.KubernetesContainers.ServiceType"] ||
    "";
  const serviceNameType =
    action?.Properties[
      "Octopus.Action.KubernetesContainers.ServiceNameType"
    ] || "";
  const serviceName =
    action?.Properties["Octopus.Action.KubernetesContainers.ServiceName"] ||
    "";
  const servicePorts =
    action?.Properties["Octopus.Action.KubernetesContainers.ServicePorts"] ||
    "";
  const combinedVolumes =
    action?.Properties["Octopus.Action.KubernetesContainers.CombinedVolumes"] ||
    "[]";
  const containersJson =
    action?.Properties["Octopus.Action.KubernetesContainers.Containers"] || "";
  const configMapName =
    action?.Properties["Octopus.Action.KubernetesContainers.ConfigMapName"] ||
    "";

  return [
    {
      key: "stepName",
      label: "Step Name",
      summary: `${step.Name} ${action?.Slug ?? ""}`.trim(),
      expandable: true,
    },
    {
      key: "targetTags",
      label: "Target Tags",
      summary: targetRoles || "未配置",
      type: "tags",
      tags: targetRoleTags,
      expandable: true,
      detailParagraphs: [
        "从属性 Octopus.Action.TargetRoles 解析得到部署目标角色。",
      ],
      detailBullets: [
        targetRoles
          ? `当前配置: ${targetRoles}`
          : "当前未配置任何 Target Role。",
        "可以在此处编辑角色名称，Octopus 会根据角色匹配 deployment targets。",
      ],
    },
    {
      key: "deploymentSection",
      label: "Deployment",
      summary: "",
      isSection: true,
    },
    {
      key: "resourceType",
      label: "Resource Type",
      summary: "Step configures a Deployment",
      expandable: true,
      detailBullets: [
        `Deployment 资源类型: ${deploymentResourceType}`,
        `Service 类型: ${serviceType}`,
        `Service 名称类型: ${serviceNameType}`,
        `部署等待策略: ${deploymentWait}`,
      ],
    },
    {
      key: "deploymentConfig",
      label: "Deployment Config",
      summary: `Create a Deployment called ${deploymentName} with ${replicas} replicas`,
      expandable: true,
      detailBullets: [
        `Deployment 名称: ${deploymentName}`,
        `副本数: ${replicas}`,
        `命名空间: ${namespaceValue}`,
      ],
    },
    {
      key: "deploymentStrategy",
      label: "Deployment Strategy",
      summary: `Update the Deployment with the ${deploymentStyle} strategy`,
      expandable: true,
      detailBullets: [
        `DeploymentStyle: ${deploymentStyle}`,
        `PodManagementPolicy: ${
          action?.Properties[
            "Octopus.Action.KubernetesContainers.PodManagementPolicy"
          ] || ""
        }`,
      ],
    },
    {
      key: "service",
      label: "Service",
      summary: serviceName
        ? `Expose service ${serviceName}`
        : "No service name configured",
      expandable: true,
      detailBullets: [
        `Service 名称: ${serviceName || "(未配置)"}`,
        `Service 类型: ${serviceType}`,
        `Service 端口: ${servicePorts}`,
      ],
    },
    {
      key: "volumes",
      label: "Volumes",
      summary:
        combinedVolumes === "[]"
          ? "No volumes have been included"
          : "Has volumes",
      summaryNote: combinedVolumes === "[]" ? "default" : undefined,
      expandable: true,
      detailBullets: [
        `Octopus.Action.KubernetesContainers.CombinedVolumes: ${combinedVolumes}`,
      ],
    },
    {
      key: "containers",
      label: "Containers",
      summary: containersJson
        ? "Configured container list"
        : "No containers configured",
      expandable: true,
      detailBullets: [
        "下面可以直接编辑容器定义的 JSON 字符串（与 Octopus UI 中的容器表单等价）。",
      ],
    },
    {
      key: "configMap",
      label: "ConfigMap",
      summary: configMapName
        ? `Use ConfigMap ${configMapName}`
        : "No ConfigMap configured",
      expandable: true,
      detailBullets: [
        `ConfigMap 名称: ${configMapName || "(未配置)"}`,
        "ConfigMapValues 中是注入到应用的配置键值对（JSON 格式）。",
      ],
      uiType: "keyValueList",
      uiConfig: {
        namePropKey:
          "Octopus.Action.KubernetesContainers.ConfigMapName",
        valuesPropKey:
          "Octopus.Action.KubernetesContainers.ConfigMapValues",
      },
    },
  ];
};

// Ingress 类型的右侧栏目
const buildIngressConfigItems = (step: StepJson): ConfigItem[] => {
  const action = step.Actions[0];

  const targetRoles = step.Properties["Octopus.Action.TargetRoles"] || "";
  const targetRoleTags = targetRoles
    ? targetRoles.split(",").map((x) => x.trim())
    : [];

  const namespaceValue =
    action?.Properties["Octopus.Action.KubernetesContainers.Namespace"] || "";
  const ingressName =
    action?.Properties["Octopus.Action.KubernetesContainers.IngressName"] || "";
  const ingressClassName =
    action?.Properties[
      "Octopus.Action.KubernetesContainers.IngressClassName"
    ] || "";
  const ingressRules =
    action?.Properties["Octopus.Action.KubernetesContainers.IngressRules"] ||
    "";
  const ingressTls =
    action?.Properties[
      "Octopus.Action.KubernetesContainers.IngressTlsCertificates"
    ] || "";
  const ingressAnnotations =
    action?.Properties[
      "Octopus.Action.KubernetesContainers.IngressAnnotations"
    ] || "";

  return [
    {
      key: "stepName",
      label: "Step Name",
      summary: `${step.Name} ${action?.Slug ?? ""}`.trim(),
      expandable: true,
    },
    {
      key: "targetTags",
      label: "Target Tags",
      summary: targetRoles || "未配置",
      type: "tags",
      tags: targetRoleTags,
      expandable: true,
      detailParagraphs: [
        "从属性 Octopus.Action.TargetRoles 解析得到部署目标角色。",
      ],
      detailBullets: [
        targetRoles
          ? `当前配置: ${targetRoles}`
          : "当前未配置任何 Target Role。",
      ],
    },
    {
      key: "ingressSection",
      label: "Ingress",
      summary: "",
      isSection: true,
    },
    {
      key: "ingressBasic",
      label: "Ingress Config",
      summary: ingressName
        ? `Ingress ${ingressName} in ${namespaceValue || "(namespace)"}`
        : "Configure ingress name, class and namespace",
      expandable: true,
      detailBullets: [
        `Ingress 名称: ${ingressName || "(未配置)"}`,
        `命名空间: ${namespaceValue || "(未配置)"}`,
        `IngressClassName: ${ingressClassName || "(未配置)"}`,
      ],
    },
    {
      key: "ingressRules",
      label: "Rules",
      summary: ingressRules ? "Configured ingress rules" : "No rules configured",
      expandable: true,
      detailBullets: [
        "IngressRules 为 JSON 数组，定义 host 与 path 到 service/port 的映射。",
      ],
    },
    {
      key: "ingressTls",
      label: "TLS",
      summary: ingressTls
        ? "Configured TLS certificates"
        : "No TLS certificates configured",
      expandable: true,
      detailBullets: [
        "IngressTlsCertificates 为 JSON 数组，定义 hosts 与 secretName 对应关系。",
      ],
      uiType: "sectionFields",
      uiConfig: {
        fields: [
          {
            control: "textarea",
            propKey:
              "Octopus.Action.KubernetesContainers.IngressTlsCertificates",
            placeholder: "IngressTlsCertificates JSON",
            rows: 4,
          },
        ],
      },
    },
    {
      key: "ingressAnnotations",
      label: "Annotations",
      summary: ingressAnnotations && ingressAnnotations !== "[]"
        ? "Custom ingress annotations defined"
        : "No custom annotations configured",
      expandable: true,
      detailBullets: [
        "IngressAnnotations 为 JSON 数组，定义 nginx 等控制器的自定义注解。",
      ],
      uiType: "sectionFields",
      uiConfig: {
        fields: [
          {
            control: "textarea",
            propKey:
              "Octopus.Action.KubernetesContainers.IngressAnnotations",
            placeholder: "IngressAnnotations JSON",
            rows: 4,
          },
        ],
      },
    },
  ];
};

 // 根据当前 stepJson 组装右侧栏目信息（纯数据）
export const buildConfigItems = (step: StepJson): ConfigItem[] => {
  const action = step.Actions[0];

  if (action?.ActionType === "Octopus.KubernetesDeployIngress") {
    return buildIngressConfigItems(step);
  }

  return buildDeploymentConfigItems(step);
};

const getInitialTemplate = (actionType?: string): StepJson =>
  actionType === "Octopus.KubernetesDeployIngress"
    ? ingressStepJson
    : deploymentStepJson;

export function useStepEditor(actionType?: string) {
  const [stepJson, setStepJson] = useState<StepJson>(() =>
    getInitialTemplate(actionType)
  );

  const [initialSnapshot, setInitialSnapshot] = useState<string>(() =>
    JSON.stringify(getInitialTemplate(actionType))
  );

  // 当 actionType 变化（例如在 editor 左侧切换 step 或从 Process 带不同类型进来）时，重置当前 stepJson 与基准快照
  useMemo(() => {
    const next = getInitialTemplate(actionType);
    setStepJson(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [actionType]);

  const currentAction = stepJson.Actions[0];

  // 基于当前 stepJson 构建 UI 层的表单值 Json（解耦 UI 与 StepJson）
  const { uiValues, setFieldValue, buildUpdatedStepJson } =
    useStepConfigForm(stepJson);

  const configItems = useMemo(() => buildConfigItems(stepJson), [stepJson]);

  const isDirty = useMemo(
    () => JSON.stringify(stepJson) !== initialSnapshot,
    [stepJson, initialSnapshot]
  );

  const markSaved = () => {
    // 先用 UI 表单的值构建一个最新的 StepJson，再作为保存基准
    const updated = buildUpdatedStepJson();
    setStepJson(updated);
    setInitialSnapshot(JSON.stringify(updated));
  };

  return {
    stepJson,
    setStepJson,
    currentAction,
    configItems,
    isDirty,
    markSaved,
    uiValues,
    setFieldValue,
    buildUpdatedStepJson,
  };
}
