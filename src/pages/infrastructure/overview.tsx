import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Spin, message } from 'antd';
import PageContainer from 'components/PageContainer';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  CloseCircleFilled,
  KeyOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';
import { EnvironmentDto, getEnvironments } from 'pages/apis/environment';
import { CertificateDto, getCertificates } from 'pages/apis/certificate';
import { DeploymentAccountDto, getDeploymentAccounts } from 'pages/apis/deploymentAccount';
import { ExternalFeedDto, getExternalFeeds } from 'pages/apis/externalFeed';
import { getMachines, MachineDto } from 'pages/apis/machine';
import { getTargetTags, TargetTagDto } from 'pages/apis/targetTag';

interface OverviewDataset {
  environments: EnvironmentDto[];
  machines: MachineDto[];
  targetTags: TargetTagDto[];
  deploymentAccounts: DeploymentAccountDto[];
  externalFeeds: ExternalFeedDto[];
  certificates: CertificateDto[];
}

interface OverviewCardProps {
  title: string;
  linkTo: string;
  count: number;
  children: React.ReactNode;
}

const accountTypeLabel: Record<number, string> = {
  1: 'Username/Password',
  2: 'SSH Key Pair',
  3: 'Token',
  4: 'Azure Subscription',
  5: 'Azure Service Principal',
  6: 'AWS Account',
  7: 'AWS Role',
  8: 'Client Certificate',
  9: 'Azure OIDC',
  10: 'Google Cloud',
  11: 'AWS OIDC',
  12: 'OpenClaw Gateway',
};

const targetTypeLabel: Record<string, string> = {
  KubernetesApi: 'Kubernetes API',
  KubernetesAgent: 'Kubernetes Agent',
  OpenClaw: 'OpenClaw',
  TentacleActive: 'Polling Tentacle',
  TentaclePolling: 'Polling Tentacle',
  TentaclePassive: 'Listening Tentacle',
  TentacleListening: 'Listening Tentacle',
  Ssh: 'SSH Connection',
};

type MachineResolvedHealthState = 'Healthy' | 'Unhealthy' | 'Unavailable' | 'Unknown' | 'Disabled';
type TargetStatusRowName = 'Healthy' | 'Disabled';

function parseCommunicationStyle(endpoint: string): string {
  try {
    const parsed = JSON.parse(endpoint) as { CommunicationStyle?: string } | null;
    return parsed?.CommunicationStyle?.trim() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function resolveMachineHealthState(machine: MachineDto): MachineResolvedHealthState {
  if (machine.isDisabled) return 'Disabled';

  const rawValue = machine.healthStatus ?? machine.HealthStatus ?? null;
  if (rawValue === null || rawValue === undefined) return 'Unknown';

  if (typeof rawValue === 'number') {
    if (rawValue === 1) return 'Healthy';
    if (rawValue === 2) return 'Unhealthy';
    if (rawValue === 3) return 'Unavailable';
    if (rawValue === 4) return 'Disabled';
    return 'Unknown';
  }

  if (typeof rawValue === 'boolean') return rawValue ? 'Healthy' : 'Unhealthy';

  const normalized = String(rawValue).trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized.includes('disabled')) return 'Disabled';
  if (normalized.includes('unavailable')) return 'Unavailable';
  if (
    normalized.includes('unhealthy')
    || normalized.includes('warning')
    || normalized.includes('warn')
    || normalized.includes('fail')
    || normalized.includes('error')
  ) {
    return 'Unhealthy';
  }
  if (normalized.includes('healthy') || normalized.includes('success') || normalized.includes('ok')) return 'Healthy';
  return 'Unknown';
}

function normalizeTagName(roleRaw: string, byId: Map<string, string>, byName: Map<string, string>): string | null {
  const role = roleRaw.trim();
  if (!role) return null;

  const directIdMatch = byId.get(role);
  if (directIdMatch) return directIdMatch;

  const directNameMatch = byName.get(role.toLowerCase());
  if (directNameMatch) return directNameMatch;

  return null;
}

function OverviewCard({ title, linkTo, count, children }: OverviewCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[320px] flex flex-col">
      <div className="bg-slate-700 px-4 py-3 text-white">
        <Link to={linkTo} className="text-white hover:text-blue-100 font-semibold text-[15px]">
          {title} <span className="text-slate-200">({count})</span>
        </Link>
      </div>
      <div className="px-4 py-3 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function CardFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filter..."
      prefix={<SearchOutlined className="text-slate-400" />}
      className="mb-3"
      allowClear
    />
  );
}

function SummaryRow({
  icon,
  label,
  to,
  rightText,
  labelClassName,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  rightText: string;
  labelClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
      <span className="w-5 text-slate-500 flex items-center justify-center">{icon}</span>
      <Link to={to} className={`flex-1 truncate hover:text-squid-blue ${labelClassName ?? 'text-slate-700'}`}>
        {label}
      </Link>
      <span className="text-slate-500 text-sm">{rightText}</span>
    </div>
  );
}

const InfrastructureOverviewPage: React.FC = () => {
  const { space } = useSpace();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<OverviewDataset>({
    environments: [],
    machines: [],
    targetTags: [],
    deploymentAccounts: [],
    externalFeeds: [],
    certificates: [],
  });
  const [envFilter, setEnvFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [certificateFilter, setCertificateFilter] = useState('');

  const paths = useMemo(() => {
    const base = `/${space.slug}`;
    return {
      environments: `${base}/environments`,
      deploymentTargets: `${base}/deployment/targets`,
      deploymentAccounts: `${base}/infrastructure/accounts`,
      externalFeeds: `${base}/external/feeds`,
      certificates: `${base}/library/certificates`,
    };
  }, [space.slug]);

  const loadOverviewData = useCallback(async () => {
    setLoading(true);
    const [envRes, machineRes, targetTagRes, accountRes, externalFeedRes, certificateRes] = await Promise.allSettled([
      getEnvironments({ pageSize: 1000, spaceId: space.id }),
      getMachines({ pageSize: 1000, spaceId: space.id }),
      getTargetTags(),
      getDeploymentAccounts({ pageSize: 1000, spaceId: space.id }),
      getExternalFeeds({ pageSize: 1000, spaceId: space.id }),
      getCertificates({ pageSize: 1000, spaceId: space.id }),
    ]);

    const hasFailed = [envRes, machineRes, targetTagRes, accountRes, externalFeedRes, certificateRes].some((result) => result.status === 'rejected');
    if (hasFailed) message.warning('Some overview data could not be loaded. Partial results are shown.');

    setDataset({
      environments: envRes.status === 'fulfilled' ? envRes.value.environments : [],
      machines: machineRes.status === 'fulfilled' ? machineRes.value.machines : [],
      targetTags: targetTagRes.status === 'fulfilled' ? targetTagRes.value.targetTags : [],
      deploymentAccounts: accountRes.status === 'fulfilled' ? accountRes.value.deploymentAccounts : [],
      externalFeeds: externalFeedRes.status === 'fulfilled' ? externalFeedRes.value.externalFeeds : [],
      certificates: certificateRes.status === 'fulfilled' ? certificateRes.value.certificates : [],
    });
    setLoading(false);
  }, [space.id]);

  useEffect(() => {
    if (!space?.id) return;
    loadOverviewData().catch((error) => {
      console.error('Failed to load infrastructure overview data', error);
      message.error('Failed to load infrastructure overview');
      setLoading(false);
    });
  }, [space?.id, loadOverviewData]);

  const environmentRows = useMemo(() => {
    const counts = new Map<number, number>();
    dataset.machines.forEach((machine) => {
      (machine.environmentIds ?? []).forEach((environmentId) => {
        counts.set(environmentId, (counts.get(environmentId) ?? 0) + 1);
      });
    });

    const normalizedFilter = envFilter.trim().toLowerCase();
    return dataset.environments
      .filter((environment) => !normalizedFilter || environment.name.toLowerCase().includes(normalizedFilter))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((environment) => ({
        id: environment.id,
        name: environment.name,
        count: counts.get(environment.id) ?? 0,
      }));
  }, [dataset.environments, dataset.machines, envFilter]);

  const deploymentTargetRows = useMemo(() => {
    const styleCount = new Map<string, number>();
    dataset.machines.forEach((machine) => {
      const style = parseCommunicationStyle(machine.endpoint);
      const label = targetTypeLabel[style] ?? style;
      styleCount.set(label, (styleCount.get(label) ?? 0) + 1);
    });

    return Array.from(styleCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  }, [dataset.machines]);

  const targetStatusRows = useMemo(() => {
    let healthyCount = 0;
    let disabledCount = 0;
    dataset.machines.forEach((machine) => {
      if (machine.isDisabled) {
        disabledCount += 1;
        return;
      }
      if (resolveMachineHealthState(machine) === 'Healthy') healthyCount += 1;
    });

    return [
      { name: 'Healthy' as TargetStatusRowName, count: healthyCount },
      { name: 'Disabled' as TargetStatusRowName, count: disabledCount },
    ];
  }, [dataset.machines]);

  const targetTagRows = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    const tagCount = new Map<string, number>();

    dataset.targetTags.forEach((tag) => {
      byId.set(String(tag.id), tag.name);
      byName.set(tag.name.toLowerCase(), tag.name);
      tagCount.set(tag.name, 0);
    });

    dataset.machines.forEach((machine) => {
      const matchedTags = new Set<string>();
      (machine.roles ?? []).forEach((roleRaw) => {
        const normalized = normalizeTagName(roleRaw, byId, byName);
        if (normalized) matchedTags.add(normalized);
      });
      matchedTags.forEach((tagName) => tagCount.set(tagName, (tagCount.get(tagName) ?? 0) + 1));
    });

    const normalizedFilter = tagFilter.trim().toLowerCase();
    return dataset.targetTags
      .filter((tag) => !normalizedFilter || tag.name.toLowerCase().includes(normalizedFilter))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tag) => ({ name: tag.name, count: tagCount.get(tag.name) ?? 0 }));
  }, [dataset.machines, dataset.targetTags, tagFilter]);

  const deploymentAccountRows = useMemo(() => {
    const normalizedFilter = accountFilter.trim().toLowerCase();
    return dataset.deploymentAccounts
      .filter((account) => !normalizedFilter || account.name.toLowerCase().includes(normalizedFilter))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((account) => ({
        id: account.id,
        name: account.name,
        typeLabel: accountTypeLabel[account.accountType] ?? `Type ${account.accountType}`,
      }));
  }, [dataset.deploymentAccounts, accountFilter]);

  const externalFeedRows = useMemo(() => {
    const normalizedFilter = feedFilter.trim().toLowerCase();
    return dataset.externalFeeds
      .filter((feed) => !normalizedFilter || feed.name.toLowerCase().includes(normalizedFilter))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((feed) => ({ id: feed.id, name: feed.name, type: feed.feedType }));
  }, [dataset.externalFeeds, feedFilter]);

  const certificateRows = useMemo(() => {
    const normalizedFilter = certificateFilter.trim().toLowerCase();
    return dataset.certificates
      .filter((certificate) => !normalizedFilter || certificate.name.toLowerCase().includes(normalizedFilter))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((certificate) => ({
        id: certificate.id,
        name: certificate.name,
        isExpired: certificate.isExpired,
        statusText: certificate.isExpired ? 'Expired' : 'Valid',
      }));
  }, [dataset.certificates, certificateFilter]);

  const statusIcon = (status: TargetStatusRowName) => {
    if (status === 'Healthy') return <CheckCircleFilled className="text-green-600" />;
    return <CloseCircleFilled className="text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900 m-0">Overview</h1>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
          <OverviewCard title="Environments" linkTo={paths.environments} count={dataset.environments.length}>
            <CardFilter value={envFilter} onChange={setEnvFilter} />
            <div className="overflow-y-auto max-h-[420px]">
              {environmentRows.map((row) => (
                <SummaryRow
                  key={row.id}
                  icon={<AppstoreOutlined />}
                  label={row.name}
                  to={paths.environments}
                  rightText={String(row.count)}
                />
              ))}
              {environmentRows.length === 0 && <div className="text-sm text-slate-400 py-2">No environments</div>}
            </div>
            <Link to={paths.environments} className="mt-auto pt-3 text-sm font-medium text-squid-blue">
              {environmentRows.length} Results
            </Link>
          </OverviewCard>

          <OverviewCard title="Deployment Targets" linkTo={paths.deploymentTargets} count={dataset.machines.length}>
            <div className="overflow-y-auto max-h-[420px]">
              {deploymentTargetRows.map((row) => (
                <SummaryRow
                  key={row.name}
                  icon={<CloudServerOutlined />}
                  label={row.name}
                  to={paths.deploymentTargets}
                  rightText={String(row.count)}
                />
              ))}
              {deploymentTargetRows.length === 0 && <div className="text-sm text-slate-400 py-2">No deployment targets</div>}
            </div>
          </OverviewCard>

          <OverviewCard title="Target Status" linkTo={paths.deploymentTargets} count={targetStatusRows.length}>
            <div className="overflow-y-auto max-h-[420px]">
              {targetStatusRows.map((row) => (
                <SummaryRow
                  key={row.name}
                  icon={statusIcon(row.name)}
                  label={row.name}
                  to={paths.deploymentTargets}
                  rightText={String(row.count)}
                />
              ))}
              {targetStatusRows.length === 0 && <div className="text-sm text-slate-400 py-2">No status data</div>}
            </div>
          </OverviewCard>

          <OverviewCard title="Target Tags" linkTo={paths.deploymentTargets} count={dataset.targetTags.length}>
            <CardFilter value={tagFilter} onChange={setTagFilter} />
            <div className="overflow-y-auto max-h-[420px]">
              {targetTagRows.map((row) => (
                <SummaryRow
                  key={row.name}
                  icon={<TagOutlined />}
                  label={row.name}
                  to={paths.deploymentTargets}
                  rightText={String(row.count)}
                />
              ))}
              {targetTagRows.length === 0 && <div className="text-sm text-slate-400 py-2">No target tags</div>}
            </div>
            <Link to={paths.deploymentTargets} className="mt-auto pt-3 text-sm font-medium text-squid-blue">
              {targetTagRows.length} Results
            </Link>
          </OverviewCard>

          <OverviewCard title="Deployment Accounts" linkTo={paths.deploymentAccounts} count={dataset.deploymentAccounts.length}>
            <CardFilter value={accountFilter} onChange={setAccountFilter} />
            <div className="overflow-y-auto max-h-[420px]">
              {deploymentAccountRows.map((row) => (
                <SummaryRow
                  key={row.id}
                  icon={<KeyOutlined />}
                  label={row.name}
                  to={paths.deploymentAccounts}
                  rightText={row.typeLabel}
                />
              ))}
              {deploymentAccountRows.length === 0 && <div className="text-sm text-slate-400 py-2">No deployment accounts</div>}
            </div>
            <Link to={paths.deploymentAccounts} className="mt-auto pt-3 text-sm font-medium text-squid-blue">
              {deploymentAccountRows.length} Results
            </Link>
          </OverviewCard>

          <OverviewCard title="External Feeds" linkTo={paths.externalFeeds} count={dataset.externalFeeds.length}>
            <CardFilter value={feedFilter} onChange={setFeedFilter} />
            <div className="overflow-y-auto max-h-[420px]">
              {externalFeedRows.map((row) => (
                <SummaryRow
                  key={row.id}
                  icon={<LinkOutlined />}
                  label={row.name}
                  to={paths.externalFeeds}
                  rightText={row.type}
                />
              ))}
              {externalFeedRows.length === 0 && <div className="text-sm text-slate-400 py-2">No external feeds</div>}
            </div>
            <Link to={paths.externalFeeds} className="mt-auto pt-3 text-sm font-medium text-squid-blue">
              {externalFeedRows.length} Results
            </Link>
          </OverviewCard>

          <OverviewCard title="Certificates" linkTo={paths.certificates} count={dataset.certificates.length}>
            <CardFilter value={certificateFilter} onChange={setCertificateFilter} />
            <div className="overflow-y-auto max-h-[420px]">
              {certificateRows.map((row) => (
                <SummaryRow
                  key={row.id}
                  icon={<SafetyCertificateOutlined />}
                  label={row.name}
                  to={paths.certificates}
                  rightText={row.statusText}
                  labelClassName={row.isExpired ? 'text-red-600' : 'text-slate-700'}
                />
              ))}
              {certificateRows.length === 0 && <div className="text-sm text-slate-400 py-2">No certificates</div>}
            </div>
            <Link to={paths.certificates} className="mt-auto pt-3 text-sm font-medium text-squid-blue">
              {certificateRows.length} Results
            </Link>
          </OverviewCard>
            </div>
          </div>
        </div>
    </PageContainer>
  );
};

export default InfrastructureOverviewPage;
