import { useState, useEffect } from "react";
import type { ProcessStep, LifecycleEnv, StepJson } from "./constraints";
import type {
  DeploymentStepDto,
  GetDeploymentProcessResponseData,
} from "pages/apis/deploymentProcess";
import { GetDeploymentProcess } from "pages/apis/deploymentProcess";

// 内部 mock 数据，后续可以在各个 hook 里替换为接口请求结果

const defaultLifecycle = {
  name: "AI",
  environments: [
    { key: "test", name: "TEST" },
    { key: "prd", name: "PRD" },
    { key: "uat", name: "UAT" },
  ] as LifecycleEnv[],
};

const defaultEditorSteps: ProcessStep[] = [
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

// 部署 Deployment 的 stepJson 模板
const defaultDeploymentStepJson: StepJson = {
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
          "[{\"Name\":\"squid\",\"FeedId\":\"Feeds-1083\",\"Ports\":[{\"key\":\"http\",\"value\":\"8080\",\"option\":\"TCP\"}]}]",
        "Octopus.Action.KubernetesContainers.Namespace": "#{namespace}",
        "Octopus.Action.KubernetesContainers.ServiceName": "squid-service",
        "Octopus.Action.KubernetesContainers.ServicePorts":
          "[{\"name\":\"http\",\"port\":\"8080\",\"targetPort\":\"8080\",\"nodePort\":\"\",\"protocol\":\"TCP\"}]",
        "Octopus.Action.KubernetesContainers.ConfigMapValues":
          "{\"ASPNETCORE_ENVIRONMENT\":\"#{ASPNETCORE_ENVIRONMENT}\",\"Environment\":\"#{Environment}\",\"Serilog__Seq__ApiKey\":\"#{Serilog:Seq:ApiKey}\",\"Serilog__Seq__ServerUrl\":\"#{Serilog:Seq:ServerUrl}\",\"SquidStore__Postgres__ConnectionString\":\"#{SquidStore:Postgres:ConnectionString}\",\"SquidStore__Type\":\"#{SquidStore:Type}\",\"Security__VariableEncryption__MasterKey\":\"#{Security:VariableEncryption:MasterKey}\",\"AllowableCorsOrigins\":\"#{AllowableCorsOrigins}\",\"SelfCert__Base64\":\"#{SelfCert:Base64}\",\"SelfCert__Password\":\"#{SelfCert:Password}\"}",
        "Octopus.Action.Kubernetes.ServerSideApply.Enabled": "False",
        "Octopus.Action.Kubernetes.ServerSideApply.ForceConflicts": "False",
        "Octopus.Action.KubernetesContainers.ConfigMapName": "squid-configmap",
      },
    },
  ],
};

// Ingress 的 stepJson 模板
const defaultIngressStepJson: StepJson = {
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
          "[{\"key\":\"nginx.ingress.kubernetes.io/ssl-redirect\",\"keyError\":null,\"value\":\"true\",\"valueError\":null,\"option\":\"\",\"optionError\":null,\"option2\":\"\",\"option2Error\":null},{\"key\":\"prometheus.io/probe\",\"keyError\":null,\"value\":\"true\",\"valueError\":null,\"option\":\"\",\"optionError\":null,\"option2\":\"\",\"option2Error\":null},{\"key\":\"cert-manager.io/cluster-issuer\",\"keyError\":null,\"value\":\"letsencrypt\",\"valueError\":null,\"option\":\"\",\"optionError\":null,\"option2\":\"\",\"option2Error\":null},{\"key\":\"kubernetes.io/tls-acme\",\"keyError\":null,\"value\":\"true\",\"valueError\":null,\"option\":\"\",\"optionError\":null,\"option2\":\"\",\"option2Error\":null},{\"key\":\"nginx.ingress.kubernetes.io/proxy-body-size\",\"keyError\":null,\"value\":\"0\",\"valueError\":null,\"option\":\"\",\"optionError\":null,\"option2\":\"\",\"option2Error\":null}]",
        "Octopus.Action.KubernetesContainers.IngressName": "squid-ingress",
        "Octopus.Action.KubernetesContainers.IngressRules":
          "[{\"host\":\"#{IngressBaseDomainName}\",\"http\":{\"paths\":[{\"key\":\"/\",\"value\":\"8080\",\"option\":\"squid-service\",\"option2\":\"ImplementationSpecific\"}]}}]",
        "Octopus.Action.KubernetesContainers.IngressTlsCertificates":
          "[{\"hosts\":[\"#{IngressBaseDomainName}\"],\"certificateVariableName\":null,\"secretName\":\"tls-squid-secret\"}]",
        "Octopus.Action.KubernetesContainers.Namespace": "#{namespace}",
        "Octopus.Action.Kubernetes.ServerSideApply.Enabled": "False",
        "Octopus.Action.Kubernetes.ServerSideApply.ForceConflicts": "False",
        "Octopus.Action.KubernetesContainers.IngressClassName": "nginx",
      },
    },
  ],
};

// hook：获取 Process 列表步骤（后续可以在这里发请求）
export function useProcessSteps(deploymentProcessId?: number) {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deploymentProcessId) {
      setSteps([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSteps = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await GetDeploymentProcess(deploymentProcessId);

        const apiSteps = data.deploymentProcess?.steps || [];

        const mapped: ProcessStep[] = apiSteps.map((step: DeploymentStepDto) => {
          const firstAction = step.actions && step.actions[0];
          const actionType =
            firstAction?.actionType || step.stepType || "Octopus.KubernetesDeployContainers";

          return {
            key: String(step.id),
            order: step.stepOrder,
            name: step.name,
            description: "",
            icon: "☸️",
            actionType,
          };
        });

        if (!cancelled) {
          setSteps(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          // 控制台打印方便调试，UI 只给一个简单错误文案
          // eslint-disable-next-line no-console
          console.error("Failed to load deployment process", e);
          setError("Failed to load deployment process");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSteps();

    return () => {
      cancelled = true;
    };
  }, [deploymentProcessId]);

  return {
    steps,
    setSteps,
    loading,
    error,
  };
}

// hook：获取 Lifecycle 数据
export function useLifecycle() {
  const [lifecycle, setLifecycle] = useState(defaultLifecycle);

  // 将来可以在这里请求接口，更新 lifecycle
  useEffect(() => {
    setLifecycle(defaultLifecycle);
  }, []);

  return {
    lifecycle,
  };
}

// hook：Step Editor 左侧的步骤列表
export function useEditorSteps() {
  const [steps] = useState<ProcessStep[]>(defaultEditorSteps);

  return {
    steps,
  };
}

export function getInitialTemplate(actionType?: string): StepJson {
  if (actionType === "Octopus.KubernetesDeployIngress") {
    return defaultIngressStepJson;
  }

  return defaultDeploymentStepJson;
}

// hook：根据 actionType 获取对应的 StepJson 模板
export function useStepTemplate(actionType?: string) {
  const [template, setTemplate] = useState<StepJson>(() =>
    getInitialTemplate(actionType)
  );

  useEffect(() => {
    setTemplate(getInitialTemplate(actionType));
  }, [actionType]);

  return template;
}
