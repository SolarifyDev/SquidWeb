import React, { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Dropdown, Input, Modal, Select, message } from 'antd';
import { CopyOutlined, FullscreenExitOutlined, FullscreenOutlined, SettingOutlined } from '@ant-design/icons';
import { VariableDto, VariableType } from 'pages/apis/variableSet';

type VariableValueUiType =
  | 'Text'
  | 'Sensitive'
  | 'AzureAccount'
  | 'GoogleCloudAccount'
  | 'AwsAccount'
  | 'UsernamePasswordAccount'
  | 'Certificate'
  | 'WorkerPool';

const VARIABLE_VALUE_TYPE_OPTIONS: Array<{ value: VariableValueUiType; label: string; supported: boolean }> = [
  { value: 'AzureAccount', label: 'Azure Account', supported: false },
  { value: 'GoogleCloudAccount', label: 'Google Cloud Account', supported: false },
  { value: 'AwsAccount', label: 'AWS Account', supported: false },
  { value: 'UsernamePasswordAccount', label: 'Username Password Account', supported: false },
  { value: 'Certificate', label: 'Certificate', supported: false },
  { value: 'WorkerPool', label: 'Worker Pool', supported: false },
  { value: 'Sensitive', label: 'Sensitive', supported: true },
  { value: 'Text', label: 'Text', supported: true },
];

function toValueUiType(variable: Pick<VariableDto, 'type' | 'isSensitive'>): VariableValueUiType {
  if (variable.isSensitive || variable.type === VariableType.Password) return 'Sensitive';
  return 'Text';
}

function fromValueUiType(type: VariableValueUiType): Pick<VariableDto, 'type' | 'isSensitive'> {
  if (type === 'Sensitive') return { type: VariableType.Password, isSensitive: true };
  return { type: VariableType.String, isSensitive: false };
}

interface VariableValueCellProps {
  name: string;
  value: string;
  description: string;
  type: VariableType;
  isSensitive: boolean;
  onSave: (patch: Partial<VariableDto>) => void;
  placeholder?: string;
}

function hasLineBreak(text: string): boolean {
  return text.includes('\n') || text.includes('\r');
}

function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const CELL_PADDING_X = 12;

const VariableValueCell: React.FC<VariableValueCellProps> = ({
  name,
  value,
  description,
  type,
  isSensitive,
  onSave,
  placeholder = 'Enter value',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [promptForValue, setPromptForValue] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftValue, setDraftValue] = useState(value);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftUiType, setDraftUiType] = useState<VariableValueUiType>(toValueUiType({ type, isSensitive }));
  const currentUiType = toValueUiType({ type, isSensitive });
  const multilineValue = hasLineBreak(value);
  const draftLineCount = Math.max(1, normalizeLineBreaks(draftValue ?? '').split('\n').length);
  const draftLineNumbers = Array.from({ length: draftLineCount }, (_, index) => index + 1);

  useEffect(() => {
    if (!isActive) return;
    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (target.closest('.ant-dropdown')) return;
      if (target.closest('.ant-modal-wrap')) return;
      setIsActive(false);
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isActive]);

  useEffect(() => {
    if (editorOpen) return;
    setDraftName(name);
    setDraftValue(value);
    setDraftDescription(description);
    setDraftUiType(currentUiType);
  }, [name, value, description, currentUiType, editorOpen]);

  const openEditor = () => {
    setIsActive(true);
    setDraftName(name);
    setDraftValue(value);
    setDraftDescription(description);
    setDraftUiType(currentUiType);
    setPromptForValue(false);
    setEditorOpen(true);
  };

  const applyType = (nextType: VariableValueUiType) => {
    const selected = VARIABLE_VALUE_TYPE_OPTIONS.find((option) => option.value === nextType);
    if (!selected) return;
    if (!selected.supported) {
      message.info('This variable type is not supported yet');
      return;
    }
    onSave(fromValueUiType(nextType));
  };

  const handleEditorTypeChange = (nextType: VariableValueUiType) => {
    const selected = VARIABLE_VALUE_TYPE_OPTIONS.find((option) => option.value === nextType);
    if (!selected) return;
    if (!selected.supported) {
      message.info('This variable type is not supported yet');
      return;
    }
    setDraftUiType(nextType);
  };

  const saveEditor = () => {
    onSave({
      name: draftName,
      value: draftValue,
      description: draftDescription,
      ...fromValueUiType(draftUiType),
    });
    setEditorFullscreen(false);
    setEditorOpen(false);
  };

  const closeEditor = () => {
    setEditorFullscreen(false);
    setEditorOpen(false);
  };

  const copyDraftValue = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(draftValue ?? '');
        message.success('Copied to clipboard');
        return;
      }
    } catch {
      // Fall through to fallback copy behavior.
    }

    const fallbackInput = document.createElement('textarea');
    fallbackInput.value = draftValue ?? '';
    fallbackInput.style.position = 'fixed';
    fallbackInput.style.opacity = '0';
    document.body.appendChild(fallbackInput);
    fallbackInput.focus();
    fallbackInput.select();
    document.execCommand('copy');
    document.body.removeChild(fallbackInput);
    message.success('Copied to clipboard');
  };

  const handleSingleLinePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = normalizeLineBreaks(event.clipboardData.getData('text/plain') ?? '');
    if (!hasLineBreak(pastedText)) return;

    event.preventDefault();
    const input = event.currentTarget;
    const currentValue = input.value ?? value;
    const selectionStart = input.selectionStart ?? currentValue.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${pastedText}${currentValue.slice(selectionEnd)}`;
    onSave({ value: nextValue });
    setIsActive(true);
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0 h-full">
      {!isActive && (
        <div className="h-full min-h-[44px] flex items-center">
          {multilineValue ? (
            <button
              type="button"
              onClick={() => setIsActive(true)}
              onDoubleClick={openEditor}
              className="w-full text-left px-0 py-1 border-0 border-b border-transparent hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-500 flex-shrink-0" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <pre className="m-0 whitespace-nowrap overflow-hidden text-ellipsis text-[13px] font-mono text-slate-800 leading-5 cursor-pointer">
                    {value}
                  </pre>
                </div>
              </div>
            </button>
          ) : (
            <div className="w-full border-b border-transparent hover:border-slate-300 focus-within:border-squid-blue transition-colors">
              <input
                type="text"
                value={value}
                onChange={(event) => onSave({ value: event.target.value })}
                onPaste={handleSingleLinePaste}
                onFocus={() => setIsActive(true)}
                onClick={() => setIsActive(true)}
                onDoubleClick={openEditor}
                placeholder={placeholder}
                title={value}
                className="w-full bg-transparent border-0 px-0 py-1 text-sm font-mono text-slate-800 placeholder:text-slate-400 outline-none"
              />
            </div>
          )}
        </div>
      )}

      {isActive && (
        <div
          className={`absolute top-0 z-30 rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)] px-3 py-1 min-h-[122px] ${multilineValue ? 'pb-6' : ''}`}
          style={{ left: -CELL_PADDING_X, right: -CELL_PADDING_X }}
        >
          <div className="w-full border-b-2 border-squid-blue">
            {multilineValue ? (
              <button
                type="button"
                onClick={openEditor}
                className="w-full text-left bg-transparent border-0 px-0 py-1 cursor-pointer"
              >
                <pre className="m-0 whitespace-pre-wrap break-words text-sm font-mono text-slate-800 leading-5">{value}</pre>
              </button>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(event) => onSave({ value: event.target.value })}
                onPaste={handleSingleLinePaste}
                onDoubleClick={openEditor}
                placeholder={placeholder}
                title={value}
                className="w-full bg-transparent border-0 px-0 py-1 pr-44 text-sm font-mono text-slate-800 placeholder:text-slate-400 outline-none"
              />
            )}
          </div>

          {multilineValue ? (
            <div className="mt-4 flex flex-col items-end gap-5">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: VARIABLE_VALUE_TYPE_OPTIONS.map((option) => ({
                    key: option.value,
                    label: option.label,
                    disabled: !option.supported,
                  })),
                  selectedKeys: [currentUiType],
                  onClick: ({ key }) => applyType(String(key) as VariableValueUiType),
                }}
              >
                <button type="button" className="text-squid-blue hover:text-blue-700 text-sm font-medium leading-none">
                  Change type
                </button>
              </Dropdown>
              <button type="button" onClick={openEditor} className="text-squid-blue hover:text-blue-700 text-sm font-medium leading-none">
                Open editor
              </button>
            </div>
          ) : (
            <div className="absolute right-3 bottom-6 flex flex-col items-end gap-5">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: VARIABLE_VALUE_TYPE_OPTIONS.map((option) => ({
                    key: option.value,
                    label: option.label,
                    disabled: !option.supported,
                  })),
                  selectedKeys: [currentUiType],
                  onClick: ({ key }) => applyType(String(key) as VariableValueUiType),
                }}
              >
                <button type="button" className="text-squid-blue hover:text-blue-700 text-sm font-medium leading-none">
                  Change type
                </button>
              </Dropdown>
              <button type="button" onClick={openEditor} className="text-squid-blue hover:text-blue-700 text-sm font-medium leading-none">
                Open editor
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={editorOpen}
        onCancel={closeEditor}
        destroyOnClose
        maskClosable={false}
        width={editorFullscreen ? 'calc(100vw - 24px)' : 1160}
        style={{ top: editorFullscreen ? 12 : 36, maxWidth: 'calc(100vw - 24px)' }}
        title={(
          <div className="flex items-center justify-between gap-3 pr-2">
            <span className="text-base font-semibold text-gray-900">Edit Variable</span>
            <Button
              type="text"
              icon={editorFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              aria-label={editorFullscreen ? 'ExitFullScreen' : 'EnterFullScreen'}
              onClick={() => setEditorFullscreen((previous) => !previous)}
            />
          </div>
        )}
        footer={(
          <div className="flex items-center justify-between">
            <Button onClick={() => message.info('Define scope in the Scope column of the variable table')}>Define scope</Button>
            <div className="flex items-center gap-2">
              <Button onClick={closeEditor}>Cancel</Button>
              <Button type="primary" onClick={saveEditor}>Done</Button>
            </div>
          </div>
        )}
      >
        <div className="pt-2 pb-2 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
          <div className="space-y-7">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2.5">Name</label>
              <Input
                bordered={false}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="!px-0 !py-1.5 !font-medium !text-slate-800 border-0 border-b !border-slate-300 rounded-none focus:!shadow-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2.5">Variable type</label>
              <Select
                bordered={false}
                value={draftUiType}
                className="w-full variable-type-inline"
                options={VARIABLE_VALUE_TYPE_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                  disabled: !option.supported,
                }))}
                onChange={(nextValue) => handleEditorTypeChange(nextValue as VariableValueUiType)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2.5">Description</label>
              <Input
                bordered={false}
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                className="!px-0 !py-1.5 !font-medium !text-slate-800 border-0 border-b !border-slate-300 rounded-none focus:!shadow-none"
              />
            </div>

            <div className="pt-2">
              <Checkbox checked={promptForValue} onChange={(event) => setPromptForValue(event.target.checked)}>
                Prompt for value
              </Checkbox>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-1.5">Value</div>
            <div className="rounded-md border border-slate-300 bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-slate-100 px-3 py-2.5 min-h-[56px] border-b border-slate-300">
                <div className="h-10 flex items-center">
                  <Select
                    value="PlainText"
                    className="w-52 value-format-select"
                    options={[{ label: 'PlainText', value: 'PlainText' }]}
                    onChange={() => undefined}
                  />
                </div>
                <div className="flex items-center gap-1 self-center">
                  <Button type="text" icon={<CopyOutlined />} onClick={copyDraftValue} className="!text-slate-700">
                    Copy to clipboard
                  </Button>
                  <Button type="text" icon={<SettingOutlined />} className="!text-slate-700" />
                </div>
              </div>

              <div className={`flex ${editorFullscreen ? 'min-h-[560px]' : 'min-h-[430px]'}`}>
                <div className="w-12 border-r border-slate-300 bg-slate-50 text-slate-500 text-sm font-mono px-2 py-2 select-none">
                  {draftLineNumbers.map((line) => (
                    <div key={line} className="leading-6">
                      {line}
                    </div>
                  ))}
                </div>
                <textarea
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  wrap="soft"
                  spellCheck={false}
                  className="value-editor-textarea flex-1 min-h-full bg-white text-slate-800 font-mono text-[15px] leading-6 px-3 py-2 border-0 outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        .variable-type-inline.ant-select:not(.ant-select-customize-input) .ant-select-selector {
          border: 0 !important;
          border-bottom: 1px solid #cbd5e1 !important;
          border-radius: 0 !important;
          padding-left: 0 !important;
          min-height: 40px !important;
          box-shadow: none !important;
        }
        .value-format-select.ant-select-single {
          height: 40px !important;
        }
        .value-format-select.ant-select:not(.ant-select-customize-input) .ant-select-selector {
          background: #eef2f7 !important;
          border: 1px solid #94a3b8 !important;
          border-radius: 8px !important;
          height: 40px !important;
          display: flex !important;
          align-items: center !important;
          padding: 0 12px !important;
          box-shadow: none !important;
        }
        .value-format-select.ant-select {
          align-self: center !important;
        }
        .value-format-select.ant-select-focused:not(.ant-select-disabled):not(.ant-select-customize-input) .ant-select-selector {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16) !important;
        }
        .value-format-select.ant-select-single .ant-select-selection-item {
          line-height: 40px !important;
          display: flex !important;
          align-items: center !important;
        }
        .value-format-select.ant-select-single .ant-select-selection-placeholder {
          line-height: 40px !important;
          display: flex !important;
          align-items: center !important;
        }
        .value-format-select .ant-select-arrow {
          top: 50% !important;
          transform: translateY(-50%) !important;
          margin-top: 0 !important;
          display: flex !important;
          align-items: center !important;
        }
        .value-editor-textarea {
          white-space: pre-wrap !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          word-break: break-word !important;
          tab-size: 2 !important;
        }
      `}</style>
    </div>
  );
};

export default VariableValueCell;
