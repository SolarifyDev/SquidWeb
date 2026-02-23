import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Select, InputNumber, Checkbox, Spin, Modal, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons';
import { getExternalFeeds, ExternalFeedDto } from 'pages/apis/externalFeed';
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

// ── Feed type icon ────────────────────────────────────────────────────────────

function FeedTypeIcon({ feedType }: { feedType: string }) {
  const meta = getFeedMeta(feedType);
  return (
    <div
      className="flex items-center justify-center w-10 h-10 rounded flex-shrink-0 text-white text-xs font-bold select-none"
      style={{ backgroundColor: meta.color }}
    >
      {meta.abbrev}
    </div>
  );
}

// ── Create / Edit form ────────────────────────────────────────────────────────

interface FeedFormProps {
  onBack: () => void;
  onSave: () => void;
}

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

function FeedForm({ onBack, onSave }: FeedFormProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>(['feedtype', 'name', 'url', 'retry', 'credentials', 'extended']);
  const [feedType, setFeedType] = useState('NuGet Feed');
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [downloadAttempts, setDownloadAttempts] = useState(5);
  const [downloadRetryBackoff, setDownloadRetryBackoff] = useState(10);
  const [feedUsername, setFeedUsername] = useState('');
  const [feedPassword, setFeedPassword] = useState('');
  const [useExtendedAPI, setUseExtendedAPI] = useState(false);

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

  return (
    <div className="min-h-screen bg-white">
      <div ref={sentinelRef} style={{ height: 1 }} />

      <div className="max-w-5xl mx-auto px-8 pt-4 pb-10">
        {/* Form card — no overflow-hidden so sticky header works */}
        <div className="border border-gray-200 rounded-md">

          {/* Sticky title — inside the card, first child */}
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
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Create Feed</h1>
              <div className="flex items-center gap-2">
                <Button onClick={onBack}>Cancel</Button>
                <Button onClick={onSave}>Save and test</Button>
                <Button
                  type="primary"
                  className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                  onClick={onSave}
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
              <Password placeholder="Password" value={feedPassword} onChange={(e) => setFeedPassword(e.target.value)} />
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
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ExternalFeeds: React.FC = () => {
  const { space } = useSpace();
  const [searchText, setSearchText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExternalFeedDto | null>(null);
  const [feeds, setFeeds] = useState<ExternalFeedDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getExternalFeeds({ spaceId: space.id })
      .then((res) => setFeeds(res.externalFeeds))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = feeds.filter((f) =>
    f.name.toLowerCase().includes(searchText.toLowerCase())
  );

  if (showCreate) {
    return <FeedForm onBack={() => setShowCreate(false)} onSave={() => setShowCreate(false)} />;
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      {/* Page header */}
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

      {/* Search */}
      <div className="mb-5">
        <Input
          placeholder="Filter by name..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 300 }}
        />
      </div>

      {/* Feed list */}
      <Spin spinning={loading}>
        <div className="border border-gray-200 rounded-md overflow-hidden">
          {filtered.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              No external feeds found.
            </div>
          )}
          {filtered.map((feed, idx) => {
            const meta = getFeedMeta(feed.feedType);
            return (
              <div
                key={feed.id}
                className={[
                  'flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors',
                  idx < filtered.length - 1 ? 'border-b border-gray-200' : '',
                ].join(' ')}
              >
                {/* Feed type icon */}
                <FeedTypeIcon feedType={feed.feedType} />

                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{feed.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Tag className="text-xs m-0" color="default">{meta.label}</Tag>
                  </div>
                </div>

                {/* URL */}
                <div className="flex-1 min-w-0 hidden md:block">
                  {feed.feedUri ? (
                    <a
                      href={feed.feedUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-squid-blue hover:underline truncate block"
                      title={feed.feedUri}
                    >
                      {feed.feedUri}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setShowCreate(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setDeleteTarget(feed)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Spin>

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
