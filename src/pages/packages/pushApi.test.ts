import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()

vi.mock('utils/request', () => ({ get: vi.fn(), post: (...args: unknown[]) => post(...args) }))

import { pushBuiltInPackage } from 'pages/apis/builtInPackages'

describe('pushBuiltInPackage', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}))

  it('sendsTheFileAsTheRawBody_WithoutVersionParamAndWithBodyInjectionOff', async () => {
    const blob = new Blob(['abc'])

    await pushBuiltInPackage(blob, { spaceId: 3, fileName: 'a.zip', version: '' })

    const [url, body, config] = post.mock.calls[0]

    expect(url).toBe('/builtin-feed/packages/push')
    expect(body).toBe(blob)
    expect(config.params).toEqual({ spaceId: 3, fileName: 'a.zip', source: 'Upload' })
    expect(config.skipSpaceIdInjection).toBe(true)
    expect(config.timeout).toBe(0)
    expect(config.silentLoading).toBe(true)
    expect(config.headers['Content-Type']).toBe('application/octet-stream')
  })

  it('passesTheAbortSignalToTheRequest', async () => {
    const controller = new AbortController()

    await pushBuiltInPackage(new Blob(['a']), { spaceId: 3, fileName: 'a.zip', signal: controller.signal })

    expect(post.mock.calls[0][2].signal).toBe(controller.signal)
  })

  it('forwardsUploadProgress', async () => {
    const seen: Array<[number, number]> = []

    await pushBuiltInPackage(new Blob(['abcd']), { spaceId: 3, fileName: 'a.zip', onProgress: (sent, total) => seen.push([sent, total]) })
    post.mock.calls[0][2].onUploadProgress({ loaded: 2, total: 4 })

    expect(seen).toEqual([[2, 4]])
  })
})
