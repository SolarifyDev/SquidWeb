import { describe, expect, it } from 'vitest'
import { composeNpgsqlConnectionString, maskConnectionString, parseNpgsqlConnectionString } from './connectionString'
import { buildInstallRequest, canLeaveDatabaseStep, canLeaveRedisSettings, isFieldRendered, mapServerErrors, type DatabaseTestSnapshot, type SetupFormValues } from './setupForm'

const okResult = { success: true, serverVersion: '16.2', databaseExists: true, canCreateDatabase: true, message: '' }

describe('composeNpgsqlConnectionString', () => {
  it('composes every field in Npgsql syntax', () => {
    expect(composeNpgsqlConnectionString({ host: 'db', port: 5432, database: 'squid', username: 'u', password: 'p', sslMode: 'Require' }))
      .toBe('Host=db;Port=5432;Database=squid;Username=u;Password=p;SSL Mode=Require')
  })

  it('omits empty fields and quotes values holding separators or quotes', () => {
    expect(composeNpgsqlConnectionString({ host: ' db ', database: '', username: 'u', password: 'a;b"c' }))
      .toBe('Host=db;Username=u;Password="a;b""c"')
  })
})

describe('composeNpgsqlConnectionString round-trip', () => {
  it.each([
    ['separator', 'a;b'],
    ['double quote', 'a"b'],
    ['single quote', "a'b"],
    ['equals', 'a=b'],
    ['leading spaces', '  secret'],
    ['everything', ` ;"'= x`],
  ])('keeps a password with a %s intact', (_, password) => {
    const parsed = parseNpgsqlConnectionString(composeNpgsqlConnectionString({ host: 'db', username: 'u', password, sslMode: 'Disable' }))

    expect(parsed).toEqual({ Host: 'db', Username: 'u', Password: password, 'SSL Mode': 'Disable' })
  })
})

describe('maskConnectionString', () => {
  it.each([
    ['Npgsql password', 'Host=db;Username=u;Password=secret;SSL Mode=Prefer', 'Host=db;Username=u;Password=******;SSL Mode=Prefer'],
    ['Npgsql value containing a comma', 'Host=db;Password=abc,def;Port=1', 'Host=db;Password=******;Port=1'],
    ['Npgsql quoted value containing ;', 'Host=db;Password="a;b""c";Port=1', 'Host=db;Password=******;Port=1'],
    ['Npgsql single-quoted value', "Host=db;Password='a;b';Port=1", 'Host=db;Password=******;Port=1'],
    ['pwd alias', 'Host=db;PWD=secret', 'Host=db;PWD=******'],
    ['psw alias, spaced', 'Host=db; psw = secret ;Port=1', 'Host=db; psw =******;Port=1'],
    ['Npgsql password last', 'Host=db;password=secret', 'Host=db;password=******'],
    ['no password', 'Host=db;Port=5432', 'Host=db;Port=5432'],
  ])('masks postgres: %s', (_, input, expected) => {
    expect(maskConnectionString(input, 'postgres')).toBe(expected)
  })

  it.each([
    ['StackExchange password', 'redis:6379,password=secret,ssl=true', 'redis:6379,password=******,ssl=true'],
    ['password with ; and =', 'redis:6379,Password=a;b=c,ssl=true', 'redis:6379,Password=******,ssl=true'],
    ['password last', 'redis:6379,ssl=true,password=secret', 'redis:6379,ssl=true,password=******'],
    ['URL without user', 'redis://:secret@cache:6379', 'redis://:******@cache:6379'],
    ['URL with user', 'redis://default:secret@cache:6379', 'redis://default:******@cache:6379'],
    ['no password', 'redis:6379,ssl=true', 'redis:6379,ssl=true'],
  ])('masks redis: %s', (_, input, expected) => {
    expect(maskConnectionString(input, 'redis')).toBe(expected)
  })

  it('masks URL-style postgres credentials', () => {
    expect(maskConnectionString('postgres://u:secret@db:5432/squid', 'postgres')).toBe('postgres://u:******@db:5432/squid')
  })
})

describe('mapServerErrors', () => {
  it('maps known keys case-insensitively to fields and steps, keeping unknown keys', () => {
    const mapped = mapServerErrors({ 'admin.password': 'Too weak', 'Server.ExternalUrl': 'Bad URL', other: 'Oops' })

    expect(mapped.fieldErrors).toEqual([
      { field: 'adminPassword', message: 'Too weak', step: 1 },
      { field: 'externalUrl', message: 'Bad URL', step: 2 },
    ])
    expect(mapped.unmatched).toEqual(['other: Oops'])
  })
})

describe('canLeaveDatabaseStep', () => {
  const tested = (connectionString: string, result = okResult): DatabaseTestSnapshot => ({ mode: 'External', connectionString, result })

  it.each([
    ['builtin needs no test', 'Builtin', '', true, null, true],
    ['external without a test', 'External', 'Host=db', true, null, false],
    ['external tested ok', 'External', ' Host=db ', true, tested('Host=db'), true],
    ['external edited after the test', 'External', 'Host=db2', true, tested('Host=db'), false],
    ['external test failed', 'External', 'Host=db', true, tested('Host=db', { ...okResult, success: false }), false],
    ['missing database, will be created', 'External', 'Host=db', true, tested('Host=db', { ...okResult, databaseExists: false }), true],
    ['missing database, creation unchecked', 'External', 'Host=db', false, tested('Host=db', { ...okResult, databaseExists: false }), false],
    ['missing database, cannot create', 'External', 'Host=db', true, tested('Host=db', { ...okResult, databaseExists: false, canCreateDatabase: false }), false],
  ] as const)('%s', (_, mode, connectionString, createIfMissing, test, expected) => {
    expect(canLeaveDatabaseStep(mode, connectionString, createIfMissing, test)).toBe(expected)
  })
})

describe('buildInstallRequest', () => {
  it('sends connection strings only for external modes', () => {
    const values: SetupFormValues = {
      dbMode: 'Builtin', dbConnectionString: 'Host=stale', dbCreateIfMissing: true,
      redisMode: 'External', redisConnectionString: ' redis:6379 ',
      adminUserName: ' admin ', adminPassword: 'password1', adminConfirmPassword: 'password1',
      externalUrl: ' http://squid:8080 ', commsUrl: undefined,
    }

    expect(buildInstallRequest(values)).toEqual({
      database: { mode: 'Builtin', connectionString: '', createIfMissing: true },
      redis: { mode: 'External', connectionString: 'redis:6379' },
      admin: { userName: 'admin', password: 'password1' },
      server: { externalUrl: 'http://squid:8080', commsUrl: '' },
    })
  })
})

describe('canLeaveRedisSettings', () => {
  const ok = { success: true, message: '' }

  it.each([
    ['builtin needs no test', 'Builtin', '', null, true],
    ['external without a test', 'External', 'redis:6379', null, false],
    ['external tested ok', 'External', ' redis:6379 ', { connectionString: 'redis:6379', result: ok }, true],
    ['external edited after the test', 'External', 'redis:6380', { connectionString: 'redis:6379', result: ok }, false],
    ['external test failed', 'External', 'redis:6379', { connectionString: 'redis:6379', result: { success: false, message: 'refused' } }, false],
  ] as const)('%s', (_, mode, connectionString, test, expected) => {
    expect(canLeaveRedisSettings(mode, connectionString, test)).toBe(expected)
  })
})

describe('isFieldRendered', () => {
  it('renders connection strings only in External mode', () => {
    expect(isFieldRendered('dbConnectionString', { dbMode: 'Builtin', redisMode: 'Builtin' })).toBe(false)
    expect(isFieldRendered('dbConnectionString', { dbMode: 'External', redisMode: 'Builtin' })).toBe(true)
    expect(isFieldRendered('redisConnectionString', { dbMode: 'External', redisMode: 'Builtin' })).toBe(false)
    expect(isFieldRendered('adminPassword', { dbMode: 'Builtin', redisMode: 'Builtin' })).toBe(true)
  })
})
