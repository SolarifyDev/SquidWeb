import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Modal, Alert, Spin } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { useProcessSteps, useLifecycle } from "./data";
import type { ProcessStep, LifecycleEnv } from "./constraints";

function Process() {
  const navigate = useNavigate();
  const location = useLocation();

  const [filterText, setFilterText] = useState("");
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);

  // 从 URL 查询参数里读取 deploymentProcessId，例如：
  // /project/demo/project-detail/process?deploymentProcessId=1
  const searchParams = new URLSearchParams(location.search);
  const deploymentProcessIdParam = searchParams.get("deploymentProcessId");
  const deploymentProcessId = deploymentProcessIdParam
    ? Number(deploymentProcessIdParam)
    : undefined;

  // 后续接入接口时，只需要在 useProcessSteps/useLifecycle 内部改为请求数据即可
  const { steps, setSteps, loading, error } = useProcessSteps(
    Number.isFinite(deploymentProcessId) ? deploymentProcessId : undefined
  );
  const { lifecycle } = useLifecycle();

  const handleAddTemplate = (actionType: string) => {
    // 根据模板新增一个空的 step，然后跳转到对应 editor
    const nextOrder = steps.length + 1;
    const newKey = String(nextOrder);

    const base: Pick<ProcessStep, "name" | "description"> =
      actionType === "Octopus.KubernetesDeployIngress"
        ? {
            name: "Deploy ingress",
            description: "Deploy an ingress resource to Kubernetes",
          }
        : {
            name: "Deploy Kubernetes YAML",
            description:
              "Deploy Kubernetes YAML files to your Kubernetes cluster.",
          };

    const newStep: ProcessStep = {
      key: newKey,
      order: nextOrder,
      name: base.name,
      description: base.description,
      icon: "☸️",
      actionType,
    };

    setSteps((prev) => [...prev, newStep]);

    navigate(
      `${newKey}/editor?actionType=${encodeURIComponent(actionType)}`
    );
    setIsAddStepModalOpen(false);
  };

  const filteredSteps = steps.filter(
    (step) =>
      step.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (step.description || "")
        .toLowerCase()
        .includes(filterText.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* 左侧主内容区 */}
      <div className="flex-1 p-8">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Process</h1>
          <div className="flex items-center gap-3">
            <Button className="border-blue-500 text-blue-500 hover:bg-blue-50">
              Create Release
            </Button>
            <Button
              className="border-blue-500 text-blue-500 hover:bg-blue-50"
              onClick={() => setIsAddStepModalOpen(true)}
            >
              Add Step
            </Button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4">
            <Alert
              type="error"
              message="Failed to load deployment process steps"
              description={error}
              showIcon
            />
          </div>
        )}

        {/* 筛选栏 */}
        <div className="flex items-center gap-4 mb-6">
          <Input
            placeholder="Filter by name..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-48"
            style={{ height: 36 }}
          />
          <Button
            type="link"
            icon={<FilterOutlined />}
            className="text-blue-600 p-0 flex items-center gap-1"
          >
            Show advanced filters
          </Button>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-4">
          <Spin spinning={loading}>
            {filteredSteps.map((step) => (
              <div
                key={step.key}
                onClick={() =>
                  navigate(
                    `${step.key}/editor?actionType=${encodeURIComponent(
                      step.actionType
                    )}`
                  )
                }
                className="flex items-start gap-4 py-4 border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors -mx-2 px-2 rounded"
              >
                {/* 图标 */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-2xl shrink-0">
                  {step.icon}
                </div>
                {/* 内容 */}
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 text-base">{step.order}.</span>
                    <span className="text-blue-600 font-semibold text-base hover:underline">
                      {step.name}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </Spin>
        </div>
      </div>

      {/* 右侧边栏 */}
      <div className="w-64 border-l border-gray-200 p-6">
        {/* Lifecycle 区块 */}
        <div className="mb-8">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Lifecycle
          </h3>
          <div className="flex items-center justify-between mb-3">
            <a href="#" className="text-blue-600 hover:underline">
              {lifecycle.name}
            </a>
            <Button size="small" className="border-gray-300 text-gray-600">
              Change
            </Button>
          </div>
          <div className="space-y-2">
            {lifecycle.environments.map((env: LifecycleEnv) => (
              <div key={env.key} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-gray-400" />
                <span className="text-gray-700 text-sm">{env.name}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-xs mt-3">
            Lifecycles can be defined{" "}
            <a href="#" className="text-blue-600 hover:underline">
              here
            </a>
          </p>
        </div>

        {/* Script Modules 区块 */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Script Modules
          </h3>
          <p className="text-gray-500 text-sm mb-2">
            No script modules have been included
          </p>
          <p className="text-gray-400 text-xs mb-3">
            Modules can be created{" "}
            <a href="#" className="text-blue-600 hover:underline">
              here
            </a>
          </p>
          <Button size="small" className="border-blue-500 text-blue-500">
            Include
          </Button>
        </div>
      </div>

      <Modal
        title="Add Step Template"
        open={isAddStepModalOpen}
        footer={null}
        onCancel={() => setIsAddStepModalOpen(false)}
        width={720}
      >
        <div className="mb-4">
          <Input
            placeholder="Filter by name, category or description..."
            prefix={<SearchOutlined className="text-gray-400" />}
            size="small"
          />
        </div>

        <div className="space-y-4">
          {/* Deploy Kubernetes YAML */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-2xl shrink-0">
                ☸️
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">
                  Deploy Kubernetes YAML
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Source YAML files from a Git repository or package and apply
                  them to your Kubernetes cluster.
                </div>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 mb-3">
                  <li>Source YAML files from a Git repository or package</li>
                  <li>Apply to your Kubernetes cluster</li>
                </ul>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    handleAddTemplate("Octopus.KubernetesDeployContainers")
                  }
                >
                  Add Step
                </Button>
              </div>
            </div>
          </div>

          {/* Configure and apply a Kubernetes Ingress */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-2xl shrink-0">
                ☸️
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">
                  Configure and apply a Kubernetes Ingress
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Configure and deploy an Ingress resource to route external
                  traffic to services in your Kubernetes cluster.
                </div>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 mb-3">
                  <li>Configure Kubernetes Ingress resource</li>
                  <li>Apply ingress rules to expose your services</li>
                </ul>
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    handleAddTemplate("Octopus.KubernetesDeployIngress")
                  }
                >
                  Add Step
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Process;
