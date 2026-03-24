import React from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { CloseOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons'

const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase()

export interface KeyValueItem {
  key: string
  value: string
}

interface KeyValueListEditorProps {
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyLabel?: string
  valueLabel?: string
  addLabel?: string
  layout?: 'simple' | 'octopus'
  keyOptions?: string[]
}

function UnderlineInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[11px] text-slate-400 mb-0.5 leading-none">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-slate-300 focus:border-blue-500 focus:outline-none text-sm text-slate-800 py-0.5 px-0 placeholder-slate-300 transition-colors"
      />
    </div>
  )
}

export function KeyValueListEditor({
  items,
  onChange,
  keyLabel = 'Name',
  valueLabel = 'Value',
  addLabel = 'Add',
  layout = 'simple',
  keyOptions = [],
}: KeyValueListEditorProps) {
  const [openNameOptionsRow, setOpenNameOptionsRow] = React.useState<number | null>(null)
  const [nameDropdownStyle, setNameDropdownStyle] = React.useState<{ top: number; left: number; width: number } | null>(null)
  const nameFieldRefs = React.useRef<Record<number, HTMLDivElement | null>>({})

  const updateItem = (index: number, field: 'key' | 'value', val: string) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const addItem = () => {
    onChange([...items, { key: '', value: '' }])
  }

  const normalizedKeyOptions = Array.from(new Set(keyOptions.map((item) => item.trim()).filter(Boolean)))
  const showKeyOptions = normalizedKeyOptions.length > 0
  const insertVariable = () => {
    message.info('Insert Variable is not available yet')
  }
  const closeNameOptionsDelayed = () => {
    window.setTimeout(() => setOpenNameOptionsRow((prev) => (prev == null ? prev : null)), 120)
  }
  const updateNameDropdownPosition = React.useCallback((index: number) => {
    const anchor = nameFieldRefs.current[index]
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setNameDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])
  const openNameOptions = (index: number) => {
    if (!showKeyOptions) return
    setOpenNameOptionsRow(index)
    updateNameDropdownPosition(index)
  }

  React.useEffect(() => {
    if (openNameOptionsRow == null) {
      setNameDropdownStyle(null)
      return
    }

    const update = () => updateNameDropdownPosition(openNameOptionsRow)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    update()
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [openNameOptionsRow, updateNameDropdownPosition])

  const openItem = openNameOptionsRow != null ? items[openNameOptionsRow] : null
  const openItemKey = openItem?.key ?? ''
  const openRowOptions = normalizedKeyOptions.filter((option) => !openItemKey.trim() || normalizeText(option).includes(normalizeText(openItemKey)))

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <PlusOutlined style={{ fontSize: 11 }} />
          {addLabel}
        </button>
      </div>

      {layout === 'simple' && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-end gap-2">
              <UnderlineInput label={keyLabel} value={item.key} onChange={(v) => updateItem(i, 'key', v)} />
              <div className="flex-shrink-0 self-center text-slate-300 pb-1 text-base leading-none">|</div>
              <UnderlineInput label={valueLabel} value={item.value} onChange={(v) => updateItem(i, 'value', v)} />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex-shrink-0 self-center p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Remove"
              >
                <CloseOutlined style={{ fontSize: 14 }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {layout === 'octopus' && items.length > 0 && (
        <ul className="space-y-3 overflow-visible">
          {items.map((item, index) => (
            <li
              key={index}
              className={`relative overflow-visible rounded border border-slate-200 bg-white px-4 py-3 ${
                openNameOptionsRow === index ? 'z-20' : 'z-0'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-5">
                  <div
                    className="relative flex-1 min-w-0"
                    ref={(element) => {
                      nameFieldRefs.current[index] = element
                    }}
                  >
                    <div className="w-full border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                      <input
                        type="text"
                        value={item.key}
                        placeholder={keyLabel}
                        onFocus={() => {
                          openNameOptions(index)
                        }}
                        onClick={() => {
                          openNameOptions(index)
                        }}
                        onBlur={closeNameOptionsDelayed}
                        onChange={(event) => {
                          updateItem(index, 'key', event.target.value)
                          openNameOptions(index)
                        }}
                        className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 pr-[74px] placeholder-slate-400"
                      />
                    </div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {showKeyOptions ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-50 transition-colors"
                          aria-label={`View options for ${keyLabel}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            if (openNameOptionsRow === index) {
                              setOpenNameOptionsRow(null)
                              return
                            }
                            openNameOptions(index)
                          }}
                        >
                          <DownOutlined style={{ fontSize: 11 }} />
                        </button>
                      ) : (
                        <span className="inline-block w-7 h-7" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-50 transition-colors"
                        aria-label="Insert Variable"
                        onClick={insertVariable}
                      >
                        <span className="text-[10px] font-semibold">{'{ }'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative flex-1 min-w-0 border-b border-slate-300 focus-within:border-blue-500 transition-colors">
                    <input
                      type="text"
                      value={item.value}
                      placeholder={valueLabel}
                      onChange={(event) => updateItem(index, 'value', event.target.value)}
                      className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 py-1 px-0 pr-[74px] placeholder-slate-400"
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <span className="inline-block w-7 h-7" aria-hidden="true" />
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-50 transition-colors"
                        aria-label="Insert Variable"
                        onClick={insertVariable}
                      >
                        <span className="text-[10px] font-semibold">{'{ }'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                  aria-label="Cancel"
                >
                  <CloseOutlined style={{ fontSize: 13 }} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showKeyOptions && openNameOptionsRow != null && nameDropdownStyle
        ? createPortal(
            <div
              className="fixed z-[99999] bg-white border border-slate-200 rounded shadow-sm max-h-44 overflow-auto"
              style={{
                top: nameDropdownStyle.top,
                left: nameDropdownStyle.left,
                width: nameDropdownStyle.width,
              }}
            >
              {openRowOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    updateItem(openNameOptionsRow, 'key', option)
                    setOpenNameOptionsRow(null)
                  }}
                >
                  {option}
                </button>
              ))}
              {openRowOptions.length === 0 ? <div className="px-3 py-2 text-xs text-slate-400">No options</div> : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
