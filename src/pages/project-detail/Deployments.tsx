import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Select, Button, Spin } from "antd";
import {
  CheckOutlined,
  MoreOutlined,
  FilterOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { getProjects, ProjectDto } from "pages/apis/project";
import { getChannels, ChannelDto } from "pages/apis/channel";
import { getReleases, ReleaseDto } from "pages/apis/release";
import { getEnvironments, EnvironmentDto } from "pages/apis/environment";

export interface DeploymentItem {
  key: string;
  version: string;
  status: "Success" | "Running" | "Failed" | "Pending";
  time: string;
  operator: string;
}

export interface ChannelData {
  key: string;
  name: string;
  environments: {
    [envKey: string]: DeploymentItem[];
  };
  currentDeployed: {
    [envKey: string]: string;
  };
}

const Deployments: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);

  useEffect(() => {
    if (!projectName) return;
    setLoadingDeployments(true);

    (async () => {
      try {
        // Resolve projectName → projectId
        const projRes = await getProjects({ pageSize: 500 });
        const project = projRes.projects.find(
          (p) => p.slug === projectName || p.name === projectName
        );
        if (!project) return;

        // Fetch channels, releases, and environments in parallel
        const [channelRes, releaseRes, envRes] = await Promise.all([
          getChannels({ pageSize: 500 }),
          getReleases({ projectId: project.id, pageSize: 500 }),
          getEnvironments({ pageSize: 500 }),
        ]);

        // Filter channels for this project
        const projectChannels = channelRes.channels.filter(
          (c) => c.projectId === project.id
        );

        // Build environment name map
        const envNameMap = new Map<number, string>();
        envRes.environments.forEach((e) => envNameMap.set(e.id, e.name));

        // Build channel data from releases
        const currentDeployedIds = new Set(releaseRes.currentDeployedReleaseIds);
        const channelDataList: ChannelData[] = projectChannels.map((ch) => {
          const channelReleases = releaseRes.releases.filter(
            (r) => r.channelId === ch.id
          );

          // Group releases as deployment items
          const environments: { [envKey: string]: DeploymentItem[] } = {};
          const currentDeployed: { [envKey: string]: string } = {};

          channelReleases.forEach((r) => {
            // Use a generic environment key since we don't have per-environment deployment data
            const envKey = "releases";
            if (!environments[envKey]) environments[envKey] = [];
            environments[envKey].push({
              key: String(r.id),
              version: r.version,
              status: currentDeployedIds.has(r.id) ? "Success" : "Pending",
              time: r.assembled
                ? new Date(r.assembled).toLocaleString()
                : "",
              operator: r.lastModifiedBy || "",
            });
            if (currentDeployedIds.has(r.id)) {
              currentDeployed[envKey] = r.version;
            }
          });

          return {
            key: String(ch.id),
            name: ch.name,
            environments,
            currentDeployed,
          };
        });

        setChannels(channelDataList);
      } catch {
        // silently handle
      } finally {
        setLoadingDeployments(false);
      }
    })();
  }, [projectName]);

  // 获取环境标签
  const getEnvironmentLabel = (envKey: string) => {
    const labels: { [key: string]: string } = {
      test: "TEST",
      aut: "AUT",
      prd: "PRD",
      prd1: "PRD1",
      staging: "STAGING",
      production: "PRODUCTION",
    };
    return labels[envKey] || envKey.toUpperCase();
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Success":
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-green-600 text-white">
            <CheckOutlined className="text-base" />
          </div>
        );
      case "Running":
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-blue-500 text-white">
            <LoadingOutlined className="text-base" />
          </div>
        );
      case "Pending":
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-gray-400 text-white">
            <ClockCircleOutlined className="text-base" />
          </div>
        );
      case "Failed":
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded bg-red-500 text-white">
            <span className="text-base font-bold">×</span>
          </div>
        );
      default:
        return null;
    }
  };

  // 过滤要显示的 channels
  const displayChannels =
    selectedChannel === "all"
      ? channels
      : channels.filter((c) => c.key === selectedChannel);

  // 渲染单个 Channel 区块
  const renderChannelSection = (channel: ChannelData) => {
    const envKeys = Object.keys(channel.environments);

    // 收集所有版本并按时间排序
    const allVersions = new Set<string>();
    const deploymentMap = new Map<string, Map<string, DeploymentItem>>();

    Object.entries(channel.environments).forEach(([envKey, deployments]) => {
      deployments.forEach((deployment) => {
        allVersions.add(deployment.version);
        if (!deploymentMap.has(deployment.version)) {
          deploymentMap.set(deployment.version, new Map());
        }
        deploymentMap.get(deployment.version)!.set(envKey, deployment);
      });
    });

    const sortedVersions = Array.from(allVersions);

    return (
      <div key={channel.key} className="mb-12">
        <div className="overflow-x-auto">
          {/* Channel 标题行 */}
          <div className="flex items-center mb-4 min-w-max">
            <div className="w-[280px] shrink-0">
              <span className="font-semibold text-base text-gray-800">
                Channel: {channel.name}
              </span>
            </div>
            {envKeys.map((envKey) => (
              <div key={envKey} className="w-[240px] shrink-0 mr-4">
                <span className="text-gray-500 text-base">
                  {getEnvironmentLabel(envKey)}
                </span>
              </div>
            ))}
          </div>

          {/* 版本行 */}
          <div>
            {sortedVersions.map((version) => {
              const envDeployments = deploymentMap.get(version)!;

              return (
                <div
                  key={version}
                  className="flex items-start py-3 border-t border-gray-100 min-w-max"
                >
                  {/* 版本链接 */}
                  <div className="w-[280px] shrink-0 pr-6 py-1">
                    <a
                      href="#"
                      className="text-blue-600 text-base font-semibold hover:underline break-words leading-6"
                    >
                      {version}
                    </a>
                  </div>

                  {/* 各环境状态 */}
                  {envKeys.map((envKey) => {
                    const deployment = envDeployments.get(envKey);
                    const currentVersion = channel.currentDeployed?.[envKey];
                    const isCurrent = deployment?.version === currentVersion;

                    if (deployment) {
                      return (
                        <div
                          key={envKey}
                          className={`w-[260px] shrink-0 flex items-start gap-3 py-1 px-2 mr-4 rounded-md cursor-pointer hover:bg-gray-100 transition-colors ${!isCurrent ? 'opacity-50' : ''}`}
                        >
                          <div className="mt-1">{getStatusIcon(deployment.status)}</div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className={`text-base text-gray-700 break-words leading-6 ${isCurrent ? 'font-semibold' : ''}`}>
                              {deployment.version}
                            </span>
                            <span className={`text-sm text-gray-400 mt-0.5 ${isCurrent ? 'font-medium' : ''}`}>
                              {deployment.time}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // 没有部署记录时显示 Deploy 按钮
                    return (
                      <div key={envKey} className="w-[240px] shrink-0 py-1 px-2 mr-4">
                        <Button
                          className="border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-500"
                        >
                          Deploy...
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-10 bg-white min-h-screen text-base">
      {/* 顶部标题栏 */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-semibold text-gray-800">Deployments</h2>
        <div className="flex items-center gap-3">
          <Button
            type="primary"
            size="large"
            className="bg-green-600 hover:!bg-green-700 border-green-600"
          >
            Create Release
          </Button>
          <Button type="text" icon={<MoreOutlined />} className="text-gray-500 text-lg" />
        </div>
      </div>

      {/* Channel 列表 */}
      <Spin spinning={loadingDeployments}>
        <div>{displayChannels.map(renderChannelSection)}</div>
      </Spin>
    </div>
  );
};

export default Deployments;
