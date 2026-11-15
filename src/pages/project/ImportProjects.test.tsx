import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as importApi from 'pages/apis/octopusImport';
import {
  OctopusHistoryFetchPhase,
  OctopusImportCompatibilitySeverity,
  OctopusImportFillEvidenceState,
  OctopusImportPreviewAction,
  OctopusImportProjectDestinationState,
  OctopusImportRequiredInputKind,
  OctopusImportResourceOutcomeState,
  OctopusImportSessionState,
  type OctopusHistoryFetchProgress,
  type OctopusImportChangeCounts,
  type OctopusImportOriginEvidence,
  type OctopusImportPreviewPlan,
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
  counts: {
    releases: projectIndex,
    deployments: projectIndex,
    serverTasks: 0,
    detailsFetched: 0,
    detailsSkipped: 0,
    detailsTooLarge: 0,
    projectsNotFound: 0,
  },
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
  fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByText(/Connected to Octopus 2024\.1/);
};

const failure = (code: number, msg: string | null = null, errorKind: string | null = null) => ({ code, msg, data: null, errorKind });

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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledWith(
      1,
      { serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET', octopusSpaceId: 'Spaces-1' },
      expect.anything(),
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
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

  it('keepsTheSession_AndResumesTheFetch_AfterTheServerWasUnreachable', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(400, 'The Octopus server could not be reached.', 'Unreachable'))
      .mockResolvedValueOnce(ok(progress(2, true)));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('The Octopus server could not be reached.');
    expect(screen.getByTestId('workflow-hint')).toHaveTextContent(/could not be reached/);
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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(1));
    await advance(1000);
    await advance(3000);
    await advance(8000);

    await screen.findByText('Bad gateway.');
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(4);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeEnabled();
  });

  it('dropsTheResumeTargetAndTheError_WhenTheServerUrlChangesAfterTheFailure', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(502, 'Bad gateway.'));
    api.fetchOctopusImportHistory.mockResolvedValue(failure(502, 'Bad gateway.'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    for (let i = 0; i < 4 && !screen.queryByText('Bad gateway.'); i++) await advance(8000);
    await screen.findByText('Bad gateway.');
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://other.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    await screen.findByText(/Connected to Octopus 2024\.1/);

    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bad gateway.')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await screen.findByText(/Reading from Octopus cancelled/);
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
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
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
    expect(screen.getByRole('button', { name: 'Read from Octopus' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Connect$/ })).toBeEnabled();
  });
  it('connectsOnEnter_AndExplainsTheKeyIsNotStored', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Octopus server'));
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });

    fireEvent.keyDown(screen.getByLabelText('API key'), { key: 'Enter', code: 'Enter', keyCode: 13 });

    await screen.findByText(/Connected to Octopus 2024\.1/);
    expect(api.probeOctopusServer).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/used only for this import and is never stored/)).toBeInTheDocument();
    expect(screen.getByText('2 spaces available')).toBeInTheDocument();
  });

  it('autoSelectsTheOnlySpace_AndChangeResetsTheProbe', async () => {
    api.probeOctopusServer.mockResolvedValue(ok({
      octopusVersion: '2024.1',
      installationId: 'install-1',
      spaceless: false,
      spaces: [{ id: 'Spaces-7', name: 'Ops', isDefault: false }],
    }));
    renderPage();
    await connectToServer();

    expect(screen.getByText('1 space available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read from Octopus' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.queryByText(/Connected to Octopus/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read from Octopus' })).toBeDisabled();
  });

  it('showsStepsPhaseAndCounts_AndDisablesServerInputs_WhileFetching', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok({
        ...progress(1, false),
        phase: OctopusHistoryFetchPhase.Releases,
        counts: {
          releases: 4, deployments: 6, serverTasks: 6, detailsFetched: 5, detailsSkipped: 1, detailsTooLarge: 0, projectsNotFound: 0,
        },
      }))
      .mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    const steps = () => screen.getByTestId('server-import-steps');
    expect(screen.queryByTestId('server-import-steps')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-import-steps').querySelector('.ant-steps-item-process')).toHaveTextContent('Select file');
    fireEvent.click(screen.getByLabelText('Octopus server'));
    expect(screen.queryByTestId('file-import-steps')).not.toBeInTheDocument();
    expect(steps().querySelector('.ant-steps-item-process')).toHaveTextContent('Connect');
    await connectToServer();
    expect(steps().querySelector('.ant-steps-item-process')).toHaveTextContent('Choose space');

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    const fetchProgress = await screen.findByTestId('history-fetch-progress');
    expect(fetchProgress).toHaveTextContent('Reading releases (project 1 of 2)');
    expect(fetchProgress).toHaveTextContent('4 releases, 6 deployments, 6 tasks, 5 details fetched, 1 unchanged');
    expect(steps().querySelector('.ant-steps-item-process')).toHaveTextContent('Read from Octopus');
    expect(screen.getByLabelText('Server URL')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Connect$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('summarizesTheFetch_AndWarnsAboutMissingProjectsAndOversizedLogs', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(ok({
      ...progress(2, true),
      counts: {
        releases: 3, deployments: 5, serverTasks: 5, detailsFetched: 4, detailsSkipped: 0, detailsTooLarge: 1, projectsNotFound: 1,
      },
    }));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    await screen.findByText('By project');
    expect(screen.getByTestId('fetch-tile-releases')).toHaveTextContent('3');
    expect(screen.getByTestId('fetch-tile-tasks')).toHaveTextContent('5');
    expect(screen.getByText(/1 project was not found in this Octopus space/).closest('.ant-alert'))
      .toHaveClass('ant-alert-warning');
    expect(screen.getByText(/1 task had logs too large to fetch/)).toBeInTheDocument();
    expect(screen.getByTestId('server-import-steps').querySelector('.ant-steps-item-process'))
      .toHaveTextContent('Preview');
  });

  it('showsAnError_WhenNoScopedProjectExistsInTheChosenSpace', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(ok({
      ...progress(2, true),
      counts: {
        releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0, detailsTooLarge: 0, projectsNotFound: 2,
      },
    }));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    const notFound = await screen.findByText(/2 projects were not found in this Octopus space/);
    expect(notFound.closest('.ant-alert')).toHaveClass('ant-alert-error');
    expect(screen.getByText(/Choose another Octopus space/)).toBeInTheDocument();
    expect(screen.queryByText(/logs too large/)).not.toBeInTheDocument();
  });

  // ── Sources ────────────────────────────────────────────────────────────────

  it('offersTwoExclusiveSources_EachSayingWhatItImportsAndCannot', () => {
    renderPage();

    expect(screen.getByLabelText('Export file')).toBeChecked();
    expect(screen.getByLabelText('Octopus server')).not.toBeChecked();
    expect(screen.getByTestId('import-source-file')).toHaveTextContent(/Cannot import:.*Deployment history/);
    expect(screen.getByTestId('import-source-server')).toHaveTextContent(/Imports:.*releases, deployments and task logs/);
    expect(screen.getByTestId('import-source-server')).toHaveTextContent(/Cannot import:.*Secret values/);
    expect(screen.getByRole('button', { name: 'Select zip file' })).toBeEnabled();
    expect(screen.queryByLabelText('Server URL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Octopus server'));

    expect(screen.getByLabelText('Octopus server')).toBeChecked();
    expect(screen.getByLabelText('Export file')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Select zip file' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Server URL')).toBeInTheDocument();
  });

  it('importsAnExportFile_WithoutEverTouchingTheServer', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();

    await pickFile();

    await screen.findByText('By project');
    expect(api.uploadOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.connectOctopusImport).not.toHaveBeenCalled();
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
    expect(screen.getByTestId('file-import-steps').querySelector('.ant-steps-item-process')).toHaveTextContent('Preview');
  });

  // ── Stale errors ───────────────────────────────────────────────────────────

  it('clearsThePreviousError_WhenTheSourceChanges', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Response too large.', 'TooLarge'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Response too large.');

    fireEvent.click(screen.getByLabelText('Export file'));

    expect(screen.queryByText('Response too large.')).not.toBeInTheDocument();
    expect(screen.queryByText('Import cannot continue.')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-import-steps').querySelector('.ant-steps-item-error')).toBeNull();
  });

  it.each([
    ['the server URL', () => fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://b.example.com' } })],
    ['the API key', () => fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-OTHER' } })],
    ['the Change link', () => fireEvent.click(screen.getByRole('button', { name: 'Change' }))],
  ])('clearsThePreviousError_WhenChanging %s', async (_name, change) => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Response too large.', 'TooLarge'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Response too large.');

    change();

    expect(screen.queryByText('Response too large.')).not.toBeInTheDocument();
  });

  it('clearsThePreviousError_WhenAnotherSpaceIsChosen', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Response too large.', 'TooLarge'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Response too large.');

    fireEvent.mouseDown(screen.getByLabelText(/Octopus space/));
    fireEvent.click(await screen.findByText('Other'));

    expect(screen.queryByText('Response too large.')).not.toBeInTheDocument();
  });

  it('clearsThePreviousError_WhenANewFileIsPicked', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.extractOctopusImport.mockResolvedValueOnce({ code: 400, msg: 'The archive is corrupt.', data: null, errorKind: null });
    renderPage();
    await pickFile();
    await screen.findByText('The archive is corrupt.');

    fireEvent.click(screen.getByRole('button', { name: 'Select zip file' }));

    expect(screen.queryByText('The archive is corrupt.')).not.toBeInTheDocument();
  });

  it('ignoresALateResponseOfACancelledRead_AfterTheSourceChanged', async () => {
    type FetchResult = Awaited<ReturnType<typeof api.fetchOctopusImportHistory>>;
    let resolveChunk: (value: FetchResult) => void = () => undefined;
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockReturnValueOnce(new Promise<FetchResult>(resolve => {
      resolveChunk = resolve;
    }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByLabelText('Export file'));

    await act(async () => {
      resolveChunk(failure(400, 'Late failure.', 'TooLarge'));
    });

    expect(screen.queryByText('Late failure.')).not.toBeInTheDocument();
    expect(api.extractOctopusImport).not.toHaveBeenCalled();
  });

  // ── API key gate and recovery ──────────────────────────────────────────────

  it('refusesARestrictedKeyAtConnect_WithTheReasonAndNoResume', async () => {
    api.connectOctopusImport.mockResolvedValueOnce(failure(400, 'The key cannot read: ProjectView (restricted).', 'KeyRestricted'));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    await screen.findByText('The key cannot read: ProjectView (restricted).');
    expect(screen.getByTestId('workflow-hint')).toHaveTextContent(/dedicated read-only service account/);
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(screen.getByTestId('server-import-steps').querySelector('.ant-steps-item-error')).toHaveTextContent('Read from Octopus');
  });

  it('warnsBeforeReading_WhenTheProbeSaysTheKeyCannotReadTheSpace', async () => {
    api.probeOctopusServer.mockResolvedValue(ok({
      octopusVersion: '2024.1',
      installationId: 'install-1',
      spaceless: false,
      spaces: [{ id: 'Spaces-1', name: 'Default', isDefault: true }, { id: 'Spaces-2', name: 'Other', isDefault: false }],
      permissions: { octopusSpaceId: 'Spaces-1', sufficient: false, restricted: ['ProjectView'], missing: ['TaskView'], incomplete: false },
    }));
    renderPage();
    await connectToServer();

    const problem = screen.getByTestId('key-permission-problem');
    expect(problem).toHaveTextContent('Limited to some projects, environments, tenants or project groups: ProjectView');
    expect(problem).toHaveTextContent('Not granted: TaskView');
  });

  it.each([
    ['Unauthorized'],
    ['KeyRestricted'],
    ['KeyUserMismatch'],
    ['NotFound'],
  ])('offersResume_OnlyAfterConnectingAgain_WhenTheReadFailedWith %s', async kind => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(400, `Failed: ${kind}.`, kind))
      .mockResolvedValueOnce(ok(progress(2, true)));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText(`Failed: ${kind}.`);

    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-NEW' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    await screen.findByText(/Connected to Octopus 2024\.1/);
    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith(
      'session-1', 1, { serverUrl: 'https://octopus.example.com', apiKey: 'API-NEW' }, 'Spaces-1', expect.anything(),
    );
  });

  it.each([
    ['SessionNotFound', 404],
    ['SessionStateConflict', 409],
  ])('offersStartAgain_NotResume_WhenTheSessionCannotContinue %s', async (kind, code) => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(failure(code, 'Session gone.', kind))
      .mockResolvedValueOnce(ok(progress(2, true)));
    api.connectOctopusImport
      .mockResolvedValueOnce(ok({ session: session(OctopusImportSessionState.Uploaded) }))
      .mockResolvedValueOnce(ok({ session: { ...session(OctopusImportSessionState.Uploaded), sessionId: 'session-2' } }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Session gone.');

    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(2);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith('session-2', 1, expect.anything(), 'Spaces-1', expect.anything());
  });

  it.each([
    ['TooLarge', 'TooLarge'],
    ['no kind', null],
  ])('offersNoResume_WhenRetryingCannotHelp %s', async (_name, kind) => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Cannot continue.', kind));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Cannot continue.');

    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start again' })).not.toBeInTheDocument();
  });

  it('hidesResume_WhenExtractionFailsAfterTheReadCompleted', async () => {
    api.extractOctopusImport.mockResolvedValueOnce({ code: 400, msg: 'Extraction broke.', data: null, errorKind: null });
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    await screen.findByText('Extraction broke.');
    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(screen.getByTestId('server-import-steps').querySelector('.ant-steps-item-error')).toHaveTextContent('Preview');
  });

  // A step after a long read fails for a passing reason: "Try again" redoes only that step on the same session, never the read.
  it.each([
    ['extract envelope', 'extract', 'envelope'],
    ['extract thrown', 'extract', 'thrown'],
    ['preview envelope', 'preview', 'envelope'],
    ['preview thrown', 'preview', 'thrown'],
  ])('retriesOnlyTheFailedStepAfterTheRead_WhenExtractOrPreviewFails %s', async (_name, step, mode) => {
    const target = step === 'extract' ? api.extractOctopusImport : api.previewOctopusImport;
    if (mode === 'thrown') target.mockRejectedValueOnce(new Error('Network dropped.'));
    else target.mockResolvedValueOnce({ code: 500, msg: 'Network dropped.', data: null, errorKind: null });
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Network dropped.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
    expect(api.extractOctopusImport).toHaveBeenCalledTimes(step === 'extract' ? 2 : 1);
    expect(api.previewOctopusImport).toHaveBeenCalledTimes(step === 'preview' ? 2 : 1);
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it.each([['envelope'], ['thrown']])('retriesTheImport_WhenValidationFailsForAPassingReason %s', async mode => {
    if (mode === 'thrown') api.validateOctopusImport.mockRejectedValueOnce(new Error('Network dropped.'));
    else api.validateOctopusImport.mockResolvedValueOnce({ code: 500, msg: 'Network dropped.', data: null, errorKind: null });
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('By project');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByText('Network dropped.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('Project list', {}, { timeout: 4000 });
    expect(api.validateOctopusImport).toHaveBeenCalledTimes(2);
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
  });

  it('offersNoRetry_WhenExtractionReportsBlockers', async () => {
    api.extractOctopusImport.mockResolvedValueOnce(ok({
      session: session(OctopusImportSessionState.Uploaded),
      extraction: { extractedAt: '', documentCount: 1, resourceCount: 1, counts: [], files: [], diagnostics: [], hasBlockers: true },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('Extraction produced blocking diagnostics.');

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('showsConfigurationProgress_WhileReadingTheSpaceCatalog', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok({
        ...progress(0, false),
        phase: OctopusHistoryFetchPhase.Catalog,
        catalogIndex: 2,
        catalogKindCount: 12,
        counts: { ...progress(0, false).counts, configurationDocuments: 40 },
      }))
      .mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    const fetchProgress = await screen.findByTestId('history-fetch-progress');
    expect(fetchProgress).toHaveTextContent('Reading space configuration (kind 3 of 12)');
    expect(fetchProgress).toHaveTextContent('40 configuration documents');
  });

  // ── Incremental preview ────────────────────────────────────────────────────

  it('showsWhereEachProjectLands_TheFieldChanges_AndTheSkipReasons', async () => {
    mockPreview(incrementalPlan());
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    const projects = await screen.findByTestId('preview-projects');
    expect(screen.getByTestId('summary-incremental')).toHaveTextContent('This import changes 2 resources in Squid; 5 already in Squid');
    expect(screen.getByTestId('summary-tile-alreadyImported')).toHaveTextContent('5');
    expect(screen.getByTestId('summary-tile-update')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-tile-create')).toHaveTextContent('1');
    const existing = within(projects).getByRole('link', { name: 'Web (renamed in Squid)' });
    expect(existing).toHaveAttribute('href', '/Spaces-1/projects/web');
    expect(projects).toHaveTextContent('(id 501)');
    expect(within(projects).getByText('New project')).toBeInTheDocument();
    expect(screen.getByTestId('skip-reasons')).toHaveTextContent('Deployment targets are not imported.');

    fireEvent.click(within(projects).getAllByRole('button', { name: /expand row/i })[1]);

    const changes = await screen.findByTestId('changes-Deployment-Deployments-1');
    expect(changes).toHaveTextContent('State');
    expect(changes).toHaveTextContent('Executing');
    expect(changes).toHaveTextContent('Success');
  });

  it('showsEverythingUpToDate_AndDisablesImport', async () => {
    mockPreview({ ...incrementalPlan(), resources: [], summary: { ...incrementalPlan().summary!, isUpToDate: true } });
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    await screen.findByTestId('preview-up-to-date');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('listsSecretsTheApiWithholds_AndFillFromExportFileSwitchesToTheFile', async () => {
    mockPreview(incrementalPlan());
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));

    const secrets = await screen.findByTestId('withheld-secrets');
    expect(secrets).toHaveTextContent('1 secret value will be imported as missing');
    expect(secrets).toHaveTextContent('Db.Password');
    expect(secrets).toHaveTextContent('Environment: Production');
    expect(secrets).not.toHaveTextContent('hunter2');

    fireEvent.click(within(secrets).getByRole('button', { name: 'Fill from export file' }));

    expect(screen.getByLabelText('Export file')).toBeChecked();
    expect(await screen.findByText('Upload file containing exported data')).toBeInTheDocument();
    expect(screen.queryByTestId('withheld-secrets')).not.toBeInTheDocument();
  });

  it('listsTheSecretsAFileFills_WithTheirSquidDestination_AndNeverAValue', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(fillPlan(false));
    renderPage();

    await pickFile();

    const fills = await screen.findByTestId('secret-fills');
    expect(within(fills).getByRole('link', { name: 'project "Web"' })).toHaveAttribute('href', '/Spaces-1/projects/Web/variables');
    expect(fills).toHaveTextContent('Db.Password');
    expect(screen.getByTestId('summary-tile-fill')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('requiresThePairingConfirmation_AndPostsIt', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(fillPlan(true));
    renderPage();
    await pickFile();

    const pairing = await screen.findByTestId('fill-pairing');
    expect(pairing).toHaveTextContent('octopus.example.com');
    expect(pairing).toHaveTextContent('Spaces-1');
    expect(pairing).toHaveTextContent('3 matching step, action or phase ids');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

    fireEvent.click(within(pairing).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Project list', {}, { timeout: 4000 });
    expect(api.validateOctopusImport.mock.calls[0][2].fillPairing?.confirmed).toBe(true);
  });

  // The origin check refused the source (another Octopus than the space's): the page explains it and nothing can be imported.
  it('refusedOrigin_ShowsTheNotice_AndBlocksTheImport', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview({
      ...fillPlan(false),
      hasBlockers: true,
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Blocker, code: 'octopus.preview.import_origin_unproven', message: 'This import would link to resources an earlier import created in this space.' }],
    });
    renderPage();
    await pickFile();

    const notice = await screen.findByTestId('import-origin-notice');
    expect(notice).toHaveTextContent('This import comes from a different Octopus than this space');
    expect(notice).toHaveTextContent('Import it into another space');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  // A pairing asked by the origin check speaks of linking, and of the source the user picked.
  it('originPairing_SaysTheImportLinks_AndNamesTheRecordedFingerprint', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    const plan = fillPlan(true);
    mockPreview({
      ...plan,
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Warning, code: 'octopus.preview.import_origin_pairing_required', message: 'Confirm the pairing.' }],
      fillPairing: { ...plan.fillPairing!, installationId: null, serverHost: null, octopusSpaceId: null, octopusVersion: null, recordedExportSourceId: 'ABC123', sourceInstallationId: 'inst-x', sourceServerHost: 'octopus-x.example.com' },
    });
    renderPage();
    await pickFile();

    const pairing = await screen.findByTestId('fill-pairing');
    expect(pairing).toHaveTextContent('Confirm this is the Octopus server this space came from');
    expect(pairing).toHaveTextContent('This Octopus server would link to what an earlier import created in this space');
    expect(pairing).toHaveTextContent('Export file fingerprint: ABC123');
    expect(pairing).toHaveTextContent('octopus-x.example.com');
    expect(pairing).not.toHaveTextContent('fill secrets');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  // The server's origin verdict, for both sources: refused names both origins; pairing asks "same Octopus server" with the count and
  // posts it; proven shows only what proved it.
  const originPlan = (origin: OctopusImportOriginEvidence, extra: Partial<OctopusImportPreviewPlan> = {}): OctopusImportPreviewPlan => ({
    ...fillPlan(false),
    origin,
    ...extra,
  });

  const refusedOrigin: OctopusImportOriginEvidence = {
    state: OctopusImportFillEvidenceState.Unproven, basis: null, matchingStructureIds: 0,
    source: 'Octopus installation inst-x (server octopus-x.example.com, space Spaces-2)', recorded: 'an export file with fingerprint ABC123',
  };

  const reachPreview = async (source: 'server' | 'file') => {
    if (source === 'file') {
      await pickFile();
      return;
    }
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
  };

  it.each(['server', 'file'] as const)('%s_refusedVerdict_NamesBothOrigins_NothingLinked_ImportBlocked', async source => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(originPlan(refusedOrigin, {
      hasBlockers: true,
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Blocker, code: 'octopus.preview.import_origin_unproven', message: 'Refused.' }],
    }));
    renderPage();
    await reachPreview(source);

    const notice = await screen.findByTestId('import-origin-notice');
    expect(notice).toHaveTextContent('This source: Octopus installation inst-x (server octopus-x.example.com, space Spaces-2)');
    expect(notice).toHaveTextContent('This space was imported from: an export file with fingerprint ABC123');
    expect(notice).toHaveTextContent('Nothing will be linked or written');
    expect(screen.queryByTestId('fill-pairing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-origin-proof')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it.each(['server', 'file'] as const)('%s_pairingVerdict_AsksSameOctopusServerWithTheCount_AndPostsIt', async source => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    const pairing = fillPlan(true).fillPairing!;
    mockPreview(originPlan({ ...refusedOrigin, state: OctopusImportFillEvidenceState.PairingRequired, matchingStructureIds: 3 }, {
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Warning, code: 'octopus.preview.import_origin_pairing_required', message: 'Confirm.' }],
      fillPairing: source === 'server'
        ? { ...pairing, installationId: null, serverHost: null, recordedExportSourceId: 'ABC123', sourceInstallationId: 'inst-x', sourceServerHost: 'octopus-x.example.com' }
        : { ...pairing, fileExportSourceId: 'FFF000' },
    }));
    renderPage();
    await reachPreview(source);

    const card = await screen.findByTestId('fill-pairing');
    expect(card).toHaveTextContent('3 matching step, action or phase ids');
    expect(screen.queryByTestId('import-origin-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

    const label = source === 'server' ? 'This is the same Octopus server this space was imported from' : 'This export file comes from the same Octopus server this space was imported from';
    fireEvent.click(within(card).getByRole('checkbox', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Project list', {}, { timeout: 4000 });
    expect(api.validateOctopusImport.mock.calls[0][2].fillPairing?.confirmed).toBe(true);
  });

  it.each(['server', 'file'] as const)('%s_provenVerdict_ShowsOnlyTheBasis', async source => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(originPlan({ ...refusedOrigin, state: OctopusImportFillEvidenceState.Proven, basis: source === 'server' ? 'installation' : 'export-fingerprint' }));
    renderPage();
    await reachPreview(source);

    const proof = await screen.findByTestId('import-origin-proof');
    expect(proof).toHaveTextContent(source === 'server' ? 'proven by its installation id' : 'proven by its export file fingerprint');
    expect(screen.queryByTestId('import-origin-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fill-pairing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('staysAfterTheImport_ListingTheSecretsItLeftMissing', async () => {
    api.getOctopusImportStatus.mockResolvedValue(ok({
      session: {
        ...session(OctopusImportSessionState.Succeeded),
        result: {
          succeeded: true, completedAt: '', resources: [], idMappings: [], diagnostics: [],
          missingSensitiveValues: [{
            kind: OctopusImportRequiredInputKind.SensitiveVariableValue, name: 'Db.Password', ownerName: 'Web', ownerKind: 'Project',
            field: 'Value', scopeSummary: 'Environment: Production', destinationId: 9, destinationOwnerId: 501, fillable: true,
          }],
        },
      },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: 'Read from Octopus' }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const missing = await screen.findByTestId('missing-secrets-after-import', {}, { timeout: 4000 });
    expect(within(missing).getByRole('link', { name: 'Db.Password' })).toHaveAttribute('href', '/Spaces-1/projects/Web/variables');
    expect(screen.queryByText('Project list')).not.toBeInTheDocument();

    fireEvent.click(within(missing).getByRole('button', { name: 'Go to projects' }));
    await screen.findByText('Project list');
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

function pickFile() {
  fireEvent.click(screen.getByRole('button', { name: 'Select zip file' }));
  const file = new File(['zip'], 'export.zip', { type: 'application/zip' });
  fireEvent.change(document.getElementById('import-zip-file-input')!, { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  return waitFor(() => expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled(), { timeout: 2000 })
    .then(() => fireEvent.click(screen.getByRole('button', { name: 'Select' })));
}

function mockPreview(plan: OctopusImportPreviewPlan) {
  api.previewOctopusImport.mockResolvedValue(ok({
    session: session(OctopusImportSessionState.Previewed),
    previewPlan: plan,
    blockerSummary: noBlockers,
  }));
}

function counts(overrides: Partial<OctopusImportChangeCounts> = {}): OctopusImportChangeCounts {
  const value = { alreadyImported: 0, reused: 0, create: 0, update: 0, fill: 0, skip: 0, unsupported: 0, blocked: 0, ...overrides };
  const incremental = value.create + value.update + value.fill + value.reused;
  return { ...value, total: incremental + value.alreadyImported + value.skip + value.unsupported + value.blocked, incremental };
}

function incrementalPlan(): OctopusImportPreviewPlan {
  const withSecret = {
    ...resource('Project', 'Projects-2', OctopusImportPreviewAction.Create, 'Projects-2'),
    sourceName: 'Api',
    requiredInputs: [{
      kind: OctopusImportRequiredInputKind.SensitiveVariableValue, inputKey: 'k1', sourceId: 'v1', sourceType: 'Variable', name: 'Db.Password',
      fieldName: 'Value', valueType: 'Sensitive', hasSourceValue: false, isRequired: false, fillable: true, withheldByServer: true,
      sourceScopes: { Environment: ['Production'] },
    }],
  };
  return {
    generatedAt: '',
    resources: [
      { ...resource('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'), sourceName: 'Web' },
      {
        ...resource('Deployment', 'Deployments-1', OctopusImportPreviewAction.Update, 'Projects-1'),
        changes: [{ field: 'State', oldValue: 'Executing', newValue: 'Success', valueHidden: false, description: null }],
      },
      withSecret,
      {
        ...resource('Machine', 'Machines-1', OctopusImportPreviewAction.Unsupported),
        skipReason: { code: 'octopus.preview.unsupported', message: 'Deployment targets are not imported.' },
      },
    ],
    requiredInputs: withSecret.requiredInputs,
    diagnostics: [],
    hasBlockers: false,
    summary: {
      isUpToDate: false,
      counts: counts({ alreadyImported: 5, create: 1, update: 1, unsupported: 1 }),
      kinds: [{ kind: 'Deployment', counts: counts({ alreadyImported: 3, update: 1 }) }],
      projects: [
        {
          sourceId: 'Projects-1', sourceName: 'Web', counts: counts({ alreadyImported: 5, update: 1 }), isUpToDate: false,
          kinds: [{ kind: 'Deployment', counts: counts({ alreadyImported: 3, update: 1 }) }],
          destination: { state: OctopusImportProjectDestinationState.Existing, projectId: 501, projectName: 'Web (renamed in Squid)', projectSlug: 'web' },
        },
        {
          sourceId: 'Projects-2', sourceName: 'Api', counts: counts({ create: 1 }), isUpToDate: false,
          kinds: [{ kind: 'Project', counts: counts({ create: 1 }) }],
          destination: { state: OctopusImportProjectDestinationState.New, projectId: null, projectName: null, projectSlug: null },
        },
      ],
      space: { counts: counts({ unsupported: 1 }), kinds: [{ kind: 'Machine', counts: counts({ unsupported: 1 }) }], isUpToDate: true },
      skipReasons: [{ resourceType: 'Machine', code: 'octopus.preview.unsupported', message: 'Deployment targets are not imported.', count: 1 }],
    },
  };
}

function fillPlan(pairingRequired: boolean): OctopusImportPreviewPlan {
  return {
    generatedAt: '',
    resources: [
      { ...resource('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'), sourceName: 'Web' },
      {
        ...resource('Variable', 'vs:abc', OctopusImportPreviewAction.FillMissingSecret, 'Projects-1'),
        sourceName: 'Db.Password',
        fillDestination: { ownerKind: 'Project', ownerId: 501, ownerName: 'Web', variableSetId: 601 },
        changes: [{ field: 'Value', oldValue: null, newValue: null, valueHidden: true, description: 'Filled from the export file.' }],
      },
    ],
    requiredInputs: [],
    diagnostics: [],
    hasBlockers: false,
    fillPairing: pairingRequired
      ? {
        required: true, confirmed: false, installationId: 'install-1', serverHost: 'octopus.example.com', octopusSpaceId: 'Spaces-1',
        octopusVersion: '2026.1', fileExportSourceId: null, recordedExportSourceId: null, matchingStructureIds: 3,
      }
      : null,
    summary: {
      isUpToDate: false,
      counts: counts({ alreadyImported: 1, fill: 1 }),
      kinds: [{ kind: 'Variable', counts: counts({ fill: 1 }) }],
      projects: [{
        sourceId: 'Projects-1', sourceName: 'Web', counts: counts({ alreadyImported: 1, fill: 1 }), isUpToDate: false,
        kinds: [{ kind: 'Variable', counts: counts({ fill: 1 }) }],
        destination: { state: OctopusImportProjectDestinationState.Existing, projectId: 501, projectName: 'Web', projectSlug: null },
      }],
      space: { counts: counts(), kinds: [], isUpToDate: true },
      skipReasons: [],
    },
  };
}
