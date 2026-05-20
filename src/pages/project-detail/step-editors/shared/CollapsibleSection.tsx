import React, { useState } from 'react'

interface CollapsibleSectionProps {
  title: string
  subtitle?: React.ReactNode
  defaultOpen?: boolean
  fullWidth?: boolean
  titleWidth?: number
  children: React.ReactNode
}

const TITLE_WIDTH = 200

export function CollapsibleSection({ title, subtitle, defaultOpen = false, fullWidth = false, titleWidth = TITLE_WIDTH, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left gap-4"
      >
        <span className="text-sm font-semibold text-slate-700 flex-shrink-0" style={{ width: titleWidth }}>
          {title}
        </span>
        {subtitle && <span className="text-xs text-slate-400 flex-1 min-w-0">{subtitle}</span>}
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          className={`ml-auto text-slate-400 flex-shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-4">
          {fullWidth ? (
            <div className="space-y-4">{children}</div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-shrink-0" style={{ width: titleWidth }} />
              <div className="min-w-0 space-y-4" style={{ width: 560 }}>{children}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
