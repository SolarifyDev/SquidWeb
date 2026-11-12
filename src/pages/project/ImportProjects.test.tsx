import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as importApi from 'pages/apis/octopusImport';
import {
  OctopusHistoryFetchPhase,
  OctopusImportPreviewAction,
  OctopusImportResourceOutcomeState,
  OctopusImportSessionState,
  type OctopusHistoryFetchProgress,
  type OctopusImportPreviewResource,
  type OctopusImportSession,
} from 'pages/apis/octopusImport';
import ImportProjects from './ImportProjects';

vi.mock('pages/apis/octopusImport', async importOriginal => {
  const actual = await importOriginal<typeof import('pages/apis/octopusImport')>();
  return {
    ...actual,
    probeOctopusServer: vi.fn(),
    connectOctopusImport: vi.fn(),
    fetchOctopusImportHistory: vi.fn(),
    uploadOctopusImport: vi.fn(),
    extractOctopusImport: vi.fn(),
    previewOctopusImport: vi.fn(),
    validateOctopusImport: vi.fn(),
    confirmOctopusImport: vi.fn(),
    getOctopusImportStatus: vi.fn(),
  };
});

const api = vi.mocked(importApi);
const ok = <T, >(data: T) => ({ code: 200, msg: null, data });
const noBlockers = { hasBlockers: false, blockerCount: 0, affectedResourceCount: 0, blockingReasons: [] };

const session = (state: OctopusImportSessionState): OctopusImportSession => ({
  sessionId: 'session-1',
  destinationSpaceId: 1,
  state,
});

const resource = (
  sourceType: string,
  sourceId: string,
  previewAction: OctopusImportPreviewAction,
  ownerProjectSourceId: string | null = null,
): OctopusImportPreviewResource => ({
  sourceId,
  sourceType,
  sourceName: sourceId,
  previewAction,
  outcomeState: OctopusImportResourceOutcomeState.Pending,
  destinationId: null,
  ownerProjectSourceId,
  requiredInputs: [],
  diagnostics: [],
});

const progress = (projectIndex: number, done: boolean): OctopusHistoryFetchProgress => ({
  phase: done ? OctopusHistoryFetchPhase.Done : OctopusHistoryFetchPhase.Deployments,
  projectIndex,
  projectCount: 2,
  counts: { releases: projectIndex, deployments: projectIndex, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 },
  totalBytes: 0,
  done,
});

const previewResources = [
  resource('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'),
  resource('Release', 'Releases-1', OctopusImportPreviewAction.Create, 'Projects-1'),
  resource('Deployment', 'Deployments-1', OctopusImportPreviewAction.Create, 'Projects-1'),
  resource('ServerTask', 'ServerTasks-1', OctopusImportPreviewAction.Create, 'Projects-1'),
];

const renderPage = () => render(
  <MemoryRouter initialEntries={['/import']}>
    <Routes>
      <Route path="/import" element={<ImportProjects />} />
      <Route path="/Spaces-1/projects" element={<div>Project list</div>} />
    </Routes>
  </MemoryRouter>,
);

const connectToServer = async () => {
  fireEvent.click(screen.getByLabelText('Octopus server'));
  fireEvent.click(screen.getByLabelText('Export file'));
  fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByText(/Connected to Octopus 2024\.1/);
};

const failure = (code: number, msg: string | null = null) => ({ code, msg, data: null });

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('ImportProjects', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.probeOctopusServer.mockResolvedValue(ok({
      octopusVersion: '2024.1',
      installationId: 'install-1',
      spaceless: false,
      spaces: [{ id: 'Spaces-1', name: 'Default', isDefault: true }, { id: 'Spaces-2', name: 'Other', isDefault: false }],
    }));
    api.connectOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded) }));
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(ok(progress(1, false)))
      .mockResolvedValueOnce(ok(progress(2, true)));
    api.extractOctopusImport.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Extracted),
      extraction: {
        extractedAt: '', documentCount: 1, resourceCount: 1, counts: [], files: [], diagnostics: [], hasBlockers: false,
      },
      blockerSummary: noBlockers,
    }));
    api.previewOctopusImport.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Previewed),
      previewPlan: { generatedAt: '', resources: previewResources, requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    api.validateOctopusImport.mockImplementation(async (_sessionId, _spaceId, plan) => ok({
      session: session(OctopusImportSessionState.Validated),
      previewPlan: plan,
      validation: { requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    api.confirmOctopusImport.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Validated),
      blockerSummary: noBlockers,
    }));
    api.getOctopusImportStatus.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Succeeded),
      blockerSummary: noBlockers,
    }));
  });

  it('rendersServerForm_ProbesWithoutPuttingTheKeyInAQuery', async () => {
    renderPage();

    await connectToServer();

    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    expect(api.probeOctopusServer).toHaveBeenCalledWith(
      { serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET' },
      1,
    );
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('loopsFetchUntilDone_ThenPreviewsAndValidatesWithoutHistoryRows', async () => {
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledWith(1, expect.anything());
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith(
      'session-1',
      1,
      { serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET' },
      'Spaces-1',
      expect.anything(),
    );
    expect(api.extractOctopusImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('import-tile-create')).toHaveTextContent('3');
    expect(screen.getByTestId('import-tile-alreadyImported')).toHaveTextContent('1');
    expect(screen.getAllByText('Already imported').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Project list', {}, { timeout: 4000 });
    const postedPlan = api.validateOctopusImport.mock.calls[0][2];
    expect(postedPlan.resources.map(item => item.sourceType)).toEqual(['Project']);
    expect(api.confirmOctopusImport).toHaveBeenCalledWith('session-1', 1, expect.anything(), true);
    expect(api.getOctopusImportStatus).toHaveBeenCalled();
  });

  it('stopsAndShowsTheServerMessage_WhenAFetchChunkFails', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce({ code: 400, msg: 'The Octopus server rejected the API key.', data: null });
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));

    await screen.findByText('The Octopus server rejected the API key.');
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(2);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();
  });

  it('showsNothingNew_AndDisablesImport_WhenEverythingWasImportedBefore', async () => {
    api.previewOctopusImport.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Previewed),
      previewPlan: {
        generatedAt: '',
        resources: [
          resource('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'),
          resource('Release', 'Releases-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'),
        ],
        requiredInputs: [],
        diagnostics: [],
        hasBlockers: false,
      },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));

    await screen.findByText('Nothing new to import');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('retriesATransientChunkFailure_OnTheSameSession_WithoutRestarting', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(503))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(failure(409, 'A fetch chunk is already running.'))
      .mockResolvedValueOnce(ok(progress(2, true)));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(2));
    await advance(1000);
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3));
    await advance(3000);
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(4));
    await advance(8000);

    await screen.findByText('By project');
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(5);
    expect(api.fetchOctopusImportHistory.mock.calls.every(call => call[0] === 'session-1')).toBe(true);
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('keepsTheSession_AndResumesTheFetch_AfterAChunkFails', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(400, 'The Octopus server rejected the API key.'))
      .mockResolvedValueOnce(ok(progress(2, true)));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await screen.findByText('The Octopus server rejected the API key.');
    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith(
      'session-1',
      1,
      { serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET' },
      'Spaces-1',
      expect.anything(),
    );
  });

  it('givesUpAfterRepeatedTransientFailures_ButKeepsTheFetchResumable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValue(failure(502, 'Bad gateway.'));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(1));
    await advance(1000);
    await advance(3000);
    await advance(8000);

    await screen.findByText('Bad gateway.');
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(4);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeEnabled();
  });

  it('disablesResume_WhenTheServerUrlChangedAfterTheFailure', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Rejected.'));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await screen.findByText('Rejected.');
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://other.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    await screen.findByText(/Connected to Octopus 2024\.1/);

    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();
  });

  it('cancelsTheFetchLoop_ThenResumesOnTheSameSession', async () => {
    let chunkSignal: AbortSignal | undefined;
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockImplementationOnce((_sessionId, _spaceId, _connection, _octopusSpaceId, signal) => {
        chunkSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      })
      .mockResolvedValueOnce(ok(progress(2, true)));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await screen.findByText(/History fetch cancelled/);
    expect(chunkSignal?.aborted).toBe(true);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));
    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith(
      'session-1',
      1,
      expect.anything(),
      'Spaces-1',
      expect.anything(),
    );
  });

  it('keepsPolling_WhenAStatusReadFails_AfterTheImportWasAccepted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getOctopusImportStatus.mockReset();
    api.getOctopusImportStatus
      .mockResolvedValueOnce(failure(502))
      .mockRejectedValueOnce(new Error('timeout of 60000ms exceeded'))
      .mockResolvedValueOnce(ok({ session: session(OctopusImportSessionState.Importing), blockerSummary: noBlockers }))
      .mockResolvedValueOnce(ok({ session: session(OctopusImportSessionState.Succeeded), blockerSummary: noBlockers }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 6 && !screen.queryByText('Project list'); i++) await advance(15000);

    await screen.findByText('Project list');
    expect(api.getOctopusImportStatus).toHaveBeenCalledTimes(4);
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('reportsFailure_OnlyWhenTheSessionItselfFailed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getOctopusImportStatus.mockReset();
    api.getOctopusImportStatus
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(ok({
        session: {
          ...session(OctopusImportSessionState.Failed),
          result: { diagnostics: [{ message: 'Release Releases-1 could not be written.' }] },
        } as OctopusImportSession,
        blockerSummary: noBlockers,
      }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 4 && !screen.queryByText('Release Releases-1 could not be written.'); i++) await advance(15000);

    await screen.findByText('Release Releases-1 could not be written.');
    expect(screen.queryByText('Import did not return a final session state.')).not.toBeInTheDocument();
    expect(api.getOctopusImportStatus).toHaveBeenCalledTimes(2);
  });

  it('offersCheckStatus_AfterThePollingDeadline_AndResumesPolling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getOctopusImportStatus.mockReset();
    api.getOctopusImportStatus.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Importing),
      blockerSummary: noBlockers,
    }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Load from server' }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 60 && !screen.queryByRole('button', { name: 'Check status' }); i++) await advance(15000);

    const checkStatus = await screen.findByRole('button', { name: 'Check status' });
    expect(screen.getByText(/Polling stopped after 10 minutes/)).toBeInTheDocument();

    api.getOctopusImportStatus.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Succeeded),
      blockerSummary: noBlockers,
    }));
    fireEvent.click(checkStatus);

    await screen.findByText('Project list');
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('ignoresAStaleProbeResponse_WhenTheServerUrlChangedMeanwhile', async () => {
    type ProbeResult = Awaited<ReturnType<typeof api.probeOctopusServer>>;
    let resolveProbe: (value: ProbeResult) => void = () => undefined;
    api.probeOctopusServer.mockReset();
    api.probeOctopusServer.mockReturnValueOnce(new Promise<ProbeResult>(resolve => {
      resolveProbe = resolve;
    }));
    renderPage();
    fireEvent.click(screen.getByLabelText('Octopus server'));
    fireEvent.click(screen.getByLabelText('Export file'));
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://a.example.com' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));

    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://b.example.com' } });
    await act(async () => {
      resolveProbe(ok({
        octopusVersion: '2024.1',
        installationId: 'install-a',
        spaceless: false,
        spaces: [{ id: 'Spaces-1', name: 'Default', isDefault: true }],
      }));
    });

    expect(screen.queryByText(/Connected to Octopus/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load from server' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Connect$/ })).toBeEnabled();
  });
});
