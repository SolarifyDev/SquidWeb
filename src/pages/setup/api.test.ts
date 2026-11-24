import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSetupProgress, getSetupStatus, LONG_REQUEST_TIMEOUT_MS, SETUP_TOKEN_HEADER, startInstall, STATUS_TIMEOUT_MS, testDatabase, testRedis, type InstallRequest } from './api'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

// Stands in for the VITE_API_BASE_URL value the app was built or deployed with.
const configured = vi.hoisted(() => ({ apiBaseUrl: '' }))

vi.mock('utils/apiBase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/apiBase')>()
  return { ...actual, resolveApiBaseUrl: () => actual.resolveBaseUrl(configured.apiBaseUrl) }
})

const http = vi.mocked(axios, true)
const installRequest: InstallRequest = {
  database: { mode: 'Builtin', connectionString: '', createIfMissing: true },
  redis: { mode: 'Builtin', connectionString: '' },
  admin: { userName: 'admin', password: 'password1' },
  server: { externalUrl: 'http://squid:8080', commsUrl: '' },
}

describe('setup api', () => {
  beforeEach(() => {
    http.get.mockResolvedValue({ data: {} })
    http.post.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.resetAllMocks()
    configured.apiBaseUrl = ''
  })

  it.each([
    ['same origin when unset', '', `${window.location.origin}/api/setup/status`],
    ['the configured base URL', 'https://squid.example.com/api', 'https://squid.example.com/api/setup/status'],
  ])('calls status on %s, without a token and with a short timeout', async (_, base, url) => {
    configured.apiBaseUrl = base

    await getSetupStatus()

    expect(http.get).toHaveBeenCalledWith(url, { timeout: STATUS_TIMEOUT_MS })
  })

  it('sends the setup token on every guarded call, to the right URL', async () => {
    configured.apiBaseUrl = 'https://squid.example.com/api'
    const headers = { [SETUP_TOKEN_HEADER]: 'tok' }

    await testDatabase('tok', { mode: 'External', connectionString: 'Host=db' })
    await testRedis('tok', { connectionString: 'redis:6379' })
    await startInstall('tok', installRequest)
    await getSetupProgress('tok')

    expect(http.post).toHaveBeenNthCalledWith(1, 'https://squid.example.com/api/setup/database/test', { mode: 'External', connectionString: 'Host=db' }, { headers, timeout: LONG_REQUEST_TIMEOUT_MS })
    expect(http.post).toHaveBeenNthCalledWith(2, 'https://squid.example.com/api/setup/redis/test', { connectionString: 'redis:6379' }, { headers, timeout: LONG_REQUEST_TIMEOUT_MS })
    expect(http.post).toHaveBeenNthCalledWith(3, 'https://squid.example.com/api/setup/install', installRequest, { headers, timeout: LONG_REQUEST_TIMEOUT_MS })
    expect(http.get).toHaveBeenCalledWith('https://squid.example.com/api/setup/progress', { headers, timeout: expect.any(Number) })
  })
})
