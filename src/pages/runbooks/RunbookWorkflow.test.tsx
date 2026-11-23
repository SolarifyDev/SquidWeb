import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRunbook, updateRunbook, type RunbookDto } from 'pages/apis/runbook'
import { getDeploymentSteps } from 'pages/apis/deploymentProcess'
import { getServerTaskList } from 'pages/apis/serverTask'
import RunbookDetailLayout from './RunbookDetailLayout'
import { RunbookRunDetailPage } from './RunbookHistoryPages'
import RunbookRunsPage from './RunbookRunsPage'
import RunbookSettingsPage from './RunbookSettingsPage'
import { RunbookPublishPage, RunbookRunPage } from './RunbookWorkflowPage'

vi.mock('pages/apis/runbook', () => ({
  getRunbook: vi.fn(),
  updateRunbook: vi.fn(),
}))
vi.mock('pages/apis/deploymentProcess', () => ({ getDeploymentSteps: vi.fn() }))
vi.mock('pages/apis/serverTask', () => ({ getServerTaskList: vi.fn() }))
vi.mock('contexts/PermissionContext', () => ({
  usePermissions: () => ({ hasPermission: () => true, loading: false }),
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

function openPage(path: string) {
  vi.mocked(getRunbook).mockResolvedValue(runbook)
  vi.mocked(getServerTaskList).mockResolvedValue({ totalCount: 0, items: [] })
  vi.mocked(getDeploymentSteps).mockResolvedValue({
    count: 1,
    steps: [{ id: 1, name: 'Create backup', stepOrder: 1 }],
  } as Awaited<ReturnType<typeof getDeploymentSteps>>)

  return render(
    <MemoryRouter initialEntries={[`${base}9/${path}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={`${base}:runbookId`} element={<RunbookDetailLayout />}>
          <Route path="process" element={<h2>Process editor</h2>} />
          <Route path="publish" element={<RunbookPublishPage />} />
          <Route path="run" element={<RunbookRunPage />} />
          <Route path="runs" element={<RunbookRunsPage />} />
          <Route path="runs/preview/:previewId" element={<RunbookRunDetailPage />} />
          <Route path="settings" element={<RunbookSettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('Runbook UI preview routes', () => {
  it('publishes a snapshot, validates a run and opens its saved preview from history', async () => {
    openPage('process')
    fireEvent.click(await screen.findByRole('link', { name: 'Publish...' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Snapshot name' }), { target: { value: 'Backup v1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Preview snapshot')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Run...' }))
    expect(screen.getByRole('radio', { name: 'Published snapshot' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.getByText('Select at least one environment.')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Select one or more environments' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Development' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show advanced' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluded steps' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Create backup' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByRole('heading', { name: 'Run preview · Development' })).toBeInTheDocument()
    expect(screen.getByText('1. Create backup')).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Runs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show advanced filters' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Task or snapshot' }), { target: { value: 'no match' } })
    expect(screen.getByText('No runs match these filters.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    fireEvent.click(screen.getByRole('link', { name: 'Backup v1' }))
    expect(await screen.findByRole('heading', { name: 'Run preview · Development' })).toBeInTheDocument()
  })

  it('saves the default failure mode locally and applies it in the run form', async () => {
    openPage('settings')
    fireEvent.click(await screen.findByRole('button', { name: /^Default Failure Mode/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Use guided failure mode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    expect(updateRunbook).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('link', { name: 'Process' }))
    fireEvent.click(await screen.findByRole('link', { name: 'Run...' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show advanced' }))
    fireEvent.click(screen.getByRole('button', { name: 'Failure mode' }))
    expect(screen.getByRole('radio', { name: 'Use guided failure mode' })).toBeChecked()
  })
})
