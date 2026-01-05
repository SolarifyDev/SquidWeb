import React, { useState, useEffect, useMemo } from "react";
import { Select, Button, Spin, Empty, Tag, message } from "antd";
import {
  CheckOutlined,
  MoreOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { GetProjects, ProjectDto } from "pages/apis/project";
import { GetChannels, ChannelDto } from "pages/apis/channel";
import { GetReleases, ReleaseDto, GetReleasesResponseData } from "pages/apis/release";

const { Option } = Select;

const Deployments: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | "all">("all");
  const [releases, setReleases] = useState<ReleaseDto[]>([]);
  const [currentDeployedReleaseIds, setCurrentDeployedReleaseIds] = useState<number[]>([]);

  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingReleases, setLoadingReleases] = useState(false);

  // 加载项目（根据路由里的 projectName 模糊匹配）
  useEffect(() => {
    if (!projectName) {
      return;
    }

    const loadProject = async () => {
      try {
        setLoadingProject(true);
        const res = await GetProjects({ pageIndex: 1, pageSize: 50, keyword: projectName });
        const found = res.projects.find((p) => p.name === projectName) || res.projects[0] || null;
        setProject(found);
      } catch (error) {
        console.error("加载项目失败", error);
        message.error("加载项目失败");
      } finally {
        setLoadingProject(false);
      }
    };

    loadProject();
  }, [projectName]);

  // 加载项目下的渠道
  useEffect(() => {
    if (!project) {
      return;
    }

    const loadChannels = async () => {
      try {
        setLoadingChannels(true);
        const res = await GetChannels({ pageIndex: 1, pageSize: 100 });
        const projectChannels = res.channels.filter((c) => c.projectId === project.id);
        setChannels(projectChannels);

        if (projectChannels.length > 0) {
          setSelectedChannelId(projectChannels[0].id);
        }
      } catch (error) {
        console.error("加载渠道失败", error);
        message.error("加载渠道失败");
      } finally {
        setLoadingChannels(false);
      }
    };

    loadChannels();
  }, [project]);

  // 加载 Release 列表
  useEffect(() => {
    if (!project) {
      return;
    }

    const loadReleases = async () => {
      try {
        setLoadingReleases(true);

        const params: { pageIndex: number; pageSize: number; projectId: number; channelId?: number } = {
          pageIndex: 1,
          pageSize: 50,
          projectId: project.id,
        };

        if (selectedChannelId !== "all") {
          params.channelId = selectedChannelId as number;
        }

        const res: GetReleasesResponseData = await GetReleases(params);
        setReleases(res.releases || []);
        setCurrentDeployedReleaseIds(res.currentDeployedReleaseIds || []);
      } catch (error) {
        console.error("加载 Release 列表失败", error);
        message.error("加载 Release 列表失败");
      } finally {
        setLoadingReleases(false);
      }
    };

    loadReleases();
  }, [project, selectedChannelId]);

  const loading = loadingProject || loadingChannels || loadingReleases;

  const filteredReleases = useMemo(
    () =>
      releases.filter((r) =>
        selectedChannelId === "all" ? true : r.channelId === selectedChannelId,
      ),
    [releases, selectedChannelId],
  );

  const getChannelName = (channelId: number) => {
    return channels.find((c) => c.id === channelId)?.name || `Channel ${channelId}`;
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

      {/* 过滤栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Channel</span>
          <Select
            value={selectedChannelId}
            onChange={setSelectedChannelId}
            style={{ minWidth: 200 }}
            size="middle"
            loading={loadingChannels}
          >
            <Option value="all">All channels</Option>
            {channels.map((c) => (
              <Option key={c.id} value={c.id}>
                {c.name || `Channel ${c.id}`}
              </Option>
            ))}
          </Select>
        </div>

        <Button icon={<FilterOutlined />} className="flex items-center">
          Filters
        </Button>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spin tip="Loading deployments..." />
        </div>
      ) : !project ? (
        <div className="flex items-center justify-center py-20">
          <Empty description="Project not found" />
        </div>
      ) : filteredReleases.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Empty description="No releases found" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReleases.map((release) => {
            const isCurrent = currentDeployedReleaseIds.includes(release.id);

            return (
              <div
                key={release.id}
                className="flex items-center justify-between border border-gray-200 rounded px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href="#"
                      className="text-blue-600 font-semibold text-sm truncate max-w-xs"
                    >
                      {release.version}
                    </a>
                    {isCurrent && (
                      <Tag color="green" icon={<CheckOutlined />}>Current</Tag>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Assembled: {new Date(release.assembled).toLocaleString()} · {getChannelName(release.channelId)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* 预留后续 Operation 按钮位置 */}
                  <Button size="small" className="text-xs">
                    View
                  </Button>
                  <Button size="small" icon={<MoreOutlined />} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Deployments;
