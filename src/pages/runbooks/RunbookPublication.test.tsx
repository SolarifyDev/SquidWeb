import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunbookDto, RunbookPublishedSnapshotDto } from 'pages/apis/runbook'
import { ApiError, get, post } from 'utils/request'
import RunbookDetailLayout, { type RunbookDetailOutletContext } from './RunbookDetailLayout'

const { hasPermission } = vi.hoisted(() => ({ hasPermission: vi.fn() }))

vi.mock('utils/request', async (importOriginal) => ({
  ...await importOriginal<typeof import('utils/request')>(),
  get: vi.fn(),
  post: vi.fn(),
}))
vi.mock('contexts/PermissionContext', () => ({
  usePermissions: () => ({ hasPermission, loading: false }),
}))
vi.mock('./useProjectRunbookContext', () => {
  const project = { id: 7, spaceId: 1, name: 'Checkout' }
  return {
    useProjectRunbookContext: () => ({ project, spaceId: 'Spaces-1', projectName: 'Checkout', loading: false }),
  }
})
vi.mock('./useRunbookProcessState', () => ({
  useRunbookProcessState: () => ({ hasProcess: true, loading: false }),
}))

const runbook: RunbookDto = {
  id: 9, projectId: 7, spaceId: 1, name: 'Backup database', description: '', tags: [],
  processId: 101, variableSetId: 102, createdDate: '', createdBy: 1, lastModifiedDate: '', lastModifiedBy: 1,
}
const firstSnapshot: RunbookPublishedSnapshotDto = {
  id: 11, runbookId: 9, version: 1, publishedAt: '2026-11-23T08:00:00Z', publishedBy: 2,
}
const basePath = '/Spaces-1/projects/Checkout/operations/runbooks'

function DraftSettings() {
  const { runbook, setRunbook } = useOutletContext<RunbookDetailOutletContext>()
  return (
    <button onClick={() => setRunbook({ ...runbook, name: 'Updated draft', publishedSnapshot: null })}>
      Save draft metadata
    </button>
  )
}

function openRunbook(detail = runbook, section = '') {
  vi.mocked(get).mockResolvedValue(detail)
  render(
    <MemoryRouter initialEntries={[`${basePath}/9${section}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={`${basePath}/:runbookId`} element={<RunbookDetailLayout />}>
          <Route index element={<p>Runbook overview</p>} />
          <Route path="settings" element={<DraftSettings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

async function openPublishDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Publish draft…' }))
  return within(await screen.findByRole('dialog', { name: 'Publish Runbook draft?' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  hasPermission.mockImplementation((permission) => permission === 'RunbookPublish')
})

afterEach(cleanup)

describe('Runbook publication', () => {
  it('publishes and republishes with publish permission alone and uses the server version', async () => {
    openRunbook()
    expect(await screen.findByText('Unpublished')).toBeInTheDocument()

    let resolvePublication!: (snapshot: RunbookPublishedSnapshotDto) => void
    vi.mocked(post).mockReturnValueOnce(new Promise((resolve) => { resolvePublication = resolve }))
    const dialog = await openPublishDialog()
    const confirm = dialog.getByRole('button', { name: 'Publish' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/runbooks/publish', { id: 9, projectId: 7, spaceId: 1 })
    expect(get).toHaveBeenCalledWith('/runbooks/detail/9', { params: { projectId: 7, spaceId: 1 } })

    await act(async () => resolvePublication(firstSnapshot))
    expect(await screen.findByText('Published version 1')).toBeInTheDocument()

    vi.mocked(post).mockResolvedValueOnce({ ...firstSnapshot, id: 16, version: 4 })
    fireEvent.click(await (await openPublishDialog()).findByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Published version 4')).toBeInTheDocument()
  })

  it('shows the current version and hides Publish for a user who can only edit', async () => {
    hasPermission.mockImplementation((permission) => permission === 'RunbookEdit')
    openRunbook({ ...runbook, publishedSnapshotId: 11, publishedSnapshot: firstSnapshot })

    expect(await screen.findByText('Published version 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish draft…' })).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it.each([
    [422, { validationCode: 'runbook.unsupported_action', msg: 'Only inline script actions can be published.' }],
    [403, { missingPermission: 'RunbookPublish', msg: 'RunbookPublish permission is required in this space.' }],
  ] as const)('shows the server error (%s) and retains the current version', async (status, response) => {
    vi.mocked(post).mockRejectedValueOnce(new ApiError(response.msg, status, status, response))
    openRunbook({ ...runbook, publishedSnapshotId: 11, publishedSnapshot: firstSnapshot })

    const dialog = await openPublishDialog()
    fireEvent.click(dialog.getByRole('button', { name: 'Publish' }))

    expect(await dialog.findByText(response.msg)).toBeInTheDocument()
    expect(screen.getByText('Published version 1')).toBeInTheDocument()
  })

  it('keeps published metadata when saving the draft', async () => {
    hasPermission.mockImplementation((permission) => permission === 'RunbookEdit')
    openRunbook({ ...runbook, publishedSnapshotId: 11, publishedSnapshot: firstSnapshot }, '/settings')

    fireEvent.click(await screen.findByRole('button', { name: 'Save draft metadata' }))
    expect(screen.getByRole('heading', { name: 'Updated draft' })).toBeInTheDocument()
    expect(screen.getByText('Published version 1')).toBeInTheDocument()
  })
})
