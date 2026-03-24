import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Input, InputNumber, Button, Dropdown, Radio, Checkbox, Alert, Spin, Modal, Select, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import {
  SearchOutlined,
  ThunderboltFilled,
  MoreOutlined,
  DownOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  CodeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  getLifecycles,
  createLifecycle,
  updateLifecycle,
  CreateLifecycleCommand,
  UpdateLifecycleCommand,
  LifecycleDto,
  LifecyclePhaseDto,
  RetentionPolicyUnit,
} from 'pages/apis/lifecycle';
import { getEnvironments } from 'pages/apis/environment';
import { useSpace } from 'contexts/SpaceContext';

interface Lifecycle {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  retentionPolicy: string;
  phaseNames: string[];
  apiPhases: LifecyclePhaseDto[];
  apiLifecycle: LifecycleDto['lifecycle'] | null;
  projectCount?: number;
}

// ── FormPanel ─────────────────────────────────────────────────────────────────

interface FormPanelProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  hasBorder?: boolean;
  children?: React.ReactNode;
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
      {isOpen && children && (
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

// ── Markdown toolbar ──────────────────────────────────────────────────────────

function MarkdownToolbar() {
  return (
    <div className="flex gap-1 border border-gray-300 border-b-0 rounded-t p-1 bg-gray-50">
      <Button size="small" icon={<BoldOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<ItalicOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<UnorderedListOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<OrderedListOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<PictureOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<LinkOutlined />} type="text" className="h-8" />
      <Button size="small" icon={<CodeOutlined />} type="text" className="h-8" />
    </div>
  );
}

// ── Phase card ────────────────────────────────────────────────────────────────

interface PhaseEnvironment {
  id: number;
  key: string;
  name: string;
  auto: boolean;
}

interface NewPhase {
  id: number;
  name: string;
  isExpanded: boolean;
  requiredToProgress: 'all' | 'minimum' | 'optional';
  minimumCount: number;
  retentionOverridden: boolean;
  phaseReleaseRetention: string;
  phaseReleaseRetentionCount: number;
  phaseReleaseRetentionUnit: string;
  phaseFileRetention: string;
  phaseFileRetentionCount: number;
  phaseFileRetentionUnit: string;
  priority: boolean;
  environments: PhaseEnvironment[];
}

interface PhaseCardProps {
  phase: NewPhase;
  index: number;
  environmentOptions: { value: number; label: string }[];
  allowDelete?: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<NewPhase>) => void;
  onDelete: () => void;
}

function PhaseCard({ phase, index, environmentOptions, allowDelete = true, onToggle, onUpdate, onDelete }: PhaseCardProps) {
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<number | undefined>(undefined);
  const [deployMode, setDeployMode] = useState<'auto' | 'manual'>('manual');

  const openEnvModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEnv(undefined);
    setDeployMode('manual');
    setEnvModalOpen(true);
  };

  const handleAddEnvironment = () => {
    if (selectedEnv === undefined) return;
    const env = environmentOptions.find((o) => o.value === selectedEnv);
    if (!env) return;
    const exists = phase.environments.some((e) => e.id === selectedEnv && e.auto === (deployMode === 'auto'));
    if (exists) {
      setEnvModalOpen(false);
      return;
    }
    onUpdate({
      environments: [
        ...phase.environments,
        { id: selectedEnv, key: `${selectedEnv}-${Date.now()}`, name: env.label, auto: deployMode === 'auto' },
      ],
    });
    setEnvModalOpen(false);
  };

  const removeEnvironment = (key: string) => {
    onUpdate({ environments: phase.environments.filter((e) => e.key !== key) });
  };

  const menuItems = allowDelete ? [
    { key: 'delete', label: 'Delete phase', danger: true, onClick: onDelete },
  ] : [];

  return (
    <>
    <div className="border border-gray-200 rounded-md shadow-sm mb-3">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-white rounded-t-md cursor-pointer"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={phase.isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm">Phase {index + 1}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {phase.name || 'Please enter phase details'}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {allowDelete && (
            <Dropdown menu={{ items: menuItems }} placement="bottomRight">
              <Button
                icon={<MoreOutlined />}
                type="text"
                size="small"
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-1.5 rounded hover:bg-gray-100 border-0 bg-transparent cursor-pointer"
            style={{ transition: 'transform 0.2s', transform: phase.isExpanded ? 'rotate(180deg)' : 'none' }}
          >
            <DownOutlined style={{ fontSize: 13 }} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Card content */}
      {phase.isExpanded && (
        <div className="border-t border-gray-200 px-5 py-5 space-y-6">
          {/* Phase name */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Phase name</h4>
            <Input
              value={phase.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Phase name"
            />
          </div>

          {/* Environments */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Environments</h4>
            {phase.environments.length === 0 ? (
              <>
                <div className="font-semibold text-gray-800 text-sm mb-1">Any environment</div>
                <p className="text-sm text-gray-500 mb-3">
                  When the release is in this phase, any environment{' '}
                  <span>that is not explicitly named in another phase</span>{' '}
                  can be deployed to. Use the <em>Add environment</em> button to limit the phase to a specific list of environments.
                </p>
              </>
            ) : (
              <div className="mb-3 space-y-1.5">
                {phase.environments.map(env => (
                  <div
                    key={env.key}
                    className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-block bg-gray-400 rounded-sm flex-shrink-0" style={{ width: 10, height: 10 }} />
                      <span className="text-sm text-gray-800">{env.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${env.auto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {env.auto ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                    <button
                      onClick={() => removeEnvironment(env.key)}
                      className="text-gray-400 hover:text-red-500 border-0 bg-transparent cursor-pointer p-0.5"
                    >
                      <CloseOutlined style={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={openEnvModal}>Add Environment</Button>
            </div>
          </div>

          {/* Required to progress */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Required to progress</h4>
            <Radio.Group
              value={phase.requiredToProgress}
              onChange={(e) => onUpdate({ requiredToProgress: e.target.value })}
              className="flex flex-col space-y-2"
            >
              <Radio value="all">
                All must complete <span className="text-gray-400">(default)</span>
              </Radio>
              <Radio value="minimum">
                <span className="inline-flex items-center gap-2">
                  A minimum of
                  <InputNumber
                    min={1}
                    value={phase.minimumCount}
                    onChange={(v) => onUpdate({ minimumCount: v ?? 1 })}
                    style={{ width: 64 }}
                    disabled={phase.requiredToProgress !== 'minimum'}
                    onClick={(e) => e.stopPropagation()}
                  />
                  must complete
                </span>
              </Radio>
              <Radio value="optional">Optional phase</Radio>
            </Radio.Group>
          </div>

          {/* Retention policy */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Retention policy{phase.retentionOverridden ? '' : ' (inherited)'}
            </h4>
            {!phase.retentionOverridden ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Releases: Keep all. Files on Tentacle: Keep all.
                </p>
                <div className="flex justify-end">
                  <Button onClick={() => onUpdate({ retentionOverridden: true })}>
                    Override retention policy
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <div className="mb-2 font-medium">How long should we keep releases?</div>
                  <Radio.Group
                    value={phase.phaseReleaseRetention}
                    onChange={(e) => onUpdate({ phaseReleaseRetention: e.target.value })}
                    className="flex flex-col space-y-1"
                  >
                    <Radio value="keepAll">Keep all <span className="text-gray-400">(default)</span></Radio>
                    <Radio value="keepLimited">Keep a limited number</Radio>
                  </Radio.Group>
                  {phase.phaseReleaseRetention === 'keepLimited' && (
                    <div className="flex items-center gap-2 mt-2 ml-6" onClick={(e) => e.stopPropagation()}>
                      <InputNumber
                        min={1}
                        value={phase.phaseReleaseRetentionCount}
                        onChange={(v) => onUpdate({ phaseReleaseRetentionCount: v ?? 1 })}
                        style={{ width: 80 }}
                      />
                      <Select
                        value={phase.phaseReleaseRetentionUnit}
                        onChange={(v) => onUpdate({ phaseReleaseRetentionUnit: v })}
                        style={{ width: 110 }}
                        options={[
                          { value: 'Days', label: 'Days' },
                          { value: 'Weeks', label: 'Weeks' },
                          { value: 'Months', label: 'Months' },
                          { value: 'Years', label: 'Years' },
                        ]}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-2 font-medium">How long should we keep extracted packages and files on disk on Tentacles?</div>
                  <Radio.Group
                    value={phase.phaseFileRetention}
                    onChange={(e) => onUpdate({ phaseFileRetention: e.target.value })}
                    className="flex flex-col space-y-1"
                  >
                    <Radio value="keepAll">Keep all <span className="text-gray-400">(default)</span></Radio>
                    <Radio value="keepLimited">Keep a limited number</Radio>
                  </Radio.Group>
                  {phase.phaseFileRetention === 'keepLimited' && (
                    <div className="flex items-center gap-2 mt-2 ml-6" onClick={(e) => e.stopPropagation()}>
                      <InputNumber
                        min={1}
                        value={phase.phaseFileRetentionCount}
                        onChange={(v) => onUpdate({ phaseFileRetentionCount: v ?? 1 })}
                        style={{ width: 80 }}
                      />
                      <Select
                        value={phase.phaseFileRetentionUnit}
                        onChange={(v) => onUpdate({ phaseFileRetentionUnit: v })}
                        style={{ width: 110 }}
                        options={[
                          { value: 'Days', label: 'Days' },
                          { value: 'Weeks', label: 'Weeks' },
                          { value: 'Months', label: 'Months' },
                          { value: 'Years', label: 'Years' },
                        ]}
                      />
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Retention policies dictate how long releases and deployments are kept for. For more information please see{' '}
                  <span className="text-squid-blue cursor-pointer hover:underline">retention policies</span> documentation.
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => onUpdate({ retentionOverridden: false })}>
                    Reset retention policy
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Phase priority */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Phase priority</h4>
            <Alert
              message="Early Access"
              description={
                <span>
                  This feature is still in development and may be removed pending feedback. We'd love to hear{' '}
                  <span className="text-squid-blue cursor-pointer hover:underline">your feedback</span>{' '}
                  after using the Priority Deployments feature.
                </span>
              }
              type="warning"
              showIcon
              className="mb-3"
            />
            <Checkbox
              checked={phase.priority}
              onChange={(e) => onUpdate({ priority: e.target.checked })}
            >
              Priority
            </Checkbox>
            <div className="text-sm text-gray-500 mt-2">
              Deployments will be prioritized in this phase according to{' '}
              <span className="text-squid-blue cursor-pointer hover:underline">phase priority</span>.
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Add Environment modal */}
    <Modal
      title="Add Environment"
      open={envModalOpen}
      onCancel={() => setEnvModalOpen(false)}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEnvModalOpen(false)}>Cancel</Button>
          <Button
            type="primary"
            disabled={!selectedEnv}
            onClick={handleAddEnvironment}
          >
            Ok
          </Button>
        </div>
      }
      width={480}
    >
      <div className="space-y-5 py-2">
        <div>
          <label className="block text-sm text-gray-600 mb-1.5">Environment</label>
          <Select
            value={selectedEnv}
            onChange={setSelectedEnv}
            className="w-full"
            placeholder="Select an environment"
            options={environmentOptions}
          />
        </div>
        <Radio.Group
          value={deployMode}
          onChange={(e) => setDeployMode(e.target.value)}
          className="flex flex-col space-y-3"
        >
          <Radio value="auto">
            <span>Deploy <strong>automatically</strong> to this environment as soon as the release enters this phase.</span>
          </Radio>
          <Radio value="manual">
            <span>Users will need to <strong>manually</strong> queue the deployment to this environment.</span>{' '}
            <span className="text-gray-400">(default)</span>
          </Radio>
        </Radio.Group>
      </div>
    </Modal>
    </>
  );
}

function makeNewPhase(id: number, name = ''): NewPhase {
  return {
    id,
    name,
    isExpanded: true,
    requiredToProgress: 'all',
    minimumCount: 1,
    retentionOverridden: false,
    phaseReleaseRetention: 'keepAll',
    phaseReleaseRetentionCount: 30,
    phaseReleaseRetentionUnit: 'Days',
    phaseFileRetention: 'keepAll',
    phaseFileRetentionCount: 30,
    phaseFileRetentionUnit: 'Days',
    priority: false,
    environments: [],
  };
}

function toRetentionUnit(unit?: RetentionPolicyUnit | string | null): string {
  if (unit === 1 || unit === 'Weeks') return 'Weeks';
  if (unit === 2 || unit === 'Months') return 'Months';
  if (unit === 3 || unit === 'Years') return 'Years';
  return 'Days';
}

function toRetentionUnitValue(unit?: string | null): RetentionPolicyUnit {
  if (unit === 'Weeks') return 1;
  if (unit === 'Months') return 2;
  if (unit === 'Years') return 3;
  return 0;
}

function mapPhaseFromApi(
  phase: LifecyclePhaseDto,
  environmentNameById: Map<number, string>,
  fallbackId: number,
): NewPhase {
  const autoEnvironments: PhaseEnvironment[] = (phase.automaticDeploymentTargetIds ?? []).map((envId, index) => ({
    id: envId,
    key: `a-${phase.id || fallbackId}-${envId}-${index}`,
    name: environmentNameById.get(envId) ?? `Environment #${envId}`,
    auto: true,
  }));
  const manualEnvironments: PhaseEnvironment[] = (phase.optionalDeploymentTargetIds ?? []).map((envId, index) => ({
    id: envId,
    key: `m-${phase.id || fallbackId}-${envId}-${index}`,
    name: environmentNameById.get(envId) ?? `Environment #${envId}`,
    auto: false,
  }));

  return {
    id: phase.id || fallbackId,
    name: phase.name ?? '',
    isExpanded: true,
    requiredToProgress: phase.isOptionalPhase
      ? 'optional'
      : (phase.minimumEnvironmentsBeforePromotion ?? 0) > 0
        ? 'minimum'
        : 'all',
    minimumCount: phase.minimumEnvironmentsBeforePromotion ?? 1,
    retentionOverridden:
      phase.releaseRetentionKeepForever !== null && phase.releaseRetentionKeepForever !== undefined ||
      phase.releaseRetentionQuantity !== null && phase.releaseRetentionQuantity !== undefined ||
      phase.releaseRetentionUnit !== null && phase.releaseRetentionUnit !== undefined ||
      phase.tentacleRetentionKeepForever !== null && phase.tentacleRetentionKeepForever !== undefined ||
      phase.tentacleRetentionQuantity !== null && phase.tentacleRetentionQuantity !== undefined ||
      phase.tentacleRetentionUnit !== null && phase.tentacleRetentionUnit !== undefined,
    phaseReleaseRetention: phase.releaseRetentionKeepForever ? 'keepAll' : 'keepLimited',
    phaseReleaseRetentionCount: phase.releaseRetentionQuantity ?? 30,
    phaseReleaseRetentionUnit: toRetentionUnit(phase.releaseRetentionUnit),
    phaseFileRetention: phase.tentacleRetentionKeepForever ? 'keepAll' : 'keepLimited',
    phaseFileRetentionCount: phase.tentacleRetentionQuantity ?? 30,
    phaseFileRetentionUnit: toRetentionUnit(phase.tentacleRetentionUnit),
    priority: !!phase.isPriorityPhase,
    environments: [...autoEnvironments, ...manualEnvironments],
  };
}

function slugifyLifecycleName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Main component ────────────────────────────────────────────────────────────

const Lifecycles: React.FC = () => {
  const { space } = useSpace();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');
  const [selectedLifecycle, setSelectedLifecycle] = useState<Lifecycle | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'usage'>('details');

  const [showCreatePage, setShowCreatePage] = useState(false);
  const [newLifecycleName, setNewLifecycleName] = useState('');
  const [newLifecycleDescription, setNewLifecycleDescription] = useState('');
  const [showMarkdownControls, setShowMarkdownControls] = useState(true);
  const [releaseRetention, setReleaseRetention] = useState('keepAll');
  const [releaseRetentionCount, setReleaseRetentionCount] = useState(30);
  const [releaseRetentionUnit, setReleaseRetentionUnit] = useState('Days');
  const [fileRetention, setFileRetention] = useState('keepAll');
  const [fileRetentionCount, setFileRetentionCount] = useState(30);
  const [fileRetentionUnit, setFileRetentionUnit] = useState('Days');

  // Create view panel state
  const createAllKeys = ['name', 'description', 'retentionPolicy', 'phases'];
  const [createActiveKeys, setCreateActiveKeys] = useState<string[]>(createAllKeys);
  const createAllExpanded = createActiveKeys.length === createAllKeys.length;
  const toggleCreatePanel = (key: string) => {
    setCreateActiveKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Create view phases
  const [newPhases, setNewPhases] = useState<NewPhase[]>([]);
  const addNewPhase = () => {
    setNewPhases(prev => [...prev, makeNewPhase(Date.now())]);
  };
  const updateNewPhase = (id: number, updates: Partial<NewPhase>) => {
    setNewPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };
  const deleteNewPhase = (id: number) => {
    setNewPhases(prev => prev.filter(p => p.id !== id));
  };
  const toggleNewPhase = (id: number) => {
    setNewPhases(prev => prev.map(p => p.id === id ? { ...p, isExpanded: !p.isExpanded } : p));
  };

  // Detail view panel state
  const detailAllKeys = ['name', 'description', 'retentionPolicy', 'phases'];
  const [detailActiveKeys, setDetailActiveKeys] = useState<string[]>([]);
  const [detailName, setDetailName] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailReleaseRetention, setDetailReleaseRetention] = useState('keepAllReleases');
  const [detailReleaseRetentionCount, setDetailReleaseRetentionCount] = useState(30);
  const [detailReleaseRetentionUnit, setDetailReleaseRetentionUnit] = useState('Days');
  const [detailFileRetention, setDetailFileRetention] = useState('keepAllFiles');
  const [detailFileRetentionCount, setDetailFileRetentionCount] = useState(30);
  const [detailFileRetentionUnit, setDetailFileRetentionUnit] = useState('Days');
  const [detailPhases, setDetailPhases] = useState<NewPhase[]>([]);
  const toggleDetailPanel = (key: string) => {
    setDetailActiveKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };
  const toggleDetailPhase = (id: number) => {
    setDetailPhases(prev => prev.map(p => p.id === id ? { ...p, isExpanded: !p.isExpanded } : p));
  };
  const updateDetailPhase = (id: number, updates: Partial<NewPhase>) => {
    setDetailPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };
  const addDetailPhase = () => {
    setDetailPhases(prev => [...prev, makeNewPhase(Date.now())]);
  };
  const deleteDetailPhase = (id: number) => {
    setDetailPhases(prev => prev.filter(p => p.id !== id));
  };

  // Sticky header refs
  const createSentinelRef = useRef<HTMLDivElement>(null);
  const [createIsSticky, setCreateIsSticky] = useState(false);
  const detailSentinelRef = useRef<HTMLDivElement>(null);
  const [detailIsSticky, setDetailIsSticky] = useState(false);

  useEffect(() => {
    const el = createSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCreateIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCreatePage]);

  useEffect(() => {
    const el = detailSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDetailIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedLifecycle]);

  // API data
  const [lifecyclesData, setLifecyclesData] = useState<Lifecycle[]>([]);
  const [loadingLifecycles, setLoadingLifecycles] = useState(false);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: number; label: string }[]>([]);
  const environmentNameById = useMemo(
    () => new Map(environmentOptions.map((opt) => [opt.value, opt.label])),
    [environmentOptions],
  );

  const loadEnvironments = async () => {
    try {
      const res = await getEnvironments({ pageIndex: 1, pageSize: 1000 });
      const options = (res.environments ?? [])
        .map((env) => ({ value: env.id, label: env.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setEnvironmentOptions(options);
    } catch {
      setEnvironmentOptions([]);
    }
  };

  const loadLifecycles = async () => {
    setLoadingLifecycles(true);
    try {
      const res = await getLifecycles();
      const mapped: Lifecycle[] = res.lifecycles.map((lc: LifecycleDto) => {
        const sortedPhases = (lc.phases ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return {
            id: lc.id,
            name: lc.name,
            slug: lc.slug,
            description: lc.description ?? null,
            retentionPolicy: 'Releases: Keep all. Files on Tentacle: Keep all.',
            phaseNames: sortedPhases.map((phase) => phase.name || ''),
            apiPhases: sortedPhases,
            apiLifecycle: lc.lifecycle ?? null,
          };
      });
      setLifecyclesData(mapped);
      return mapped;
    } catch {
      return [];
    } finally {
      setLoadingLifecycles(false);
    }
  };

  useEffect(() => {
    void loadEnvironments();
    void loadLifecycles();
  }, [space.id]);

  const filteredData = useMemo(() => {
    return lifecyclesData.filter(
      (item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (item.description ?? '').toLowerCase().includes(searchText.toLowerCase()) ||
        item.phaseNames.some((phaseName) => phaseName.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [searchText, lifecyclesData]);

  const renderPhaseWithLine = (phase: LifecyclePhaseDto, index: number, totalPhases: number) => {
    const isLast = index === totalPhases - 1;
    const displayName = phase.name || `Phase ${index + 1}`;
    const hasAutoDeployment = (phase.automaticDeploymentTargetIds?.length ?? 0) > 0;

    return (
      <div key={phase.id || `${phase.name}-${index}`} className="flex items-center min-h-[22px]">
        <div className="relative flex items-center justify-center shrink-0" style={{ width: '18px', height: '18px' }}>
          {hasAutoDeployment ? (
            <ThunderboltFilled className="text-orange-600" style={{ fontSize: '14px' }} />
          ) : (
            <span className="inline-block bg-gray-400" style={{ width: '12px', height: '12px', borderRadius: '2px' }} />
          )}
          {!isLast && (
            <div
              className="absolute bg-gray-300"
              style={{ width: '2px', height: '12px', top: '16px' }}
            />
          )}
        </div>
        <div className={`ml-2 leading-5 ${hasAutoDeployment ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
          {displayName}
        </div>
      </div>
    );
  };

  const handleLifecycleClick = (lifecycle: Lifecycle) => {
    setSelectedLifecycle(lifecycle);
    setActiveTab('details');
    setDetailActiveKeys(detailAllKeys);
    setDetailName(lifecycle.name);
    setDetailDescription(lifecycle.description ?? '');

    const releaseKeepForever = lifecycle.apiLifecycle?.releaseRetentionKeepForever ?? true;
    const releaseQuantity = lifecycle.apiLifecycle?.releaseRetentionQuantity ?? 30;
    const releaseUnit = lifecycle.apiLifecycle?.releaseRetentionUnit ?? 0;
    setDetailReleaseRetention(releaseKeepForever ? 'keepAllReleases' : 'keepLimitedReleases');
    setDetailReleaseRetentionCount(releaseQuantity || 30);
    setDetailReleaseRetentionUnit(toRetentionUnit(releaseUnit));

    const tentacleKeepForever = lifecycle.apiLifecycle?.tentacleRetentionKeepForever ?? true;
    const tentacleQuantity = lifecycle.apiLifecycle?.tentacleRetentionQuantity ?? 30;
    const tentacleUnit = lifecycle.apiLifecycle?.tentacleRetentionUnit ?? 0;
    setDetailFileRetention(tentacleKeepForever ? 'keepAllFiles' : 'keepLimitedFiles');
    setDetailFileRetentionCount(tentacleQuantity || 30);
    setDetailFileRetentionUnit(toRetentionUnit(tentacleUnit));

    setDetailPhases((lifecycle.apiPhases ?? []).map((phase, index) => mapPhaseFromApi(phase, environmentNameById, Date.now() + index)));
  };

  useEffect(() => {
    if (!lifecyclesData.length) return;

    const search = new URLSearchParams(location.search);
    const lifecycleIdRaw = search.get('lifecycleId');
    const lifecycleSlugRaw = search.get('lifecycleSlug');

    let matched: Lifecycle | undefined;

    if (lifecycleIdRaw) {
      const lifecycleId = Number(lifecycleIdRaw);
      if (Number.isFinite(lifecycleId)) {
        matched = lifecyclesData.find((item) => item.id === lifecycleId);
      }
    }

    if (!matched && lifecycleSlugRaw) {
      const slug = lifecycleSlugRaw.toLowerCase();
      matched = lifecyclesData.find((item) => item.slug.toLowerCase() === slug);
    }

    if (!matched) return;
    if (selectedLifecycle?.id === matched.id) return;

    handleLifecycleClick(matched);
  }, [lifecyclesData, location.search]);

  const buildRetention = (mode: string, count: number, unit: string) => {
    return {
      keepForever: mode === 'keepAll',
      quantity: mode === 'keepAll' ? 0 : count,
      unit: mode === 'keepAll' ? 0 : toRetentionUnitValue(unit),
    };
  };

  const buildDetailRetention = (mode: string, count: number, unit: string) => {
    return {
      keepForever: mode === 'keepAllReleases' || mode === 'keepAllFiles',
      quantity: mode === 'keepAllReleases' || mode === 'keepAllFiles' ? 0 : count,
      unit: mode === 'keepAllReleases' || mode === 'keepAllFiles' ? 0 : toRetentionUnitValue(unit),
    };
  };

  const handleSaveDetailLifecycle = async () => {
    if (!selectedLifecycle) return;
    const lifecycleName = detailName.trim();
    if (!lifecycleName) {
      message.error('Please enter a lifecycle name.');
      return;
    }

    const baseLifecycle = selectedLifecycle.apiLifecycle;
    if (!baseLifecycle) {
      message.error('Lifecycle payload is missing. Please refresh and try again.');
      return;
    }

    const detailRelease = buildDetailRetention(detailReleaseRetention, detailReleaseRetentionCount, detailReleaseRetentionUnit);
    const detailFile = buildDetailRetention(detailFileRetention, detailFileRetentionCount, detailFileRetentionUnit);

    const updateCommand: UpdateLifecycleCommand = {
      id: selectedLifecycle.id,
      lifecyclePhase: {
        lifecycle: {
          ...baseLifecycle,
          id: selectedLifecycle.id,
          name: lifecycleName,
          description: detailDescription.trim() ? detailDescription.trim() : null,
          releaseRetentionUnit: detailRelease.unit,
          releaseRetentionQuantity: detailRelease.quantity,
          releaseRetentionKeepForever: detailRelease.keepForever,
          tentacleRetentionUnit: detailFile.unit,
          tentacleRetentionQuantity: detailFile.quantity,
          tentacleRetentionKeepForever: detailFile.keepForever,
        },
        phases: detailPhases.map((p, index) => ({
          id: p.id,
          lifecycleId: selectedLifecycle.id,
          name: p.name,
          sortOrder: index + 1,
          automaticDeploymentTargetIds: p.environments.filter((e) => e.auto).map((e) => e.id),
          optionalDeploymentTargetIds: p.environments.filter((e) => !e.auto).map((e) => e.id),
          minimumEnvironmentsBeforePromotion: p.requiredToProgress === 'minimum' ? p.minimumCount : 0,
          isOptionalPhase: p.requiredToProgress === 'optional',
          isPriorityPhase: p.priority,
          releaseRetentionKeepForever: p.retentionOverridden ? p.phaseReleaseRetention !== 'keepLimited' : null,
          releaseRetentionQuantity: p.retentionOverridden && p.phaseReleaseRetention === 'keepLimited' ? p.phaseReleaseRetentionCount : null,
          releaseRetentionUnit: p.retentionOverridden && p.phaseReleaseRetention === 'keepLimited'
            ? toRetentionUnitValue(p.phaseReleaseRetentionUnit)
            : null,
          tentacleRetentionKeepForever: p.retentionOverridden ? p.phaseFileRetention !== 'keepLimited' : null,
          tentacleRetentionQuantity: p.retentionOverridden && p.phaseFileRetention === 'keepLimited' ? p.phaseFileRetentionCount : null,
          tentacleRetentionUnit: p.retentionOverridden && p.phaseFileRetention === 'keepLimited'
            ? toRetentionUnitValue(p.phaseFileRetentionUnit)
            : null,
        })),
      },
    };

    setUpdatingLifecycle(true);
    try {
      await updateLifecycle(updateCommand);
      const refreshed = await loadLifecycles();
      const updatedLifecycle = refreshed.find((item) => item.id === selectedLifecycle.id);
      if (updatedLifecycle) {
        handleLifecycleClick(updatedLifecycle);
      }
      message.success('Lifecycle updated successfully.');
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        error?.message;
      message.error(backendMsg ? `Failed to update lifecycle: ${backendMsg}` : 'Failed to update lifecycle. Please try again.');
    } finally {
      setUpdatingLifecycle(false);
    }
  };

  const handleSaveNewLifecycle = async () => {
    if (!newLifecycleName.trim()) {
      message.error('Please enter a lifecycle name.');
      return;
    }

    const command: CreateLifecycleCommand = {
      lifecyclePhase: {
        lifecycle: {
          id: 0,
          name: newLifecycleName.trim(),
          slug: slugifyLifecycleName(newLifecycleName.trim()) || `lifecycle-${Date.now()}`,
          description: newLifecycleDescription.trim() ? newLifecycleDescription.trim() : null,
          spaceId: space.id,
          releaseRetentionUnit: buildRetention(releaseRetention, releaseRetentionCount, releaseRetentionUnit).unit,
          releaseRetentionQuantity: buildRetention(releaseRetention, releaseRetentionCount, releaseRetentionUnit).quantity,
          releaseRetentionKeepForever: buildRetention(releaseRetention, releaseRetentionCount, releaseRetentionUnit).keepForever,
          tentacleRetentionUnit: buildRetention(fileRetention, fileRetentionCount, fileRetentionUnit).unit,
          tentacleRetentionQuantity: buildRetention(fileRetention, fileRetentionCount, fileRetentionUnit).quantity,
          tentacleRetentionKeepForever: buildRetention(fileRetention, fileRetentionCount, fileRetentionUnit).keepForever,
        },
        phases: newPhases.map((p, index) => ({
          id: 0,
          lifecycleId: 0,
          name: p.name,
          sortOrder: index + 1,
          automaticDeploymentTargetIds: p.environments.filter((e) => e.auto).map((e) => e.id),
          optionalDeploymentTargetIds: p.environments.filter((e) => !e.auto).map((e) => e.id),
          minimumEnvironmentsBeforePromotion: p.requiredToProgress === 'minimum' ? p.minimumCount : 0,
          isOptionalPhase: p.requiredToProgress === 'optional',
          isPriorityPhase: p.priority,
          releaseRetentionKeepForever: p.retentionOverridden ? p.phaseReleaseRetention !== 'keepLimited' : null,
          releaseRetentionQuantity: p.retentionOverridden && p.phaseReleaseRetention === 'keepLimited' ? p.phaseReleaseRetentionCount : null,
          releaseRetentionUnit: p.retentionOverridden && p.phaseReleaseRetention === 'keepLimited'
            ? toRetentionUnitValue(p.phaseReleaseRetentionUnit)
            : null,
          tentacleRetentionKeepForever: p.retentionOverridden ? p.phaseFileRetention !== 'keepLimited' : null,
          tentacleRetentionQuantity: p.retentionOverridden && p.phaseFileRetention === 'keepLimited' ? p.phaseFileRetentionCount : null,
          tentacleRetentionUnit: p.retentionOverridden && p.phaseFileRetention === 'keepLimited'
            ? toRetentionUnitValue(p.phaseFileRetentionUnit)
            : null,
        })),
      },
    };

    setSavingLifecycle(true);
    try {
      await createLifecycle(command);
      message.success('Lifecycle created successfully.');
      setShowCreatePage(false);
      resetCreateForm();
      loadLifecycles();
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        error?.message
      message.error(backendMsg ? `Failed to create lifecycle: ${backendMsg}` : 'Failed to create lifecycle. Please try again.');
    } finally {
      setSavingLifecycle(false);
    }
  };

  const resetCreateForm = () => {
    setNewLifecycleName('');
    setNewLifecycleDescription('');
    setReleaseRetention('keepAll');
    setReleaseRetentionCount(30);
    setReleaseRetentionUnit('Days');
    setFileRetention('keepAll');
    setFileRetentionCount(30);
    setFileRetentionUnit('Days');
    setShowMarkdownControls(true);
    setCreateActiveKeys(createAllKeys);
    setNewPhases([]);
  };

  const handleBackToList = () => {
    setSelectedLifecycle(null);
    setActiveTab('details');
  };

  const handleExpandAll = () => {
    setDetailActiveKeys(detailAllKeys);
    setDetailPhases(prev => prev.map(p => ({ ...p, isExpanded: true })));
  };

  const handleCollapseAll = () => {
    setDetailActiveKeys([]);
    setDetailPhases(prev => prev.map(p => ({ ...p, isExpanded: false })));
  };

  const moreMenuItems = [{ key: '1', label: 'Audit Trail' }];
  const stickyBoxShadow = '0 1px 1px 0 rgba(0,0,0,0.12), 0 1px 8px 0 rgba(0,0,0,0.06)';

  const detailPreviewPhases = detailPhases;
  const createPreviewPhases = newPhases.filter(p => p.name.trim() || p.environments.length > 0);

  // ── Detail view ───────────────────────────────────────────────────────────────

  if (selectedLifecycle) {
    return (
      <div className="min-h-screen bg-white">
        <div ref={detailSentinelRef} style={{ height: 1 }} />
        <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
          <div className="border border-gray-200 rounded-md">

            {/* Sticky header */}
            <div
              className="sticky top-0 z-10 bg-white rounded-t-md border-b border-gray-200 px-6 pt-5 pb-0 transition-shadow duration-200"
              style={detailIsSticky ? { boxShadow: stickyBoxShadow } : {}}
            >
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1.5 text-sm text-squid-blue hover:underline bg-transparent border-0 cursor-pointer mb-3 p-0"
              >
                Lifecycles
              </button>
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-semibold text-gray-900 m-0">{detailName || selectedLifecycle.name}</h1>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleLifecycleClick(selectedLifecycle)} disabled={updatingLifecycle}>
                    Reset
                  </Button>
                  <Button
                    type="primary"
                    className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                    onClick={handleSaveDetailLifecycle}
                    loading={updatingLifecycle}
                  >
                    Save
                  </Button>
                  <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
                    <Button icon={<MoreOutlined />} />
                  </Dropdown>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-8 -mx-6 px-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
                {(['details', 'usage'] as const).map(tab => (
                  <div
                    key={tab}
                    className={`pb-3 cursor-pointer ${
                      activeTab === tab
                        ? 'border-b-2 border-squid-blue text-squid-blue font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-4 pb-2 pt-2">
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                  onClick={handleExpandAll}
                >
                  EXPAND ALL
                </button>
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                  onClick={handleCollapseAll}
                >
                  COLLAPSE ALL
                </button>
              </div>
            </div>

            {/* Details tab */}
            {activeTab === 'details' && (
              <>
                <FormPanel
                  title="Name"
                  description={detailActiveKeys.includes('name') ? 'Enter a name for your lifecycle.' : selectedLifecycle.name}
                  isOpen={detailActiveKeys.includes('name')}
                  onToggle={() => toggleDetailPanel('name')}
                >
                  <Input value={detailName} onChange={(e) => setDetailName(e.target.value)} />
                </FormPanel>

                <FormPanel
                  title="Description"
                  description={detailActiveKeys.includes('description') ? 'Enter a description for your lifecycle.' : (selectedLifecycle.description ?? '')}
                  isOpen={detailActiveKeys.includes('description')}
                  onToggle={() => toggleDetailPanel('description')}
                >
                  <MarkdownToolbar />
                  <Input.TextArea
                    placeholder="Lifecycle description"
                    rows={4}
                    value={detailDescription}
                    onChange={(e) => setDetailDescription(e.target.value)}
                    className="rounded-t-none border-t-0 mb-2"
                  />
                  <div className="flex gap-4 text-sm">
                    <span className="text-squid-blue cursor-pointer hover:underline">Hide markdown controls</span>
                    <span className="text-squid-blue cursor-pointer hover:underline">Markdown instructions</span>
                  </div>
                </FormPanel>

                <FormPanel
                  title="Retention Policy"
                  description={detailActiveKeys.includes('retentionPolicy') ? 'Change the retention policy.' : selectedLifecycle.retentionPolicy}
                  isOpen={detailActiveKeys.includes('retentionPolicy')}
                  onToggle={() => toggleDetailPanel('retentionPolicy')}
                >
                  <div className="text-sm text-gray-700 space-y-6">
                    <div>
                      <div className="mb-2">How long should we keep releases?</div>
                      <Radio.Group
                        value={detailReleaseRetention}
                        onChange={(e) => setDetailReleaseRetention(e.target.value)}
                        className="flex flex-col space-y-1"
                      >
                        <Radio value="keepAllReleases">Keep all (default)</Radio>
                        <Radio value="keepLimitedReleases">Keep a limited number</Radio>
                      </Radio.Group>
                      {detailReleaseRetention === 'keepLimitedReleases' && (
                        <div className="flex items-center gap-2 mt-2 ml-6">
                          <InputNumber
                            min={1}
                            value={detailReleaseRetentionCount}
                            onChange={(v) => setDetailReleaseRetentionCount(v ?? 1)}
                            style={{ width: 80 }}
                          />
                          <Select
                            value={detailReleaseRetentionUnit}
                            onChange={setDetailReleaseRetentionUnit}
                            style={{ width: 110 }}
                            options={[
                              { value: 'Days', label: 'Days' },
                              { value: 'Weeks', label: 'Weeks' },
                              { value: 'Months', label: 'Months' },
                              { value: 'Years', label: 'Years' },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-2">How long should we keep extracted packages and files on disk on Tentacles?</div>
                      <Radio.Group
                        value={detailFileRetention}
                        onChange={(e) => setDetailFileRetention(e.target.value)}
                        className="flex flex-col space-y-1"
                      >
                        <Radio value="keepAllFiles">Keep all (default)</Radio>
                        <Radio value="keepLimitedFiles">Keep a limited number</Radio>
                      </Radio.Group>
                      {detailFileRetention === 'keepLimitedFiles' && (
                        <div className="flex items-center gap-2 mt-2 ml-6">
                          <InputNumber
                            min={1}
                            value={detailFileRetentionCount}
                            onChange={(v) => setDetailFileRetentionCount(v ?? 1)}
                            style={{ width: 80 }}
                          />
                          <Select
                            value={detailFileRetentionUnit}
                            onChange={setDetailFileRetentionUnit}
                            style={{ width: 110 }}
                            options={[
                              { value: 'Days', label: 'Days' },
                              { value: 'Weeks', label: 'Weeks' },
                              { value: 'Months', label: 'Months' },
                              { value: 'Years', label: 'Years' },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 leading-relaxed">
                      Retention policies dictate how long releases and deployments are kept for. For more information please see{' '}
                      <span className="text-squid-blue cursor-pointer hover:underline">retention policies</span> documentation.
                    </div>
                  </div>
                </FormPanel>

                {/* Phases */}
                <div>
                  <div
                    className="grid items-start py-4 pl-6 pr-10 cursor-pointer select-none"
                    style={{ gridTemplateColumns: '220px 1fr' }}
                    onClick={() => toggleDetailPanel('phases')}
                  >
                    <div className="text-base font-bold text-gray-900 pt-0.5">Phases</div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-sm text-gray-500 flex-1">
                        Projects that use this lifecycle can only be deployed according to the phases below.
                      </div>
                      <DownOutlined
                        style={{ fontSize: 11 }}
                        className={`text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${detailActiveKeys.includes('phases') ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {detailActiveKeys.includes('phases') && (
                    <div className="grid pl-6 pr-10 pb-5" style={{ gridTemplateColumns: '220px 1fr' }}>
                      <div />
                      <div>
                        {detailPhases.length === 0 && (
                          <div className="text-sm text-gray-500 mb-4">
                            This lifecycle will use the default conventions. Use the{' '}
                            <span className="italic">Add phase</span> button to explicitly define phases or restrict
                            deployments to specific environments.
                          </div>
                        )}
                        {detailPhases.map((phase, index) => (
                          <PhaseCard
                            key={phase.id}
                            phase={phase}
                            index={index}
                            environmentOptions={environmentOptions}
                            allowDelete
                            onToggle={() => toggleDetailPhase(phase.id)}
                            onUpdate={(updates) => updateDetailPhase(phase.id, updates)}
                            onDelete={() => deleteDetailPhase(phase.id)}
                          />
                        ))}
                        <Button
                          type="primary"
                          ghost
                          icon={<PlusOutlined />}
                          onClick={addDetailPhase}
                          className="mt-1"
                        >
                          Add Phase
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Usage tab */}
            {activeTab === 'usage' && (
              <FormPanel
                title="Projects"
                description={`This lifecycle is being used in ${selectedLifecycle.projectCount || 0} projects`}
                isOpen={false}
                onToggle={() => {}}
                hasBorder={false}
              />
            )}
          </div>

          {/* Lifecycle Preview */}
          {activeTab === 'details' && (
            <div className="mt-6 border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-gray-50 py-3 px-4 font-semibold text-gray-700 border-b border-gray-200 flex items-center justify-between gap-3">
                <span>Lifecycle Preview</span>
                <span className="text-xs font-normal text-gray-500">
                  {detailPreviewPhases.length === 0 ? 'Default conventions' : `${detailPreviewPhases.length} phase${detailPreviewPhases.length > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="bg-white p-6 space-y-4">
                {detailPreviewPhases.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-4">
                    <div className="text-sm font-medium text-gray-700">Uses default conventions</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Deployments can progress through environments in their configured order unless explicit phases are added.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
                    <ul className="m-0 list-none p-0">
                      {detailPreviewPhases.map((phase, index) => {
                        const isLast = index === detailPreviewPhases.length - 1;
                        const displayName = phase.name.trim() || `Phase ${index + 1}`;
                        const isOptionalPhase = phase.requiredToProgress === 'optional';
                        const progressionText =
                          phase.requiredToProgress === 'minimum'
                            ? `Progress after ${phase.minimumCount} environment${phase.minimumCount > 1 ? 's' : ''}`
                            : phase.requiredToProgress === 'optional'
                              ? 'Optional phase'
                              : 'Progress after all environments';

                        return (
                          <li key={phase.id} className={isLast ? '' : 'pb-3'}>
                            <div className="flex">
                              <div className="flex flex-col items-center pt-1" style={{ width: 18 }}>
                                <span
                                  className={[
                                    'inline-block',
                                    isOptionalPhase ? 'border border-slate-400 bg-white' : 'bg-slate-500',
                                  ].join(' ')}
                                  style={{ width: '8px', height: '8px', borderRadius: '999px' }}
                                />
                                {!isLast && (
                                  <div className="bg-gray-300 mt-1" style={{ width: '1px', height: '100%' }} />
                                )}
                              </div>

                              <div className="ml-2.5 flex-1">
                                <div className="text-sm text-gray-800">
                                  <span className="font-semibold">{displayName}</span>
                                  {isOptionalPhase && <span className="text-gray-500"> (optional)</span>}
                                  {phase.priority && (
                                    <span className="ml-2 text-[11px] rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 align-middle">
                                      Priority
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{progressionText}</div>

                                {phase.environments.length === 0 ? (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Any environment (not explicitly named in another phase)
                                  </div>
                                ) : (
                                  <ul className="mt-2 mb-0 list-none p-0 space-y-1">
                                    {phase.environments.map((env) => (
                                      <li
                                        key={env.key}
                                        className="flex items-center gap-2 text-sm text-gray-700"
                                        title={env.auto ? 'Automatically deploy to this environment' : 'Manually deploy to this environment'}
                                      >
                                        <span
                                          className={[
                                            'inline-block',
                                            env.auto ? 'bg-squid-blue' : 'border border-slate-400 bg-white',
                                          ].join(' ')}
                                          style={{ width: '7px', height: '7px', borderRadius: '999px' }}
                                        />
                                        <span>{env.name}</span>
                                        <span className="text-xs text-gray-500">{env.auto ? '(auto)' : '(manual)'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Create view ───────────────────────────────────────────────────────────────

  if (showCreatePage) {
    return (
      <div className="min-h-screen bg-white">
        <div ref={createSentinelRef} style={{ height: 1 }} />
        <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
          <div className="border border-gray-200 rounded-md">

            {/* Sticky header */}
            <div
              className="sticky top-0 z-10 bg-white rounded-t-md border-b border-gray-200 px-6 pt-5 pb-0 transition-shadow duration-200"
              style={createIsSticky ? { boxShadow: stickyBoxShadow } : {}}
            >
              <button
                onClick={() => { setShowCreatePage(false); resetCreateForm(); }}
                className="flex items-center gap-1.5 text-sm text-squid-blue hover:underline bg-transparent border-0 cursor-pointer mb-3 p-0"
              >
                Lifecycles
              </button>
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-semibold text-gray-900 m-0">Create Lifecycle</h1>
                <div className="flex items-center gap-2">
                  <Button onClick={() => { setShowCreatePage(false); resetCreateForm(); }}>Cancel</Button>
                  <Button
                    type="primary"
                    className="!bg-green-700 hover:!bg-green-800 !border-green-700"
                    onClick={handleSaveNewLifecycle}
                    loading={savingLifecycle}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex justify-end pb-2">
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 uppercase font-semibold tracking-wide bg-transparent border-0 cursor-pointer"
                  onClick={() => setCreateActiveKeys(createAllExpanded ? [] : createAllKeys)}
                >
                  {createAllExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
                </button>
              </div>
            </div>

            <FormPanel
              title="Name"
              description="Enter a name for your lifecycle."
              isOpen={createActiveKeys.includes('name')}
              onToggle={() => toggleCreatePanel('name')}
            >
              <Input
                placeholder="Lifecycle name"
                value={newLifecycleName}
                onChange={(e) => setNewLifecycleName(e.target.value)}
              />
            </FormPanel>

            <FormPanel
              title="Description"
              description="Enter a description for your lifecycle."
              isOpen={createActiveKeys.includes('description')}
              onToggle={() => toggleCreatePanel('description')}
            >
              {showMarkdownControls && <MarkdownToolbar />}
              <Input.TextArea
                placeholder="Lifecycle description"
                rows={4}
                value={newLifecycleDescription}
                onChange={(e) => setNewLifecycleDescription(e.target.value)}
                className={showMarkdownControls ? 'rounded-t-none border-t-0' : ''}
              />
              <div className="flex gap-4 text-sm mt-2">
                <span
                  className="text-squid-blue cursor-pointer hover:underline"
                  onClick={(e) => { e.stopPropagation(); setShowMarkdownControls(!showMarkdownControls); }}
                >
                  {showMarkdownControls ? 'Hide' : 'Show'} markdown controls
                </span>
                <a href="#" className="text-squid-blue hover:underline flex items-center gap-1">
                  Markdown instructions <span className="text-xs">↗</span>
                </a>
              </div>
            </FormPanel>

            <FormPanel
              title="Retention Policy"
              description="Change the retention policy."
              isOpen={createActiveKeys.includes('retentionPolicy')}
              onToggle={() => toggleCreatePanel('retentionPolicy')}
            >
              <div className="text-sm text-gray-700 space-y-6">
                <div>
                  <div className="mb-3 font-medium">How long should we keep releases?</div>
                  <Radio.Group
                    value={releaseRetention}
                    onChange={(e) => setReleaseRetention(e.target.value)}
                    className="flex flex-col space-y-2"
                  >
                    <Radio value="keepAll">Keep all (default)</Radio>
                    <Radio value="keepLimited">Keep a limited number</Radio>
                  </Radio.Group>
                  {releaseRetention === 'keepLimited' && (
                    <div className="flex items-center gap-2 mt-2 ml-6" onClick={(e) => e.stopPropagation()}>
                      <InputNumber
                        min={1}
                        value={releaseRetentionCount}
                        onChange={(v) => setReleaseRetentionCount(v ?? 1)}
                        style={{ width: 80 }}
                      />
                      <Select
                        value={releaseRetentionUnit}
                        onChange={setReleaseRetentionUnit}
                        style={{ width: 110 }}
                        options={[
                          { value: 'Days', label: 'Days' },
                          { value: 'Weeks', label: 'Weeks' },
                          { value: 'Months', label: 'Months' },
                          { value: 'Years', label: 'Years' },
                        ]}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-3 font-medium">
                    How long should we keep extracted packages and files on disk on Tentacles?
                  </div>
                  <Radio.Group
                    value={fileRetention}
                    onChange={(e) => setFileRetention(e.target.value)}
                    className="flex flex-col space-y-2"
                  >
                    <Radio value="keepAll">Keep all (default)</Radio>
                    <Radio value="keepLimited">Keep a limited number</Radio>
                  </Radio.Group>
                  {fileRetention === 'keepLimited' && (
                    <div className="flex items-center gap-2 mt-2 ml-6" onClick={(e) => e.stopPropagation()}>
                      <InputNumber
                        min={1}
                        value={fileRetentionCount}
                        onChange={(v) => setFileRetentionCount(v ?? 1)}
                        style={{ width: 80 }}
                      />
                      <Select
                        value={fileRetentionUnit}
                        onChange={setFileRetentionUnit}
                        style={{ width: 110 }}
                        options={[
                          { value: 'Days', label: 'Days' },
                          { value: 'Weeks', label: 'Weeks' },
                          { value: 'Months', label: 'Months' },
                          { value: 'Years', label: 'Years' },
                        ]}
                      />
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Retention policies dictate how long releases and deployments are kept for. For more information please see{' '}
                  <a href="#" className="text-squid-blue hover:underline">retention policies ↗</a> documentation.
                </div>
              </div>
            </FormPanel>

            <FormPanel
              title="Phases"
              description="Add deployment phases to this lifecycle."
              isOpen={createActiveKeys.includes('phases')}
              onToggle={() => toggleCreatePanel('phases')}
              hasBorder={false}
            >
              {newPhases.length === 0 && (
                <div className="text-sm text-gray-500 mb-4">
                  This lifecycle will use the default conventions. They allow deployment to any environment, so long as
                  environments are deployed in the order that they are defined on the{' '}
                  <a href="#" className="text-squid-blue hover:underline">environments</a> page. Use the{' '}
                  <span className="italic">Add phase</span> button to explicitly define your own phases or to restrict
                  the lifecycle to specific environments.
                </div>
              )}
              {newPhases.map((phase, index) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  index={index}
                  environmentOptions={environmentOptions}
                  onToggle={() => toggleNewPhase(phase.id)}
                  onUpdate={(updates) => updateNewPhase(phase.id, updates)}
                  onDelete={() => deleteNewPhase(phase.id)}
                />
              ))}
              <Button
                type="primary"
                ghost
                icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); addNewPhase(); }}
                className="mt-1"
              >
                Add Phase
              </Button>
            </FormPanel>
          </div>

          {/* Lifecycle Preview */}
          <div className="mt-6 border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-gray-50 py-3 px-4 font-semibold text-gray-700 border-b border-gray-200 flex items-center justify-between gap-3">
              <span>Lifecycle Preview</span>
              <span className="text-xs font-normal text-gray-500">
                {createPreviewPhases.length === 0 ? 'Default conventions' : `${createPreviewPhases.length} phase${createPreviewPhases.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="bg-white p-6 space-y-4">
              {createPreviewPhases.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-4">
                  <div className="text-sm font-medium text-gray-700">Uses default conventions</div>
                  <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Deployments can progress through environments in their configured order unless explicit phases are added.
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
                  <ul className="m-0 list-none p-0">
                  {createPreviewPhases.map((phase, index) => {
                    const isLast = index === createPreviewPhases.length - 1;
                    const displayName = phase.name.trim() || `Phase ${index + 1}`;
                    const isOptionalPhase = phase.requiredToProgress === 'optional';
                    const progressionText =
                      phase.requiredToProgress === 'minimum'
                        ? `Progress after ${phase.minimumCount} environment${phase.minimumCount > 1 ? 's' : ''}`
                        : phase.requiredToProgress === 'optional'
                          ? 'Optional phase'
                          : 'Progress after all environments';

                    return (
                      <li key={phase.id} className={isLast ? '' : 'pb-3'}>
                        <div className="flex">
                          <div className="flex flex-col items-center pt-1" style={{ width: 18 }}>
                            <span
                              className={[
                                'inline-block',
                                isOptionalPhase ? 'border border-slate-400 bg-white' : 'bg-slate-500',
                              ].join(' ')}
                              style={{ width: '8px', height: '8px', borderRadius: '999px' }}
                            />
                            {!isLast && (
                              <div className="bg-gray-300 mt-1" style={{ width: '1px', height: '100%' }} />
                            )}
                          </div>

                          <div className="ml-2.5 flex-1">
                            <div className="text-sm text-gray-800">
                              <span className="font-semibold">{displayName}</span>
                              {isOptionalPhase && <span className="text-gray-500"> (optional)</span>}
                              {phase.priority && (
                                <span className="ml-2 text-[11px] rounded-full bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 align-middle">
                                  Priority
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{progressionText}</div>

                            {phase.environments.length === 0 ? (
                              <div className="mt-2 text-xs text-gray-500">
                                Any environment (not explicitly named in another phase)
                              </div>
                            ) : (
                              <ul className="mt-2 mb-0 list-none p-0 space-y-1">
                                {phase.environments.map((env) => (
                                  <li
                                    key={env.key}
                                    className="flex items-center gap-2 text-sm text-gray-700"
                                    title={env.auto ? 'Automatically deploy to this environment' : 'Manually deploy to this environment'}
                                  >
                                    <span
                                      className={[
                                        'inline-block',
                                        env.auto ? 'bg-squid-blue' : 'border border-slate-400 bg-white',
                                      ].join(' ')}
                                      style={{ width: '7px', height: '7px', borderRadius: '999px' }}
                                    />
                                    <span>{env.name}</span>
                                    <span className="text-xs text-gray-400">{env.auto ? '(auto)' : ''}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 pt-4 pb-10">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <div className="px-6 pt-5 pb-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Lifecycles</h1>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowCreatePage(true)}
                className="!bg-green-700 hover:!bg-green-800 !border-green-700"
              >
                ADD LIFECYCLE
              </Button>
            </div>

            <Input
              placeholder="Filter by name or phase name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 300 }}
            />
          </div>

          <div className="p-6">
            <Spin spinning={loadingLifecycles}>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {filteredData.length === 0 && !loadingLifecycles && (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">No lifecycles found.</div>
                )}
                {filteredData.map((lifecycle, idx) => (
                  <div
                    key={lifecycle.id}
                    className={[
                      'px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer',
                      idx < filteredData.length - 1 ? 'border-b border-gray-200' : '',
                    ].join(' ')}
                    onClick={() => handleLifecycleClick(lifecycle)}
                  >
                    <h3 className="text-squid-blue text-base font-medium mb-1">{lifecycle.name}</h3>
                    {lifecycle.description && (
                      <p className="text-gray-500 text-sm mb-2">{lifecycle.description}</p>
                    )}
                    {lifecycle.apiPhases.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {lifecycle.apiPhases.map((phase, index) =>
                          renderPhaseWithLine(phase, index, lifecycle.apiPhases.length)
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-500">
                        Uses default conventions
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lifecycles;
