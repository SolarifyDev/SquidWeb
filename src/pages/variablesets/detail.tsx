import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSpace } from 'contexts/SpaceContext';
import { Button, Input, Tabs, Spin, Dropdown } from 'antd';
import { SearchOutlined, FilterOutlined, MoreOutlined } from '@ant-design/icons';
import {
  GetVariableSet,
  VariableDto,
  VariableSetDto,
  VariableType,
} from 'pages/apis/variableSet';

interface VariableGroup {
  name: string;
  entries: VariableDto[];
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

const overflowItems = [{ key: 'delete', label: 'Delete' }];

interface SingleRowProps {
  entry: VariableDto;
  onNameChange: (id: number, name: string) => void;
  onValueChange: (id: number, value: string) => void;
}

const SingleVariableRow: React.FC<SingleRowProps> = ({ entry, onNameChange, onValueChange }) => (
  <div className="flex items-center hover:bg-gray-50 border-b border-gray-200" style={{ height: 48 }}>
    <div style={{ width: '26.3158%' }} className="px-3">
      <Input
        value={entry.name}
        onChange={e => onNameChange(entry.id, e.target.value)}
        variant="borderless"
        className="font-mono text-sm !px-0"
      />
    </div>
    <div style={{ width: '42.1053%' }} className="px-3">
      <Input
        value={entry.value}
        onChange={e => onValueChange(entry.id, e.target.value)}
        variant="borderless"
        className="font-mono text-sm !px-0"
      />
    </div>
    <div style={{ width: '31.5789%' }} className="px-3 flex items-center justify-between">
      <div className="flex items-center flex-wrap gap-0.5 flex-1 min-w-0 cursor-pointer">
        {entry.scopes.length > 0
          ? entry.scopes.map(s => <ScopeChip key={s.id} label={s.scopeValue} />)
          : <span className="text-gray-400 text-xs font-mono hover:text-gray-600">Define scope</span>
        }
      </div>
      <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
        <Button icon={<MoreOutlined />} type="text" size="small" />
      </Dropdown>
    </div>
  </div>
);

interface GroupProps {
  group: VariableGroup;
  onValueChange: (id: number, value: string) => void;
}

const MultiVariableGroup: React.FC<GroupProps> = ({ group, onValueChange }) => (
  <div className="border-b border-gray-200">
    {/* Parent summary row */}
    <div className="flex items-center hover:bg-gray-50" style={{ height: 32 }}>
      <div style={{ width: '26.3158%' }} className="px-3">
        <span className="font-mono text-sm">{group.name}</span>
      </div>
      <div style={{ width: '42.1053%' }} className="px-3">
        <span className="text-gray-400 text-xs">Multiple values</span>
      </div>
      <div style={{ width: '31.5789%' }} className="px-3 flex items-center justify-between">
        <span className="text-gray-400 text-xs">Multiple scopes</span>
        <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
          <Button icon={<MoreOutlined />} type="text" size="small" />
        </Dropdown>
      </div>
    </div>

    {/* Child value rows */}
    {group.entries.map(entry => (
      <div key={entry.id} className="flex items-stretch" style={{ height: 48 }}>
        <div style={{ width: '26.3158%' }} className="px-3" />
        <div style={{ width: '42.1053%' }} className="px-3 border-t border-gray-200 flex items-center">
          <Input
            value={entry.value}
            onChange={e => onValueChange(entry.id, e.target.value)}
            variant="borderless"
            className="font-mono text-sm !px-0"
          />
        </div>
        <div style={{ width: '31.5789%' }} className="px-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center flex-wrap gap-0.5 flex-1 min-w-0 cursor-pointer">
            {entry.scopes.length > 0
              ? entry.scopes.map(s => <ScopeChip key={s.id} label={s.scopeValue} />)
              : <span className="text-gray-400 text-xs font-mono hover:text-gray-600">Define scope</span>
            }
          </div>
          <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
            <Button icon={<MoreOutlined />} type="text" size="small" />
          </Dropdown>
        </div>
      </div>
    ))}
  </div>
);

interface NewVarState {
  name: string;
  value: string;
}

const VariableSetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { space } = useSpace();
  const [loading, setLoading] = useState(false);
  const [variableSet, setVariableSet] = useState<VariableSetDto | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [newVar, setNewVar] = useState<NewVarState>({ name: '', value: '' });
  const [localVariables, setLocalVariables] = useState<VariableDto[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    GetVariableSet(Number(id))
      .then(data => {
        setVariableSet(data);
        setLocalVariables(data.variables ?? []);
      })
      .catch(e => console.error('Failed to load variable set', e))
      .finally(() => setLoading(false));
  }, [id]);

  const filteredVariables = localVariables.filter(v =>
    v.name.toLowerCase().includes(searchText.toLowerCase())
  );
  const groups = groupVariables(filteredVariables);

  const canAdd = newVar.name.trim().length > 0;

  const handleAddToList = () => {
    if (!canAdd) return;
    const entry: VariableDto = {
      id: Date.now(),
      variableSetId: Number(id),
      name: newVar.name,
      value: newVar.value,
      description: '',
      type: VariableType.String,
      isSensitive: false,
      sortOrder: localVariables.length,
      lastModifiedOn: null,
      lastModifiedBy: '',
      scopes: [],
    };
    setLocalVariables(prev => [...prev, entry]);
    setNewVar({ name: '', value: '' });
    setIsDirty(true);
  };

  const handleValueChange = (varId: number, value: string) => {
    setLocalVariables(prev => prev.map(v => v.id === varId ? { ...v, value } : v));
    setIsDirty(true);
  };

  const handleNameChange = (varId: number, name: string) => {
    setLocalVariables(prev => prev.map(v => v.id === varId ? { ...v, name } : v));
    setIsDirty(true);
  };

  const variablesContent = (
    <div className="py-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="By variable name"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-60"
          allowClear
        />
        <Button icon={<FilterOutlined />} type="text">Show advanced filters</Button>
      </div>

      {/* Table */}
      <div>
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-white">
          <div style={{ width: '26.3158%' }} className="px-3 py-2 text-sm font-medium text-gray-700">Name</div>
          <div style={{ width: '42.1053%' }} className="px-3 py-2 text-sm font-medium text-gray-700">Value</div>
          <div style={{ width: '31.5789%' }} className="px-3 py-2 text-sm font-medium text-gray-700">Scope</div>
        </div>

        {/* Add new variable row */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex items-center" style={{ height: 48 }}>
            <div style={{ width: '26.3158%' }} className="px-3">
              <Input
                placeholder="Enter new variable"
                value={newVar.name}
                onChange={e => setNewVar(p => ({ ...p, name: e.target.value }))}
                variant="borderless"
                className="font-mono text-sm !px-0"
              />
            </div>
            <div style={{ width: '42.1053%' }} className="px-3">
              <Input
                placeholder="Enter value"
                value={newVar.value}
                onChange={e => setNewVar(p => ({ ...p, value: e.target.value }))}
                variant="borderless"
                className="font-mono text-sm !px-0"
              />
            </div>
            <div style={{ width: '31.5789%' }} className="px-3">
              <span className="text-gray-400 text-xs font-mono cursor-pointer hover:text-gray-600">Define scope</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-3 pb-2">
            <Button size="small" disabled={!canAdd}>Add another value</Button>
            <Button
              size="small"
              type="primary"
              disabled={!canAdd}
              onClick={handleAddToList}
              className="!bg-green-600 !border-green-600"
            >
              Add to list
            </Button>
          </div>
        </div>

        {/* Data rows */}
        {groups.map(group =>
          group.entries.length === 1 ? (
            <SingleVariableRow
              key={group.name}
              entry={group.entries[0]}
              onNameChange={handleNameChange}
              onValueChange={handleValueChange}
            />
          ) : (
            <MultiVariableGroup
              key={group.name}
              group={group}
              onValueChange={handleValueChange}
            />
          )
        )}

        {groups.length === 0 && !loading && (
          <div className="py-10 text-center text-gray-400 text-sm">No variables found</div>
        )}
      </div>
    </div>
  );

  const tabItems = [
    { key: 'variables', label: 'Variables', children: variablesContent },
    {
      key: 'templates',
      label: 'Variable Templates',
      children: <div className="py-10 text-center text-gray-400">Variable Templates coming soon</div>,
    },
    {
      key: 'usage',
      label: 'Usage',
      children: <div className="py-10 text-center text-gray-400">Usage coming soon</div>,
    },
    {
      key: 'settings',
      label: 'Settings',
      children: <div className="py-10 text-center text-gray-400">Settings coming soon</div>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header area */}
      <div className="px-6 pt-4 pb-0">
        {/* Breadcrumb */}
        <nav>
          <ol>
            <li>
              <button
                onClick={() => navigate(`/${space.slug}/variable`)}
                className="text-blue-500 hover:text-blue-600 text-sm bg-transparent border-0 p-0 cursor-pointer"
              >
                Variable Sets
              </button>
            </li>
          </ol>
        </nav>

        {/* Title + action buttons */}
        <div className="flex items-center justify-between mt-1 mb-0">
          <h1 className="text-2xl font-semibold m-0">{variableSet?.name ?? '...'}</h1>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              disabled={!isDirty}
              className="!bg-green-600 !border-green-600 disabled:!opacity-50"
            >
              Save
            </Button>
            <Dropdown menu={{ items: overflowItems }} trigger={['click']}>
              <Button icon={<MoreOutlined />} type="text" />
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex-1 overflow-y-auto">
        <Tabs items={tabItems} defaultActiveKey="variables" />
      </div>
    </div>
  );
};

export default VariableSetDetail;
