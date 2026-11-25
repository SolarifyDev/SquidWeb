import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Select, InputNumber, Checkbox, Spin, Modal, message, Dropdown, Radio } from 'antd';
import { SearchOutlined, PlusOutlined, DownOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import PageContainer from 'components/PageContainer';
import {
  getExternalFeeds,
  createExternalFeed,
  updateExternalFeed,
  testExternalFeed,
  deleteExternalFeed,
  ExternalFeedDto,
  CreateExternalFeedCommand,
  UpdateExternalFeedCommand,
} from 'pages/apis/externalFeed';
import { useSpace } from 'contexts/SpaceContext';
import { useNavigate } from 'react-router-dom';
import { isBuiltInFeedType } from 'pages/apis/builtInPackages';

const { Password } = Input;

// ── Feed type meta ────────────────────────────────────────────────────────────

const feedTypeMeta: Record<string, { label: string; abbrev: string; color: string }> = {
  'Docker': { label: 'Docker Container Registry', abbrev: 'Dk', color: '#2563eb' },
  'Docker Container Registry': { label: 'Docker Container Registry', abbrev: 'Dk', color: '#2563eb' },
  'AWS Elastic Container Registry': { label: 'AWS Elastic Container Registry', abbrev: 'ECR', color: '#d97706' },
  'AWS ECR Feed': { label: 'AWS Elastic Container Registry', abbrev: 'ECR', color: '#d97706' },
  'Azure Container Registry': { label: 'Azure Container Registry', abbrev: 'ACR', color: '#0284c7' },
  'Google Container Registry': { label: 'Google Container Registry', abbrev: 'GCR', color: '#0ea5e9' },
  'OCI Registry': { label: 'OCI Registry Feed', abbrev: 'OCI', color: '#0891b2' },
  'OCI Registry Feed': { label: 'OCI Registry Feed', abbrev: 'OCI', color: '#0891b2' },
  'GitHub': { label: 'GitHub Repository Feed', abbrev: 'GH', color: '#1f2937' },
  'GitHub Repository Feed': { label: 'GitHub Repository Feed', abbrev: 'GH', color: '#1f2937' },
  'GitHub Container Registry': { label: 'GitHub Repository Feed', abbrev: 'GH', color: '#1f2937' },
  'Helm': { label: 'Helm Feed', abbrev: 'Hm', color: '#0891b2' },
  'Helm Feed': { label: 'Helm Feed', abbrev: 'Hm', color: '#0891b2' },
  'NuGet': { label: 'NuGet Feed', abbrev: 'Nu', color: '#6366f1' },
  'NuGet Feed': { label: 'NuGet Feed', abbrev: 'Nu', color: '#6366f1' },
  'Maven': { label: 'Maven Feed', abbrev: 'Mv', color: '#ea580c' },
  'Maven Feed': { label: 'Maven Feed', abbrev: 'Mv', color: '#ea580c' },
  'BuiltIn': { label: 'Squid packages', abbrev: 'Sq', color: '#0f766e' },
  'Artifactory Generic Feed': { label: 'Artifactory Generic Feed', abbrev: 'Ar', color: '#9333ea' },
  'AWS S3 Bucket Feed': { label: 'AWS S3 Bucket Feed', abbrev: 'S3', color: '#ca8a04' },
};

function getFeedMeta(feedType: string) {
  return feedTypeMeta[feedType] ?? { label: feedType, abbrev: feedType.slice(0, 2).toUpperCase(), color: '#6b7280' };
}

const feedTypeOptions = [
  { value: 'Docker Container Registry', label: 'Docker Container Registry' },
  { value: 'AWS Elastic Container Registry', label: 'AWS Elastic Container Registry' },
  { value: 'Azure Container Registry', label: 'Azure Container Registry' },
  { value: 'Google Container Registry', label: 'Google Container Registry' },
  { value: 'OCI Registry', label: 'OCI Registry Feed' },
  { value: 'GitHub Repository Feed', label: 'GitHub Repository Feed' },
  { value: 'Helm Feed', label: 'Helm Feed' },
  { value: 'NuGet Feed', label: 'NuGet Feed' },
  { value: 'Maven Feed', label: 'Maven Feed' },
  { value: 'Artifactory Generic Feed', label: 'Artifactory Generic Feed' },
  { value: 'AWS S3 Bucket Feed', label: 'AWS S3 Bucket Feed' },
];

const apiVersionOptions = [
  { value: '', label: 'Auto Detect' },
  { value: 'v1', label: 'v1' },
  { value: 'v2', label: 'v2' },
];

type FeedCredentialType = 'Anonymous Access' | 'Username and Password' | 'Token' | 'Google Cloud Json Key';

const githubRepositoryCredentialTypeOptions: Array<{ value: FeedCredentialType; label: string }> = [
  { value: 'Anonymous Access', label: 'Anonymous Access' },
  { value: 'Username and Password', label: 'Username and Password' },
  { value: 'Token', label: 'Token' },
];

const dockerRegistryCredentialTypeOptions: Array<{ value: FeedCredentialType; label: string }> = [
  { value: 'Anonymous Access', label: 'Anonymous Access' },
  { value: 'Username and Password', label: 'Username and Password' },
  { value: 'Google Cloud Json Key', label: 'Google Cloud Json Key' },
];

function isContainerRegistryFeedType(feedType: string) {
  const containerKeywords = ['Docker', 'Container Registry', 'OCI', 'ACR', 'GCR'];
  return containerKeywords.some((keyword) => feedType.includes(keyword));
}

function isDockerContainerRegistryFeedType(feedType: string) {
  return feedType === 'Docker Container Registry' || feedType === 'Docker';
}

function isNuGetFeedType(feedType: string) {
  return feedType === 'NuGet Feed' || feedType === 'NuGet';
}

function isGitHubRepositoryFeedType(feedType: string) {
  return feedType === 'GitHub Repository Feed' || feedType === 'GitHub' || feedType === 'GitHub Container Registry';
}

function isAwsEcrFeedType(feedType: string) {
  return feedType === 'AWS Elastic Container Registry' || feedType === 'AWS ECR Feed';
}

function isAwsS3BucketFeedType(feedType: string) {
  return feedType === 'AWS S3 Bucket Feed';
}

function isAzureContainerRegistryFeedType(feedType: string) {
  return feedType === 'Azure Container Registry';
}

function isGoogleContainerRegistryFeedType(feedType: string) {
  return feedType === 'Google Container Registry';
}

type FeedCategory = 'containerRegistry' | 'ecr' | 'nuget' | 'downloadRetry' | 'none';

function getFeedCategory(feedType: string): FeedCategory {
  if (isAwsEcrFeedType(feedType) || feedType === 'ECR') return 'ecr';
  if (isContainerRegistryFeedType(feedType)) return 'containerRegistry';
  if (isNuGetFeedType(feedType)) return 'nuget';
  if (feedType.includes('Maven') || feedType.includes('GitHub')) return 'downloadRetry';
  return 'none';
}

function getDefaultFeedUrl(feedType: string) {
  if (feedType === 'Docker Container Registry') return 'https://index.docker.io';
  if (feedType === 'AWS Elastic Container Registry') return 'https://{accountId}.dkr.ecr.{region}.amazonaws.com';
  if (feedType === 'Azure Container Registry') return 'https://{name}.azurecr.io';
  if (feedType === 'Google Container Registry') return 'https://gcr.io';
  if (feedType === 'GitHub Repository Feed' || feedType === 'GitHub' || feedType === 'GitHub Container Registry') return 'https://api.github.com';
  if (isNuGetFeedType(feedType)) return 'https://api.nuget.org/v3/index.json';
  if (feedType.includes('Maven')) return 'https://repo1.maven.org/maven2';
  return '';
}

function inferCredentialType(feedType: string, feed?: ExternalFeedDto): FeedCredentialType {
  if (!feed) return 'Anonymous Access';
  const username = feed.username?.trim() ?? '';
  if (isGitHubRepositoryFeedType(feedType) && !username) return feed.passwordHasValue ? 'Token' : 'Anonymous Access';
  if (isDockerContainerRegistryFeedType(feedType) && username === '_json_key') return 'Google Cloud Json Key';
  if (!username) return feed.passwordHasValue ? 'Username and Password' : 'Anonymous Access';
  return 'Username and Password';
}

function getFeedProperty(feed: ExternalFeedDto | undefined, key: string): string {
  if (!feed?.properties) return '';
  if (feed.properties[key] != null) return String(feed.properties[key]);
  const lower = key.toLowerCase();
  const match = Object.entries(feed.properties).find(([propertyKey]) => propertyKey.toLowerCase() === lower);
  return match ? String(match[1]) : '';
}

function toSafeNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanString(value: string, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function inferEcrRegion(feed: ExternalFeedDto | undefined): string {
  if (!feed) return '';
  const fromProperties = getFeedProperty(feed, 'Region').trim();
  if (fromProperties) return fromProperties;
  const uri = feed.feedUri?.trim() ?? '';
  const match = uri.match(/\.ecr\.([a-z0-9-]+)\.amazonaws\.com/i);
  return match?.[1] ?? '';
}

interface FeedPanelVisibility {
  showUrlPanel: boolean;
  showContainerRegistrySettings: boolean;
  showRetryAttempts: boolean;
  showNuGetSettings: boolean;
  showGenericCredentialsPanel: boolean;
  showAwsWorkerCredentialsPanel: boolean;
  showAwsAccessKeyPanel: boolean;
  showAwsSecretKeyPanel: boolean;
  showAwsRegionPanel: boolean;
}

function buildFeedPanelKeys(visibility: FeedPanelVisibility): string[] {
  return [
    'feedtype',
    'name',
    ...(visibility.showUrlPanel ? ['url'] : []),
    ...(visibility.showContainerRegistrySettings ? ['containerregistry'] : []),
    ...(visibility.showRetryAttempts ? ['retry'] : []),
    ...(visibility.showNuGetSettings ? ['nuget'] : []),
    ...(visibility.showAwsWorkerCredentialsPanel ? ['workercredentials'] : []),
    ...(visibility.showAwsAccessKeyPanel ? ['accesskey'] : []),
    ...(visibility.showAwsSecretKeyPanel ? ['secretkey'] : []),
    ...(visibility.showAwsRegionPanel ? ['region'] : []),
    ...(visibility.showGenericCredentialsPanel ? ['credentials'] : []),
  ];
}

const toFeedSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'external-feed';

// ── Feed type icon ────────────────────────────────────────────────────────────

function FeedTypeIcon({ feedType }: { feedType: string }) {
  const meta = getFeedMeta(feedType);
  return (
    <div
      className="flex items-center justify-center w-9 h-9 rounded flex-shrink-0 text-white text-xs font-bold select-none"
      style={{ backgroundColor: meta.color }}
    >
      {meta.abbrev}
    </div>
  );
}

// ── Collapsible form panel ────────────────────────────────────────────────────

interface FormPanelProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  hasBorder?: boolean;
  children: React.ReactNode;
}

function FormPanel({ title, description, isOpen, onToggle, hasBorder = true, children }: FormPanelProps) {
  return (
    <div style={hasBorder ? { borderBottom: '1px solid #e5e7eb' } : {}}>
      <div
        className="grid items-start py-4 pl-6 pr-10 cursor-pointer select-none"
        style={{ gridTemplateColumns: '220px 1fr' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className="flex items-start justify-between gap-4">
          {description && <div className="text-sm text-gray-500 flex-1">{description}</div>}
          <DownOutlined
            style={{ fontSize: 11 }}
            className={`text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {isOpen && (
        <div
          className="grid pl-6 pr-10 pb-5"
          style={{ gridTemplateColumns: '220px 1fr' }}
        >
          <div />
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Create / Edit form ────────────────────────────────────────────────────────

interface FeedFormProps {
  spaceId: number;
  feed?: ExternalFeedDto;       // undefined = create, defined = edit
  onBack: () => void;
  onSaved: () => void;
}

function FeedForm({ spaceId, feed, onBack, onSaved }: FeedFormProps) {
  const initialFeedType = feed?.feedType ?? 'Docker Container Registry';
  const isEdit = !!feed;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialFeedCategory = getFeedCategory(initialFeedType);
  const initialIsContainerRegistryFeed = initialFeedCategory === 'containerRegistry';
  const initialIsEcrFeed = initialFeedCategory === 'ecr';
  const initialIsNuGetFeed = initialFeedCategory === 'nuget';
  const initialShowRetryAttempts = initialFeedCategory === 'downloadRetry' || initialFeedCategory === 'nuget';
  const initialIsAwsEcrFeed = isAwsEcrFeedType(initialFeedType);
  const initialIsAwsS3Feed = isAwsS3BucketFeedType(initialFeedType);
  const initialUseWorkerCredentials = initialIsAwsS3Feed && !(feed?.username?.trim()) && !(feed?.passwordHasValue ?? false);
  const initialVisibility: FeedPanelVisibility = {
    showUrlPanel: !initialIsAwsEcrFeed && !initialIsAwsS3Feed,
    showContainerRegistrySettings: initialIsContainerRegistryFeed || initialIsEcrFeed,
    showRetryAttempts: initialShowRetryAttempts,
    showNuGetSettings: initialIsNuGetFeed,
    showGenericCredentialsPanel: !initialIsAwsEcrFeed && !initialIsAwsS3Feed,
    showAwsWorkerCredentialsPanel: initialIsAwsS3Feed,
    showAwsAccessKeyPanel: initialIsAwsEcrFeed || (initialIsAwsS3Feed && !initialUseWorkerCredentials),
    showAwsSecretKeyPanel: initialIsAwsEcrFeed || (initialIsAwsS3Feed && !initialUseWorkerCredentials),
    showAwsRegionPanel: initialIsAwsEcrFeed,
  };
  const [feedType, setFeedType] = useState(initialFeedType);
  const [isSticky, setIsSticky] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(buildFeedPanelKeys(initialVisibility));
  const [feedName, setFeedName] = useState(feed?.name ?? '');
  const [feedUrl, setFeedUrl] = useState(feed?.feedUri ?? getDefaultFeedUrl(initialFeedType));
  const [awsRegion, setAwsRegion] = useState(inferEcrRegion(feed));
  const [useWorkerCredentials, setUseWorkerCredentials] = useState(initialUseWorkerCredentials);
  const [registryPath, setRegistryPath] = useState(getFeedProperty(feed, 'RegistryPath') || (feed as { registryPath?: string } | undefined)?.registryPath || '');
  const [apiVersion, setApiVersion] = useState(getFeedProperty(feed, 'ApiVersion'));
  const [downloadAttempts, setDownloadAttempts] = useState(toSafeNumber(getFeedProperty(feed, 'DownloadAttempts'), 5));
  const [downloadRetryBackoff, setDownloadRetryBackoff] = useState(toSafeNumber(getFeedProperty(feed, 'DownloadRetryBackoffSeconds'), 10));
  const [feedUsername, setFeedUsername] = useState(feed?.username ?? '');
  const [credentialType, setCredentialType] = useState<FeedCredentialType>(() => inferCredentialType(initialFeedType, feed));
  const [feedPassword, setFeedPassword] = useState('');
  const [isPasswordEditing, setIsPasswordEditing] = useState(!feed || !(feed.passwordHasValue ?? true));
  const [useNuGetEnhancedMode, setUseNuGetEnhancedMode] = useState(
    parseBooleanString(getFeedProperty(feed, 'EnhancedMode'), ((feed as { apiVersion?: string } | undefined)?.apiVersion ?? '') === 'Extended')
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const feedCategory = getFeedCategory(feedType);
  const isContainerRegistryFeed = feedCategory === 'containerRegistry';
  const isEcrFeed = feedCategory === 'ecr';
  const isDockerContainerRegistryFeed = isDockerContainerRegistryFeedType(feedType);
  const isGitHubRepositoryFeed = isGitHubRepositoryFeedType(feedType);
  const isAwsEcrFeed = isAwsEcrFeedType(feedType);
  const isAwsS3Feed = isAwsS3BucketFeedType(feedType);
  const isAzureContainerRegistryFeed = isAzureContainerRegistryFeedType(feedType);
  const isAwsCredentialFeed = isAwsEcrFeed || isAwsS3Feed;
  const isNuGetFeed = feedCategory === 'nuget';
  const showUrlPanel = !isAwsCredentialFeed;
  const showContainerRegistrySettings = isContainerRegistryFeed || isEcrFeed;
  const showRetryAttempts = feedCategory === 'downloadRetry' || feedCategory === 'nuget';
  const showNuGetSettings = isNuGetFeed;
  const showAwsWorkerCredentialsPanel = isAwsS3Feed;
  const showAwsAccessKeyPanel = isAwsEcrFeed || (isAwsS3Feed && !useWorkerCredentials);
  const showAwsSecretKeyPanel = isAwsEcrFeed || (isAwsS3Feed && !useWorkerCredentials);
  const showAwsRegionPanel = isAwsEcrFeed;
  const showGenericCredentialsPanel = !isAwsCredentialFeed;
  const credentialOptions = isGitHubRepositoryFeed
    ? githubRepositoryCredentialTypeOptions
    : isDockerContainerRegistryFeed
      ? dockerRegistryCredentialTypeOptions
      : [];
  const hasCredentialSelection = isGitHubRepositoryFeed || isDockerContainerRegistryFeed;
  const allKeys = buildFeedPanelKeys({
    showUrlPanel,
    showContainerRegistrySettings,
    showRetryAttempts,
    showNuGetSettings,
    showGenericCredentialsPanel,
    showAwsWorkerCredentialsPanel,
    showAwsAccessKeyPanel,
    showAwsSecretKeyPanel,
    showAwsRegionPanel,
  });
  const allExpanded = activeKeys.length === allKeys.length;

  const togglePanel = (key: string) => {
    setActiveKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveKeys((previousKeys) => {
      const next = previousKeys.filter((key) => allKeys.includes(key));
      if (showUrlPanel && !next.includes('url')) next.push('url');
      if (showContainerRegistrySettings && !next.includes('containerregistry')) next.push('containerregistry');
      if (showRetryAttempts && !next.includes('retry')) next.push('retry');
      if (showNuGetSettings && !next.includes('nuget')) next.push('nuget');
      if (showAwsWorkerCredentialsPanel && !next.includes('workercredentials')) next.push('workercredentials');
      if (showAwsAccessKeyPanel && !next.includes('accesskey')) next.push('accesskey');
      if (showAwsSecretKeyPanel && !next.includes('secretkey')) next.push('secretkey');
      if (showAwsRegionPanel && !next.includes('region')) next.push('region');
      if (showGenericCredentialsPanel && !next.includes('credentials')) next.push('credentials');
      return next;
    });
  }, [
    showUrlPanel,
    showContainerRegistrySettings,
    showRetryAttempts,
    showNuGetSettings,
    showAwsWorkerCredentialsPanel,
    showAwsAccessKeyPanel,
    showAwsSecretKeyPanel,
    showAwsRegionPanel,
    showGenericCredentialsPanel,
  ]);

  useEffect(() => {
    if (feedUrl.trim()) return;
    const defaultUrl = getDefaultFeedUrl(feedType);
    if (!defaultUrl) return;
    setFeedUrl(defaultUrl);
  }, [feedType, feedUrl]);

  useEffect(() => {
    if (isContainerRegistryFeed && credentialType === 'Token') {
      setCredentialType('Anonymous Access');
      return;
    }
    if (isGitHubRepositoryFeed && credentialType === 'Google Cloud Json Key') {
      setCredentialType('Anonymous Access');
      return;
    }
    if (!hasCredentialSelection && credentialType !== 'Username and Password') {
      setCredentialType('Username and Password');
    }
  }, [isContainerRegistryFeed, isGitHubRepositoryFeed, hasCredentialSelection, credentialType]);

  const buildCommand = (): CreateExternalFeedCommand => {
    const resolvedUsername = isAwsS3Feed
      ? useWorkerCredentials
        ? ''
        : feedUsername.trim()
      : hasCredentialSelection
        ? credentialType === 'Anonymous Access'
          ? ''
          : credentialType === 'Token'
              ? ''
              : credentialType === 'Google Cloud Json Key'
                ? '_json_key'
              : feedUsername.trim()
        : feedUsername.trim();
    const resolvedPassword = isAwsS3Feed
      ? useWorkerCredentials
        ? ''
        : feedPassword
      : hasCredentialSelection && credentialType === 'Anonymous Access'
        ? ''
        : feedPassword;
    const resolvedFeedUri = isAwsEcrFeed
      ? awsRegion.trim()
        ? `https://{accountId}.dkr.ecr.${awsRegion.trim()}.amazonaws.com`
        : getDefaultFeedUrl(feedType)
      : feedUrl.trim();
    let properties: Record<string, string> | null = null;
    if (feedCategory === 'containerRegistry') {
      properties = {
        ApiVersion: apiVersion.trim(),
        RegistryPath: registryPath.trim(),
      };
    } else if (feedCategory === 'ecr') {
      properties = {
        Region: awsRegion.trim(),
        ApiVersion: apiVersion.trim(),
        RegistryPath: registryPath.trim(),
      };
    } else if (feedCategory === 'nuget') {
      properties = {
        EnhancedMode: String(useNuGetEnhancedMode),
        DownloadAttempts: String(downloadAttempts),
        DownloadRetryBackoffSeconds: String(downloadRetryBackoff),
      };
    } else if (feedCategory === 'downloadRetry') {
      properties = {
        DownloadAttempts: String(downloadAttempts),
        DownloadRetryBackoffSeconds: String(downloadRetryBackoff),
      };
    }

    return {
      feedType,
      feedUri: resolvedFeedUri,
      username: resolvedUsername,
      password: resolvedPassword,
      name: feedName.trim(),
      slug: toFeedSlug(feedName),
      packageAcquisitionLocationOptions: feed?.packageAcquisitionLocationOptions ?? [],
      properties,
      spaceId,
    };
  };

  const handleSave = async (): Promise<ExternalFeedDto | null> => {
    const name = feedName.trim();
    if (!name) {
      message.warning('Please enter a feed name');
      return null;
    }

    setSaving(true);
    try {
      if (isEdit && feed) {
        const createLike = buildCommand();
        const cmd: UpdateExternalFeedCommand = {
          id: feed.id,
          feedType: createLike.feedType,
          feedUri: createLike.feedUri,
          username: createLike.username,
          passwordNewValue:
            (hasCredentialSelection && credentialType === 'Anonymous Access') || (isAwsS3Feed && useWorkerCredentials)
              ? ''
              : feedPassword.length > 0
                ? feedPassword
                : undefined,
          name: createLike.name,
          slug: createLike.slug,
          packageAcquisitionLocationOptions: createLike.packageAcquisitionLocationOptions,
          properties: createLike.properties,
          spaceId: createLike.spaceId,
        };
        const saved = await updateExternalFeed(cmd);
        message.success('External feed updated');
        onSaved();
        return saved;
      } else {
        const saved = await createExternalFeed(buildCommand());
        message.success('External feed created');
        onSaved();
        return saved;
      }
    } catch (error) {
      console.error('Failed to save external feed', error);
      message.error(error instanceof Error ? error.message : 'Failed to save external feed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (isEdit && feed) {
      setSaving(true);
      try {
        const result = await testExternalFeed(feed.id);
        setTestResult(result);
      } catch (error) {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
        });
      } finally {
        setSaving(false);
      }
      setShowTestModal(true);
      return;
    }

    const saved = await handleSave();
    if (!saved) return;

    setSaving(true);
    try {
      const result = await testExternalFeed(saved.id);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
    } finally {
      setSaving(false);
    }
    setShowTestModal(true);
  };

  const handleDelete = async () => {
    if (!isEdit || !feed) return;
    setDeleting(true);
    try {
      await deleteExternalFeed(feed.id);
      message.success('External feed deleted');
      setShowDeleteModal(false);
      onSaved();
    } catch (error) {
      console.error('Failed to delete external feed', error);
      message.error(error instanceof Error ? error.message : 'Failed to delete external feed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageContainer>
      <div ref={sentinelRef} style={{ height: 1 }} />

        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">

          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 bg-white rounded-t-md border-b border-gray-200 px-6 pt-5 pb-0 transition-shadow duration-200"
            style={isSticky ? { boxShadow: '0 1px 1px 0 rgba(0,0,0,0.12), 0 1px 8px 0 rgba(0,0,0,0.06)' } : {}}
          >
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-squid-blue hover:underline bg-transparent border-0 cursor-pointer mb-3 p-0"
            >
              External Feeds
            </button>
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">
                {isEdit ? `Edit: ${feed!.name}` : 'Create Feed'}
              </h1>
              <div className="flex items-center gap-2">
                <Button onClick={onBack} disabled={saving || deleting}>Cancel</Button>
                <Button onClick={() => void handleSaveAndTest()} loading={saving} disabled={saving || deleting}>
                  {isEdit ? 'Test' : 'Save and test'}
                </Button>
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={saving || deleting}
                >
                  Save
                </Button>
                {isEdit && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [{ key: 'delete', label: 'Delete', danger: true }],
                      onClick: ({ key }) => {
                        if (key === 'delete') setShowDeleteModal(true);
                      },
                    }}
                  >
                    <Button icon={<MoreOutlined />} disabled={saving || deleting} aria-label="Feed actions" />
                  </Dropdown>
                )}
              </div>
            </div>
            <div className="flex justify-end pb-2">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                onClick={() => setActiveKeys(allExpanded ? [] : allKeys)}
              >
                {allExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
            </div>
          </div>

          <FormPanel
            title="Feed Type"
            description="Select the type of the feed."
            isOpen={activeKeys.includes('feedtype')}
            onToggle={() => togglePanel('feedtype')}
          >
            <label className="block text-sm text-gray-700 mb-1.5">Feed type</label>
            <Select value={feedType} onChange={setFeedType} className="w-full" options={feedTypeOptions} disabled={isEdit} />
          </FormPanel>

          <FormPanel
            title="Name"
            description="Enter a name for the external feed."
            isOpen={activeKeys.includes('name')}
            onToggle={() => togglePanel('name')}
          >
            <Input placeholder="Feed name" value={feedName} onChange={(e) => setFeedName(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">A short, memorable, unique name. Example: ACME Builds.</div>
          </FormPanel>

          {showUrlPanel && (
            <FormPanel
              title="URL"
              description="Provide the location of the feed."
              isOpen={activeKeys.includes('url')}
              onToggle={() => togglePanel('url')}
            >
              {(() => {
                const defaultUrl = getDefaultFeedUrl(feedType);
                const placeholder = defaultUrl || 'https://example.com/feed';
                const helperText = isAzureContainerRegistryFeed
                  ? 'See Azure Container Registry documentation for registry URL and authentication setup.'
                  : isGoogleContainerRegistryFeedType(feedType)
                    ? 'See Google Container Registry documentation for registry URL and authentication setup.'
                  : feedType.includes('OCI Registry')
                    ? 'For the public Docker Hub OCI registry, set the URL to oci://registry-1.docker.io.'
                  : feedType.includes('Helm')
                    ? 'The uri to your helm repository.'
                  : feedType.includes('Maven')
                    ? 'The URL to your Maven repository. This URL is the same value defined in the repositories/repository/url element of a Maven settings.xml file.'
                  : isNuGetFeedType(feedType)
                    ? 'The feed url can be a url or a folder path.'
                  : isContainerRegistryFeed
                    ? 'For the public Docker Hub registry, set the URL to https://index.docker.io.'
                  : isGitHubRepositoryFeed
                    ? 'To use the standard public GitHub endpoint, set the URL to https://api.github.com.'
                    : 'Provide the feed URL.';
                return (
                  <>
                    <Input placeholder={placeholder} value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
                    <div className="text-xs text-gray-400 mt-1">{helperText}</div>
                  </>
                );
              })()}
            </FormPanel>
          )}

          {showContainerRegistrySettings && (
            <FormPanel
              title="Registry Settings"
              description="Configure the container registry API version and optional registry path."
              isOpen={activeKeys.includes('containerregistry')}
              onToggle={() => togglePanel('containerregistry')}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">API version</label>
                  <Select value={apiVersion} onChange={setApiVersion} className="w-full" options={apiVersionOptions} />
                  <div className="text-xs text-gray-400 mt-1">Leave as Auto Detect to let backend probe v2 then v1.</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">Registry path</label>
                  <Input placeholder="localhost:5000" value={registryPath} onChange={(e) => setRegistryPath(e.target.value)} />
                  <div className="text-xs text-gray-400 mt-1">Leave empty if it is the same as the URL host.</div>
                </div>
              </div>
            </FormPanel>
          )}

          {showRetryAttempts && (
            <FormPanel
              title="Retry Attempts"
              description="Control how Octopus should deal with feed errors."
              isOpen={activeKeys.includes('retry')}
              onToggle={() => togglePanel('retry')}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">Download attempts (attempts)</label>
                  <InputNumber value={downloadAttempts} onChange={(value) => setDownloadAttempts(value ?? 5)} min={1} className="w-40" />
                  <div className="text-xs text-gray-400 mt-1">The number of times a deployment should attempt to download a package before failing.</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">Download retry backoff (seconds)</label>
                  <InputNumber value={downloadRetryBackoff} onChange={(value) => setDownloadRetryBackoff(value ?? 10)} min={0} className="w-40" />
                  <div className="text-xs text-gray-400 mt-1">The number of seconds to apply as linear backoff between download attempts.</div>
                </div>
              </div>
            </FormPanel>
          )}

          {showAwsWorkerCredentialsPanel && (
            <FormPanel
              title="Credentials"
              description="Use explicitly specified credentials or the credentials configured on the worker."
              isOpen={activeKeys.includes('workercredentials')}
              onToggle={() => togglePanel('workercredentials')}
            >
              <div className="space-y-2">
                <div className="text-sm text-gray-700">Execute using the credentials configured on the worker</div>
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={useWorkerCredentials}
                  onChange={(event) => {
                    const nextUseWorkerCredentials = Boolean(event.target.value);
                    setUseWorkerCredentials(nextUseWorkerCredentials);
                    if (nextUseWorkerCredentials) {
                      setFeedUsername('');
                      setFeedPassword('');
                      setIsPasswordEditing(false);
                    } else {
                      setIsPasswordEditing(true);
                    }
                  }}
                >
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </div>
            </FormPanel>
          )}

          {showAwsAccessKeyPanel && (
            <FormPanel
              title="Access Key"
              description="The AWS access key to use when authenticating against Amazon Web Services."
              isOpen={activeKeys.includes('accesskey')}
              onToggle={() => togglePanel('accesskey')}
            >
              <div className="text-xs text-gray-400 mb-2">
                Refer to AWS documentation for information on generating access and secret keys.
              </div>
              <Input placeholder="Access Key" value={feedUsername} onChange={(event) => setFeedUsername(event.target.value)} />
            </FormPanel>
          )}

          {showAwsSecretKeyPanel && (
            <FormPanel
              title="Secret Key"
              description="The AWS secret key to use when authenticating against Amazon Web Services."
              isOpen={activeKeys.includes('secretkey')}
              onToggle={() => togglePanel('secretkey')}
              hasBorder={showAwsRegionPanel}
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {isEdit && !isPasswordEditing ? (
                    <Password
                      placeholder="********"
                      disabled
                      value=""
                      visibilityToggle={false}
                    />
                  ) : (
                    <Password
                      placeholder={isEdit ? 'Enter new secret key' : 'Secret Key'}
                      value={feedPassword}
                      onChange={(event) => setFeedPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  )}
                </div>
                {isEdit && (
                  <div className="flex items-center gap-1 mb-2">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      aria-label="Change value for Secret Key"
                      onClick={() => setIsPasswordEditing(true)}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="Remove value for Secret Key"
                      onClick={() => {
                        setFeedPassword('');
                        setIsPasswordEditing(false);
                      }}
                    />
                  </div>
                )}
              </div>
              {isEdit && !isPasswordEditing && (
                <div className="text-xs text-gray-400 mt-2">Secret key is set. Click edit to change it.</div>
              )}
            </FormPanel>
          )}

          {showAwsRegionPanel && (
            <FormPanel
              title="Region"
              description="The AWS region where the registry resides."
              isOpen={activeKeys.includes('region')}
              onToggle={() => togglePanel('region')}
              hasBorder={false}
            >
              <Input placeholder="us-east-1" value={awsRegion} onChange={(event) => setAwsRegion(event.target.value)} />
              <div className="text-xs text-gray-400 mt-1">Example: us-east-1, ap-southeast-1.</div>
            </FormPanel>
          )}

          {showGenericCredentialsPanel && (
            <FormPanel
              title="Credentials"
              description={hasCredentialSelection ? 'Select an authentication type.' : isAzureContainerRegistryFeed ? 'Username and Password' : 'Leave the following blank if your feed does not require authentication.'}
              isOpen={activeKeys.includes('credentials')}
              onToggle={() => togglePanel('credentials')}
              hasBorder={showNuGetSettings}
            >
            <div className="space-y-4">
              {hasCredentialSelection && (
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={credentialType}
                  onChange={(event) => {
                    const nextCredentialType = event.target.value as FeedCredentialType;
                    setCredentialType(nextCredentialType);
                    if (nextCredentialType === 'Anonymous Access') {
                      setFeedUsername('');
                      setFeedPassword('');
                      setIsPasswordEditing(false);
                      return;
                    }
                    if (nextCredentialType === 'Token') {
                      setFeedUsername('');
                    }
                    if (nextCredentialType === 'Google Cloud Json Key') {
                      setFeedUsername('');
                    }
                    setIsPasswordEditing(true);
                  }}
                >
                  {credentialOptions.map((option) => (
                    <Radio key={option.value} value={option.value}>
                      {option.label}
                    </Radio>
                  ))}
                </Radio.Group>
              )}

              {(!hasCredentialSelection || credentialType === 'Username and Password') && (
                <>
                  <Input placeholder="Feed Username" value={feedUsername} onChange={(event) => setFeedUsername(event.target.value)} />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      {isEdit && !isPasswordEditing ? (
                        <Password
                          placeholder="********"
                          disabled
                          value=""
                          visibilityToggle={false}
                        />
                      ) : (
                        <Password
                          placeholder={isEdit ? 'Enter new password' : 'Feed Password'}
                          value={feedPassword}
                          onChange={(event) => setFeedPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                      )}
                    </div>
                    {isEdit && (
                      <div className="flex items-center gap-1 mb-2">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          aria-label="Change value for Feed Password"
                          onClick={() => setIsPasswordEditing(true)}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Remove value for Feed Password"
                          onClick={() => {
                            setFeedPassword('');
                            setIsPasswordEditing(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {isGitHubRepositoryFeed && credentialType === 'Token' && (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    {isEdit && !isPasswordEditing ? (
                      <Password
                        placeholder="********"
                        disabled
                        value=""
                        visibilityToggle={false}
                      />
                    ) : (
                      <Password
                        placeholder={isEdit ? 'Enter new token' : 'Token'}
                        value={feedPassword}
                        onChange={(event) => setFeedPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    )}
                  </div>
                  {isEdit && (
                    <div className="flex items-center gap-1 mb-2">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        aria-label="Change value for Feed Token"
                        onClick={() => setIsPasswordEditing(true)}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Remove value for Feed Token"
                        onClick={() => {
                          setFeedPassword('');
                          setIsPasswordEditing(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {isDockerContainerRegistryFeed && credentialType === 'Google Cloud Json Key' && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-700">Google Cloud Json Key</div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      {isEdit && !isPasswordEditing ? (
                        <Password
                          placeholder="********"
                          disabled
                          value=""
                          visibilityToggle={false}
                        />
                      ) : (
                        <Password
                          placeholder={isEdit ? 'Enter new Google Cloud Json Key' : 'Google Cloud Json Key'}
                          value={feedPassword}
                          onChange={(event) => setFeedPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                      )}
                    </div>
                    {isEdit && (
                      <div className="flex items-center gap-1 mb-2">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          aria-label="Change value for Google Cloud Json Key"
                          onClick={() => setIsPasswordEditing(true)}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Remove value for Google Cloud Json Key"
                          onClick={() => {
                            setFeedPassword('');
                            setIsPasswordEditing(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasCredentialSelection && credentialType === 'Anonymous Access' && (
                <div className="text-xs text-gray-400">Anonymous access selected. Username and password are not required.</div>
              )}

              {isEdit && !isPasswordEditing && (!hasCredentialSelection || credentialType !== 'Anonymous Access') && (
                <div className="text-xs text-gray-400">Password is set. Click edit to change it.</div>
              )}
              {isEdit && isPasswordEditing && (!hasCredentialSelection || credentialType !== 'Anonymous Access') && (
                <div className="text-xs text-gray-400">Leave blank to keep current password.</div>
              )}
            </div>
            </FormPanel>
          )}

          {showNuGetSettings && (
            <FormPanel
              title="Extended API"
              isOpen={activeKeys.includes('nuget')}
              onToggle={() => togglePanel('nuget')}
              hasBorder={false}
            >
              <Checkbox checked={useNuGetEnhancedMode} onChange={(event) => setUseNuGetEnhancedMode(event.target.checked)}>
                Make use of the extended API
              </Checkbox>
              <div className="text-xs text-gray-400 mt-2">This will improve performance of the NuGet feed but may not be supported by some older feeds. Disable if Create Release does not return the latest version for a package.</div>
            </FormPanel>
          )}
        </div>

      {/* Test result modal */}
      <Modal
        title={testResult?.success ? 'Connection Successful' : 'Connection Failed'}
        open={showTestModal}
        onOk={() => setShowTestModal(false)}
        onCancel={() => setShowTestModal(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="OK"
      >
        {testResult?.success ? (
          <div className="flex items-start gap-3 py-2">
            <span className="text-green-600 text-lg">✓</span>
            <p className="text-sm text-gray-700 m-0">
              {testResult.message ?? 'Successfully connected to the feed.'}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 py-2">
            <span className="text-red-500 text-lg">✗</span>
            <p className="text-sm text-gray-700 m-0">
              {testResult?.message ?? 'Could not connect to the feed. Check the URL and credentials.'}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        title="Delete Feed"
        open={showDeleteModal}
        onOk={() => void handleDelete()}
        onCancel={() => setShowDeleteModal(false)}
        okText="Delete"
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
      >
        <p>
          Are you sure you want to delete <strong>{feed?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </PageContainer>
  );
}

// ── Main list component ───────────────────────────────────────────────────────

const ExternalFeeds: React.FC = () => {
  const { space } = useSpace();
  const navigate = useNavigate();
  const openBuiltInFeed = () => navigate(`/${space.slug}/library/packages`);
  const [searchText, setSearchText] = useState('');
  const [editFeed, setEditFeed] = useState<ExternalFeedDto | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExternalFeedDto | null>(null);
  const [feeds, setFeeds] = useState<ExternalFeedDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testModal, setTestModal] = useState<{ feedName: string; success: boolean; message: string } | null>(null);

  const loadFeeds = () => {
    setLoading(true);
    getExternalFeeds({ spaceId: space.id })
      .then((res) => setFeeds(res.externalFeeds))
      .catch((error) => {
        console.error('Failed to load external feeds', error);
        message.error(error instanceof Error ? error.message : 'Failed to load external feeds');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!space?.id) return;
    loadFeeds();
  }, [space?.id]);

  const handleBack = () => {
    setShowCreate(false);
    setEditFeed(null);
  };

  const handleSaved = () => {
    setShowCreate(false);
    setEditFeed(null);
    loadFeeds();
  };

  const handleTestConnection = async (feed: ExternalFeedDto) => {
    setTestingId(feed.id);
    try {
      const result = await testExternalFeed(feed.id);
      setTestModal({
        feedName: feed.name,
        success: result.success,
        message: result.message ?? (result.success ? 'Connection successful.' : 'Connection failed.'),
      });
    } catch (error) {
      setTestModal({
        feedName: feed.name,
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed.',
      });
    } finally {
      setTestingId(null);
    }
  };

  if (showCreate || editFeed) {
    return (
      <FeedForm
        spaceId={space.id}
        feed={editFeed ?? undefined}
        onBack={handleBack}
        onSaved={handleSaved}
      />
    );
  }

  const filtered = feeds.filter((f) =>
    f.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <PageContainer>
        <div className="border border-slate-200/70 rounded-xl bg-white overflow-hidden shadow-card">

          {/* Page header */}
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">External Feeds</h1>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                onClick={() => setShowCreate(true)}
              >
                ADD FEED
              </Button>
            </div>

            <Input
              placeholder="Filter by name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 300 }}
            />
          </div>

          {/* Table */}
          <Spin spinning={loading}>
            {filtered.length === 0 && !loading ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                No external feeds found.
              </div>
            ) : (
              <div>
                {/* Column headers */}
                <div
                  className="grid border-b border-gray-200 bg-gray-50 px-5 py-2"
                  style={{ gridTemplateColumns: '1fr 1fr 40px' }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">URL</div>
                  <div />
                </div>

                {filtered.map((feed, idx) => {
                  const meta = getFeedMeta(feed.feedType);
                  const builtIn = isBuiltInFeedType(feed.feedType);
                  const openFeed = () => (builtIn ? openBuiltInFeed() : setEditFeed(feed));
                  return (
                    <div
                      key={feed.id}
                      className={[
                        'grid items-center px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer',
                        idx < filtered.length - 1 ? 'border-b border-gray-100' : '',
                      ].join(' ')}
                      style={{ gridTemplateColumns: '1fr 1fr 40px' }}
                      role="button"
                      tabIndex={0}
                      onClick={openFeed}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openFeed();
                        }
                      }}
                    >
                      {/* Name column */}
                      <div className="flex items-center gap-3 min-w-0">
                        <FeedTypeIcon feedType={feed.feedType} />
                        <div className="min-w-0">
                          <div
                            className="font-semibold text-sm text-squid-blue hover:underline cursor-pointer truncate"
                          >
                            {builtIn ? 'Squid packages' : feed.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {builtIn ? (
                              <span className="rounded bg-teal-50 px-1.5 py-0.5 font-medium text-teal-700" data-testid="builtin-badge">Built-in</span>
                            ) : meta.label}
                          </div>
                        </div>
                      </div>

                      {/* URL column */}
                      <div className="min-w-0 pr-4">
                        {feed.feedUri ? (
                          <a
                            href={feed.feedUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-600 hover:text-squid-blue hover:underline truncate flex items-center gap-1"
                            title={feed.feedUri}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{feed.feedUri}</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400 w-3 h-3">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>

                      {/* Overflow menu */}
                      <div className="flex justify-end">
                        {!builtIn && <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              { key: 'test', label: testingId === feed.id ? 'Testing…' : 'Test connection', disabled: testingId === feed.id },
                              { key: 'edit', label: 'Edit' },
                              { type: 'divider' },
                              { key: 'delete', label: 'Delete', danger: true },
                            ],
                            onClick: ({ key }) => {
                              if (key === 'test') void handleTestConnection(feed);
                              if (key === 'edit') setEditFeed(feed);
                              if (key === 'delete') setDeleteTarget(feed);
                            },
                          }}
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<MoreOutlined />}
                            loading={testingId === feed.id}
                            className="text-gray-400 hover:text-gray-700"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Dropdown>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Spin>
        </div>

      {/* Test connection result */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {testModal?.success
              ? <span className="text-green-600 text-base">✓</span>
              : <span className="text-red-500 text-base">✗</span>}
            {testModal?.success ? 'Connection Successful' : 'Connection Failed'}
          </div>
        }
        open={!!testModal}
        onOk={() => setTestModal(null)}
        onCancel={() => setTestModal(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="OK"
      >
        <div className="py-2">
          <div className="text-xs text-gray-400 mb-1">{testModal?.feedName}</div>
          <p className="text-sm text-gray-700 m-0">{testModal?.message}</p>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        title="Delete Feed"
        open={!!deleteTarget}
        onOk={() => setDeleteTarget(null)}
        onCancel={() => setDeleteTarget(null)}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </PageContainer>
  );
};

export default ExternalFeeds;
