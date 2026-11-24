import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as setupApi from './api'
import type { SetupProgress } from './api'
import SetupProgressView, { formatDuration, type PollTimings } from './SetupProgressView'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, getSetupStatus: vi.fn(), getSetupProgress: vi.fn() }
})

const api = vi.mocked(setupApi)

const FAST: PollTimings = { progressIntervalMs: 5, statusIntervalMs: 5, installTimeoutMs: 60000, startupTimeoutMs: 60000, redirectDelayMs: 20 }
const httpError = (status: number) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } })
const networkError = () => new Error('Network Error')
const progress = (state: SetupProgress['state']): SetupProgress => ({ state, steps: [{ key: 'db', title: 'Create database', status: state === 'Completed' ? 'Succeeded' : 'Running', message: null }], error: null })

function renderView(timings: Partial<PollTimings> = {}, token = 'tok') {
  const props = { adminUserName: 'admin', timings: { ...FAST, ...timings }, onBackToEdit: vi.fn(), onFinished: vi.fn(), onUnauthorized: vi.fn() }
  const view = render(<SetupProgressView token={token} {...props} />)
  return { ...props, ...view, rerenderWithToken: (next: string) => view.rerender(<SetupProgressView token={next} {...props} />) }
}

describe('SetupProgressView', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('goes back to following progress when the status still says required:true', async () => {
    api.getSetupProgress
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(httpError(502))
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue(progress('Running'))
    api.getSetupStatus.mockResolvedValue({ required: true })
    renderView()

    await waitFor(() => expect(api.getSetupStatus).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.getSetupProgress.mock.calls.length).toBeGreaterThanOrEqual(5))
    expect(screen.getByText('Installing Squid…')).toBeInTheDocument()
    expect(api.getSetupStatus).toHaveBeenCalledTimes(1)
  })

  it('does not leave installing on non-transient answers other than 404', async () => {
    api.getSetupProgress.mockRejectedValue(httpError(400))
    renderView()

    await waitFor(() => expect(api.getSetupProgress.mock.calls.length).toBeGreaterThanOrEqual(5))
    expect(api.getSetupStatus).not.toHaveBeenCalled()
    expect(screen.getByText('Installing Squid…')).toBeInTheDocument()
  })

  it('stops polling on 401, asks for the token, and resumes with the new one', async () => {
    api.getSetupProgress.mockRejectedValueOnce(httpError(401)).mockResolvedValue(progress('Running'))
    const view = renderView()

    await waitFor(() => expect(view.onUnauthorized).toHaveBeenCalledTimes(1))
    view.rerenderWithToken('')
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(api.getSetupProgress).toHaveBeenCalledTimes(1)
    expect(api.getSetupStatus).not.toHaveBeenCalled()

    view.rerenderWithToken('new-token')

    await waitFor(() => expect(api.getSetupProgress).toHaveBeenLastCalledWith('new-token'))
  })

  it('times out the startup without claiming the install finished when Completed was never seen', async () => {
    api.getSetupProgress.mockRejectedValue(httpError(404))
    api.getSetupStatus.mockRejectedValue(networkError())
    renderView({ startupTimeoutMs: 1000 })

    expect(await screen.findByText(/Squid did not respond within 1 second/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText(/installation finished/i)).toBeNull()
    expect(screen.getByText('docker logs <container>')).toBeInTheDocument()
  })

  it('says the install finished only after Completed was observed', async () => {
    api.getSetupProgress.mockResolvedValue(progress('Completed'))
    api.getSetupStatus.mockRejectedValue(httpError(502))
    renderView({ startupTimeoutMs: 1000 })

    expect(await screen.findByText(/The installation finished, but Squid did not respond within 1 second/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('gives up on an install that never finishes', async () => {
    api.getSetupProgress.mockResolvedValue(progress('Running'))
    renderView({ installTimeoutMs: 1000 })

    expect(await screen.findByText(/The installation did not finish within 1 second/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it.each([
    ['installing', () => api.getSetupProgress.mockResolvedValue(progress('Running')), () => api.getSetupProgress],
    ['starting', () => {
      api.getSetupProgress.mockResolvedValue(progress('Completed'))
      api.getSetupStatus.mockRejectedValue(networkError())
    }, () => api.getSetupStatus],
  ])('stops polling after unmount (%s)', async (_, arrange, polled) => {
    vi.useFakeTimers()
    arrange()
    const view = renderView({ progressIntervalMs: 1000, statusIntervalMs: 1000 })

    // Two rounds: React commits the phase change (and schedules the next poll) when act ends.
    await act(() => vi.advanceTimersByTimeAsync(1500))
    await act(() => vi.advanceTimersByTimeAsync(3500))
    const calls = polled().mock.calls.length
    expect(calls).toBeGreaterThan(0)

    view.unmount()
    await vi.advanceTimersByTimeAsync(10000)

    expect(polled().mock.calls.length).toBe(calls)
  })
})

describe('formatDuration', () => {
  it.each([
    [3 * 60 * 1000, '3 minutes'],
    [60 * 1000, '1 minute'],
    [15 * 60 * 1000, '15 minutes'],
    [1000, '1 second'],
    [90 * 1000, '90 seconds'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})
