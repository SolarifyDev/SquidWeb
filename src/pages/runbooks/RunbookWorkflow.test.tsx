import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunbookDto, RunbookRunDto } from 'pages/apis/runbook'
import { getDeploymentSteps } from 'pages/apis/deploymentProcess'
import { axiosInstance, get, post } from 'utils/request'
import RunbookDetailLayout from './RunbookDetailLayout'
import { RunbookRunDetailPage } from './RunbookHistoryPages'
import RunbookRunsPage from './RunbookRunsPage'
import RunbookSettingsPage from './RunbookSettingsPage'
import { RunbookPublishPage, RunbookRunPage } from './RunbookWorkflowPage'

const { hasPermission } = vi.hoisted(() => ({ hasPermission: vi.fn(() => true) }))

vi.mock('utils/request', async (importOriginal) => ({
  ...await importOriginal<typeof import('utils/request')>(),
  get: vi.fn(),
}))
vi.mock('pages/apis/deploymentProcess', () => ({ getDeploymentSteps: vi.fn() }))
vi.mock('contexts/PermissionContext', () => ({
  usePermissions: () => ({ hasPermission, loading: false }),
}))
vi.mock('./useProjectRunbookContext', () => {
  const project = { id: 7, spaceId: 1, name: 'Checkout', slug: 'checkout' }
  return { useProjectRunbookContext: () => ({ project, spaceId: 'Spaces-1', projectName: 'checkout', loading: false }) }
})

const runbook = {
  id: 9, projectId: 7, spaceId: 1, name: 'Backup database',
  description: '', tags: [], processId: 101, variableSetId: 102,
  createdDate: '', createdBy: 1, lastModifiedDate: '', lastModifiedBy: 1,
} satisfies RunbookDto

const base = '/Spaces-1/projects/checkout/operations/runbooks/'
const published: RunbookDto = {
  ...runbook,
  publishedSnapshotId: 11,
  publishedSnapshot: { id: 11, runbookId: 9, version: 4, publishedAt: '', publishedBy: 1 },
}
const accepted: RunbookRunDto = {
  id: 21, taskId: 42, runbookId: 9, snapshotId: 10, snapshotVersion: 3,
  environmentId: 2, projectId: 7, spaceId: 1, initiatedBy: 1, state: 'Pending', createdDate: '',
}

const task = (state: string, errorMessage?: string) => ({
  id: 42, name: 'Runbook', description: 'Run Runbook Backup database version 3',
  state, spaceId: 1, projectId: 7, environmentId: 2, errorMessage,
})
const logPage = (message?: string, sequenceNumber = 1, hasMore = false) => ({
  items: message ? [{ id: sequenceNumber, sequenceNumber, messageText: message }] : [],
  nextAfterSequenceNumber: message ? sequenceNumber : null,
  hasMore,
})

function openPage(path: string, detail: RunbookDto = runbook, {
  environments = [{ id: 1, name: 'Development' }, { id: 2, name: 'Staging' }],
  readTask = () => task('Pending'),
  readLogs = (_after?: number) => logPage(),
} = {}) {
  vi.mocked(get).mockImplementation(async (url, config) => {
    if (url === '/runbooks/detail/9') return detail
    if (url === '/runbooks/eligible-environments/9') return { environments }
    if (url === '/tasks') return { totalCount: 0, items: [] }
    if (url === '/tasks/42') return readTask()
    if (url === '/tasks/42/logs') return readLogs(config?.params?.afterSequenceNumber)
    throw new Error(`Unexpected GET ${url}`)
  })
  vi.mocked(getDeploymentSteps).mockResolvedValue({
    count: 1,
    steps: [{ id: 1, name: 'Create backup', stepOrder: 1 }],
  } as Awaited<ReturnType<typeof getDeploymentSteps>>)

  return render(
    <MemoryRouter initialEntries={[`${base}9/${path}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={`${base}:runbookId`} element={<RunbookDetailLayout />}>
          <Route index element={<p>Runbook overview</p>} />
          <Route path="process" element={<h2>Process editor</h2>} />
          <Route path="publish" element={<RunbookPublishPage />} />
          <Route path="run" element={<RunbookRunPage />} />
          <Route path="runs" element={<RunbookRunsPage />} />
          <Route path="runs/preview/:previewId" element={<RunbookRunDetailPage />} />
          <Route path="runs/:taskId" element={<RunbookRunDetailPage />} />
          <Route path="settings" element={<RunbookSettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  hasPermission.mockReset()
  hasPermission.mockReturnValue(true)
})

describe('Runbook UI preview routes', () => {
  it('keeps preview publication separate from an executable version', async () => {
    openPage('process')
    fireEvent.click(await screen.findByRole('link', { name: 'Preview publication' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Snapshot name' }), { target: { value: 'Backup v1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Preview snapshot')).toBeInTheDocument()

    expect(screen.queryByRole('link', { name: 'Run Now' })).not.toBeInTheDocument()
  })

  it('saves the preview failure mode locally without updating the Runbook', async () => {
    const send = vi.spyOn(axiosInstance, 'post')
    openPage('settings')
    fireEvent.click(await screen.findByRole('button', { name: /^Default Failure Mode/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Use guided failure mode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    fireEvent.click(screen.getByRole('link', { name: 'Process' }))
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Default Failure Mode/ }))
    expect(screen.getByRole('radio', { name: 'Use guided failure mode' })).toBeChecked()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('Run Now', () => {
  it('blocks direct access to unpublished Runbooks without querying environments', async () => {
    openPage('run')
    expect(await screen.findByText('Publish this Runbook before it can be run.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Now' })).toBeDisabled()
    expect(get).not.toHaveBeenCalledWith('/runbooks/eligible-environments/9', expect.anything())
  })

  it('requires RunbookRun permission even with edit permission', async () => {
    hasPermission.mockImplementation((permission?: string) => permission !== 'RunbookRun')
    openPage('run', published)
    expect(await screen.findByText(/RunbookRun permission is required/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Now' })).toBeDisabled()
    expect(get).not.toHaveBeenCalledWith('/runbooks/eligible-environments/9', expect.anything())
  })

  it('does not allow submitting without eligible environments', async () => {
    openPage('run', published, { environments: [] })
    expect(await screen.findByText(/No eligible environments/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Now' })).toBeDisabled()
  })

  it('submits one environment once, accepts 202, and polls the linked task until success', async () => {
    const readTask = vi.fn().mockReturnValueOnce(task('Pending')).mockReturnValue(task('Success'))
    const readLogs = vi.fn().mockReturnValueOnce(logPage()).mockReturnValue(logPage('Backup completed'))
    let acceptRun!: (response: { data: { code: number; data: RunbookRunDto }; status: number }) => void
    const send = vi.spyOn(axiosInstance, 'post').mockReturnValue(new Promise((resolve) => { acceptRun = resolve }))
    openPage('', published, { readTask, readLogs })
    fireEvent.click(await screen.findByRole('link', { name: 'Run Now' }))
    const environment = await screen.findByRole('combobox', { name: 'Environment' })
    expect(within(environment).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Select an eligible environment', 'Development', 'Staging'])
    expect(get).toHaveBeenCalledWith('/runbooks/eligible-environments/9', { params: { projectId: 7, spaceId: 1 } })
    const trigger = screen.getByRole('button', { name: 'Run Now' })
    expect(trigger).toBeDisabled()
    expect(screen.queryByText('Current draft')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show advanced' })).not.toBeInTheDocument()

    fireEvent.change(environment, { target: { value: '1' } })
    fireEvent.change(environment, { target: { value: '2' } })
    vi.useFakeTimers()
    fireEvent.submit(trigger.closest('form')!)
    fireEvent.submit(trigger.closest('form')!)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('/runbooks/run', { id: 9, projectId: 7, spaceId: 1, environmentId: 2 }, undefined)
    expect(trigger).toBeDisabled()

    await act(async () => acceptRun({ data: { code: 202, data: accepted }, status: 202 }))
    expect(screen.getByRole('heading', { name: 'Run details' })).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText('Staging')).toBeInTheDocument()
    expect(screen.getByText('3', { exact: true })).toBeInTheDocument()
    expect(screen.getByText(String(accepted.id))).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/tasks/42', { silentLoading: true })

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Backup completed')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(6000))
    expect(readTask).toHaveBeenCalledTimes(2)
  })

  it('keeps the form open and displays the backend rejection', async () => {
    const send = vi.spyOn(axiosInstance, 'post').mockRejectedValue({
      response: { data: { msg: 'Staging is no longer eligible.' } },
    })
    openPage('run', published)
    fireEvent.change(await screen.findByRole('combobox', { name: 'Environment' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run Now' }))
    expect(await screen.findByText('Staging is no longer eligible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Now' })).toBeEnabled()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('loads a failed task from its direct link and paginates its output', async () => {
    const readLogs = vi.fn((after?: number) => after
      ? logPage('Permission denied', 2)
      : logPage('Opening backup folder', 1, true))
    openPage('runs/42', published, {
      readTask: () => task('Failed', 'Script exited with code 1'),
      readLogs,
    })
    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Script exited with code 1')).toBeInTheDocument()
    expect(screen.getByText('Run Runbook Backup database version 3')).toBeInTheDocument()
    expect(await screen.findByText('Opening backup folder')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load more logs' }))
    expect(await screen.findByText('Permission denied')).toBeInTheDocument()
    expect(screen.getByText('Opening backup folder')).toBeInTheDocument()
    expect(readLogs).toHaveBeenNthCalledWith(2, 1)
    expect(screen.queryByRole('button', { name: /cancel|resume|retry run/i })).not.toBeInTheDocument()
  })
})
