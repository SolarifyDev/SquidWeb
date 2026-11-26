import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { axiosInstance } from './request'

async function bodyOf(url: string) {
  let sent: unknown
  await axiosInstance.post(url, { id: 1 }, {
    adapter: async (config) => {
      sent = config.data
      return { data: { code: 0, data: null }, status: 200, statusText: 'OK', headers: {}, config }
    },
  })
  return typeof sent === 'string' ? JSON.parse(sent) : sent
}

describe('space id injection', () => {
  beforeEach(() => {
    window.location.hash = '#/Spaces-1/settings'
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it('adds the current space id to a space-scoped request', async () => {
    expect(await bodyOf('/machines/create')).toEqual({ id: 1, spaceId: 1 })
  })

  it.each(['/package-stores/create', '/package-stores/test-settings', '/api/package-stores/list'])('does not add it to the server-wide %s', async (url) => {
    expect(await bodyOf(url)).toEqual({ id: 1 })
  })

  it('treats a different path that merely starts with package-stores as space-scoped', async () => {
    expect(await bodyOf('/package-stores-archive/create')).toEqual({ id: 1, spaceId: 1 })
  })
})
