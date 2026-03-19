import type { ReactNode } from 'react'
import { DownOutlined } from '@ant-design/icons'

interface SettingsDetailPanelProps {
  title: string
  subtitle?: ReactNode
  subtitlePlaceholder?: boolean
  isOpen: boolean
  onToggle: () => void
  hasBorder?: boolean
  children?: ReactNode
}

export function SettingsDetailPanel({
  title,
  subtitle,
  subtitlePlaceholder = false,
  isOpen,
  onToggle,
  hasBorder = true,
  children,
}: SettingsDetailPanelProps) {
  return (
    <div className={hasBorder ? 'border-b border-gray-200' : ''}>
      <div
        className="grid items-start py-4 pl-6 pr-6 cursor-pointer select-none"
        style={{ gridTemplateColumns: '260px 1fr auto' }}
        onClick={onToggle}
      >
        <div className="text-base font-bold text-gray-900 pt-0.5">{title}</div>
        <div className={subtitlePlaceholder ? 'text-sm text-gray-400 pt-0.5' : 'text-sm text-gray-500 pt-0.5'}>{subtitle}</div>
        <button
          type="button"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <DownOutlined className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ fontSize: 12 }} />
        </button>
      </div>
      {isOpen ? (
        <div className="grid pl-6 pr-6 pb-5" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div />
          <div>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

