import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl, resolveAuthBaseUrl, resolveBaseUrl } from './apiBase'

describe('resolveBaseUrl', () => {
  const sameOrigin = `${window.location.origin}/api`

  // `undefined` is what the built app reads when the import-meta-env placeholder is never substituted.
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['missing (placeholder never substituted)', undefined],
    ['not a string', null],
  ])('falls back to the same origin when the value is %s', (_, raw) => {
    expect(resolveBaseUrl(raw)).toBe(sameOrigin)
  })

  it('keeps a configured value unchanged (trimmed)', () => {
    expect(resolveBaseUrl(' https://squid.example.com/api ')).toBe('https://squid.example.com/api')
  })

  it('falls back to /api for the API but to the server root for auth (routes are /auth/*)', () => {
    expect(resolveApiBaseUrl('')).toBe(sameOrigin)
    expect(resolveAuthBaseUrl('')).toBe(window.location.origin)
    expect(resolveApiBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/api')
    expect(resolveAuthBaseUrl('https://auth.example.com/api')).toBe('https://auth.example.com/api')
  })
})
