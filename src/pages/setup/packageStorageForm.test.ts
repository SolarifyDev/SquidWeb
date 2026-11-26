import { describe, expect, it } from 'vitest'
import type { PackageStoreProviderDescriptor } from 'pages/apis/packageStore'
import { buildPackageStorageSection, DEFAULT_PACKAGE_STORAGE, isDefaultPackageStorage, summarizePackageStorage } from './packageStorageForm'
import { buildInstallRequest, isPackageStorageError, type SetupFormValues } from './setupForm'

const providers: PackageStoreProviderDescriptor[] = [
  { kind: 'FileSystem', displayName: 'Local disk', fields: [{ key: 'Root', label: 'Root folder', kind: 'Path', required: false, options: [] }] },
  { kind: 'Remote', displayName: 'Remote store', fields: [{ key: 'Endpoint', label: 'Endpoint', kind: 'Text', required: true, options: [] }, { key: 'Token', label: 'Access token', kind: 'Secret', required: true, options: [] }] },
]

const select = (kind: string, properties: Record<string, string> = {}, secrets: Record<string, string> = {}) => ({ kind, value: { properties, secrets } })

describe('buildPackageStorageSection', () => {
  it.each([
    ['the untouched default', DEFAULT_PACKAGE_STORAGE],
    ['an empty root', select('FileSystem', { Root: '' })],
    ['a blank root', select('FileSystem', { Root: '   ' })],
  ])('leaves the section out for %s', (_, selection) => {
    expect(buildPackageStorageSection(providers, selection)).toBeUndefined()
  })

  it('sends the kind and entered values when the local disk folder is set', () => {
    expect(buildPackageStorageSection(providers, select('FileSystem', { Root: '/mnt/p' }))).toEqual({ kind: 'FileSystem', properties: { Root: '/mnt/p' }, secrets: {} })
  })

  it('sends another provider even when nothing is filled in', () => {
    expect(buildPackageStorageSection(providers, select('Remote'))).toEqual({ kind: 'Remote', properties: {}, secrets: {} })
  })

  it('keeps secrets in the secrets map only', () => {
    expect(buildPackageStorageSection(providers, select('Remote', { Endpoint: 'e' }, { Token: 't' }))).toEqual({ kind: 'Remote', properties: { Endpoint: 'e' }, secrets: { Token: 't' } })
  })

  it('treats the local disk as default only when nothing is entered', () => {
    expect(isDefaultPackageStorage({ kind: 'FileSystem', properties: {}, secrets: {} })).toBe(true)
    expect(isDefaultPackageStorage({ kind: 'FileSystem', properties: { Root: '/x' }, secrets: {} })).toBe(false)
  })
})

describe('summarizePackageStorage', () => {
  it('says the default is kept', () => {
    expect(summarizePackageStorage(providers, DEFAULT_PACKAGE_STORAGE)).toEqual({ title: 'Local disk', details: ['Default settings (the data directory of this server)'] })
  })

  it('shows labelled values but only that a secret is set', () => {
    const summary = summarizePackageStorage(providers, select('Remote', { Endpoint: 'e' }, { Token: 'super-secret' }))

    expect(summary.details).toEqual(['Endpoint: e', 'Access token: set'])
    expect(JSON.stringify(summary)).not.toContain('super-secret')
  })
})

describe('install request', () => {
  const values: SetupFormValues = { dbMode: 'Builtin', dbCreateIfMissing: true, redisMode: 'Builtin', adminUserName: 'admin', adminPassword: 'password1', adminConfirmPassword: 'password1', externalUrl: 'http://squid', commsUrl: '' }

  it('has no packageStorage key without a section, so existing request shapes are unchanged', () => {
    expect(buildInstallRequest(values)).not.toHaveProperty('packageStorage')
  })

  it('carries the section when given', () => {
    expect(buildInstallRequest(values, { kind: 'FileSystem', properties: { Root: '/x' }, secrets: {} }).packageStorage).toEqual({ kind: 'FileSystem', properties: { Root: '/x' }, secrets: {} })
  })

  it.each([['packageStorage', true], ['PackageStorage.Kind', true], ['admin.password', false]])('routes server error key %s to the storage step: %s', (key, expected) => {
    expect(isPackageStorageError(key)).toBe(expected)
  })
})
