import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button, Select, Spin } from "antd";
import { FilterOutlined, MoreOutlined } from "@ant-design/icons";
import { getProjects } from "pages/apis/project";
import {
  getReleaseLifecycleProgression,
  type ReleaseLifecycleProgressionDto,
} from "pages/apis/release";
import {
  getProjectProgression,
  ProjectProgression,
  ProgressionEnvironment,
  ProgressionChannel,
  ReleaseProgression,
  DeploymentState,
} from "pages/apis/projectProgression";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDeployableEnvironmentIds(
  phases: ReleaseLifecycleProgressionDto["phases"] | null | undefined
): number[] {
  const deployableEnvIds: number[] = [];
  if (!phases?.length) return deployableEnvIds;

  const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const phase of sortedPhases) {
    for (const environment of phase.environments ?? []) {
      if (!environment.canDeploy) continue;
      if (!deployableEnvIds.includes(environment.environmentId)) {
        deployableEnvIds.push(environment.environmentId);
      }
    }
  }

  return deployableEnvIds;
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StateIcon({ state, hasWarnings }: { state: DeploymentState; hasWarnings: boolean }) {
  // Success with warnings → yellow
  if (state === "Success" && hasWarnings) {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
        <path d="M8 2L1 14h14L8 2zm0 3.2l4.2 7.8H3.8L8 5.2zm-.6 2.8v3h1.2V8H7.4zm0 4v1.2h1.2V12H7.4z" />
      </svg>
    );
  }
  switch (state) {
    case "Success":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
          <path d="M6.5 11.5L2.5 7.5l1-1 3 3 6-6 1 1z" />
        </svg>
      );
    case "Failed":
    case "TimedOut":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
          <path d="M12 4.7L11.3 4 8 7.3 4.7 4 4 4.7 7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8z" />
        </svg>
      );
    case "Executing":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white" style={{ animation: "spin 1s linear infinite" }}>
          <path d="M8 2a6 6 0 00-6 6h1.5A4.5 4.5 0 018 3.5V2z" />
        </svg>
      );
    case "Pending":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.5 7.7V4.5H7.5v4.8l3 3 .7-.7L8.5 8.7z" />
        </svg>
      );
    case "Cancelling":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3 9.3-.7.7L8 8.7l-2.3 2.3-.7-.7L7.3 8 5 5.7l.7-.7L8 7.3l2.3-2.3.7.7L8.7 8z" />
        </svg>
      );
    case "Cancelled":
      return (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
          <path d="M11.3 4.7l-6.6 6.6-.7-.7 6.6-6.6.7.7z" />
        </svg>
      );
    default:
      return null;
  }
}

function stateBg(state: DeploymentState, hasWarnings: boolean): string {
  if (state === "Success" && hasWarnings) return "#f59e0b";
  switch (state) {
    case "Success":   return "#22c55e";
    case "Failed":
    case "TimedOut":  return "#ef4444";
    case "Executing": return "#3b82f6";
    case "Pending":   return "#9ca3af";
    case "Cancelling":return "#f97316";
    case "Cancelled": return "#6b7280";
    default:          return "#9ca3af";
  }
}

// ── Deployment status cell ────────────────────────────────────────────────────

function DeploymentCell({
  state,
  hasWarnings,
  version,
  date,
  isCurrent,
}: {
  state: DeploymentState;
  hasWarnings: boolean;
  version: string;
  date: string;
  isCurrent: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 pl-0 pr-5 py-3 w-full h-full cursor-pointer hover:bg-slate-50 transition-colors"
      style={{ opacity: isCurrent ? 1 : 0.45 }}
    >
      <span
        className="inline-flex items-center justify-center rounded w-6 h-6 flex-shrink-0"
        style={{ backgroundColor: stateBg(state, hasWarnings) }}
      >
        <StateIcon state={state} hasWarnings={hasWarnings} />
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-slate-700 truncate leading-snug" title={version}>
          {version}
        </span>
        <span className="text-xs text-slate-400 mt-0.5 truncate">{date}</span>
      </div>
    </div>
  );
}

// ── Channel grid ──────────────────────────────────────────────────────────────

const RELEASE_COL = 260;
const ENV_COL = 260;
const HEADER_H = 70;
const ROW_MIN_H = 70;
const GRID_TRAILING_GAP = 16;

function ChannelGrid({
  channel,
  releases,
  allEnvironments,
  channelEnvIds,
  releaseDeployability,
  basePath,
}: {
  channel: ProgressionChannel;
  releases: ReleaseProgression[];
  allEnvironments: ProgressionEnvironment[];
  channelEnvIds: number[];
  releaseDeployability: Record<number, number[]>;
  basePath: string;
}) {
  // Show only environments belonging to this channel's lifecycle
  const envIdSet = new Set(channelEnvIds);
  const environments = allEnvironments.filter((e) => envIdSet.has(e.id));
  const gridWidth = RELEASE_COL + ENV_COL * environments.length + GRID_TRAILING_GAP;

  if (releases.length === 0) return null;

  return (
    <div
      className="mb-4"
      style={{ overflowX: "auto" }}
    >
      {/* ── Header row ── */}
      <div
        className="flex"
        style={{ width: gridWidth }}
      >
        {/* Channel label cell */}
        <div
          className="shrink-0 flex items-center pl-0 pr-5"
          style={{ width: RELEASE_COL, height: HEADER_H }}
        >
          <span className="text-sm font-semibold text-slate-700">
            Channel: {channel.name}
          </span>
        </div>

        {/* Environment header cells */}
        {environments.map((env) => (
          <div
            key={env.id}
            className="shrink-0 flex items-center pl-0 pr-5"
            style={{ width: ENV_COL, height: HEADER_H }}
          >
            <span className="text-sm font-medium text-slate-700">{env.name}</span>
          </div>
        ))}
      </div>

      {/* ── Release rows ── */}
      {releases.map((item) => (
        <div
          key={item.release.id}
          className="flex border-b border-dashed border-slate-300"
          style={{ width: gridWidth, minHeight: ROW_MIN_H }}
        >
          {/* Release version */}
          <div
            className="shrink-0 flex items-center pl-0 pr-5"
            style={{ width: RELEASE_COL, minHeight: ROW_MIN_H }}
          >
            <Link
              to={`${basePath}/releases/${encodeURIComponent(item.release.version)}`}
              className="text-squid-blue text-base font-medium no-underline hover:no-underline break-all leading-snug"
            >
              {item.release.version}
            </Link>
          </div>

          {/* Environment cells */}
          {environments.map((env) => {
            const deploys = item.deployments[env.id] ?? [];
            const latest = deploys[0];
            const deployableEnvIds = releaseDeployability[item.release.id] ?? [];
            const canDeploy =
              deployableEnvIds.includes(env.id) &&
              (deploys.length === 0 || latest.state !== "Executing");

            return (
              <div
                key={env.id}
                className="shrink-0 flex items-stretch"
                style={{ width: ENV_COL, minHeight: ROW_MIN_H }}
              >
                {latest ? (
                  <Link
                    to={`${basePath}/releases/${encodeURIComponent(item.release.version)}/deployments/${latest.deploymentId}`}
                    className="block w-full h-full text-inherit no-underline hover:no-underline"
                    state={{ environmentId: env.id }}
                    aria-label={`View deployment for ${item.release.version} in ${env.name}`}
                  >
                    <DeploymentCell
                      state={latest.state}
                      hasWarnings={latest.hasWarningsOrErrors}
                      version={latest.releaseVersion}
                      date={formatDate(latest.completedTime ?? latest.created)}
                      isCurrent={latest.isCurrent}
                    />
                  </Link>
                ) : canDeploy ? (
                  <div className="flex items-center pl-0 pr-5 py-3">
                    <Link
                      to={`${basePath}/releases/${encodeURIComponent(item.release.version)}/deployments/create?environmentIds=Environments-${env.id}`}
                      className="inline-flex items-center justify-center h-8 px-3 rounded border border-squid-blue bg-white text-squid-blue text-sm font-medium no-underline hover:bg-blue-50 hover:text-squid-blue"
                    >
                      Deploy...
                    </Link>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Deployments: React.FC = () => {
  const { spaceId, projectName } = useParams<{ spaceId: string; projectName: string }>();
  const navigate = useNavigate();
  const encodedProjectName = encodeURIComponent(projectName ?? '');
  const [loading, setLoading] = useState(false);
  const [progression, setProgression] = useState<ProjectProgression | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [releaseDeployability, setReleaseDeployability] = useState<Record<number, number[]>>({});

  useEffect(() => {
    if (!projectName) return;
    setLoading(true);
    setReleaseDeployability({});

    (async () => {
      try {
        const projRes = await getProjects({ pageSize: 500 });
        const project = projRes.projects.find(
          (p) => p.slug === projectName || p.name === projectName
        );
        if (!project) return;

        const data = await getProjectProgression(project.id);
        setProgression(data);
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    })();
  }, [projectName]);

  // Group releases by channel, preserving assembled-desc order from server
  const channelGroups = useMemo(() => {
    if (!progression) return [];
    const map = new Map<number, { channel: ProgressionChannel; releases: ReleaseProgression[] }>();
    for (const item of progression.releases) {
      if (!item.channel) continue;
      const key = item.channel.id;
      if (!map.has(key)) map.set(key, { channel: item.channel, releases: [] });
      map.get(key)!.releases.push(item);
    }
    return Array.from(map.values());
  }, [progression]);

  const channelOptions = channelGroups.map(({ channel }) => ({
    label: channel.name,
    value: channel.id,
  }));

  const displayGroups =
    selectedChannelId === null
      ? channelGroups
      : channelGroups.filter(({ channel }) => channel.id === selectedChannelId);

  const deployabilityReleaseIds = useMemo(() => {
    const ids = new Set<number>();
    for (const group of displayGroups) {
      for (const item of group.releases) {
        if ((item.nextDeployments ?? []).length === 0) continue;
        if (item.release.id > 0) ids.add(item.release.id);
      }
    }
    return Array.from(ids);
  }, [displayGroups]);

  useEffect(() => {
    if (deployabilityReleaseIds.length === 0) return;

    const pendingIds = deployabilityReleaseIds.filter((id) => releaseDeployability[id] === undefined);
    if (pendingIds.length === 0) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        pendingIds.map(async (releaseId) => {
          const progressionDetail = await getReleaseLifecycleProgression(releaseId).catch(() => null);
          return {
            releaseId,
            deployableEnvIds: getDeployableEnvironmentIds(progressionDetail?.phases),
          };
        }),
      );

      if (cancelled) return;

      setReleaseDeployability((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.releaseId] = item.deployableEnvIds;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [deployabilityReleaseIds, releaseDeployability]);

  return (
    <div className="rounded-xl border border-slate-200 min-h-full overflow-hidden flex flex-col bg-white">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-slate-800 m-0">Deployments</h1>
        <div className="flex items-center gap-1">
          <Button
            type="primary"
            className="!bg-green-600 hover:!bg-green-700 !border-green-600 !font-medium !shadow-none !text-sm"
            onClick={() => navigate(`/${spaceId}/projects/${encodedProjectName}/releases/create`)}
          >
            Create Release
          </Button>
          <Button
            type="text"
            icon={<MoreOutlined />}
            className="!text-slate-500 hover:!text-slate-700"
          />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 px-6 py-3">
        <Select
          style={{ width: 200 }}
          placeholder="Channel"
          variant="borderless"
          allowClear
          value={selectedChannelId ?? undefined}
          onChange={(val) => setSelectedChannelId(val ?? null)}
          options={channelOptions}
        />
        <Button
          type="text"
          icon={<FilterOutlined />}
          className="!text-slate-600 hover:!text-slate-800 !text-sm"
        >
          Show advanced filters
        </Button>
      </div>

      {/* ── Channel grids ── */}
      <div className="flex-1 p-6">
        <Spin spinning={loading}>
          {displayGroups.length > 0 ? (
            displayGroups.map(({ channel, releases }) => (
              <ChannelGrid
                key={channel.id}
                channel={channel}
                releases={releases}
                allEnvironments={progression!.environments}
                channelEnvIds={progression!.channelEnvironments[channel.id] ?? []}
                releaseDeployability={releaseDeployability}
                basePath={`/${spaceId}/projects/${encodedProjectName}`}
              />
            ))
          ) : (
            !loading && (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                No deployments found.
              </div>
            )
          )}
        </Spin>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Deployments;
