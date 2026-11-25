import { describe, expect, it } from 'vitest'
import { buildPushParams } from 'pages/apis/builtInPackages'
import { ApiError } from 'utils/request'
import { apiErrorMessage, describePushFailure, describePushResult, formatBytes, suggestPackageId } from './packageUi'

const pkg = { id: 1, feedId: 1, packageId: 'Acme.Web', version: '1.0.7', fileExtension: '.zip', sizeBytes: 1, sha256: 'ab', publishedDate: '', publishedBy: 1, source: 'upload' }

describe('push params', () => {
  it('emptyVersionAndId_AreNotSent', () => {
    const params = buildPushParams({ spaceId: 3, fileName: 'a.zip', packageId: '  ', version: '' })

    expect(params).toEqual({ spaceId: 3, fileName: 'a.zip', source: 'Upload' })
    expect('version' in params).toBe(false)
  })

  it('givenValuesAreTrimmedAndSent', () => {
    expect(buildPushParams({ spaceId: 3, fileName: 'a.zip', packageId: ' Acme ', version: ' 2.0.0 ', replace: true })).toEqual({
      spaceId: 3, fileName: 'a.zip', source: 'Upload', packageId: 'Acme', version: '2.0.0', replace: true,
    })
  })
})

describe('results', () => {
  it('deduplicated_SaysUnchangedAndNamesTheVersion', () => {
    const outcome = describePushResult({ package: pkg, deduplicated: true, replaced: false })

    expect(outcome.tone).toBe('info')
    expect(outcome.title).toBe('Unchanged — same content as version 1.0.7')
  })

  it('published_NamesTheAssignedVersion', () => {
    expect(describePushResult({ package: pkg, deduplicated: false, replaced: false }).title).toBe('Published version 1.0.7')
  })

  it('replaced_SaysSo', () => {
    expect(describePushResult({ package: pkg, deduplicated: false, replaced: true }).title).toBe('Replaced version 1.0.7')
  })

  it.each([
    [409, 'Version conflict'],
    [413, 'Package too large'],
    [400, 'Package rejected'],
    [403, 'Not allowed'],
    [500, 'Upload failed'],
  ])('backendCode%i_TitlesTheFailure_AsTheRealBackendSendsIt', (code, title) => {
    // The backend answers HTTP 200 and puts the status in the envelope code, which the request helper raises as an ApiError.
    expect(describePushFailure(new ApiError('server says so', code, 200))).toEqual({ title, detail: 'server says so' })
  })

  it('transportLevelStatus_IsTheFallback_ForProxyErrorsLikeNginx413', () => {
    expect(describePushFailure({ response: { status: 413, data: '<html>Request Entity Too Large</html>' }, message: 'Request failed with status code 413' })).toEqual({
      title: 'Package too large',
      detail: 'Request failed with status code 413',
    })
  })

  it('theEnvelopeCodeWinsOverTheTransportStatus', () => {
    expect(describePushFailure(Object.assign(new ApiError('conflict', 409, 200), { response: { status: 500 } })).title).toBe('Version conflict')
  })

  it('unknownCode_FallsBackToTheGenericTitle', () => {
    expect(describePushFailure(new ApiError('boom', 500, 200)).title).toBe('Upload failed')
  })

  it('replaceIsOnlySentWithAVersion', () => {
    expect(buildPushParams({ spaceId: 1, fileName: 'a.zip', version: '', replace: true })).not.toHaveProperty('replace')
    expect(buildPushParams({ spaceId: 1, fileName: 'a.zip', version: '1.0.0', replace: true })).toHaveProperty('replace', true)
  })

  it('apiErrorMessage_ReadsAnApiErrorsMessage', () => {
    expect(apiErrorMessage(new ApiError('template rejected', 400, 200), 'fallback')).toBe('template rejected')
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback')
  })

  it('failureWithoutResponse_FallsBackToTheErrorMessage', () => {
    expect(describePushFailure(new Error('Network Error')).detail).toBe('Network Error')
  })
})

describe('naming and sizes', () => {
  it.each([
    ['myapp', 'myapp'],
    ['myapp.zip', 'myapp'],
    ['Acme.Web.1.2.3.zip', 'Acme.Web'],
    ['site-2.0.1.tar.gz', 'site'],
    ['pkg.tgz', 'pkg'],
    ['my.app', 'my.app'],
  ])('suggestPackageId(%s) = %s', (input, expected) => {
    expect(suggestPackageId(input)).toBe(expected)
  })

  it.each([[0, '0 B'], [1023, '1023 B'], [1536, '1.5 KB'], [5 * 1024 * 1024, '5.0 MB']])('formatBytes(%d)', (n, text) => {
    expect(formatBytes(n)).toBe(text)
  })
})
