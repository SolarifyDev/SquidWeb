import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';
import { Button, Dropdown, Input, Popover, Select, Spin, Tabs, message } from 'antd';
import { EditOutlined, FilterOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import { getProjects } from 'pages/apis/project';
import { getEnvironments } from 'pages/apis/environment';
import { getMachines } from 'pages/apis/machine';
import { getTargetTags } from 'pages/apis/targetTag';
import {
  GetVariableSet,
  UpdateVariableSet,
  VariableDto,
  VariableScopeDto,
  VariableScopeType,
  VariableSetDto,
  VariableType,
} from 'pages/apis/variableSet';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VariableGroup {
  name: string;
  entries: VariableDto[];
}

interface NewVarState {
  name: string;
}

interface ScopeEditorState {
  environments: string[];
  targetTags: string[];
  targets: string[];
}

interface DraftValueRow {
  id: string;
  value: string;
  scopes: VariableScopeDto[];
}

type ScopeEditorTarget =
  | { kind: 'existing'; id: number }
  | { kind: 'draft'; id: string }
  | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const NAME_COL_WIDTH = '25%';
const VALUE_COL_WIDTH = '39%';
const SCOPE_COL_WIDTH = '30%';
const CONTROL_COL_WIDTH = '6%';
const ROW_HEIGHT = 48;
const GROUP_ROW_HEIGHT = 32;

const headerOverflowItems = [{ key: 'delete', label: 'Delete' }];

// ── Helpers ───────────────────────────────────────────────────────────────────

function createDraftValueRow(): DraftValueRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    value: '',
    scopes: [],
  };
}

function normalizeVariablesForUpdate(variables: VariableDto[]): VariableDto[] {
  return variables.map((v, index) => ({
    id: 0,
    variableSetId: 0,
    name: v.name ?? '',
    value: v.value ?? '',
    description: v.description ?? '',
    type: v.type ?? VariableType.String,
    isSensitive: v.isSensitive ?? false,
    sortOrder: index,
    lastModifiedOn: null,
    lastModifiedBy: '',
    scopes: (v.scopes ?? []).map((s) => ({
      id: 0,
      variableId: 0,
      scopeType: s.scopeType,
      scopeValue: s.scopeValue ?? '',
    })),
  }));
}

function groupVariables(variables: VariableDto[]): VariableGroup[] {
  const map = new Map<string, VariableDto[]>();
  for (const v of variables) {
    const arr = map.get(v.name) ?? [];
    arr.push(v);
    map.set(v.name, arr);
  }
  return Array.from(map.entries()).map(([name, entries]) => ({ name, entries }));
}

function uniqueStringValues(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function toScopeEditorState(scopes: VariableScopeDto[]): ScopeEditorState {
  return {
    environments: uniqueStringValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Environment).map((s) => s.scopeValue),
    ),
    targetTags: uniqueStringValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Role).map((s) => s.scopeValue),
    ),
    targets: uniqueStringValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Machine).map((s) => s.scopeValue),
    ),
  };
}

function applyScopeEditorToScopes(
  originalScopes: VariableScopeDto[],
  editor: ScopeEditorState,
  variableId: number,
): VariableScopeDto[] {
  const preserved = (originalScopes ?? []).filter(
    (scope) =>
      scope.scopeType !== VariableScopeType.Environment &&
      scope.scopeType !== VariableScopeType.Role &&
      scope.scopeType !== VariableScopeType.Machine,
  );
  const base = Date.now();
  return [
    ...preserved,
    ...uniqueStringValues(editor.environments).map((name, i) => ({
      id: base + i,
      variableId,
      scopeType: VariableScopeType.Environment,
      scopeValue: name,
    })),
    ...uniqueStringValues(editor.targetTags).map((name, i) => ({
      id: base + 1000 + i,
      variableId,
      scopeType: VariableScopeType.Role,
      scopeValue: name,
    })),
    ...uniqueStringValues(editor.targets).map((name, i) => ({
      id: base + 2000 + i,
      variableId,
      scopeType: VariableScopeType.Machine,
      scopeValue: name,
    })),
  ];
}

function sanitizeVisibleVariables(variables: VariableDto[]): VariableDto[] {
  return variables.filter((item) => {
    const key = item.name?.trim().toLowerCase();
    return key !== 'name' && key !== 'description';
  });
}

function scopeSignature(scopes: VariableScopeDto[]): string {
  return (scopes ?? [])
    .map((s) => `${s.scopeType}:${(s.scopeValue ?? '').trim()}`)
    .sort()
    .join('|');
}

function areVariablesEquivalent(a: VariableDto, b: VariableDto): boolean {
  return (
    (a.name ?? '').trim() === (b.name ?? '').trim() &&
    (a.value ?? '') === (b.value ?? '') &&
    (a.description ?? '') === (b.description ?? '') &&
    a.type === b.type &&
    a.isSensitive === b.isSensitive &&
    scopeSignature(a.scopes ?? []) === scopeSignature(b.scopes ?? [])
  );
}

function hasVariableChanges(current: VariableDto[], original: VariableDto[]): boolean {
  if (current.length !== original.length) return true;
  const map = new Map(original.map((item) => [item.id, item]));
  for (const item of current) {
    const baseline = map.get(item.id);
    if (!baseline || !areVariablesEquivalent(item, baseline)) return true;
  }
  return false;
}

// ── Shared sub-components (copied from VariableSetDetail) ─────────────────────

const EnvironmentIcon: React.FC = () => (
  <svg viewBox="0 0 200 200" width="12" height="12" style={{ marginRight: 3, flexShrink: 0 }} aria-hidden="true">
    <path fill="currentColor" d="M14 30v35h172V30zm26 26H23V39h17zM14 83v35h95V83zm26 26H23V92h17zM14 134v35h172v-35zm26 26H23v-17h17z" />
  </svg>
);

const ScopeChip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs mr-1 select-none">
    <EnvironmentIcon />
    {label}
  </span>
);

const InlineVariableInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-transparent border-0 border-b border-transparent px-0 py-1 text-sm font-mono text-gray-800 placeholder:text-gray-400 outline-none focus:border-slate-300"
  />
);

const ScopeCell: React.FC<{
  entry: VariableDto;
  editorOpen: boolean;
  onEditorOpenChange: (open: boolean) => void;
  editorContent: React.ReactNode;
}> = ({ entry, editorOpen, onEditorOpenChange, editorContent }) => (
  <div className="w-full">
    <Popover
      trigger="click"
      open={editorOpen}
      onOpenChange={onEditorOpenChange}
      content={editorContent}
      placement="bottomLeft"
      destroyTooltipOnHide
    >
      <div className="w-full min-h-[28px] py-1 flex items-center flex-wrap gap-0.5 min-w-0 cursor-pointer">
        {entry.scopes.length > 0 ? (
          entry.scopes.map((s, i) => (
            <ScopeChip key={`${s.scopeType}-${s.scopeValue}-${i}`} label={s.scopeValue} />
          ))
        ) : (
          <span className="text-gray-400 text-xs font-mono hover:text-gray-600">Define scope</span>
        )}
      </div>
    </Popover>
  </div>
);

const RowControlActions: React.FC<{
  isModified: boolean;
  rowMenuItems: { key: string; label: string; danger?: boolean }[];
  onMenuAction: (key: string) => void;
}> = ({ isModified, rowMenuItems, onMenuAction }) => (
  <div className="relative w-full h-full flex items-center justify-end">
    {isModified && <EditOutlined className="absolute left-0 text-gray-400 text-xs" />}
    <Dropdown
      menu={{ items: rowMenuItems, onClick: ({ key }) => onMenuAction(String(key)) }}
      trigger={['click']}
    >
      <Button
        icon={<MoreOutlined />}
        type="text"
        size="small"
        aria-label="OverflowMenu"
        className="!inline-flex !items-center !justify-center !w-8 !h-8"
      />
    </Dropdown>
  </div>
);

const SingleVariableRow: React.FC<{
  entry: VariableDto;
  onNameChange: (id: number, name: string) => void;
  onValueChange: (id: number, value: string) => void;
  isModified: boolean;
  rowMenuItems: { key: string; label: string; danger?: boolean }[];
  onRowMenuAction: (entry: VariableDto, key: string) => void;
  scopeEditorOpen: boolean;
  onScopeEditorOpenChange: (entry: VariableDto, open: boolean) => void;
  scopeEditorContent: React.ReactNode;
}> = ({ entry, onNameChange, onValueChange, isModified, rowMenuItems, onRowMenuAction, scopeEditorOpen, onScopeEditorOpenChange, scopeEditorContent }) => (
  <div className="flex items-center hover:bg-gray-50 border-b border-gray-200" style={{ minHeight: ROW_HEIGHT }}>
    <div style={{ width: NAME_COL_WIDTH }} className="px-3">
      <InlineVariableInput value={entry.name} onChange={(next) => onNameChange(entry.id, next)} />
    </div>
    <div style={{ width: VALUE_COL_WIDTH }} className="px-3">
      <InlineVariableInput value={entry.value} onChange={(next) => onValueChange(entry.id, next)} />
    </div>
    <div style={{ width: SCOPE_COL_WIDTH }} className="px-3">
      <ScopeCell entry={entry} editorOpen={scopeEditorOpen} onEditorOpenChange={(open) => onScopeEditorOpenChange(entry, open)} editorContent={scopeEditorContent} />
    </div>
    <div style={{ width: CONTROL_COL_WIDTH }} className="px-3 flex items-center justify-end">
      <RowControlActions isModified={isModified} rowMenuItems={rowMenuItems} onMenuAction={(key) => onRowMenuAction(entry, key)} />
    </div>
  </div>
);

const MultiVariableGroup: React.FC<{
  group: VariableGroup;
  onValueChange: (id: number, value: string) => void;
  isVariableModified: (entry: VariableDto) => boolean;
  getRowMenuItems: (entry: VariableDto, allowAddValue: boolean) => { key: string; label: string; danger?: boolean }[];
  onRowMenuAction: (entry: VariableDto, key: string) => void;
  scopeEditorTarget: ScopeEditorTarget;
  onScopeEditorOpenChange: (entry: VariableDto, open: boolean) => void;
  scopeEditorContent: React.ReactNode;
}> = ({ group, onValueChange, isVariableModified, getRowMenuItems, onRowMenuAction, scopeEditorTarget, onScopeEditorOpenChange, scopeEditorContent }) => {
  const firstEntry = group.entries[0];
  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center bg-white hover:bg-gray-50" style={{ minHeight: GROUP_ROW_HEIGHT }}>
        <div style={{ width: NAME_COL_WIDTH }} className="px-3">
          <span className="font-mono text-sm text-gray-800">{group.name}</span>
        </div>
        <div style={{ width: VALUE_COL_WIDTH }} className="px-3">
          <span className="text-gray-400 text-xs">Multiple values</span>
        </div>
        <div style={{ width: SCOPE_COL_WIDTH }} className="px-3">
          <span className="text-gray-400 text-xs">Multiple scopes</span>
        </div>
        <div style={{ width: CONTROL_COL_WIDTH }} className="px-3 flex items-center justify-end">
          {firstEntry && (
            <RowControlActions isModified={isVariableModified(firstEntry)} rowMenuItems={getRowMenuItems(firstEntry, true)} onMenuAction={(key) => onRowMenuAction(firstEntry, key)} />
          )}
        </div>
      </div>
      {group.entries.map((entry) => (
        <div key={entry.id} className="flex items-stretch" style={{ minHeight: ROW_HEIGHT }}>
          <div style={{ width: NAME_COL_WIDTH }} className="px-3" />
          <div style={{ width: VALUE_COL_WIDTH }} className="px-3 border-t border-gray-200 flex items-center">
            <InlineVariableInput value={entry.value} onChange={(next) => onValueChange(entry.id, next)} />
          </div>
          <div style={{ width: SCOPE_COL_WIDTH }} className="px-3 border-t border-gray-200 flex items-center">
            <ScopeCell entry={entry} editorOpen={scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === entry.id} onEditorOpenChange={(open) => onScopeEditorOpenChange(entry, open)} editorContent={scopeEditorContent} />
          </div>
          <div style={{ width: CONTROL_COL_WIDTH }} className="px-3 border-t border-gray-200 flex items-center justify-end">
            <RowControlActions isModified={isVariableModified(entry)} rowMenuItems={getRowMenuItems(entry, false)} onMenuAction={(key) => onRowMenuAction(entry, key)} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ProjectVariables: React.FC = () => {
  const { projectName } = useParams<{ projectName: string }>();
  const { space } = useSpace();

  const [loading, setLoading] = useState(false);
  const [variableSet, setVariableSet] = useState<VariableSetDto | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVar, setNewVar] = useState<NewVarState>({ name: '' });
  const [draftValueRows, setDraftValueRows] = useState<DraftValueRow[]>([createDraftValueRow()]);
  const [localVariables, setLocalVariables] = useState<VariableDto[]>([]);
  const [originalVariables, setOriginalVariables] = useState<VariableDto[]>([]);
  const [scopeOptionsLoading, setScopeOptionsLoading] = useState(false);
  const [environmentOptions, setEnvironmentOptions] = useState<{ value: string; label: string }[]>([]);
  const [targetTagOptions, setTargetTagOptions] = useState<{ value: string; label: string }[]>([]);
  const [targetOptions, setTargetOptions] = useState<{ value: string; label: string }[]>([]);
  const [scopeEditorTarget, setScopeEditorTarget] = useState<ScopeEditorTarget>(null);
  const [scopeEditor, setScopeEditor] = useState<ScopeEditorState>({ environments: [], targetTags: [], targets: [] });
  const [variableSetId, setVariableSetId] = useState<number | null>(null);

  // Step 1: resolve project → variableSetId
  useEffect(() => {
    if (!projectName) return;
    getProjects({ pageSize: 500 })
      .then((res) => {
        const project = res.projects.find((p) => p.slug === projectName || p.name === projectName);
        if (project) setVariableSetId(project.variableSetId);
      })
      .catch(() => {});
  }, [projectName]);

  // Step 2: load variable set once we have the ID
  useEffect(() => {
    if (variableSetId == null) return;
    setLoading(true);
    GetVariableSet(variableSetId)
      .then((data) => {
        const visible = sanitizeVisibleVariables(data.variables ?? []);
        setVariableSet(data);
        setLocalVariables(visible);
        setOriginalVariables(visible);
        setIsDirty(false);
      })
      .catch((e) => console.error('Failed to load variable set', e))
      .finally(() => setLoading(false));
  }, [variableSetId]);

  // Step 3: load scope options
  useEffect(() => {
    if (!space.id) return;
    setScopeOptionsLoading(true);
    Promise.all([
      getEnvironments({ pageIndex: 1, pageSize: 1000, spaceId: space.id }),
      getTargetTags(),
      getMachines({ pageIndex: 1, pageSize: 1000, spaceId: space.id }),
    ])
      .then(([envRes, tagRes, machineRes]) => {
        const scopedTags = (tagRes.targetTags ?? []).filter((t) => t.spaceId === space.id);
        const scopedMachines = (machineRes.machines ?? []).filter((m) => m.spaceId === space.id);
        setEnvironmentOptions(
          uniqueStringValues((envRes.environments ?? []).map((e) => e.name)).map((n) => ({ value: n, label: n })),
        );
        setTargetTagOptions(
          uniqueStringValues((scopedTags.length > 0 ? scopedTags : tagRes.targetTags ?? []).map((t) => t.name)).map((n) => ({ value: n, label: n })),
        );
        setTargetOptions(
          uniqueStringValues((scopedMachines.length > 0 ? scopedMachines : machineRes.machines ?? []).map((m) => m.name)).map((n) => ({ value: n, label: n })),
        );
      })
      .catch(() => message.error('Failed to load scope options'))
      .finally(() => setScopeOptionsLoading(false));
  }, [space.id]);

  const filteredVariables = useMemo(
    () => localVariables.filter((v) => v.name.toLowerCase().includes(searchText.toLowerCase())),
    [localVariables, searchText],
  );
  const groups = useMemo(() => groupVariables(filteredVariables), [filteredVariables]);

  const canAddAnotherValue = newVar.name.trim().length > 0;
  const canAddToList =
    newVar.name.trim().length > 0 &&
    draftValueRows.some((r) => r.value.trim().length > 0 || r.scopes.length > 0);

  const originalVariableMap = useMemo(
    () => new Map(originalVariables.map((item) => [item.id, item])),
    [originalVariables],
  );

  const applyLocalVariables = (updater: (prev: VariableDto[]) => VariableDto[]) => {
    setLocalVariables((prev) => {
      const next = updater(prev);
      setIsDirty(hasVariableChanges(next, originalVariables));
      return next;
    });
  };

  const isVariableModified = (entry: VariableDto) => {
    const baseline = originalVariableMap.get(entry.id);
    return baseline ? !areVariablesEquivalent(entry, baseline) : false;
  };

  const handleAddToList = () => {
    const rowsToCommit = draftValueRows.filter((r) => r.value.trim().length > 0 || r.scopes.length > 0);
    if (rowsToCommit.length === 0 || !newVar.name.trim()) return;
    const base = Date.now();
    const entries: VariableDto[] = rowsToCommit.map((row, i) => ({
      id: base + i,
      variableSetId: variableSetId ?? 0,
      name: newVar.name.trim(),
      value: row.value,
      description: '',
      type: VariableType.String,
      isSensitive: false,
      sortOrder: localVariables.length + i,
      lastModifiedOn: null,
      lastModifiedBy: '',
      scopes: row.scopes.map((s, si) => ({ ...s, id: base + 500 + i * 10 + si, variableId: base + i })),
    }));
    applyLocalVariables((prev) => [...prev, ...entries]);
    setNewVar({ name: '' });
    setDraftValueRows([createDraftValueRow()]);
    setScopeEditorTarget(null);
  };

  const handleAddAnotherValue = () => {
    if (canAddAnotherValue) setDraftValueRows((prev) => [...prev, createDraftValueRow()]);
  };

  const handleDraftValueChange = (rowId: string, value: string) =>
    setDraftValueRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, value } : r)));

  const handleValueChange = (varId: number, value: string) =>
    applyLocalVariables((prev) => prev.map((v) => (v.id === varId ? { ...v, value } : v)));

  const handleNameChange = (varId: number, name: string) =>
    applyLocalVariables((prev) => prev.map((v) => (v.id === varId ? { ...v, name } : v)));

  const handleScopeEditorOpenChange = (entry: VariableDto, open: boolean) => {
    if (!open) { if (scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === entry.id) setScopeEditorTarget(null); return; }
    setScopeEditorTarget({ kind: 'existing', id: entry.id });
    setScopeEditor(toScopeEditorState(entry.scopes ?? []));
  };

  const handleDraftScopeEditorOpenChange = (row: DraftValueRow, open: boolean) => {
    if (!open) { if (scopeEditorTarget?.kind === 'draft' && scopeEditorTarget.id === row.id) setScopeEditorTarget(null); return; }
    setScopeEditorTarget({ kind: 'draft', id: row.id });
    setScopeEditor(toScopeEditorState(row.scopes));
  };

  const applyScopeEditorStateToTarget = (nextEditor: ScopeEditorState) => {
    if (!scopeEditorTarget) return;
    if (scopeEditorTarget.kind === 'draft') {
      setDraftValueRows((prev) => prev.map((r) => r.id === scopeEditorTarget.id ? { ...r, scopes: applyScopeEditorToScopes(r.scopes, nextEditor, 0) } : r));
      return;
    }
    applyLocalVariables((prev) => prev.map((item) => item.id === scopeEditorTarget.id ? { ...item, scopes: applyScopeEditorToScopes(item.scopes ?? [], nextEditor, item.id) } : item));
  };

  const handleScopeEditorChange = (patch: Partial<ScopeEditorState>) => {
    setScopeEditor((prev) => { const next = { ...prev, ...patch }; applyScopeEditorStateToTarget(next); return next; });
  };

  const handleAddValueForVariable = (entry: VariableDto) => {
    const base = Date.now();
    const newItem: VariableDto = { ...entry, id: base, value: '', scopes: [], lastModifiedOn: null, lastModifiedBy: '' };
    applyLocalVariables((prev) => {
      const idxs = prev.map((item, i) => ({ item, i })).filter(({ item }) => (item.name ?? '').trim() === (entry.name ?? '').trim()).map(({ i }) => i);
      const insertAt = idxs.length > 0 ? idxs[idxs.length - 1] + 1 : (prev.findIndex((item) => item.id === entry.id) + 1 || prev.length);
      return [...prev.slice(0, insertAt), newItem, ...prev.slice(insertAt)];
    });
  };

  const handleDuplicateVariable = (entry: VariableDto) => {
    const base = Date.now();
    const duped: VariableDto = { ...entry, id: base, scopes: (entry.scopes ?? []).map((s, i) => ({ ...s, id: base + 100 + i, variableId: base })), lastModifiedOn: null, lastModifiedBy: '' };
    applyLocalVariables((prev) => { const idx = prev.findIndex((item) => item.id === entry.id); return idx < 0 ? [...prev, duped] : [...prev.slice(0, idx + 1), duped, ...prev.slice(idx + 1)]; });
  };

  const handleDeleteVariable = (entry: VariableDto) =>
    applyLocalVariables((prev) => prev.filter((item) => item.id !== entry.id));

  const handleResetVariable = (entry: VariableDto) => {
    const baseline = originalVariableMap.get(entry.id);
    if (!baseline) return;
    applyLocalVariables((prev) => prev.map((item) => item.id === entry.id ? { ...baseline, scopes: (baseline.scopes ?? []).map((s) => ({ ...s })) } : item));
  };

  const getRowMenuItems = (entry: VariableDto, allowAddValue: boolean) => {
    const items: { key: string; label: string; danger?: boolean }[] = [];
    if (allowAddValue) items.push({ key: 'add-value', label: 'Add value' });
    items.push({ key: 'duplicate', label: 'Duplicate variable' });
    if (isVariableModified(entry)) items.push({ key: 'reset', label: 'Reset change' });
    items.push({ key: 'delete', label: 'Delete variable', danger: true });
    return items;
  };

  const handleRowMenuAction = (entry: VariableDto, key: string) => {
    switch (key) {
      case 'add-value': handleAddValueForVariable(entry); break;
      case 'duplicate': handleDuplicateVariable(entry); break;
      case 'reset': handleResetVariable(entry); break;
      case 'delete': handleDeleteVariable(entry); break;
    }
  };

  const handleSave = async () => {
    if (!variableSet) return;
    setSaving(true);
    try {
      await UpdateVariableSet({
        id: variableSet.id,
        ownerId: variableSet.ownerId,
        ownerType: variableSet.ownerType,
        spaceId: variableSet.spaceId,
        Name: (variableSet.name ?? '').trim(),
        Description: (variableSet.description ?? '').trim(),
        variables: normalizeVariablesForUpdate(localVariables),
      });
      const refreshed = await GetVariableSet(variableSet.id);
      const visible = sanitizeVisibleVariables(refreshed.variables ?? []);
      setVariableSet(refreshed);
      setLocalVariables(visible);
      setOriginalVariables(visible);
      setIsDirty(false);
      message.success('Variables saved');
    } catch {
      message.error('Failed to save variables');
    } finally {
      setSaving(false);
    }
  };

  const scopeEditorContent = (
    <div className="w-[560px] space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select environments</label>
        <Select mode="multiple" value={scopeEditor.environments} onChange={(v) => handleScopeEditorChange({ environments: v })} options={environmentOptions} loading={scopeOptionsLoading} placeholder="Select environments" className="w-full" allowClear showSearch />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select target tags</label>
        <Select mode="multiple" value={scopeEditor.targetTags} onChange={(v) => handleScopeEditorChange({ targetTags: v })} options={targetTagOptions} loading={scopeOptionsLoading} placeholder="Select target tags" className="w-full" allowClear showSearch />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select targets</label>
        <Select mode="multiple" value={scopeEditor.targets} onChange={(v) => handleScopeEditorChange({ targets: v })} options={targetOptions} loading={scopeOptionsLoading} placeholder="Select targets" className="w-full" allowClear showSearch />
      </div>
    </div>
  );

  const variablesContent = (
    <div className="py-4">
      <section className="mb-4">
        <div className="flex flex-wrap items-center gap-3" role="search">
          <Input
            placeholder="By variable name"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-64"
            allowClear
          />
          <Button icon={<FilterOutlined />} type="text" className="!text-gray-600 hover:!text-gray-900">
            Show advanced filters
          </Button>
        </div>
      </section>

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        {/* Header row */}
        <div className="flex border-b border-gray-200 bg-white">
          <div style={{ width: NAME_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700">Name</div>
          <div style={{ width: VALUE_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700">Value</div>
          <div style={{ width: SCOPE_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700">Scope</div>
          <div style={{ width: CONTROL_COL_WIDTH }} className="px-1 py-2" />
        </div>

        {/* Draft new variable row */}
        <div className="border-b border-gray-200 bg-white">
          {draftValueRows.map((row, index) => (
            <div key={row.id} className={`flex items-center ${index > 0 ? 'border-t border-gray-200' : ''}`} style={{ minHeight: ROW_HEIGHT }}>
              <div style={{ width: NAME_COL_WIDTH }} className="px-3">
                {index === 0 ? (
                  <InlineVariableInput placeholder="Enter new variable" value={newVar.name} onChange={(next) => setNewVar({ name: next })} />
                ) : (
                  <div className="h-7" />
                )}
              </div>
              <div style={{ width: VALUE_COL_WIDTH }} className="px-3">
                <InlineVariableInput placeholder="Enter value" value={row.value} onChange={(next) => handleDraftValueChange(row.id, next)} />
              </div>
              <div style={{ width: SCOPE_COL_WIDTH }} className="px-3">
                <Popover trigger="click" open={scopeEditorTarget?.kind === 'draft' && scopeEditorTarget.id === row.id} onOpenChange={(open) => handleDraftScopeEditorOpenChange(row, open)} content={scopeEditorContent} placement="bottomLeft" destroyTooltipOnHide>
                  <div className="w-full min-h-[28px] py-1 flex items-center flex-wrap gap-0.5 cursor-pointer">
                    {row.scopes.length > 0 ? (
                      row.scopes.map((s, i) => <ScopeChip key={`${s.scopeType}-${s.scopeValue}-${i}`} label={s.scopeValue} />)
                    ) : (
                      <span className="text-gray-400 text-xs font-mono hover:text-gray-600">Define scope</span>
                    )}
                  </div>
                </Popover>
              </div>
              <div style={{ width: CONTROL_COL_WIDTH }} className="px-3" />
            </div>
          ))}
          <div className="border-t border-gray-200 bg-gray-50/60">
            <div className="flex justify-end gap-2 px-3 py-2.5">
              <Button
                size="middle"
                disabled={!canAddAnotherValue}
                onClick={handleAddAnotherValue}
                className="!h-9 !px-4 !text-sm !font-medium"
              >
                Add another value
              </Button>
              <Button
                size="middle"
                type="primary"
                disabled={!canAddToList}
                onClick={handleAddToList}
                className="!h-9 !px-4 !text-sm !font-medium !bg-green-600 !border-green-600 hover:!bg-green-700 hover:!border-green-700"
              >
                Add to list
              </Button>
            </div>
          </div>
        </div>

        {/* Existing variables */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Spin /></div>
        ) : (
          <>
            {groups.map((group) =>
              group.entries.length === 1 ? (
                <SingleVariableRow
                  key={group.entries[0].id}
                  entry={group.entries[0]}
                  onNameChange={handleNameChange}
                  onValueChange={handleValueChange}
                  isModified={isVariableModified(group.entries[0])}
                  rowMenuItems={getRowMenuItems(group.entries[0], true)}
                  onRowMenuAction={handleRowMenuAction}
                  scopeEditorOpen={scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === group.entries[0].id}
                  onScopeEditorOpenChange={handleScopeEditorOpenChange}
                  scopeEditorContent={scopeEditorContent}
                />
              ) : (
                <MultiVariableGroup
                  key={group.name}
                  group={group}
                  onValueChange={handleValueChange}
                  isVariableModified={isVariableModified}
                  getRowMenuItems={getRowMenuItems}
                  onRowMenuAction={handleRowMenuAction}
                  scopeEditorTarget={scopeEditorTarget}
                  onScopeEditorOpenChange={handleScopeEditorOpenChange}
                  scopeEditorContent={scopeEditorContent}
                />
              ),
            )}
            {groups.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">No variables found</div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const tabItems = [
    { key: 'variables', label: 'Variables', children: variablesContent },
    { key: 'templates', label: 'Variable Templates', children: <div className="py-10 text-center text-gray-400">Variable Templates coming soon</div> },
    { key: 'usage', label: 'Usage', children: <div className="py-10 text-center text-gray-400">Usage coming soon</div> },
    { key: 'settings', label: 'Settings', children: <div className="py-10 text-center text-gray-400">Settings coming soon</div> },
  ];

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-6 pt-4 pb-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-2xl font-semibold m-0">Project Variables</h1>
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            disabled={!isDirty}
            loading={saving}
            onClick={handleSave}
            className="!bg-green-700 hover:!bg-green-800 !border-green-700 disabled:!opacity-50"
          >
            Save
          </Button>
          <Dropdown menu={{ items: headerOverflowItems }} trigger={['click']}>
            <Button icon={<MoreOutlined />} type="text" aria-label="Overflow Menu Button" />
          </Dropdown>
        </div>
      </div>

      <div className="px-6">
        <Tabs
          items={tabItems}
          defaultActiveKey="variables"
          className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-tab]:px-3 [&_.ant-tabs-tab]:py-3"
        />
      </div>
    </div>
  );
};

export default ProjectVariables;
