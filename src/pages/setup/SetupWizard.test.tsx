import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as setupApi from './api'
import type { SetupStatus } from './api'
import SetupWizard from './SetupWizard'
import type { PollTimings } from './SetupProgressView'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getSetupStatus: vi.fn(),
    testDatabase: vi.fn(),
    testRedis: vi.fn(),
    startInstall: vi.fn(),
    getSetupProgress: vi.fn(),
    getPackageStorageProviders: vi.fn(),
    testPackageStorage: vi.fn(),
  }
})

const api = vi.mocked(setupApi)

const FAST: PollTimings = { progressIntervalMs: 5, statusIntervalMs: 5, installTimeoutMs: 60000, startupTimeoutMs: 5000, redirectDelayMs: 20 }
const httpError = (status: number, data?: unknown) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })
const okDb = { success: true, serverVersion: '16.2', databaseExists: true, canCreateDatabase: true, message: '' }
const status = (overrides: Partial<SetupStatus> = {}): SetupStatus => ({ required: true, builtinDatabaseAvailable: true, builtinRedisAvailable: true, suggestedExternalUrl: '', defaultPollingPort: 10943, ...overrides })

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

const FILE_SYSTEM = {
  kind: 'FileSystem', displayName: 'Local disk', description: 'Keeps packages as files in a folder on the server.',
  fields: [{ key: 'Root', label: 'Root folder', kind: 'Path', required: false, placeholder: 'Leave empty to use the data directory', helpText: 'Leave empty to keep packages in the data directory.', options: [] }],
}

function renderWizard({ path = '/setup?token=abc', setupStatus = status(), onFinished = vi.fn(), providers = [FILE_SYSTEM] }: { path?: string; setupStatus?: SetupStatus; onFinished?: () => void; providers?: unknown[] | 'fail' } = {}) {
  if (providers === 'fail') api.getPackageStorageProviders.mockRejectedValue(new Error('Network Error'))
  else api.getPackageStorageProviders.mockResolvedValue(providers as never)
  render(
    <MemoryRouter initialEntries={[path]}>
      <SetupWizard status={setupStatus} onFinished={onFinished} timings={FAST} />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { onFinished }
}

const nextButton = () => screen.getByRole('button', { name: 'Next' })
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function advanceToReview() {
  click('Next')
  await screen.findByText('Administrator', { selector: '.ant-steps-item-process .ant-steps-item-title' })
  fireEvent.change(screen.getAllByLabelText('Password').at(-1)!, { target: { value: 'password1' } })
  type('Confirm password', 'password1')
  click('Next')
  await screen.findByText('Server URLs', { selector: '.ant-steps-item-process .ant-steps-item-title' })
  click('Next')
  await screen.findByText('Storage', { selector: '.ant-steps-item-process .ant-steps-item-title' })
  click('Next')
  await screen.findByRole('button', { name: 'Install' })
}

const stepTitle = (title: string) => screen.findByText(title, { selector: '.ant-steps-item-process .ant-steps-item-title' })

describe('SetupWizard', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['a warning', 'Data is in an anonymous volume', true],
    ['null', null, false],
    ['missing', undefined, false],
  ])('shows the data volume warning only when the status carries one (%s)', (_, dataVolumeWarning, shown) => {
    renderWizard({ setupStatus: status({ dataVolumeWarning }) })

    if (shown) expect(screen.getByTestId('data-volume-warning')).toHaveTextContent('Data is in an anonymous volume')
    else expect(screen.queryByTestId('data-volume-warning')).toBeNull()
  })

  it('disables External Next until the current connection string tests successfully, and again after an edit', async () => {
    api.testDatabase.mockResolvedValue(okDb)
    renderWizard({ setupStatus: status({ builtinDatabaseAvailable: false }) })

    expect(nextButton()).toBeDisabled()

    type('Connection string', 'Host=db;Database=squid')
    click('Test connection')

    expect(await screen.findByText(/Connection OK — PostgreSQL 16.2/)).toBeInTheDocument()
    expect(api.testDatabase).toHaveBeenCalledWith('abc', { mode: 'External', connectionString: 'Host=db;Database=squid' })
    await waitFor(() => expect(nextButton()).toBeEnabled())

    type('Connection string', 'Host=db2;Database=squid')

    await waitFor(() => expect(nextButton()).toBeDisabled())
    expect(screen.getByText(/changed since this test/)).toBeInTheDocument()
  })

  it('reports a missing database that will be created', async () => {
    api.testDatabase.mockResolvedValue({ ...okDb, databaseExists: false })
    renderWizard({ setupStatus: status({ builtinDatabaseAvailable: false }) })

    type('Connection string', 'Host=db')
    click('Test connection')

    expect(await screen.findByText(/does not exist — it will be created/)).toBeInTheDocument()
    await waitFor(() => expect(nextButton()).toBeEnabled())
  })

  it('composes the connection string from the helper fields', async () => {
    renderWizard({ setupStatus: status({ builtinDatabaseAvailable: false }) })

    fireEvent.click(screen.getByText('Fill by fields'))
    type('Host', 'db.internal')
    fireEvent.change(screen.getAllByLabelText('Username')[0], { target: { value: 'squid' } })
    fireEvent.change(screen.getAllByLabelText('Password')[0], { target: { value: 'p;w' } })
    click('Fill connection string')

    await waitFor(() => expect(screen.getByLabelText('Connection string')).toHaveValue('Host=db.internal;Port=5432;Database=squid;Username=squid;Password="p;w";SSL Mode=Prefer'))
  })

  it('maps install 400 errors back onto the field and step', async () => {
    api.startInstall.mockRejectedValue(httpError(400, { message: 'Validation failed', errors: { 'admin.password': 'Password is too common' } }))
    renderWizard()

    await advanceToReview()
    expect(screen.queryByText('password1')).toBeNull()
    click('Install')

    expect(await screen.findByText('Password is too common')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()
    expect(screen.getByText('Administrator', { selector: '.ant-steps-item-process .ant-steps-item-title' })).toBeInTheDocument()
    expect(api.startInstall).toHaveBeenCalledWith('abc', {
      database: { mode: 'Builtin', connectionString: '', createIfMissing: true },
      redis: { mode: 'Builtin', connectionString: '' },
      admin: { userName: 'admin', password: 'password1' },
      server: { externalUrl: window.location.origin, commsUrl: '' },
    })
  })

  it('polls progress to Completed, then status through the restart, then shows success and redirects', async () => {
    api.startInstall.mockResolvedValue()
    api.getSetupProgress
      .mockResolvedValueOnce({ state: 'Running', steps: [{ key: 'db', title: 'Create database', status: 'Running', message: null }], error: null })
      .mockResolvedValue({ state: 'Completed', steps: [{ key: 'db', title: 'Create database', status: 'Succeeded', message: null }], error: null })
    let serverUp: (status: SetupStatus) => void = () => {}
    api.getSetupStatus
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(httpError(502))
      .mockReturnValueOnce(new Promise((resolve) => { serverUp = resolve }))
    const { onFinished } = renderWizard()

    await advanceToReview()
    click('Install')

    expect(await screen.findByText('Starting Squid…')).toBeInTheDocument()
    expect(screen.getByText('Create database')).toBeInTheDocument()
    await waitFor(() => expect(api.getSetupStatus).toHaveBeenCalledTimes(3))

    await act(async () => serverUp({ required: false }))

    expect(await screen.findByText('Squid is ready')).toBeInTheDocument()
    expect(screen.getByText('admin', { selector: 'strong' })).toBeInTheDocument()
    await waitFor(() => expect(onFinished).toHaveBeenCalled())
  })

  it('switches to status polling when the progress endpoint disappears mid-install', async () => {
    api.startInstall.mockResolvedValue()
    api.getSetupProgress.mockRejectedValue(new Error('Network Error'))
    api.getSetupStatus.mockResolvedValue({ required: false })
    renderWizard()

    await advanceToReview()
    click('Install')

    expect(await screen.findByText('Squid is ready')).toBeInTheDocument()
  })

  it('goes straight to progress on 409 and offers Back to edit when the install fails', async () => {
    api.startInstall.mockRejectedValue(httpError(409))
    api.getSetupProgress.mockResolvedValue({ state: 'Failed', steps: [{ key: 'db', title: 'Create database', status: 'Failed', message: 'permission denied' }], error: 'Could not create the database' })
    renderWizard()

    await advanceToReview()
    click('Install')

    expect(await screen.findByText('Could not create the database')).toBeInTheDocument()
    click('Back to edit')
    expect(await screen.findByRole('button', { name: 'Test connection' })).toBeVisible()
  })

  it('asks for the token when it is missing from the URL', async () => {
    api.testDatabase.mockResolvedValue(okDb)
    renderWizard({ path: '/setup' })

    expect(screen.getByTestId('token-prompt')).toBeInTheDocument()
    type('Setup token', 'typed-token')
    click('Continue')

    click('Test connection')
    await waitFor(() => expect(api.testDatabase).toHaveBeenCalledWith('typed-token', { mode: 'Builtin', connectionString: '' }))
  })

  it('shows the token prompt again on 401 and retries with the re-entered token', async () => {
    api.testDatabase.mockRejectedValueOnce(httpError(401)).mockResolvedValue(okDb)
    renderWizard({ path: '/setup?token=wrong' })

    click('Test connection')

    expect(await screen.findByText(/setup token was rejected/)).toBeInTheDocument()
    type('Setup token', 'right')
    click('Continue')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Test connection/ })))

    await waitFor(() => expect(api.testDatabase).toHaveBeenLastCalledWith('right', { mode: 'Builtin', connectionString: '' }))
  })

  it('reads the token once and removes it from the URL, keeping other query params', async () => {
    api.testDatabase.mockResolvedValue(okDb)
    renderWizard({ path: '/setup?lang=en&token=abc' })

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/setup\?lang=en$/))
    click('Test connection')
    await waitFor(() => expect(api.testDatabase).toHaveBeenCalledWith('abc', { mode: 'Builtin', connectionString: '' }))
  })

  it('opens Advanced and explains why when built-in Redis is unavailable, and gates Next on a current Redis test', async () => {
    api.testRedis.mockResolvedValue({ success: true, message: '' })
    renderWizard({ setupStatus: status({ builtinRedisAvailable: false }) })

    expect(screen.getByTestId('redis-builtin-unavailable')).toBeVisible()
    expect(nextButton()).toBeDisabled()
    expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Redis')

    type('Redis connection string', 'redis:6379,password=x')
    click('Test Redis connection')

    await waitFor(() => expect(nextButton()).toBeEnabled())
    expect(api.testRedis).toHaveBeenCalledWith('abc', { connectionString: 'redis:6379,password=x' })

    type('Redis connection string', 'redis:6380,password=x')

    await waitFor(() => expect(nextButton()).toBeDisabled())
    expect(screen.getByTestId('redis-test-result')).toHaveTextContent('changed since this test')
  })

  it('lists a 400 error for a field that is not rendered (connection string while Built-in is selected)', async () => {
    api.startInstall.mockRejectedValue(httpError(400, { message: 'Validation failed', errors: { 'database.connectionString': 'Not allowed with Builtin' } }))
    renderWizard()

    await advanceToReview()
    click('Install')

    expect(await screen.findByText(/Database connection string: Not allowed with Builtin/)).toBeInTheDocument()
    expect(await stepTitle('Database')).toBeInTheDocument()
  })

  it('keeps every value when going Back from Review', async () => {
    api.testDatabase.mockResolvedValue(okDb)
    renderWizard({ setupStatus: status({ builtinDatabaseAvailable: false }) })

    type('Connection string', 'Host=db;Password=secret')
    click('Test connection')
    await waitFor(() => expect(nextButton()).toBeEnabled())
    click('Next')
    await stepTitle('Administrator')
    fireEvent.change(screen.getAllByLabelText('Username').at(-1)!, { target: { value: 'root' } })
    fireEvent.change(screen.getAllByLabelText('Password').at(-1)!, { target: { value: 'password1' } })
    type('Confirm password', 'password1')
    click('Next')
    await stepTitle('Server URLs')
    type('Polling URL (optional)', 'https://squid:10943')
    click('Next')
    await stepTitle('Storage')
    click('Next')
    await screen.findByRole('button', { name: 'Install' })

    expect(screen.getByText('Host=db;Password=******')).toBeInTheDocument()

    click('Back')
    await stepTitle('Storage')
    click('Back')
    await stepTitle('Server URLs')
    expect(screen.getByLabelText('Polling URL (optional)')).toHaveValue('https://squid:10943')
    click('Back')
    await stepTitle('Administrator')
    expect(screen.getAllByLabelText('Username').at(-1)).toHaveValue('root')
    expect(screen.getAllByLabelText('Password').at(-1)).toHaveValue('password1')
    click('Back')
    await stepTitle('Database')
    expect(screen.getByLabelText('Connection string')).toHaveValue('Host=db;Password=secret')
    expect(nextButton()).toBeEnabled()
  })

  describe('package storage step', () => {
    const REMOTE = {
      kind: 'Remote', displayName: 'Remote store', description: 'Keeps packages in a remote service.',
      fields: [
        { key: 'Endpoint', label: 'Endpoint', kind: 'Text', required: true, options: [] },
        { key: 'Token', label: 'Access token', kind: 'Secret', required: true, options: [] },
      ],
    }

    const gotoStorage = async () => {
      click('Next')
      await stepTitle('Administrator')
      fireEvent.change(screen.getAllByLabelText('Password').at(-1)!, { target: { value: 'password1' } })
      type('Confirm password', 'password1')
      click('Next')
      await stepTitle('Server URLs')
      click('Next')
      await stepTitle('Storage')
    }

    it('renders one radio card per provider descriptor, with the local disk selected by default', async () => {
      renderWizard({ providers: [FILE_SYSTEM, REMOTE] })

      await gotoStorage()

      expect(screen.getByRole('radio', { name: /Local disk/ })).toBeChecked()
      expect(screen.getByRole('radio', { name: /Remote store/ })).not.toBeChecked()
      expect(screen.getByLabelText('Root folder')).toHaveValue('')
      expect(screen.getByText(/Leave empty to keep packages in the data directory/)).toBeInTheDocument()
    })

    it('sends no packageStorage section while the default is kept', async () => {
      api.startInstall.mockResolvedValue()
      api.getSetupProgress.mockResolvedValue({ state: 'Running', steps: [], error: null })
      renderWizard()

      await advanceToReview()
      click('Install')

      await waitFor(() => expect(api.startInstall).toHaveBeenCalled())
      expect(api.startInstall.mock.calls[0][1]).not.toHaveProperty('packageStorage')
    })

    it('sends the section when the folder is changed, and lists it on the review step', async () => {
      api.startInstall.mockResolvedValue()
      api.getSetupProgress.mockResolvedValue({ state: 'Running', steps: [], error: null })
      renderWizard()

      await gotoStorage()
      type('Root folder', '/mnt/packages')
      click('Next')
      await screen.findByRole('button', { name: 'Install' })

      expect(screen.getByText('Root folder: /mnt/packages')).toBeInTheDocument()
      click('Install')

      await waitFor(() => expect(api.startInstall).toHaveBeenCalled())
      expect(api.startInstall.mock.calls[0][1].packageStorage).toEqual({ kind: 'FileSystem', properties: { Root: '/mnt/packages' }, secrets: {} })
    })

    it('blocks Next until the required fields of the chosen provider are filled, and never shows a secret on review', async () => {
      renderWizard({ providers: [FILE_SYSTEM, REMOTE] })

      await gotoStorage()
      fireEvent.click(screen.getByRole('radio', { name: /Remote store/ }))
      click('Next')

      expect(await screen.findByText('Endpoint is required')).toBeInTheDocument()
      expect(screen.getByText('Access token is required')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull()

      type(/^Endpoint/, 'https://store.example')
      type(/^Access token/, 'top-secret-value')
      click('Next')
      await screen.findByRole('button', { name: 'Install' })

      expect(screen.getByTestId('review-package-storage')).toHaveTextContent('Remote store')
      expect(screen.getByText('Endpoint: https://store.example')).toBeInTheDocument()
      expect(screen.getByText('Access token: set')).toBeInTheDocument()
      expect(screen.queryByText(/top-secret-value/)).toBeNull()
    })

    it('tests the settings through the setup endpoint and shows the outcome, marking it stale after an edit', async () => {
      api.testPackageStorage.mockResolvedValueOnce({ success: true, message: 'Folder: /mnt/packages' }).mockResolvedValueOnce({ success: false, message: 'Permission denied' })
      renderWizard()

      await gotoStorage()
      type('Root folder', '/mnt/packages')
      fireEvent.click(screen.getAllByRole('button', { name: /Test connection/ }).at(-1)!)

      expect(await screen.findByText(/Storage OK: Folder: \/mnt\/packages/)).toBeInTheDocument()
      expect(api.testPackageStorage).toHaveBeenCalledWith('abc', { kind: 'FileSystem', properties: { Root: '/mnt/packages' }, secrets: {} })

      type('Root folder', '/mnt/other')
      expect(screen.getByText(/settings changed since this test/)).toBeInTheDocument()

      fireEvent.click(screen.getAllByRole('button', { name: /Test connection/ }).at(-1)!)
      expect(await screen.findByText(/Storage check failed: Permission denied/)).toBeInTheDocument()
    })

    it('shows the warnings that come with a test result', async () => {
      api.testPackageStorage.mockResolvedValue({ success: true, message: 'Folder does not exist yet; it will be created.', warnings: ['/data is not on a persistent volume'] })
      renderWizard()

      await gotoStorage()
      fireEvent.click(screen.getAllByRole('button', { name: /Test connection/ }).at(-1)!)

      expect(await screen.findByText('/data is not on a persistent volume')).toBeInTheDocument()
      expect(screen.getByText(/does not exist yet/)).toBeInTheDocument()
    })

    it('keeps the storage choice when going Back past the step and forward again, and installs with it', async () => {
      api.startInstall.mockResolvedValue()
      api.getSetupProgress.mockResolvedValue({ state: 'Running', steps: [], error: null })
      renderWizard()

      await gotoStorage()
      type('Root folder', '/mnt/packages')
      click('Next')
      await screen.findByRole('button', { name: 'Install' })

      click('Back')
      await stepTitle('Storage')
      click('Back')
      await stepTitle('Server URLs')
      click('Next')
      await stepTitle('Storage')

      expect(screen.getByLabelText('Root folder')).toHaveValue('/mnt/packages')

      click('Next')
      await screen.findByRole('button', { name: 'Install' })
      click('Install')

      await waitFor(() => expect(api.startInstall).toHaveBeenCalled())
      expect(api.startInstall.mock.calls[0][1].packageStorage).toEqual({ kind: 'FileSystem', properties: { Root: '/mnt/packages' }, secrets: {} })
    })

    it('returns to editing after the install fails at the storage step, with the choice kept', async () => {
      api.startInstall.mockResolvedValue()
      api.getSetupProgress.mockResolvedValue({
        state: 'Failed',
        steps: [{ key: 'packageStorage', title: 'Configure package storage', status: 'Failed', message: 'Another package store is already named "Local disk"' }],
        error: 'Another package store is already named "Local disk"',
      })
      renderWizard()

      await gotoStorage()
      type('Root folder', '/mnt/packages')
      click('Next')
      await screen.findByRole('button', { name: 'Install' })
      click('Install')

      expect(await screen.findByText('Configure package storage')).toBeInTheDocument()
      click('Back to edit')
      await stepTitle('Database')
      for (const step of ['Administrator', 'Server URLs', 'Storage']) {
        fireEvent.click(await screen.findByText('Next'))
        await stepTitle(step)
      }

      expect(screen.getByLabelText('Root folder')).toHaveValue('/mnt/packages')
    })

    it('goes back to the step and shows the reason when the server rejects the storage section', async () => {
      api.startInstall.mockRejectedValue(httpError(400, { message: 'Validation failed', errors: { 'packageStorage.kind': 'No package store provider is registered for kind "x"' } }))
      renderWizard()

      await advanceToReview()
      click('Install')

      expect(await screen.findByText(/packageStorage\.kind: No package store provider/)).toBeInTheDocument()
      expect(await stepTitle('Storage')).toBeInTheDocument()
    })

    it('keeps the default usable when the provider list cannot be loaded', async () => {
      renderWizard({ providers: 'fail' })

      await gotoStorage()
      expect(await screen.findByText('Could not load the storage options.')).toBeInTheDocument()

      click('Next')
      expect(await screen.findByRole('button', { name: 'Install' })).toBeInTheDocument()
    })
  })

  it('brings back the token prompt on a 401 during progress polling and resumes with the new token', async () => {
    api.startInstall.mockResolvedValue()
    api.getSetupProgress.mockRejectedValueOnce(httpError(401)).mockResolvedValue({ state: 'Running', steps: [{ key: 'db', title: 'Create database', status: 'Running', message: null }], error: null })
    renderWizard()

    await advanceToReview()
    click('Install')

    expect(await screen.findByText(/setup token was rejected/)).toBeInTheDocument()
    type('Setup token', 'fresh')
    click('Continue')

    await waitFor(() => expect(api.getSetupProgress).toHaveBeenLastCalledWith('fresh'))
    expect(await screen.findByText('Create database')).toBeInTheDocument()
  })
})
