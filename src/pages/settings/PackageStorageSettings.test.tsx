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
    testPackageStoreSettings: vi.fn(),
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
    expect(primary.queryByText('Not on a persistent volume')).toBeNull()
    const warningRow = within(screen.getByTestId('store-warnings-1'))
    expect(warningRow.getByText('Not on a persistent volume')).toBeInTheDocument()
    expect(screen.getByTestId('store-warnings-1').querySelector('td')).toHaveAttribute('colspan', '5')
    expect(screen.queryByTestId('store-warnings-2')).toBeNull()

    const archive = within(rowOf('Archive'))
    expect(archive.queryByText('Default')).toBeNull()
    expect(archive.getByText('Failed')).toBeInTheDocument()
    expect(archive.getByText('Folder is not writable')).toBeInTheDocument()
  })

  it('keeps the table in its own scroll container so a long path cannot widen the page', async () => {
    const longPath = `/private/tmp/${'very-long-segment/'.repeat(12)}store`
    mocked.getPackageStores.mockResolvedValue([store({ id: 5, name: 'Long', properties: { Root: longPath } })])
    render(<PackageStorageSettings />)

    const location = await screen.findByText(longPath)

    expect(location).toHaveClass('break-all')
    expect(screen.getByTestId('package-stores-scroll')).toHaveClass('overflow-x-auto')
    expect(screen.getByTestId('package-stores-scroll')).toContainElement(location)
  })

  it('offers Set as default and Delete only through the menu, and not for the default store', async () => {
    render(<PackageStorageSettings />)
    await screen.findByText('Primary')

    const primary = within(rowOf('Primary'))
    expect(primary.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(primary.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(primary.getByRole('button', { name: 'Test' })).toBeInTheDocument()

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'More actions' }))
    expect(await screen.findByText('Set as default')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('sets a store as default through the API and refreshes the list', async () => {
    mocked.setDefaultPackageStore.mockResolvedValue({ ...ARCHIVE, isDefault: true })
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByText('Set as default'))

    await waitFor(() => expect(mocked.setDefaultPackageStore).toHaveBeenCalledWith(2))
    await waitFor(() => expect(mocked.getPackageStores).toHaveBeenCalledTimes(2))
  })

  it('shows the message of a refused delete', async () => {
    mocked.deletePackageStore.mockRejectedValue(new ApiError('Package store 2 is the default store and cannot be deleted; make another store the default first', 409))
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByText('Delete'))
    const confirm = await screen.findByRole('dialog')
    expect(within(confirm).getByText(/A store that still holds packages can't be deleted/)).toBeInTheDocument()
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

  it('tests the typed values of a new store without saving it', async () => {
    mocked.testPackageStoreSettings.mockResolvedValue({ success: true, message: 'Probe file written' })
    render(<PackageStorageSettings />)
    await screen.findByText('Primary')

    fireEvent.click(screen.getByRole('button', { name: /Add store/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Scratch' } })
    fireEvent.change(within(dialog).getByLabelText('Root folder'), { target: { value: '/tmp/scratch' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test' }))

    expect(await within(dialog).findByText('Probe file written')).toBeInTheDocument()
    expect(mocked.testPackageStoreSettings).toHaveBeenCalledWith({ kind: 'FileSystem', properties: { Root: '/tmp/scratch' }, secrets: {}, storeId: undefined })
    expect(mocked.createPackageStore).not.toHaveBeenCalled()
  })

  it('tests an edit with the store id and leaves untouched secrets out', async () => {
    const withSecret: api.PackageStoreProviderDescriptor = {
      ...FILE_SYSTEM,
      fields: [...FILE_SYSTEM.fields, { key: 'Token', label: 'Token', kind: 'Secret', required: true, options: [] }],
    }
    mocked.getPackageStoreProviders.mockResolvedValue([withSecret])
    mocked.getPackageStores.mockResolvedValue([store({ id: 2, name: 'Archive', properties: { Root: '/mnt/archive' }, secretHasValue: { Token: true } })])
    mocked.testPackageStoreSettings.mockResolvedValue({ success: true, message: 'ok' })
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test' }))

    await waitFor(() => expect(mocked.testPackageStoreSettings).toHaveBeenCalledWith({ kind: 'FileSystem', properties: { Root: '/mnt/archive' }, secrets: {}, storeId: 2 }))

    fireEvent.change(within(dialog).getByLabelText(/Token/), { target: { value: 'fresh' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test' }))

    await waitFor(() => expect(mocked.testPackageStoreSettings).toHaveBeenLastCalledWith({ kind: 'FileSystem', properties: { Root: '/mnt/archive' }, secrets: { Token: 'fresh' }, storeId: 2 }))
  })

  it('shows a failure message from the test in the dialog', async () => {
    mocked.testPackageStoreSettings.mockRejectedValue(new ApiError('The settings for package store kind "FileSystem" are invalid: "Root" is bad', 400))
    render(<PackageStorageSettings />)
    await screen.findByText('Archive')

    fireEvent.click(within(rowOf('Archive')).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test' }))

    expect(await within(dialog).findByText(/"Root" is bad/)).toBeInTheDocument()

    mocked.testPackageStoreSettings.mockResolvedValue({ success: false, message: 'Folder is not writable' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Test' }))

    expect(await within(dialog).findByText('Folder is not writable')).toBeInTheDocument()
  })
})
