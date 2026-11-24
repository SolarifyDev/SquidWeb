import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as setupApi from './api'
import SetupGate from './SetupGate'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, getSetupStatus: vi.fn() }
})

const api = vi.mocked(setupApi)

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SetupGate>
        <div>normal app</div>
      </SetupGate>
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('SetupGate', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows a spinner while the status call is in flight', () => {
    api.getSetupStatus.mockReturnValue(new Promise(() => {}))
    renderGate('/')

    expect(document.querySelector('.ant-spin')).not.toBeNull()
    expect(screen.queryByText('normal app')).toBeNull()
  })

  it('sends every path to the wizard when setup is required, keeping the token query', async () => {
    api.getSetupStatus.mockResolvedValue({ required: true, builtinDatabaseAvailable: true, builtinRedisAvailable: true, suggestedExternalUrl: '', defaultPollingPort: 10943 })
    renderGate('/Spaces-1/projects?token=abc')

    expect(await screen.findByText('Set up Squid')).toBeInTheDocument()
    // The wizard keeps the token in memory and strips it from the address bar.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/setup$/))
    expect(screen.queryByText('normal app')).toBeNull()
  })

  it.each([
    ['a 404 from an older server', { response: { status: 404 } }],
    ['a 500', { response: { status: 500 } }],
    ['a timeout', Object.assign(new Error('timeout of 3000ms exceeded'), { code: 'ECONNABORTED' })],
    ['a network error', new Error('Network Error')],
  ])('renders the normal app on %s, after one retry', async (_, error) => {
    api.getSetupStatus.mockRejectedValue(error)
    renderGate('/Spaces-1/projects')

    expect(await screen.findByText('normal app')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/Spaces-1/projects')
    expect(api.getSetupStatus).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['an HTML page', '<!DOCTYPE html><html><body>Squid</body></html>'],
    ['a { code, msg, data } envelope', { code: 200, msg: null, data: { required: true } }],
  ])('renders the normal app on a 200 with %s', async (_, body) => {
    api.getSetupStatus.mockResolvedValue(body as unknown as setupApi.SetupStatus)
    renderGate('/tasks')

    expect(await screen.findByText('normal app')).toBeInTheDocument()
    expect(api.getSetupStatus).toHaveBeenCalledTimes(1)
  })

  it('retries once and shows the wizard when the second attempt says setup is required', async () => {
    api.getSetupStatus.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({ required: true })
    renderGate('/')

    expect(await screen.findByText('Set up Squid')).toBeInTheDocument()
  })

  it('renders the normal app when setup is not required', async () => {
    api.getSetupStatus.mockResolvedValue({ required: false })
    renderGate('/tasks')

    expect(await screen.findByText('normal app')).toBeInTheDocument()
  })

  it('redirects /setup to sign in when setup is not required', async () => {
    api.getSetupStatus.mockResolvedValue({ required: false })
    renderGate('/setup?token=abc')

    expect(await screen.findByText('normal app')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/users/sign-in')
  })
})
