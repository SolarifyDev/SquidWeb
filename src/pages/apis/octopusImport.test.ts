import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('utils/request', () => ({ axiosInstance: { request: (...args: unknown[]) => request(...args) } }));

const {
  connectOctopusImport, extractOctopusImport, fetchOctopusImportHistory, getOctopusImportProjects, listOctopusImportSessions, listOctopusServerProjects,
  previewOctopusImport, selectOctopusImportProjects, validateOctopusImport, isRetryableAfter, confirmationFailureMessage,
  OctopusImportSessionState, OctopusImportConfirmationFailureReason,
} = await import('./octopusImport');

describe('octopusImport api', () => {
  beforeEach(() => request.mockReset());

  it('sendsTheServerTargetOnConnect_InTheBodyOnly', async () => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: { session: { sessionId: 's' } } } });

    await connectOctopusImport(1, { serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET', octopusSpaceId: 'Spaces-1' });

    const config = request.mock.calls[0][0];
    expect(JSON.parse(config.data)).toEqual({
      spaceId: 1, serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET', octopusSpaceId: 'Spaces-1',
    });
    expect(config.params).toBeUndefined();
    expect(config.url).toBe('/octopus-import/connect');
  });

  it('connectsWithoutATarget_SendsOnlyTheSpace', async () => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: null } });

    await connectOctopusImport(1, null);

    expect(JSON.parse(request.mock.calls[0][0].data)).toEqual({ spaceId: 1 });
  });

  it.each([
    [{ code: 400, msg: 'Restricted.', data: null, errorKind: 'KeyRestricted' }, 'KeyRestricted'],
    [{ code: 404, msg: 'Gone.', errorKind: 'SessionNotFound' }, 'SessionNotFound'],
    [{ code: 400, msg: 'Bad.', data: null }, null],
  ])('keepsTheErrorKindOfAFailure %#', async (body, kind) => {
    request.mockResolvedValue({ status: body.code, data: body });

    const envelope = await fetchOctopusImportHistory('s', 1, { serverUrl: 'u', apiKey: 'k' }, 'Spaces-1');

    expect(envelope).toMatchObject({ code: body.code, msg: body.msg, errorKind: kind });
  });

  it('listsServerProjects_WithTheKeyInThePostBodyOnly', async () => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: { groups: [], projects: [], selectedProjectIds: null } } });

    await listOctopusServerProjects({ serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET' }, 'Spaces-1', 1);

    const config = request.mock.calls[0][0];
    expect(config.method).toBe('POST');
    expect(config.url).toBe('/octopus-import/history/projects');
    expect(config.params).toBeUndefined();
    expect(JSON.parse(config.data)).toEqual({
      spaceId: 1, serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET', octopusSpaceId: 'Spaces-1',
    });
  });

  // Pinned on both sides: OctopusImportControllerTests.SessionsAsync_IsAGetOnTheSessionsRoute_AndDispatchesTheBoundRequest.
  it('listsResumableSessions_WithAGetOnTheSessionsRoute', async () => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: [] } });

    await listOctopusImportSessions(1);

    const config = request.mock.calls[0][0];
    expect(config.method).toBe('GET');
    expect(config.url).toBe('/octopus-import/sessions');
    expect(config.params).toEqual({ spaceId: 1 });
    expect(config.data).toBeUndefined();
  });

  it('readsTheProjectsOfASession_WithAGet', async () => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: { groups: [], projects: [], selectedProjectIds: null } } });

    await getOctopusImportProjects('s', 1);

    const config = request.mock.calls[0][0];
    expect(config.method).toBe('GET');
    expect(config.url).toBe('/octopus-import/s/projects');
    expect(config.params).toEqual({ spaceId: 1 });
    expect(config.data).toBeUndefined();
  });

  it.each([
    [['Projects-1', 'Projects-2']],
    [null],
  ])('putsTheSelection_SerialisingWholeSpaceAsNull %#', async projectIds => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: { sessionId: 's' } } });

    await selectOctopusImportProjects('s', 1, projectIds);

    const config = request.mock.calls[0][0];
    expect(config.method).toBe('PUT');
    expect(config.url).toBe('/octopus-import/s/projects/selection');
    expect(JSON.parse(config.data)).toEqual({ spaceId: 1, projectIds });
  });

  // Extracting a 100 MB export, or planning a project with thousands of releases, outlasts the default one-minute wait.
  it.each([
    ['extract', () => extractOctopusImport('s', 1)],
    ['preview', () => previewOctopusImport('s', 1)],
    ['validate', () => validateOctopusImport('s', 1, { generatedAt: '', resources: [], requiredInputs: [], diagnostics: [], hasBlockers: false })],
  ])('waitsFiveMinutes_ForTheHeavySessionSteps %s', async (_name, call) => {
    request.mockResolvedValue({ status: 200, data: { code: 200, msg: null, data: null } });

    await call();

    expect(request.mock.calls[0][0].timeout).toBe(5 * 60 * 1000);
  });

  it.each([
    [OctopusImportSessionState.Validated, 'attempt-2', 'attempt-1', true],   // a new failure: import again
    [OctopusImportSessionState.Validated, 'attempt-1', 'attempt-1', false],  // the failure seen before confirming
    [OctopusImportSessionState.Validated, 'attempt-1', null, true],
    [OctopusImportSessionState.Validated, null, null, false],                // validated, never failed: still queued
    [OctopusImportSessionState.Importing, 'attempt-2', 'attempt-1', false],
  ])('isRetryableAfter %#', (state, attemptId, previous, expected) => {
    const session = { sessionId: 's', destinationSpaceId: 1, state, lastConfirmationFailure: attemptId ? { attemptId, reason: OctopusImportConfirmationFailureReason.RolledBack, transient: false, attempts: 1 } : null };

    expect(isRetryableAfter(session, previous)).toBe(expected);
  });

  it('confirmationFailureMessage_PrefersTheDiagnostic_ThenTheReason', () => {
    expect(confirmationFailureMessage({ attemptId: 'a', reason: OctopusImportConfirmationFailureReason.RolledBack, transient: false, attempts: 1, diagnostics: [{ message: 'Root cause.' } as never] })).toBe('Root cause.');
    expect(confirmationFailureMessage({ attemptId: 'a', reason: OctopusImportConfirmationFailureReason.Interrupted, transient: true, attempts: 1 })).toMatch(/stopped before it finished/);
  });
});
