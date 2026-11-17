import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('utils/request', () => ({ axiosInstance: { request: (...args: unknown[]) => request(...args) } }));

const {
  connectOctopusImport, extractOctopusImport, fetchOctopusImportHistory, getOctopusImportProjects, listOctopusServerProjects,
  previewOctopusImport, selectOctopusImportProjects, validateOctopusImport,
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
});
