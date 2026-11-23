import { useMemo, type ReactNode } from 'react'
import { Button, Dropdown, Tag, type MenuProps } from 'antd'
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  MoreOutlined,
  ScheduleOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import PageContainer from 'components/PageContainer'
import type { RunbookDto } from 'pages/apis/runbook'
import {
  buildRunbookPath,
  buildRunbookProcessPath,
  buildRunbookRunsPath,
  buildRunbookSettingsPath,
  buildRunbooksPath,
} from './shared'

export type RunbookTab = 'overview' | 'runs' | 'process' | 'settings'

const TAB_LABELS: Array<{ key: RunbookTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'runs', label: 'Runs' },
  { key: 'process', label: 'Process' },
  { key: 'settings', label: 'Settings' },
]

const PRIMARY_GREEN_CLASS =
  '!inline-flex !items-center !justify-center !rounded !border !border-squid-green !bg-squid-green !px-3.5 !py-1.5 !text-[13px] !font-semibold !text-white !shadow-none hover:!border-[#00874d] hover:!bg-[#00874d] disabled:!border-slate-200 disabled:!bg-slate-100 disabled:!text-slate-400'

const OUTLINE_BLUE_CLASS =
  '!inline-flex !items-center !justify-center !rounded !border !border-squid-blue/45 !bg-white !px-3.5 !py-1.5 !text-[13px] !font-medium !text-squid-blue !shadow-none hover:!border-squid-blue hover:!bg-blue-50'

interface RunbookPageShellProps {
  runbook: RunbookDto
  spaceId: string
  projectName: string
  activeTab: RunbookTab
  menuItems?: MenuProps['items']
  onMenuClick?: (key: string) => void
  defaultAction?: 'process' | null
  renderShell?: boolean
  actions?: ReactNode
  aside?: ReactNode
  children: ReactNode
  contentClassName?: string
  forceAside?: boolean
}

function ScheduledTriggerAside() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
          <ClockCircleOutlined className="text-slate-500" />
          Scheduled Triggers
        </div>
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          className="!h-7 !w-7 !p-0 !text-slate-500"
          aria-label="Scheduled Trigger options"
        />
      </div>
      <p className="mb-0 mt-4 text-sm leading-6 text-slate-600">
        No triggers are currently setup for this runbook.
      </p>
      <div className="mt-6 flex min-h-[120px] flex-1 items-end justify-center text-slate-300">
        <ScheduleOutlined className="mb-2 text-5xl" />
      </div>
    </div>
  )
}

function ProcessAside() {
  return (
    <div>
      <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        <CodeOutlined className="text-slate-500" />
        Script Modules
      </div>
      <p className="mb-0 mt-4 text-sm leading-6 text-slate-600">
        Script modules can be included in Runbook steps to share scripts across projects.
      </p>
      <Button className={`${OUTLINE_BLUE_CLASS} mt-5`} disabled>
        Include
      </Button>
    </div>
  )
}

function RunbookAside({
  runbook,
  activeTab,
}: {
  runbook: RunbookDto
  activeTab: RunbookTab
}) {
  if (activeTab === 'process') return <ProcessAside />
  return <ScheduledTriggerAside />
}

export default function RunbookPageShell({
  runbook,
  spaceId,
  projectName,
  activeTab,
  renderShell = true,
  menuItems = [],
  onMenuClick,
  defaultAction = 'process',
  actions,
  aside,
  children,
  contentClassName = '',
  forceAside = false,
}: RunbookPageShellProps) {
  const basePath = buildRunbookPath(spaceId, projectName, runbook.id)
  const listPath = buildRunbooksPath(spaceId, projectName)
  const tabPaths = useMemo<Record<RunbookTab, string>>(() => ({
    overview: basePath,
    runs: buildRunbookRunsPath(spaceId, projectName, runbook.id),
    process: buildRunbookProcessPath(spaceId, projectName, runbook.id),
    settings: buildRunbookSettingsPath(spaceId, projectName, runbook.id),
  }), [basePath, projectName, runbook.id, spaceId])

  const shell = (
    <>
      <header className="flex-shrink-0 border-b border-slate-200">
        <div className="px-5 pt-4 sm:px-6">
          <Link
            to={listPath}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-squid-blue hover:underline"
          >
            <ArrowLeftOutlined className="text-[12px]" />
            Runbooks
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 break-words text-[24px] font-semibold leading-8 text-slate-900">
                {runbook.name}
              </h1>
              <p className="mb-0 mt-1 text-sm text-slate-600" aria-live="polite">
                {runbook.publishedSnapshot ? `Published version ${runbook.publishedSnapshot.version}` : 'Unpublished'}
              </p>
              {(runbook.tags ?? []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {runbook.tags.map((tag) => (
                    <Tag key={tag} className="m-0 border-slate-200 bg-slate-50 text-slate-600">
                      {tag}
                    </Tag>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
              {!actions && defaultAction === 'process' ? (
                <Link to={tabPaths.process}>
                  <Button className={PRIMARY_GREEN_CLASS}>Define your Runbook Process</Button>
                </Link>
              ) : null}
              {menuItems.length > 0 ? (
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  menu={{
                    items: menuItems,
                    onClick: ({ key }) => onMenuClick?.(key),
                  }}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    className="!h-8 !w-8 !p-0 !text-slate-500"
                    aria-label="Runbook actions"
                  />
                </Dropdown>
              ) : null}
            </div>
          </div>
        </div>

        <nav aria-label="Runbook tabs" className="mt-4 flex min-w-0 flex-wrap px-2 sm:px-3">
          {TAB_LABELS.map((tab) => {
            const active = tab.key === activeTab
            return (
              <Link
                key={tab.key}
                to={tabPaths[tab.key]}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative flex h-11 flex-shrink-0 items-center px-3 text-sm font-medium transition-colors sm:px-4 sm:text-[15px]',
                  active
                    ? 'text-squid-blue after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[3px] after:rounded-t-full after:bg-squid-blue'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <div className={`grid min-h-0 flex-1 auto-rows-min overflow-y-auto lg:auto-rows-auto lg:overflow-hidden ${forceAside || activeTab === 'process' || aside ? 'lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]' : ''}`}>
        <main className={`min-h-0 min-w-0 overflow-y-auto ${contentClassName}`}>{children}</main>
        {forceAside || activeTab === 'process' || aside ? <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/60 px-5 py-5 lg:border-l lg:border-t-0">
          {aside ?? <RunbookAside runbook={runbook} activeTab={activeTab} />}
        </aside> : null}
      </div>
    </>
  )

  if (!renderShell) return shell

  return (
    <PageContainer className="!flex !h-full !min-h-0 !max-w-[1680px] !flex-col !py-4">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {shell}
      </div>
    </PageContainer>
  )
}

export { PRIMARY_GREEN_CLASS, OUTLINE_BLUE_CLASS }
