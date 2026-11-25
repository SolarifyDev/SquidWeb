import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from 'pages/apis/packageStore'
import { ApiError } from 'utils/request'
import { PackageStorageSettings } from './PackageStorageSettings'

vi.mock('pages/apis/packageStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pages/apis/packageStore')>()
  return {
    ...actual,
    getPackageStores: vi.fn(),
    getPackageStoreProviders: vi.fn(),
    createPackageStore: vi.fn(),
    updatePackageStore: vi.fn(),
    deletePackageStore: vi.fn(),
    setDefaultPackageStore: vi.fn(),
    testPackageStore: vi.fn(),
  }
})

const mocked = vi.mocked(api)

const FILE_SYSTEM: api.PackageStoreProviderDescriptor = {
  kind: 'FileSystem',
  displayName: 'Local disk',
  description: 'Keeps packages as files in a folder on the server.',
  fields: [{ key: 'Root', label: 'Root folder', kind: 'Path', required: false, placeholder: 'Leave empty to use the data directory', options: [] }],
}

function store(overrides: Partial<api.PackageStoreDto>): api.PackageStoreDto {
  return { id: 1, name: 'Primary', kind: 'FileSystem', properties: {}, secretHasValue: {}, isDefault: false, warnings: [], ...overrides }
}

const PRIMARY = store({ id: 1, name: 'Primary', isDefault: true, properties: { Root: '/data/packages' }, warnings: ['Not on a persistent volume'] })
const ARCHIVE = store({ id: 2, name: 'Archive', properties: { Root: '/mnt/archive' }, lastTestSucceeded: false, lastTestedDate: '2026-11-20T10:00:00Z', lastTestMessage: 'Folder is not writable' })

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

describe('PackageStorageSettings', () => {
  beforeEach(() => {
    mocked.getPackageStores.mockResolvedValue([PRIMARY, ARCHIVE])
    mocked.getPackageStoreProviders.mockResolvedValue([FILE_SYSTEM])
  })

  afterEach(() => {
    vi.resetAllMocks()
    document.body.innerHTML = ''
  })

  it('lists stores with type, location, default badge, warnings and last check', async () => {
    render(<PackageStorageSettings />)
    await screen.findByText('Primary')

    const primary = within(rowOf('Primary'))
    expect(primary.getByText('Default')).toBeInTheDocument()
    expect(primary.getByText('Local disk')).toBeInTheDocument()
    expect(primary.getByText('/data/packages')).toBeInTheDocument()
    expect(primary.getByText('Not on a persistent volume')).toBeInTheDocument()

    const archive = within(rowOf('Archive'))
    expect(archive.queryByText('Default')).toBeNull()
    expect(archive.getByText('Failed')).toBeInTheDocument()
    expect(archive.getByText('Folder is not writable')).toBeInTheDocument()
  })

  it('cannot delete or re-default the default store', async () => {
    render(<PackageStorageSettings />)
    await screen.findByText('Primary')

    const primary = within(rowOf('Primary'))
    expect(primary.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(primary.queryByRole('button', { name: 'Set as default' })).toBeNull()
    expect(within(rowOf('Archive')).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('sets a store as default through the API and refreshes the list', async () => {
    mocked.setDefaultPackageStore.mockResolvedValue({ ...ARCHIVE, isDefault: true })
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Set as default' }))

    await waitFor(() => expect(mocked.setDefaultPackageStore).toHaveBeenCalledWith(2))
    await waitFor(() => expect(mocked.getPackageStores).toHaveBeenCalledTimes(2))
  })

  it('shows the message of a refused delete', async () => {
    mocked.deletePackageStore.mockRejectedValue(new ApiError('Package store 2 is the default store and cannot be deleted; make another store the default first', 409))
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/is the default store and cannot be deleted/)).toBeInTheDocument()
    expect(mocked.deletePackageStore).toHaveBeenCalledWith(2)
  })

  it('tests a store and reports the human-readable result', async () => {
    mocked.testPackageStore.mockResolvedValue({ success: true, message: 'Wrote and read back a probe file. Folder: /mnt/archive' })
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Test' }))

    expect(await screen.findByText(/Wrote and read back a probe file/)).toBeInTheDocument()
    expect(mocked.testPackageStore).toHaveBeenCalledWith(2)
  })

  it('adds a store with the generically rendered provider form', async () => {
    mocked.createPackageStore.mockResolvedValue(store({ id: 3, name: 'Scratch' }))
    render(<PackageStorageSettings />)
    await screen.findByText('Primary')

    fireEvent.click(screen.getByRole('button', { name: /Add store/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()
    expect(mocked.createPackageStore).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Scratch' } })
    fireEvent.change(within(dialog).getByLabelText('Root folder'), { target: { value: '/tmp/scratch' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocked.createPackageStore).toHaveBeenCalledWith({ kind: 'FileSystem', name: 'Scratch', properties: { Root: '/tmp/scratch' }, secrets: {} }))
  })

  it('shows backend validation messages next to the form and keeps it open', async () => {
    mocked.updatePackageStore.mockRejectedValue(new ApiError('A package store named "Archive" already exists', 409))
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Root folder')).toHaveValue('/mnt/archive')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText(/already exists/)).toBeInTheDocument()
    expect(mocked.updatePackageStore).toHaveBeenCalledWith({ id: 2, name: 'Archive', properties: { Root: '/mnt/archive' }, secrets: {} })
  })
})
