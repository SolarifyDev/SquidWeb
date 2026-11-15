import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('utils/request', () => ({ axiosInstance: { request: (...args: unknown[]) => request(...args) } }));

const { connectOctopusImport, fetchOctopusImportHistory } = await import('./octopusImport');

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
});
