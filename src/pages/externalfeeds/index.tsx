import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Select, InputNumber, Checkbox, Spin, Modal, message, Dropdown } from 'antd';
import { SearchOutlined, PlusOutlined, DownOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  getExternalFeeds,
  createExternalFeed,
  updateExternalFeed,
  testExternalFeed,
  ExternalFeedDto,
  CreateExternalFeedCommand,
  UpdateExternalFeedCommand,
} from 'pages/apis/externalFeed';
import { useSpace } from 'contexts/SpaceContext';

const { Password } = Input;

// ── Feed type meta ────────────────────────────────────────────────────────────

const feedTypeMeta: Record<string, { label: string; abbrev: string; color: string }> = {
  'NuGet':            { label: 'NuGet Feed',                   abbrev: 'Nu',  color: '#6366f1' },
  'NuGet Feed':       { label: 'NuGet Feed',                   abbrev: 'Nu',  color: '#6366f1' },
  'Docker':           { label: 'Docker Container Registry',    abbrev: 'Dk',  color: '#2563eb' },
  'Docker Container Registry': { label: 'Docker Container Registry', abbrev: 'Dk', color: '#2563eb' },
  'Maven':            { label: 'Maven Feed',                   abbrev: 'Mv',  color: '#ea580c' },
  'Maven Feed':       { label: 'Maven Feed',                   abbrev: 'Mv',  color: '#ea580c' },
  'GitHub':           { label: 'GitHub Container Registry',    abbrev: 'GH',  color: '#1f2937' },
  'GitHub Container Registry': { label: 'GitHub Container Registry', abbrev: 'GH', color: '#1f2937' },
  'Helm':             { label: 'Helm Feed',                    abbrev: 'Hm',  color: '#0891b2' },
  'Helm Feed':        { label: 'Helm Feed',                    abbrev: 'Hm',  color: '#0891b2' },
  'AwsElasticContainerRegistry': { label: 'AWS ECR Feed',      abbrev: 'ECR', color: '#d97706' },
  'AWS ECR Feed':     { label: 'AWS ECR Feed',                 abbrev: 'ECR', color: '#d97706' },
  'BuiltIn':          { label: 'Built-in',                     abbrev: 'BI',  color: '#059669' },
};

function getFeedMeta(feedType: string) {
  return feedTypeMeta[feedType] ?? { label: feedType, abbrev: feedType.slice(0, 2).toUpperCase(), color: '#6b7280' };
}

const feedTypeOptions = [
  { value: 'NuGet Feed',                  label: 'NuGet Feed' },
  { value: 'Docker Container Registry',   label: 'Docker Container Registry' },
  { value: 'Maven Feed',                  label: 'Maven Feed' },
  { value: 'GitHub Container Registry',   label: 'GitHub Container Registry' },
  { value: 'Helm Feed',                   label: 'Helm Feed' },
  { value: 'AWS ECR Feed',               label: 'AWS ECR Feed' },
];

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
  const isEdit = !!feed;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(['feedtype', 'name', 'url', 'retry', 'credentials', 'extended']);
  const [feedType, setFeedType] = useState(feed?.feedType ?? 'NuGet Feed');
  const [feedName, setFeedName] = useState(feed?.name ?? '');
  const [feedUrl, setFeedUrl] = useState(feed?.feedUri ?? '');
  const [downloadAttempts, setDownloadAttempts] = useState(5);
  const [downloadRetryBackoff, setDownloadRetryBackoff] = useState(10);
  const [feedUsername, setFeedUsername] = useState(feed?.username ?? '');
  const [feedPassword, setFeedPassword] = useState('');
  const [isPasswordEditing, setIsPasswordEditing] = useState(!feed);
  const [useExtendedAPI, setUseExtendedAPI] = useState(
    feed ? feed.apiVersion === 'Extended' : false
  );
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const allKeys = ['feedtype', 'name', 'url', 'retry', 'credentials', 'extended'];
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

  const buildCommand = (): CreateExternalFeedCommand => ({
    feedType,
    apiVersion: useExtendedAPI ? 'Extended' : '',
    registryPath: '',
    feedUri: feedUrl.trim(),
    username: feedUsername.trim(),
    password: feedPassword,
    name: feedName.trim(),
    slug: toFeedSlug(feedName),
    packageAcquisitionLocationOptions: [],
    spaceId,
  });

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
          apiVersion: createLike.apiVersion,
          registryPath: createLike.registryPath,
          feedUri: createLike.feedUri,
          username: createLike.username,
          passwordNewValue: feedPassword.length > 0 ? feedPassword : undefined,
          name: createLike.name,
          slug: createLike.slug,
          packageAcquisitionLocationOptions: createLike.packageAcquisitionLocationOptions,
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

  return (
    <div className="min-h-screen bg-white">
      <div ref={sentinelRef} style={{ height: 1 }} />

      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md">

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
                <Button onClick={onBack} disabled={saving}>Cancel</Button>
                <Button onClick={() => void handleSaveAndTest()} loading={saving} disabled={saving}>
                  {isEdit ? 'Test' : 'Save and test'}
                </Button>
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
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
            <Select value={feedType} onChange={setFeedType} className="w-full" options={feedTypeOptions} />
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

          <FormPanel
            title="URL"
            description="Provide the location of the feed."
            isOpen={activeKeys.includes('url')}
            onToggle={() => togglePanel('url')}
          >
            <Input placeholder="https://api.nuget.org/v3/index.json" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
            <div className="text-xs text-gray-400 mt-1">The feed URL can be a URL or a folder path.</div>
          </FormPanel>

          <FormPanel
            title="Retry Attempts"
            description="Control how Squid should deal with feed errors."
            isOpen={activeKeys.includes('retry')}
            onToggle={() => togglePanel('retry')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Download attempts</label>
                <InputNumber value={downloadAttempts} onChange={(v) => setDownloadAttempts(v ?? 5)} min={1} className="w-32" />
                <div className="text-xs text-gray-400 mt-1">Number of times to attempt downloading a package before failing.</div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Download retry backoff (seconds)</label>
                <InputNumber value={downloadRetryBackoff} onChange={(v) => setDownloadRetryBackoff(v ?? 10)} min={1} className="w-32" />
                <div className="text-xs text-gray-400 mt-1">Seconds to wait between download attempts.</div>
              </div>
            </div>
          </FormPanel>

          <FormPanel
            title="Credentials"
            description="Leave blank if your feed does not require authentication."
            isOpen={activeKeys.includes('credentials')}
            onToggle={() => togglePanel('credentials')}
          >
            <div className="space-y-3">
              <Input placeholder="Username" value={feedUsername} onChange={(e) => setFeedUsername(e.target.value)} />
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
                      placeholder={isEdit ? 'Enter new password' : 'Password'}
                      value={feedPassword}
                      onChange={(e) => setFeedPassword(e.target.value)}
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
              {isEdit && !isPasswordEditing && (
                <div className="text-xs text-gray-400">Password is set. Click edit to change it.</div>
              )}
              {isEdit && isPasswordEditing && (
                <div className="text-xs text-gray-400">Leave blank to keep current password.</div>
              )}
            </div>
          </FormPanel>

          <FormPanel
            title="Extended API"
            isOpen={activeKeys.includes('extended')}
            onToggle={() => togglePanel('extended')}
            hasBorder={false}
          >
            <Checkbox checked={useExtendedAPI} onChange={(e) => setUseExtendedAPI(e.target.checked)}>
              Make use of the extended API
            </Checkbox>
            <div className="text-xs text-gray-400 mt-2">Improves NuGet feed performance but may not be supported by older feeds.</div>
          </FormPanel>
        </div>
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
    </div>
  );
}

// ── Main list component ───────────────────────────────────────────────────────

const ExternalFeeds: React.FC = () => {
  const { space } = useSpace();
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
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">

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
                  return (
                    <div
                      key={feed.id}
                      className={[
                        'grid items-center px-5 py-3 hover:bg-gray-50 transition-colors',
                        idx < filtered.length - 1 ? 'border-b border-gray-100' : '',
                      ].join(' ')}
                      style={{ gridTemplateColumns: '1fr 1fr 40px' }}
                    >
                      {/* Name column */}
                      <div className="flex items-center gap-3 min-w-0">
                        <FeedTypeIcon feedType={feed.feedType} />
                        <div className="min-w-0">
                          <div
                            className="font-semibold text-sm text-squid-blue hover:underline cursor-pointer truncate"
                            onClick={() => setEditFeed(feed)}
                          >
                            {feed.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{meta.label}</div>
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
                        <Dropdown
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
                        </Dropdown>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Spin>
        </div>
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
    </div>
  );
};

export default ExternalFeeds;
