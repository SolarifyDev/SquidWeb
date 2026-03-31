import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';
import { Button, Dropdown, Input, Popover, Select, Spin, Tabs, message } from 'antd';
import { EditOutlined, FilterOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import VariableValueCell from 'components/variables/VariableValueCell';
import { getProjects } from 'pages/apis/project';
import { getChannels } from 'pages/apis/channel';
import { getEnvironments } from 'pages/apis/environment';
import { getDeploymentSteps } from 'pages/apis/deploymentProcess';
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

interface ScopeOption {
  value: string;
  label: string;
}

interface ScopeEditorState {
  environments: string[];
  targetTags: string[];
  targets: string[];
  channels: string[];
  actions: string[];
  processes: string[];
}

interface ScopeOptionContext {
  environments: ScopeOption[];
  targetTags: ScopeOption[];
  targets: ScopeOption[];
  channels: ScopeOption[];
  actions: ScopeOption[];
  processes: ScopeOption[];
}

interface ProjectScopeContext {
  id: number;
  name: string;
  spaceId: number;
  variableSetId: number;
  deploymentProcessId: number;
}

interface DraftValueRow {
  id: string;
  value: string;
  description: string;
  type: VariableType;
  isSensitive: boolean;
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
    description: '',
    type: VariableType.String,
    isSensitive: false,
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

function uniqueScopeOptions(options: ScopeOption[]): ScopeOption[] {
  const seen = new Set<string>();
  const next: ScopeOption[] = [];
  options.forEach((option) => {
    const key = option.value.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    next.push({ value: key, label: option.label });
  });
  return next;
}

function normalizeScopeEditorValues(rawValues: string[], options: ScopeOption[]): string[] {
  const optionValueSet = new Set(options.map((o) => o.value.trim()));
  const valueByLabel = new Map(
    options.map((o) => [o.label.trim().toLowerCase(), o.value.trim()] as const),
  );

  return uniqueStringValues(
    rawValues.map((value) => {
      const trimmed = (value ?? '').trim();
      if (!trimmed) return '';
      if (optionValueSet.has(trimmed)) return trimmed;
      const byLabel = valueByLabel.get(trimmed.toLowerCase());
      return byLabel ?? trimmed;
    }),
  );
}

function isStandardScopeType(scopeType: VariableScopeType): boolean {
  return scopeType === VariableScopeType.Environment
    || scopeType === VariableScopeType.Machine
    || scopeType === VariableScopeType.Role
    || scopeType === VariableScopeType.Channel
    || scopeType === VariableScopeType.Action
    || scopeType === VariableScopeType.Process;
}

function formatActionScopeLabel(stepOrder: number, stepName: string, actionName: string, actionId: number): string {
  const normalizedStepName = (stepName ?? '').trim();
  const normalizedActionName = (actionName ?? '').trim();
  const safeStepOrder = Number.isFinite(stepOrder) && stepOrder > 0 ? stepOrder : 0;
  const orderPrefix = safeStepOrder > 0 ? `${safeStepOrder}. ` : '';

  if (!normalizedActionName || normalizedActionName.toLowerCase() === normalizedStepName.toLowerCase()) {
    return `${orderPrefix}${normalizedStepName || `Action #${actionId}`}`.trim();
  }

  if (!normalizedStepName) return `${orderPrefix}${normalizedActionName}`.trim();
  return `${orderPrefix}${normalizedStepName} / ${normalizedActionName}`.trim();
}

function toScopeEditorState(scopes: VariableScopeDto[], options: ScopeOptionContext): ScopeEditorState {
  return {
    environments: normalizeScopeEditorValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Environment).map((s) => s.scopeValue),
      options.environments,
    ),
    targetTags: normalizeScopeEditorValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Role).map((s) => s.scopeValue),
      options.targetTags,
    ),
    targets: normalizeScopeEditorValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Machine).map((s) => s.scopeValue),
      options.targets,
    ),
    channels: normalizeScopeEditorValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Channel).map((s) => s.scopeValue),
      options.channels,
    ),
    actions: normalizeScopeEditorValues(
      (scopes ?? [])
        .filter((s) => s.scopeType === VariableScopeType.Action)
        .map((s) => s.scopeValue),
      options.actions,
    ),
    processes: normalizeScopeEditorValues(
      (scopes ?? []).filter((s) => s.scopeType === VariableScopeType.Process).map((s) => s.scopeValue),
      options.processes,
    ),
  };
}

function applyScopeEditorToScopes(
  originalScopes: VariableScopeDto[],
  editor: ScopeEditorState,
  variableId: number,
): VariableScopeDto[] {
  const preserved = (originalScopes ?? []).filter((scope) => !isStandardScopeType(scope.scopeType));
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
    ...uniqueStringValues(editor.channels).map((name, i) => ({
      id: base + 3000 + i,
      variableId,
      scopeType: VariableScopeType.Channel,
      scopeValue: name,
    })),
    ...uniqueStringValues(editor.actions).map((name, i) => ({
      id: base + 4000 + i,
      variableId,
      scopeType: VariableScopeType.Action,
      scopeValue: name,
    })),
    ...uniqueStringValues(editor.processes).map((name, i) => ({
      id: base + 5000 + i,
      variableId,
      scopeType: VariableScopeType.Process,
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

const ChannelIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" style={{ marginRight: 3, flexShrink: 0 }} aria-hidden="true">
    <path fill="currentColor" d="M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3z" />
  </svg>
);

const RoleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" style={{ marginRight: 3, flexShrink: 0 }} aria-hidden="true">
    <path fill="currentColor" d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
  </svg>
);

const MachineIcon: React.FC = () => (
  <svg viewBox="0 0 200 200" width="12" height="12" style={{ marginRight: 3, flexShrink: 0 }} aria-hidden="true">
    <path fill="currentColor" d="M119.19 70.52h6.54a27 27 0 0 0-18-18V59a3.87 3.87 0 0 1-3.84 3.84h-7.73A3.87 3.87 0 0 1 92.32 59v-6.53a27 27 0 0 0-18 18h6.54a3.86 3.86 0 0 1 3.83 3.84V82a3.86 3.86 0 0 1-3.83 3.84h-6.59a27 27 0 0 0 18 18.05v-6.5a3.87 3.87 0 0 1 3.84-3.84h7.68a3.87 3.87 0 0 1 3.84 3.84v6.54a27 27 0 0 0 18-18.05h-6.54a3.86 3.86 0 0 1-3.73-3.88v-7.64a3.86 3.86 0 0 1 3.83-3.84z" />
    <path fill="currentColor" d="M170.17 16.15H29.83A3.82 3.82 0 0 0 26 20v116.71a3.82 3.82 0 0 0 3.83 3.82h65.34v15.74a14.92 14.92 0 0 0-9.3 9.3H42a4.83 4.83 0 1 0 0 9.66h43.87a14.92 14.92 0 0 0 28.26 0H158a4.83 4.83 0 1 0 0-9.66h-43.87a14.92 14.92 0 0 0-9.3-9.3v-15.74h65.34a3.82 3.82 0 0 0 3.83-3.82V20a3.82 3.82 0 0 0-3.83-3.85zM146.07 82a3.87 3.87 0 0 1-3.84 3.84h-8.58a34.59 34.59 0 0 1-26 26v8.58a3.87 3.87 0 0 1-3.84 3.84h-7.65a3.87 3.87 0 0 1-3.84-3.84v-8.58a34.59 34.59 0 0 1-26-26h-8.55A3.87 3.87 0 0 1 53.93 82v-7.64a3.87 3.87 0 0 1 3.84-3.84h8.58a34.59 34.59 0 0 1 26-26V36a3.87 3.87 0 0 1 3.84-3.84h7.68a3.87 3.87 0 0 1 3.81 3.84v8.58a34.59 34.59 0 0 1 26 26h8.58a3.87 3.87 0 0 1 3.84 3.84z" />
  </svg>
);

const ProcessIcon: React.FC = () => (
  <svg viewBox="0 0 200 200" width="12" height="12" style={{ marginRight: 3, flexShrink: 0 }} aria-hidden="true">
    <path fill="currentColor" d="M176.84 15.09l-21.16 3.44C134.57 21.44 116 31 102.56 45.89l-23.72 26L46.52 70a4.9 4.9 0 00-4.35 2.16L25.91 96.43a4.89 4.89 0 002 7.17L50.89 114 86 149.11l10.44 23a4.89 4.89 0 007.16 2.05l24.64-16.35a4.87 4.87 0 002.18-4.4l-2.16-32.31 25.88-23.62C169 84 178.56 65.43 181.47 44.32l3.44-21.16a7 7 0 00-8.07-8.07zm-39 67.8a14.67 14.67 0 110-20.75 14.67 14.67 0 01.02 20.75zM73.59 153.49l-27.08-27.08a1.94 1.94 0 00-2.71 0c-1.47 1.42-3.49 3.42-4.21 4.14C15.67 154.44 15 185 15 185s30.56-.67 54.48-24.59c.72-.72 2.72-2.74 4.14-4.21a1.94 1.94 0 00-.03-2.71z" />
  </svg>
);

const ScopeChip: React.FC<{ label: string; scopeType?: VariableScopeType }> = ({ label, scopeType }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs mr-1 select-none">
    {scopeType === VariableScopeType.Environment ? <EnvironmentIcon /> : null}
    {scopeType === VariableScopeType.Channel ? <ChannelIcon /> : null}
    {scopeType === VariableScopeType.Role ? <RoleIcon /> : null}
    {scopeType === VariableScopeType.Machine ? <MachineIcon /> : null}
    {scopeType === VariableScopeType.Process ? <ProcessIcon /> : null}
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
  getScopeLabel: (scope: VariableScopeDto) => string;
  editorContent: React.ReactNode;
}> = ({ entry, editorOpen, onEditorOpenChange, getScopeLabel, editorContent }) => (
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
            <ScopeChip
              key={`${s.scopeType}-${s.scopeValue}-${i}`}
              label={getScopeLabel(s)}
              scopeType={s.scopeType}
            />
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
  onEntryPatch: (id: number, patch: Partial<VariableDto>) => void;
  isModified: boolean;
  rowMenuItems: { key: string; label: string; danger?: boolean }[];
  onRowMenuAction: (entry: VariableDto, key: string) => void;
  scopeEditorOpen: boolean;
  onScopeEditorOpenChange: (entry: VariableDto, open: boolean) => void;
  getScopeLabel: (scope: VariableScopeDto) => string;
  scopeEditorContent: React.ReactNode;
}> = ({ entry, onNameChange, onEntryPatch, isModified, rowMenuItems, onRowMenuAction, scopeEditorOpen, onScopeEditorOpenChange, getScopeLabel, scopeEditorContent }) => (
  <div className="flex items-center hover:bg-gray-50 border-b border-gray-200" style={{ minHeight: ROW_HEIGHT }}>
    <div style={{ width: NAME_COL_WIDTH }} className="px-3">
      <InlineVariableInput value={entry.name} onChange={(next) => onNameChange(entry.id, next)} />
    </div>
    <div style={{ width: VALUE_COL_WIDTH }} className="px-3 self-stretch flex items-start">
      <VariableValueCell
        name={entry.name}
        value={entry.value}
        description={entry.description}
        type={entry.type}
        isSensitive={entry.isSensitive}
        onSave={(patch) => onEntryPatch(entry.id, patch)}
      />
    </div>
    <div style={{ width: SCOPE_COL_WIDTH }} className="px-3">
      <ScopeCell
        entry={entry}
        editorOpen={scopeEditorOpen}
        onEditorOpenChange={(open) => onScopeEditorOpenChange(entry, open)}
        getScopeLabel={getScopeLabel}
        editorContent={scopeEditorContent}
      />
    </div>
    <div style={{ width: CONTROL_COL_WIDTH }} className="px-3 flex items-center justify-end">
      <RowControlActions isModified={isModified} rowMenuItems={rowMenuItems} onMenuAction={(key) => onRowMenuAction(entry, key)} />
    </div>
  </div>
);

const MultiVariableGroup: React.FC<{
  group: VariableGroup;
  onGroupNameChange: (entryIds: number[], name: string) => void;
  onEntryPatch: (id: number, patch: Partial<VariableDto>) => void;
  isVariableModified: (entry: VariableDto) => boolean;
  getRowMenuItems: (entry: VariableDto, allowAddValue: boolean) => { key: string; label: string; danger?: boolean }[];
  onRowMenuAction: (entry: VariableDto, key: string) => void;
  scopeEditorTarget: ScopeEditorTarget;
  onScopeEditorOpenChange: (entry: VariableDto, open: boolean) => void;
  getScopeLabel: (scope: VariableScopeDto) => string;
  scopeEditorContent: React.ReactNode;
}> = ({
  group,
  onGroupNameChange,
  onEntryPatch,
  isVariableModified,
  getRowMenuItems,
  onRowMenuAction,
  scopeEditorTarget,
  onScopeEditorOpenChange,
  getScopeLabel,
  scopeEditorContent,
}) => {
  const firstEntry = group.entries[0];
  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center bg-white hover:bg-gray-50" style={{ minHeight: GROUP_ROW_HEIGHT }}>
        <div style={{ width: NAME_COL_WIDTH }} className="px-3">
          <InlineVariableInput
            value={group.name}
            onChange={(next) => onGroupNameChange(group.entries.map((entry) => entry.id), next)}
          />
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
          <div style={{ width: VALUE_COL_WIDTH }} className="px-3 border-t border-gray-200 flex items-start">
            <VariableValueCell
              name={entry.name}
              value={entry.value}
              description={entry.description}
              type={entry.type}
              isSensitive={entry.isSensitive}
              onSave={(patch) => onEntryPatch(entry.id, patch)}
            />
          </div>
          <div style={{ width: SCOPE_COL_WIDTH }} className="px-3 border-t border-gray-200 flex items-center">
            <ScopeCell
              entry={entry}
              editorOpen={scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === entry.id}
              onEditorOpenChange={(open) => onScopeEditorOpenChange(entry, open)}
              getScopeLabel={getScopeLabel}
              editorContent={scopeEditorContent}
            />
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
  const [projectScopeContext, setProjectScopeContext] = useState<ProjectScopeContext | null>(null);
  const [scopeOptionsLoading, setScopeOptionsLoading] = useState(false);
  const [environmentOptions, setEnvironmentOptions] = useState<ScopeOption[]>([]);
  const [targetTagOptions, setTargetTagOptions] = useState<ScopeOption[]>([]);
  const [targetOptions, setTargetOptions] = useState<ScopeOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<ScopeOption[]>([]);
  const [actionOptions, setActionOptions] = useState<ScopeOption[]>([]);
  const [processOptions, setProcessOptions] = useState<ScopeOption[]>([]);
  const [scopeEditorTarget, setScopeEditorTarget] = useState<ScopeEditorTarget>(null);
  const [scopeEditor, setScopeEditor] = useState<ScopeEditorState>({
    environments: [],
    targetTags: [],
    targets: [],
    channels: [],
    actions: [],
    processes: [],
  });
  const [variableSetId, setVariableSetId] = useState<number | null>(null);
  const scopeOptionContext: ScopeOptionContext = useMemo(
    () => ({
      environments: environmentOptions,
      targetTags: targetTagOptions,
      targets: targetOptions,
      channels: channelOptions,
      actions: actionOptions,
      processes: processOptions,
    }),
    [environmentOptions, targetTagOptions, targetOptions, channelOptions, actionOptions, processOptions],
  );

  const environmentNameById = useMemo(
    () => new Map(environmentOptions.map((option) => [option.value, option.label])),
    [environmentOptions],
  );
  const machineNameById = useMemo(
    () => new Map(targetOptions.map((option) => [option.value, option.label])),
    [targetOptions],
  );
  const roleNameByValue = useMemo(
    () => new Map(targetTagOptions.map((option) => [option.value, option.label])),
    [targetTagOptions],
  );
  const channelNameById = useMemo(
    () => new Map(channelOptions.map((option) => [option.value, option.label])),
    [channelOptions],
  );
  const actionNameById = useMemo(
    () => new Map(actionOptions.map((option) => [option.value, option.label])),
    [actionOptions],
  );
  const processNameById = useMemo(
    () => new Map(processOptions.map((option) => [option.value, option.label])),
    [processOptions],
  );

  const getScopeLabel = (scope: VariableScopeDto): string => {
    const raw = (scope.scopeValue ?? '').trim();
    if (!raw) return '';

    if (scope.scopeType === VariableScopeType.Environment) return environmentNameById.get(raw) ?? raw;
    if (scope.scopeType === VariableScopeType.Machine) return machineNameById.get(raw) ?? raw;
    if (scope.scopeType === VariableScopeType.Role) return roleNameByValue.get(raw) ?? raw;
    if (scope.scopeType === VariableScopeType.Channel) return channelNameById.get(raw) ?? raw;
    if (scope.scopeType === VariableScopeType.Action) {
      return actionNameById.get(raw) ?? raw;
    }
    if (scope.scopeType === VariableScopeType.Process) return processNameById.get(raw) ?? raw;

    return raw;
  };

  // Step 1: resolve project → variableSetId
  useEffect(() => {
    if (!projectName) return;
    getProjects({ pageSize: 500 })
      .then((res) => {
        const project = res.projects.find((p) => p.slug === projectName || p.name === projectName);
        if (!project) {
          setProjectScopeContext(null);
          setVariableSetId(null);
          return;
        }

        setProjectScopeContext({
          id: project.id,
          name: project.name,
          spaceId: project.spaceId,
          variableSetId: project.variableSetId,
          deploymentProcessId: project.deploymentProcessId,
        });
        setVariableSetId(project.variableSetId);
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
    if (!space.id || !projectScopeContext) return;
    setScopeOptionsLoading(true);
    Promise.all([
      getEnvironments({ pageIndex: 1, pageSize: 1000, spaceId: space.id }),
      getTargetTags(),
      getMachines({ pageIndex: 1, pageSize: 1000, spaceId: space.id }),
      getChannels({ pageSize: 1000, projectId: projectScopeContext.id }),
      getDeploymentSteps({ processId: projectScopeContext.deploymentProcessId, pageIndex: 1, pageSize: 1000 }),
    ])
      .then(([envRes, tagRes, machineRes, channelRes, stepRes]) => {
        const scopedTags = (tagRes.targetTags ?? []).filter((t) => t.spaceId === space.id);
        const scopedMachines = (machineRes.machines ?? []).filter((m) => m.spaceId === space.id);
        const scopedChannels = (channelRes.channels ?? []).filter((c) => c.projectId === projectScopeContext.id);

        const nextEnvironmentOptions = uniqueScopeOptions(
          (envRes.environments ?? []).map((env) => ({
            value: String(env.id),
            label: env.name,
          })),
        );

        const nextTargetTagOptions = uniqueScopeOptions(
          (scopedTags.length > 0 ? scopedTags : tagRes.targetTags ?? []).map((tag) => ({
            value: tag.name.trim(),
            label: tag.name,
          })),
        );

        const nextTargetOptions = uniqueScopeOptions(
          (scopedMachines.length > 0 ? scopedMachines : machineRes.machines ?? []).map((machine) => ({
            value: String(machine.id),
            label: machine.name,
          })),
        );

        const nextChannelOptions = uniqueScopeOptions(
          (scopedChannels.length > 0 ? scopedChannels : channelRes.channels ?? []).map((channel) => ({
            value: String(channel.id),
            label: channel.name,
          })),
        );

        const nextActionOptions = uniqueScopeOptions(
          (stepRes.steps ?? []).flatMap((step) =>
            (step.actions ?? []).map((action) => ({
              value: String(action.id),
              label: formatActionScopeLabel(step.stepOrder, step.name, action.name, action.id),
            })),
          ),
        );

        const nextProcessOptions = uniqueScopeOptions([
          {
            value: String(projectScopeContext.deploymentProcessId),
            label: `${projectScopeContext.name} deployment process`,
          },
        ]);

        setEnvironmentOptions(
          nextEnvironmentOptions,
        );
        setTargetTagOptions(
          nextTargetTagOptions,
        );
        setTargetOptions(
          nextTargetOptions,
        );
        setChannelOptions(nextChannelOptions);
        setActionOptions(nextActionOptions);
        setProcessOptions(nextProcessOptions);
      })
      .catch(() => message.error('Failed to load scope options'))
      .finally(() => setScopeOptionsLoading(false));
  }, [space.id, projectScopeContext]);

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
      description: row.description,
      type: row.type,
      isSensitive: row.isSensitive,
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

  const handleDraftEntryPatch = (rowId: string, patch: Partial<VariableDto>) => {
    setDraftValueRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
            ...row,
            value: patch.value ?? row.value,
            description: patch.description ?? row.description,
            type: patch.type ?? row.type,
            isSensitive: patch.isSensitive ?? row.isSensitive,
          }
          : row,
      ),
    );
    if (typeof patch.name === 'string') setNewVar({ name: patch.name });
  };

  const handleEntryPatch = (varId: number, patch: Partial<VariableDto>) =>
    applyLocalVariables((prev) => prev.map((item) => (item.id === varId ? { ...item, ...patch } : item)));

  const handleNameChange = (varId: number, name: string) =>
    applyLocalVariables((prev) => prev.map((v) => (v.id === varId ? { ...v, name } : v)));

  const handleGroupNameChange = (entryIds: number[], name: string) => {
    const idSet = new Set(entryIds);
    applyLocalVariables((prev) => prev.map((v) => (idSet.has(v.id) ? { ...v, name } : v)));
  };

  const handleScopeEditorOpenChange = (entry: VariableDto, open: boolean) => {
    if (!open) { if (scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === entry.id) setScopeEditorTarget(null); return; }
    setScopeEditorTarget({ kind: 'existing', id: entry.id });
    setScopeEditor(toScopeEditorState(entry.scopes ?? [], scopeOptionContext));
  };

  const handleDraftScopeEditorOpenChange = (row: DraftValueRow, open: boolean) => {
    if (!open) { if (scopeEditorTarget?.kind === 'draft' && scopeEditorTarget.id === row.id) setScopeEditorTarget(null); return; }
    setScopeEditorTarget({ kind: 'draft', id: row.id });
    setScopeEditor(toScopeEditorState(row.scopes, scopeOptionContext));
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
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select channels</label>
        <Select mode="multiple" value={scopeEditor.channels} onChange={(v) => handleScopeEditorChange({ channels: v })} options={channelOptions} loading={scopeOptionsLoading} placeholder="Select channels" className="w-full" allowClear showSearch />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select deployment steps</label>
        <Select mode="multiple" value={scopeEditor.actions} onChange={(v) => handleScopeEditorChange({ actions: v })} options={actionOptions} loading={scopeOptionsLoading} placeholder="Select deployment steps" className="w-full" allowClear showSearch optionFilterProp="label" />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Select deployment processes</label>
        <Select mode="multiple" value={scopeEditor.processes} onChange={(v) => handleScopeEditorChange({ processes: v })} options={processOptions} loading={scopeOptionsLoading} placeholder="Select deployment processes" className="w-full" allowClear showSearch optionFilterProp="label" />
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

      <div className="border border-gray-200 rounded-md overflow-visible bg-white">
        {/* Header row */}
        <div className="flex border-b border-gray-200 bg-white">
          <div style={{ width: NAME_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700">Name</div>
          <div style={{ width: VALUE_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700 border-l border-gray-200">Value</div>
          <div style={{ width: SCOPE_COL_WIDTH }} className="px-3 py-2 text-sm font-medium text-gray-700 border-l border-gray-200">Scope</div>
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
              <div style={{ width: VALUE_COL_WIDTH }} className="px-3 self-stretch flex items-start">
                <VariableValueCell
                  name={newVar.name}
                  value={row.value}
                  description={row.description}
                  type={row.type}
                  isSensitive={row.isSensitive}
                  placeholder="Enter value"
                  onSave={(patch) => handleDraftEntryPatch(row.id, patch)}
                />
              </div>
              <div style={{ width: SCOPE_COL_WIDTH }} className="px-3">
                <Popover trigger="click" open={scopeEditorTarget?.kind === 'draft' && scopeEditorTarget.id === row.id} onOpenChange={(open) => handleDraftScopeEditorOpenChange(row, open)} content={scopeEditorContent} placement="bottomLeft" destroyTooltipOnHide>
                  <div className="w-full min-h-[28px] py-1 flex items-center flex-wrap gap-0.5 cursor-pointer">
                    {row.scopes.length > 0 ? (
                      row.scopes.map((s, i) => (
                        <ScopeChip
                          key={`${s.scopeType}-${s.scopeValue}-${i}`}
                          label={getScopeLabel(s)}
                          scopeType={s.scopeType}
                        />
                      ))
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
                  onEntryPatch={handleEntryPatch}
                  isModified={isVariableModified(group.entries[0])}
                  rowMenuItems={getRowMenuItems(group.entries[0], true)}
                  onRowMenuAction={handleRowMenuAction}
                  scopeEditorOpen={scopeEditorTarget?.kind === 'existing' && scopeEditorTarget.id === group.entries[0].id}
                  onScopeEditorOpenChange={handleScopeEditorOpenChange}
                  getScopeLabel={getScopeLabel}
                  scopeEditorContent={scopeEditorContent}
                />
              ) : (
                <MultiVariableGroup
                  key={group.entries[0].id}
                  group={group}
                  onGroupNameChange={handleGroupNameChange}
                  onEntryPatch={handleEntryPatch}
                  isVariableModified={isVariableModified}
                  getRowMenuItems={getRowMenuItems}
                  onRowMenuAction={handleRowMenuAction}
                  scopeEditorTarget={scopeEditorTarget}
                  onScopeEditorOpenChange={handleScopeEditorOpenChange}
                  getScopeLabel={getScopeLabel}
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
    <div className="rounded-xl border border-slate-200 overflow-visible bg-white">
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
