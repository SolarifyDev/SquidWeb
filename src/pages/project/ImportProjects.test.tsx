import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as importApi from 'pages/apis/octopusImport';
import {
  OctopusHistoryFetchPhase,
  OctopusImportChoiceReason,
  OctopusImportCompatibilitySeverity,
  OctopusImportConfirmationFailureReason,
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
  type OctopusImportProjectList,
  type OctopusImportSession,
} from 'pages/apis/octopusImport';
import ImportProjects from './ImportProjects';
import { SESSION_MAX_AGE_REACHED } from './importPreviewSummary';

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
    listOctopusServerProjects: vi.fn(),
    getOctopusImportProjects: vi.fn(),
    selectOctopusImportProjects: vi.fn(),
  };
});

// The callbacks the page hands the memoised preview panels, render by render (the panels themselves render unchanged).
const previewCallbacks = vi.hoisted(() => ({ changeProjects: [] as unknown[], fillFromFile: [] as unknown[] }));

vi.mock('./ImportPreviewDetails', async importOriginal => {
  const actual = await importOriginal<typeof import('./ImportPreviewDetails')>();
  const { createElement } = await import('react');
  type OverviewProps = React.ComponentProps<typeof actual.ImportPreviewOverview>;
  type WithheldProps = React.ComponentProps<typeof actual.WithheldSecretsPanel>;
  return {
    ...actual,
    ImportPreviewOverview: (props: OverviewProps) => {
      previewCallbacks.changeProjects.push(props.onChangeProjects);
      return createElement(actual.ImportPreviewOverview, props);
    },
    WithheldSecretsPanel: (props: WithheldProps) => {
      previewCallbacks.fillFromFile.push(props.onFillFromFile);
      return createElement(actual.WithheldSecretsPanel, props);
    },
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

// The Connect step's header names the Octopus version once connected.
const CONNECTED = 'Octopus 2024.1';

// The step a section is in: done, current, error or future.
const sectionStatus = (id: string) => screen.getByTestId(`import-section-${id}`).getAttribute('data-status');

// The page shows exactly one accent button: the next step.
const primaryButtons = () => Array.from(document.querySelectorAll('button.ant-btn-primary')).map(button => button.textContent);

// The read button names how many projects are chosen ("Read 2 chosen projects from Octopus").
const READ_FROM_OCTOPUS = /^Read \d+ chosen projects? from Octopus$/;

const projectList = (selectedProjectIds: string[] | null = null): OctopusImportProjectList => ({
  groups: [{ id: 'ProjectGroups-1', name: 'Web apps' }, { id: 'ProjectGroups-2', name: 'Services' }],
  projects: [
    { id: 'Projects-1', name: 'Web', projectGroupId: 'ProjectGroups-1', isDisabled: false, previouslyImported: true },
    { id: 'Projects-2', name: 'Api', projectGroupId: 'ProjectGroups-2', isDisabled: false, previouslyImported: false },
    { id: 'Projects-3', name: 'Worker', projectGroupId: 'ProjectGroups-2', isDisabled: true, previouslyImported: false },
  ],
  selectedProjectIds,
});

const connectAndList = async () => {
  fireEvent.click(screen.getByLabelText('Octopus server'));
  fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByText(CONNECTED);
  return screen.findByTestId('project-picker');
};

// Connects and chooses every listed project, so "Read" is enabled.
const connectToServer = async () => {
  const picker = await connectAndList();
  fireEvent.click(within(picker).getByRole('button', { name: 'Select all' }));
};

const projectCheckbox = (name: string) => screen.getByRole('checkbox', { name });

// antd keeps the leaving "loading" icon in the button's name after a request in jsdom.
const IMPORT_AFTER_LOADING = /^(loading )?Import$/;

const statusIs = (state: OctopusImportSessionState) => ok({ session: session(state), blockerSummary: noBlockers });

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
    api.listOctopusServerProjects.mockResolvedValue(ok(projectList()));
    api.getOctopusImportProjects.mockResolvedValue(ok(projectList()));
    api.selectOctopusImportProjects.mockResolvedValue(ok(session(OctopusImportSessionState.Uploaded)));
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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
    expect(screen.getByTestId('import-tile-notChosen')).toHaveTextContent('0');
    expect(within(screen.getByTestId('preview-projects')).getAllByRole('columnheader').map(header => header.textContent).filter(Boolean))
      .toEqual(['Octopus project', 'Lands on', 'Create', 'Skip']);

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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await waitFor(() => expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(1));
    await advance(1000);
    await advance(3000);
    await advance(8000);

    await screen.findByText('Bad gateway.');
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(4);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeEnabled();
  });

  // The stopped read stays on its session: another server only disables Resume, and switching back resumes it.
  it('keepsTheStoppedRead_ButDisablesResume_AndDropsTheError_WhenTheServerUrlChangesAfterTheFailure', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(502, 'Bad gateway.'));
    api.fetchOctopusImportHistory.mockResolvedValue(failure(502, 'Bad gateway.'));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    for (let i = 0; i < 4 && !screen.queryByText('Bad gateway.'); i++) await advance(8000);
    await screen.findByText('Bad gateway.');
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://other.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    await screen.findByText(CONNECTED);

    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();
    expect(screen.getByTestId('resume-notice')).toHaveTextContent('This read belongs to https://octopus.example.com (Spaces-1)');
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await screen.findByText(/Reading from Octopus cancelled/);
    expect(chunkSignal?.aborted).toBe(true);
    expect(api.extractOctopusImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));
    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    // The resumed read keeps the selection already on its session.
    expect(api.selectOctopusImportProjects).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 4 && !screen.queryByText('Release Releases-1 could not be written.'); i++) await advance(15000);

    await screen.findByText('Release Releases-1 could not be written.');
    expect(screen.queryByText('Import did not return a final session state.')).not.toBeInTheDocument();
    expect(api.getOctopusImportStatus).toHaveBeenCalledTimes(2);
  });

  // A rolled-back import leaves the session Validated with the reason: polling stops at once, the reason shows, and "Import again"
  // validates and confirms the same plan again without reading from Octopus again.
  it('rolledBackImport_StopsPolling_ShowsTheReason_AndImportAgainConfirmsTheSamePlan', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const rolledBack = {
      ...session(OctopusImportSessionState.Validated),
      lastConfirmationFailure: { attemptId: 'attempt-1', reason: OctopusImportConfirmationFailureReason.RolledBack, transient: false, attempts: 1, diagnostics: [{ message: 'Project Web could not be written.' }] },
    } as OctopusImportSession;
    api.getOctopusImportStatus.mockReset();
    api.getOctopusImportStatus.mockResolvedValueOnce(ok({ session: rolledBack, blockerSummary: noBlockers }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 4 && !screen.queryByText('Project Web could not be written.'); i++) await advance(15000);

    await screen.findByText('Project Web could not be written.');
    expect(api.getOctopusImportStatus).toHaveBeenCalledTimes(1);
    const fetchesBefore = api.fetchOctopusImportHistory.mock.calls.length;

    api.validateOctopusImport.mockImplementation(async (_sessionId, _spaceId, plan) => ok({
      session: rolledBack,
      previewPlan: plan,
      validation: { requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    api.getOctopusImportStatus.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Succeeded), blockerSummary: noBlockers }));
    fireEvent.click(screen.getByRole('button', { name: 'Import again' }));
    for (let i = 0; i < 4 && !screen.queryByText('Project list'); i++) await advance(15000);

    await screen.findByText('Project list');
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(2);
    expect(api.fetchOctopusImportHistory.mock.calls.length).toBe(fetchesBefore);
  });

  // The failure the page saw before confirming is not this attempt's outcome: the page keeps following the import.
  it('aFailureSeenBeforeConfirming_DoesNotEndThePolling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const earlier = {
      ...session(OctopusImportSessionState.Validated),
      lastConfirmationFailure: { attemptId: 'attempt-old', reason: OctopusImportConfirmationFailureReason.Interrupted, transient: true, attempts: 1, diagnostics: [] },
    } as OctopusImportSession;
    api.previewOctopusImport.mockResolvedValue(ok({
      session: earlier,
      previewPlan: { generatedAt: '', resources: previewResources, requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    api.getOctopusImportStatus.mockReset();
    api.getOctopusImportStatus
      .mockResolvedValueOnce(ok({ session: earlier, blockerSummary: noBlockers }))
      .mockResolvedValueOnce(ok({ session: session(OctopusImportSessionState.Succeeded), blockerSummary: noBlockers }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    for (let i = 0; i < 6 && !screen.queryByText('Project list'); i++) await advance(15000);

    await screen.findByText('Project list');
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    // A text query: a role query walks the accessibility tree of the whole page on each of up to 60 iterations.
    for (let i = 0; i < 60 && !screen.queryByText('Check status'); i++) await advance(15000);

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

    expect(screen.queryByText(CONNECTED)).not.toBeInTheDocument();
    expect(sectionStatus('projects')).toBe('future');
    expect(screen.queryByRole('button', { name: READ_FROM_OCTOPUS })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect$/ })).toBeEnabled();
  });
  it('connectsOnEnter_AndExplainsTheKeyIsNotStored', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Octopus server'));
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });

    fireEvent.keyDown(screen.getByLabelText('API key'), { key: 'Enter', code: 'Enter', keyCode: 13 });

    await screen.findByText(CONNECTED);
    expect(api.probeOctopusServer).toHaveBeenCalledTimes(1);
    expect(screen.getByText('· never stored')).toBeInTheDocument();
    expect(screen.getByTestId('api-key-hint')).toHaveTextContent('Keep this tab open while reading');
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
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.queryByText(CONNECTED)).not.toBeInTheDocument();
    expect(sectionStatus('connect')).toBe('current');
    expect(screen.queryByRole('button', { name: READ_FROM_OCTOPUS })).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('server-import-sections')).not.toBeInTheDocument();
    expect(sectionStatus('file')).toBe('current');
    fireEvent.click(screen.getByLabelText('Octopus server'));
    expect(screen.queryByTestId('file-import-sections')).not.toBeInTheDocument();
    expect(sectionStatus('source')).toBe('done');
    expect(sectionStatus('connect')).toBe('current');
    expect(sectionStatus('projects')).toBe('future');
    await connectToServer();
    expect(sectionStatus('connect')).toBe('done');
    expect(screen.getByTestId('import-section-connect-summary')).toHaveTextContent('Octopus 2024.1');
    expect(sectionStatus('projects')).toBe('current');
    expect(screen.getByTestId('import-section-projects-summary')).toHaveTextContent('Default · 3 of 3 chosen');

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    const fetchProgress = await screen.findByTestId('history-fetch-progress');
    expect(fetchProgress).toHaveTextContent('Reading releases (project 2 of 2 chosen)');
    expect(fetchProgress).toHaveTextContent('4 releases, 6 deployments, 6 tasks, 5 details fetched, 1 unchanged');
    expect(sectionStatus('read')).toBe('current');
    expect(screen.getByTestId('import-section-read-summary')).toHaveTextContent('%');
    expect(sectionStatus('preview')).toBe('future');
    expect(screen.getByLabelText('Server URL')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('By project');
    expect(screen.getByTestId('fetch-tile-releases')).toHaveTextContent('3');
    expect(screen.getByTestId('fetch-tile-tasks')).toHaveTextContent('5');
    expect(screen.getByText(/1 project was not found in this Octopus space/).closest('.ant-alert'))
      .toHaveClass('ant-alert-warning');
    expect(screen.getByText(/1 task had logs too large to fetch/)).toBeInTheDocument();
    expect(sectionStatus('read')).toBe('done');
    expect(screen.getByTestId('import-section-read-summary')).toHaveTextContent(/^Done in \d+ s$/);
    expect(sectionStatus('preview')).toBe('current');
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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
    expect(screen.getByTestId('import-source-file')).toHaveTextContent('Configuration and secrets, no history');
    expect(screen.getByTestId('import-source-server')).toHaveTextContent('Configuration and history, secrets marked missing');
    expect(screen.getByTestId('import-source-details-file')).toHaveTextContent(/Cannot import:.*Deployment history/);
    expect(screen.getByTestId('import-source-details-server')).toHaveTextContent(/Imports:.*releases, deployments and task logs/);
    expect(screen.getByTestId('import-source-details-server')).toHaveTextContent(/Cannot import:.*Secret values/);
    expect(screen.getByText("Importing again never overwrites Squid; it only adds what's missing.")).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeEnabled();
    expect(screen.queryByLabelText('Server URL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Octopus server'));

    expect(screen.getByLabelText('Octopus server')).toBeChecked();
    expect(screen.getByLabelText('Export file')).not.toBeChecked();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Server URL')).toBeInTheDocument();
  });

  it('importsAnExportFile_WithoutEverTouchingTheServer', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();

    await pickFileAndPreview();

    await screen.findByText('By project');
    expect(api.uploadOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.connectOctopusImport).not.toHaveBeenCalled();
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
    expect(['source', 'file', 'read', 'projects'].map(sectionStatus)).toEqual(['done', 'done', 'done', 'done']);
    expect(sectionStatus('preview')).toBe('current');
    expect(screen.getByTestId('import-section-file-summary')).toHaveTextContent('export.zip');
    expect(screen.getByTestId('import-section-read-summary')).toHaveTextContent('1 document read');
    expect(screen.getByTestId('import-section-projects-summary')).toHaveTextContent('3 of 3 chosen');
  });

  // ── Stale errors ───────────────────────────────────────────────────────────

  it('clearsThePreviousError_WhenTheSourceChanges', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Response too large.', 'TooLarge'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('Response too large.');

    fireEvent.click(screen.getByLabelText('Export file'));

    expect(screen.queryByText('Response too large.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-error')).not.toBeInTheDocument();
    expect(document.querySelector('[data-status="error"]')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('Response too large.');

    change();

    expect(screen.queryByText('Response too large.')).not.toBeInTheDocument();
  });

  it('clearsThePreviousError_WhenAnotherSpaceIsChosen', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(failure(400, 'Response too large.', 'TooLarge'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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

    chooseFile(new File(['zip2'], 'other.zip', { type: 'application/zip' }));

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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('The key cannot read: ProjectView (restricted).');
    expect(screen.getByTestId('workflow-hint')).toHaveTextContent(/dedicated read-only service account/);
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(sectionStatus('read')).toBe('error');
    expect(within(screen.getByTestId('import-section-read')).getByTestId('workflow-error')).toHaveTextContent('The key cannot read');
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText(`Failed: ${kind}.`);

    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-NEW' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    await screen.findByText(CONNECTED);
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('Cannot continue.');

    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start again' })).not.toBeInTheDocument();
  });

  it('hidesResume_WhenExtractionFailsAfterTheReadCompleted', async () => {
    api.extractOctopusImport.mockResolvedValueOnce({ code: 400, msg: 'Extraction broke.', data: null, errorKind: null });
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('Extraction broke.');
    expect(screen.queryByRole('button', { name: 'Resume fetch' })).not.toBeInTheDocument();
    expect(sectionStatus('preview')).toBe('error');
    expect(within(screen.getByTestId('import-section-preview')).getByTestId('workflow-error')).toHaveTextContent('Extraction broke.');
  });

  // A step after a long read fails for a passing reason: "Try again" redoes only that step on the same session, never the read.
  it.each([
    ['extract envelope', 'extract', 'envelope'],
    ['extract thrown', 'extract', 'thrown'],
    ['preview envelope', 'preview', 'envelope'],
    ['preview thrown', 'preview', 'thrown'],
  ])('retriesOnlyTheFailedStepAfterTheRead_WhenExtractOrPreviewFails %s', async (_name, step, mode) => {
    const target = step === 'extract' ? api.extractOctopusImport : api.previewOctopusImport;
    api.getOctopusImportStatus.mockResolvedValue(statusIs(step === 'extract' ? OctopusImportSessionState.Uploaded : OctopusImportSessionState.Extracted));
    if (mode === 'thrown') target.mockRejectedValueOnce(new Error('Network dropped.'));
    else target.mockResolvedValueOnce({ code: 500, msg: 'Network dropped.', data: null, errorKind: null });
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('Extraction produced blocking diagnostics.');

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it.each([
    [{ phaseItemsDone: 1200, phaseItemsTotal: 5431 }, 'Reading deployments (project 1 of 1 chosen): 1,200 of 5,431', '51%'],
    [{}, 'Reading deployments (project 1 of 1 chosen)', '39%'],
  ])('showsHowManyItemsOfThePhaseAreRead_WhenTheServerReportsATotal %#', async (totals, label, percent) => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok({ ...progress(0, false), projectCount: 1, ...totals }))
      .mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    const fetchProgress = await screen.findByTestId('history-fetch-progress');
    expect(fetchProgress.querySelector('.font-medium')).toHaveTextContent(new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`));
    expect(document.querySelector('.ant-progress-text')).toHaveTextContent(percent);
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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    const fetchProgress = await screen.findByTestId('history-fetch-progress');
    expect(fetchProgress).toHaveTextContent('Reading space configuration (kind 3 of 12)');
    expect(fetchProgress).toHaveTextContent('40 configuration documents');
  });

  // ── Incremental preview ────────────────────────────────────────────────────

  it('showsWhereEachProjectLands_TheFieldChanges_AndTheSkipReasons', async () => {
    mockPreview(incrementalPlan());
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByTestId('preview-up-to-date');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('listsSecretsTheApiWithholds_AndFillFromExportFileSwitchesToTheFile', async () => {
    mockPreview(incrementalPlan());
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

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

    await pickFileAndPreview();

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
    await pickFileAndPreview();

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

  // ── Choices (deleted in Squid, added in Octopus since) ─────────────────────

  it('showsNoChoicesPanel_ForAPlanWithoutChoices', async () => {
    mockPreview(incrementalPlan());
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByTestId('preview-projects');
    expect(screen.queryByTestId('preview-choices')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('tickingAChoice_AsksToUpdateThePreview_WhichValidatesWithTheSelection_AndNeverConfirms', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(choicesPlan());
    api.validateOctopusImport.mockImplementationOnce(async (_sessionId, _spaceId, posted) => ok({
      session: session(OctopusImportSessionState.Validated),
      previewPlan: replannedChoices(posted),
      validation: { requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await pickFileAndPreview();

    const deleted = await screen.findByTestId('choices-deleted');
    expect(screen.getByTestId('preview-up-to-date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

    fireEvent.click(within(deleted).getAllByRole('checkbox')[1]);

    expect(await screen.findByTestId('choices-pending')).toBeInTheDocument();
    const update = screen.getByRole('button', { name: 'Update preview' });
    expect(update).toBeEnabled();
    expect(screen.getByTestId('summary-tile-create')).toHaveTextContent('0');

    fireEvent.click(update);

    await waitFor(() => expect(screen.getByTestId('summary-tile-create')).toHaveTextContent('1'));
    const posted = api.validateOctopusImport.mock.calls[0][2];
    expect(posted.resources.find(item => item.sourceId === 'Steps-2')?.choice?.selected).toBe(true);
    expect(posted.resources.find(item => item.sourceId === 'Steps-7')?.choice?.selected).toBe(false);
    expect(api.confirmOctopusImport).not.toHaveBeenCalled();
    expect(screen.queryByTestId('choices-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-up-to-date')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('choices-deleted')).getAllByRole('checkbox')[1]).toBeChecked();
    expect(screen.getByRole('button', { name: IMPORT_AFTER_LOADING })).toBeEnabled();
  });

  it('importAfterUpdatingThePreview_ValidatesAndConfirmsWithTheSelection', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(choicesPlan());
    api.validateOctopusImport.mockImplementation(async (_sessionId, _spaceId, posted) => ok({
      session: session(OctopusImportSessionState.Validated),
      previewPlan: replannedChoices(posted),
      validation: { requiredInputs: [], diagnostics: [], hasBlockers: false },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await pickFileAndPreview();

    fireEvent.click(within(await screen.findByTestId('choices-added')).getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Update preview' }));
    fireEvent.click(await screen.findByRole('button', { name: IMPORT_AFTER_LOADING }));

    await screen.findByText('Project list', {}, { timeout: 4000 });
    expect(api.validateOctopusImport).toHaveBeenCalledTimes(2);
    const posted = api.validateOctopusImport.mock.calls[1][2];
    expect(posted.resources.find(item => item.sourceId === 'Steps-7')?.choice?.selected).toBe(true);
    expect(posted.resources.find(item => item.sourceId === 'Steps-2')?.choice?.selected).toBe(false);
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('untickingBack_ReturnsToImport_WithoutAskingForAnUpdate', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(choicesPlan());
    renderPage();
    await pickFileAndPreview();

    const box = () => within(screen.getByTestId('choices-deleted')).getAllByRole('checkbox')[1];
    fireEvent.click(within(await screen.findByTestId('choices-deleted')).getAllByRole('checkbox')[1]);
    await screen.findByRole('button', { name: 'Update preview' });
    fireEvent.click(box());

    await waitFor(() => expect(screen.queryByTestId('choices-pending')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(api.validateOctopusImport).not.toHaveBeenCalled();
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
    await pickFileAndPreview();

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
    await pickFileAndPreview();

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
      await pickFileAndPreview();
      return;
    }
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
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

  it.each(['server', 'file'] as const)('%s_refusedOverAThirdOriginsRows_NamesWhoCreatedThem', async source => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(originPlan({ ...refusedOrigin, basis: 'other-origin-rows', creators: ['Octopus installation inst-z (server octopus-z.example.com, space Spaces-3)'], moreCreators: 0 }, {
      hasBlockers: true,
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Blocker, code: 'octopus.preview.import_origin_unproven', message: 'Refused.' }],
    }));
    renderPage();
    await reachPreview(source);

    const notice = await screen.findByTestId('import-origin-notice');
    expect(notice).toHaveTextContent('This import would link to resources another Octopus source created in this space');
    expect(notice).toHaveTextContent('This source: Octopus installation inst-x (server octopus-x.example.com, space Spaces-2)');
    expect(notice).toHaveTextContent('This space was imported from: an export file with fingerprint ABC123');
    expect(notice).toHaveTextContent('Resources it would link to were created by: Octopus installation inst-z (server octopus-z.example.com, space Spaces-3)');
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

  // An export file whose fingerprint the space does not know: with no process id in common it is refused, naming both fingerprints;
  // with matching ones it asks the file pairing (both fingerprints shown) and posts the confirmation.
  const fileFingerprintOrigin: OctopusImportOriginEvidence = {
    state: OctopusImportFillEvidenceState.Unproven, basis: 'export-fingerprint-mismatch', matchingStructureIds: 0,
    source: 'an export file with fingerprint FFF000', recorded: 'an export file with fingerprint ABC123',
  };

  it('file_unknownFingerprint_NoProcessIdInCommon_RefusedNamingBothFingerprints', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(originPlan(fileFingerprintOrigin, {
      hasBlockers: true,
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Blocker, code: 'octopus.preview.import_origin_unproven', message: 'Refused.' }],
    }));
    renderPage();
    await pickFileAndPreview();

    const notice = await screen.findByTestId('import-origin-notice');
    expect(notice).toHaveTextContent("This export file's fingerprint is not one this space was imported from");
    expect(notice).toHaveTextContent('This source: an export file with fingerprint FFF000');
    expect(notice).toHaveTextContent('This space was imported from: an export file with fingerprint ABC123');
    expect(notice).toHaveTextContent('Nothing will be linked or written');
    expect(screen.queryByTestId('fill-pairing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('file_unknownFingerprint_MatchingProcessIds_AsksTheFilePairing_AndPostsIt', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    const pairing = fillPlan(true).fillPairing!;
    mockPreview(originPlan({ ...fileFingerprintOrigin, state: OctopusImportFillEvidenceState.PairingRequired, matchingStructureIds: 2 }, {
      diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Warning, code: 'octopus.preview.import_origin_pairing_required', message: 'Confirm.' }],
      fillPairing: { ...pairing, installationId: null, serverHost: null, sourceInstallationId: null, fileExportSourceId: 'FFF000', recordedExportSourceId: 'ABC123', matchingStructureIds: 2 },
    }));
    renderPage();
    await pickFileAndPreview();

    const card = await screen.findByTestId('fill-pairing');
    expect(card).toHaveTextContent('Confirm where this export file comes from');
    expect(card).toHaveTextContent('This export file would link to what an earlier import created in this space');
    expect(card).toHaveTextContent('Export file fingerprint: FFF000');
    expect(card).toHaveTextContent('Export file fingerprint: ABC123');
    expect(card).toHaveTextContent('2 matching step, action or phase ids');
    expect(screen.queryByTestId('import-origin-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

    fireEvent.click(within(card).getByRole('checkbox', { name: 'This export file comes from the same Octopus server this space was imported from' }));
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
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const missing = await screen.findByTestId('missing-secrets-after-import', {}, { timeout: 4000 });
    expect(within(missing).getByRole('link', { name: 'Db.Password' })).toHaveAttribute('href', '/Spaces-1/projects/Web/variables');
    expect(screen.queryByText('Project list')).not.toBeInTheDocument();

    expect(missing).toHaveTextContent('Import completed; 1 secret value is still missing: Db.Password.');
    expect(sectionStatus('preview')).toBe('done');
    expect(screen.getByTestId('import-section-preview-summary')).toHaveTextContent('Imported');
    expect(primaryButtons()).toEqual(['Go to projects']);
    expect(screen.getByRole('button', { name: 'Import more projects' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Go to projects' }));
    await screen.findByText('Project list');
  });
  // ── Layout: one accent button per view, blockers in sight ──────────────────

  it('server_showsExactlyOnePrimaryButton_TheNextStep_AtEachStage', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Octopus server'));
    expect(primaryButtons()).toEqual(['Connect']);

    await connectToServer();
    expect(primaryButtons()).toEqual(['Read 3 chosen projects from Octopus']);

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    expect(primaryButtons()).toEqual(['Import']);
    expect(within(screen.getByTestId('import-section-preview')).getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('file_showsExactlyOnePrimaryButton_TheNextStep_AtEachStage', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(choicesPlan());
    renderPage();
    expect(primaryButtons()).toEqual(['Read file']);

    await pickFile();
    await screen.findByTestId('session-project-choice');
    expect(primaryButtons()).toEqual(['Preview import']);

    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    const deleted = await screen.findByTestId('choices-deleted');
    expect(primaryButtons()).toEqual(['Import']);

    fireEvent.click(within(deleted).getAllByRole('checkbox')[1]);
    await screen.findByRole('button', { name: 'Update preview' });
    expect(primaryButtons()).toEqual(['Update preview']);
  });

  it('putsTheReadResultInOneMetricStrip_TheOtherCountsBehindDetails', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory.mockResolvedValueOnce(ok({
      ...progress(2, true),
      counts: {
        releases: 3, deployments: 5, serverTasks: 7, detailsFetched: 4, detailsSkipped: 1, detailsTooLarge: 0, projectsNotFound: 0,
        configurationDocuments: 12, secretsWithheld: 2,
      },
    }));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('By project');
    const summary = screen.getByTestId('history-fetch-summary');
    expect(['configuration', 'releases', 'deployments', 'secretsWithheld'].map(id => within(summary).getByTestId(`fetch-tile-${id}`).textContent))
      .toEqual(['Configuration12', 'Releases3', 'Deployments5', 'Secrets withheld2']);
    const details = within(summary).getByTestId('fetch-tile-details');
    expect(['tasks', 'detailsFetched', 'unchanged'].map(id => within(details).getByTestId(`fetch-tile-${id}`).textContent))
      .toEqual(['Tasks7', 'Details fetched4', 'Unchanged1']);
  });

  it('showsTheWorkflowErrorInTheStepThatFailed_WithOneAction', async () => {
    api.previewOctopusImport.mockResolvedValueOnce({ code: 503, msg: 'Preview unavailable.', data: null, errorKind: null });
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    const error = await screen.findByTestId('workflow-error');
    expect(screen.getByTestId('import-section-preview')).toContainElement(error);
    expect(error).toHaveTextContent('Preview unavailable.');
    expect(within(error).getAllByRole('button').map(button => button.textContent)).toEqual(['Try again']);
    expect(screen.getByTestId('import-section-preview-summary')).toHaveTextContent('Failed');
  });

  it('keepsTheBlockersInSight_UnderTheirLine', async () => {
    const blockers = {
      hasBlockers: true, blockerCount: 2, affectedResourceCount: 1,
      blockingReasons: [{ code: 'octopus.blocked', message: 'A step uses an unsupported action.', occurrenceCount: 2, affectedResourceCount: 1 }],
    };
    api.previewOctopusImport.mockResolvedValue(ok({
      session: session(OctopusImportSessionState.Previewed),
      previewPlan: { generatedAt: '', resources: previewResources, requiredInputs: [], diagnostics: [], hasBlockers: true },
      blockerSummary: blockers,
    }));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    const summary = await screen.findByTestId('blocker-summary');
    expect(summary).toHaveTextContent('2 blocking issues across 1 resource: the import cannot continue.');
    expect(within(summary).getByText('A step uses an unsupported action.')).toBeVisible();
    expect(summary.querySelector('details')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(screen.getByTestId('import-section-preview-summary')).toHaveTextContent('Blocked');
  });

  it('importMoreProjects_AfterTheImport_StartsAgainWithTheSameConnection', async () => {
    api.getOctopusImportStatus.mockResolvedValue(ok({
      session: {
        ...session(OctopusImportSessionState.Succeeded),
        result: {
          succeeded: true, completedAt: '', resources: [], idMappings: [], diagnostics: [],
          missingSensitiveValues: [{
            kind: OctopusImportRequiredInputKind.FeedPassword, name: 'ACR', ownerName: null, ownerKind: null,
            field: 'Password', scopeSummary: null, destinationId: 9, destinationOwnerId: null, fillable: true,
          }],
        },
      },
      blockerSummary: noBlockers,
    }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByTestId('missing-secrets-after-import', {}, { timeout: 4000 });

    fireEvent.click(screen.getByRole('button', { name: 'Import more projects' }));

    expect(screen.queryByTestId('missing-secrets-after-import')).not.toBeInTheDocument();
    expect(screen.queryByText('By project')).not.toBeInTheDocument();
    expect(sectionStatus('projects')).toBe('current');
    expect(primaryButtons()).toEqual(['Read 3 chosen projects from Octopus']);
  });

  // ── Project selection ──────────────────────────────────────────────────────

  it('server_listsTheSpacesProjectsAfterConnect_ReadIsDisabledUntilOneIsChosen', async () => {
    renderPage();

    const picker = await connectAndList();

    expect(api.listOctopusServerProjects).toHaveBeenCalledWith({ serverUrl: 'https://octopus.example.com', apiKey: 'API-SECRET' }, 'Spaces-1', 1);
    expect(within(picker).getByTestId('project-picker-count')).toHaveTextContent('0 of 3 projects chosen');
    expect(within(screen.getByTestId('picker-project-Projects-1')).getByText('Imported before')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeDisabled();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toHaveTextContent('Read 0 chosen projects from Octopus');

    fireEvent.click(projectCheckbox('Api'));

    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeEnabled();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toHaveTextContent('Read 1 chosen project from Octopus');
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
  });

  it('server_connectsThenStoresTheChoiceThenReads_InThatOrder', async () => {
    renderPage();
    await connectAndList();
    fireEvent.click(projectCheckbox('Api'));
    fireEvent.click(projectCheckbox('Web'));

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).toHaveBeenCalledWith('session-1', 1, ['Projects-2', 'Projects-1'], expect.anything());
    const [connected] = api.connectOctopusImport.mock.invocationCallOrder;
    const [selected] = api.selectOctopusImportProjects.mock.invocationCallOrder;
    const [fetched] = api.fetchOctopusImportHistory.mock.invocationCallOrder;
    expect(connected).toBeLessThan(selected);
    expect(selected).toBeLessThan(fetched);
    expect(api.getOctopusImportProjects).not.toHaveBeenCalled();
  });

  it('server_refusedSelection_ShowsTheReason_AndReadsNothing', async () => {
    api.selectOctopusImportProjects.mockResolvedValueOnce(failure(400, 'Choose at least one project.', 'ProjectSelection'));
    renderPage();
    await connectToServer();

    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('Choose at least one project.');
    expect(screen.getByTestId('workflow-hint')).toHaveTextContent(/at least one project/);
    expect(api.fetchOctopusImportHistory).not.toHaveBeenCalled();
  });

  // Resume reads the choice stored on the stopped session: another choice disables it, and "Read" starts again with the new choice.
  it('server_choiceChangedAfterAFailedRead_DisablesTheResume_ReadsTheNewChoiceOnANewSession', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(400, 'The Octopus server could not be reached.', 'Unreachable'))
      .mockResolvedValue(ok(progress(1, true)));
    renderPage();
    await connectAndList();
    fireEvent.click(projectCheckbox('Api'));
    fireEvent.click(projectCheckbox('Web'));
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('The Octopus server could not be reached.');
    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeEnabled();

    fireEvent.click(projectCheckbox('Web'));

    expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();
    expect(screen.getByTestId('resume-notice')).toHaveTextContent('This read reads 2 projects chosen before');
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(2);
    expect(api.selectOctopusImportProjects).toHaveBeenLastCalledWith('session-1', 1, ['Projects-2'], expect.anything());
  });

  // Connecting again (a new key) lists the projects again: the picker shows the choice the resume reads, not an empty one.
  it('server_reconnectAfterAFailedRead_ThePickerShowsTheChoiceTheResumeReads', async () => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(failure(401, 'The Octopus server rejected the API key.', 'Unauthorized'))
      .mockResolvedValue(ok(progress(1, true)));
    renderPage();
    await connectAndList();
    fireEvent.click(projectCheckbox('Api'));
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('The Octopus server rejected the API key.');

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
    const picker = await screen.findByTestId('project-picker');
    await waitFor(() => expect(within(picker).getByTestId('project-picker-count')).toHaveTextContent('1 of 3 projects chosen'));
    expect(projectCheckbox('Api')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));
    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('server_anotherSpace_ListsItsProjects_AndClearsTheChoice', async () => {
    renderPage();
    await connectToServer();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeEnabled();

    fireEvent.mouseDown(screen.getByLabelText(/Octopus space/));
    fireEvent.click(await screen.findByText('Other'));

    await waitFor(() => expect(api.listOctopusServerProjects).toHaveBeenLastCalledWith(expect.anything(), 'Spaces-2', 1));
    await screen.findByTestId('project-picker');
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeDisabled();
  });

  it('server_listingFails_ShowsTheReason_AndTryAgainListsAgain', async () => {
    api.listOctopusServerProjects.mockResolvedValueOnce(failure(400, 'Could not list.', 'Rejected'));
    renderPage();
    fireEvent.click(screen.getByLabelText('Octopus server'));
    fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'API-SECRET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await screen.findByText('Could not list.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByTestId('project-picker');
    expect(api.listOctopusServerProjects).toHaveBeenCalledTimes(2);
  });

  it('file_choosesProjectsAfterReading_EveryProjectTicked_AnUntouchedPickerSendsNoSelection', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();
    await pickFile();

    const choice = await screen.findByTestId('session-project-choice');

    expect(within(choice).getByTestId('project-picker-count')).toHaveTextContent('3 of 3 projects chosen');
    expect(sectionStatus('projects')).toBe('current');
    expect(primaryButtons()).toEqual(['Preview import']);
    expect(api.previewOctopusImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).not.toHaveBeenCalled();
    expect(api.previewOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('file_unticking_SendsTheChosenIds_BeforeThePreview', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();
    await pickFile();
    await screen.findByTestId('session-project-choice');

    fireEvent.click(projectCheckbox('Api'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).toHaveBeenCalledWith('session-1', 1, ['Projects-1', 'Projects-3'], expect.anything());
    expect(api.selectOctopusImportProjects.mock.invocationCallOrder[0]).toBeLessThan(api.previewOctopusImport.mock.invocationCallOrder[0]);
  });

  it('file_everyProjectTickedAfterAnEarlierChoice_SendsTheWholeSpace', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.getOctopusImportProjects.mockResolvedValue(ok(projectList(['Projects-1'])));
    renderPage();
    await pickFile();
    const choice = await screen.findByTestId('session-project-choice');
    expect(within(choice).getByTestId('project-picker-count')).toHaveTextContent('1 of 3 projects chosen');

    fireEvent.click(within(choice).getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).toHaveBeenCalledWith('session-1', 1, null, expect.anything());
  });

  it('file_withAConfigAsCodeProject_UntouchedPicker_SendsTheImportableProjects', async () => {
    const list = projectList();
    list.projects[1] = { ...list.projects[1], isConfigAsCode: true };
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.getOctopusImportProjects.mockResolvedValue(ok(list));
    renderPage();
    await pickFile();
    await screen.findByTestId('session-project-choice');

    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).toHaveBeenCalledWith('session-1', 1, ['Projects-1', 'Projects-3'], expect.anything());
  });

  it('file_everyProjectConfigAsCode_PreviewsTheWholeFile', async () => {
    const list = projectList();
    list.projects = list.projects.map((item) => ({ ...item, isConfigAsCode: true }));
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.getOctopusImportProjects.mockResolvedValue(ok(list));
    renderPage();
    await pickFile();
    await screen.findByTestId('session-project-choice');

    expect(screen.getByRole('button', { name: 'Preview import' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByText('By project');
    expect(api.selectOctopusImportProjects).not.toHaveBeenCalled();
    expect(api.previewOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('file_previewIsDisabled_WithNothingChosen', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();
    await pickFile();
    const choice = await screen.findByTestId('session-project-choice');

    fireEvent.click(within(choice).getByRole('button', { name: 'Clear' }));

    expect(screen.getByRole('button', { name: 'Preview import' })).toBeDisabled();
  });

  it('file_listingFails_TryAgainListsAgain_OnTheSameSession', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.getOctopusImportProjects.mockResolvedValueOnce(failure(503, 'Busy.'));
    api.getOctopusImportStatus.mockResolvedValue(statusIs(OctopusImportSessionState.Extracted));
    renderPage();
    await pickFile();

    await screen.findByText('Busy.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByTestId('session-project-choice');
    expect(api.getOctopusImportProjects).toHaveBeenCalledTimes(2);
    expect(api.extractOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('file_changeProjectsAfterThePreview_ReopensThePicker_AndPreviewsTheNewChoice', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(incrementalPlan());
    renderPage();
    await pickFileAndPreview();
    await screen.findByTestId('preview-projects');

    fireEvent.click(screen.getByRole('button', { name: 'Change projects' }));
    await screen.findByTestId('session-project-choice');
    fireEvent.click(projectCheckbox('Worker'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await screen.findByTestId('preview-projects');
    expect(api.selectOctopusImportProjects).toHaveBeenCalledWith('session-1', 1, ['Projects-1', 'Projects-2'], expect.anything());
    expect(api.previewOctopusImport).toHaveBeenCalledTimes(2);
    expect(api.extractOctopusImport).toHaveBeenCalledTimes(1);
  });

  // The session lists only the projects the read read (the server never stages the others): the choice can only narrow, and the page
  // says that other projects need a new connection.
  it('server_changeProjects_ListsWhatWasRead_NarrowsIt_AndSaysOthersNeedAReconnect', async () => {
    const readSession = {
      ...session(OctopusImportSessionState.Previewed),
      sourceSummary: {
        fileName: '', contentType: '', sizeBytes: 0, detectedFormat: '', sha256: null,
        historyFetch: { ...historyFetch(), projectIds: ['Projects-1', 'Projects-2'] },
        selectedProjectIds: ['Projects-1', 'Projects-2'],
      },
    };
    const readList = projectList(['Projects-1', 'Projects-2']);
    api.previewOctopusImport.mockResolvedValue(ok({ session: readSession, previewPlan: incrementalPlan(), blockerSummary: noBlockers }));
    api.getOctopusImportProjects.mockResolvedValue(ok({ ...readList, projects: readList.projects.filter(project => project.id !== 'Projects-3') }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByTestId('preview-projects');

    fireEvent.click(screen.getByRole('button', { name: 'Change projects' }));
    const choice = await screen.findByTestId('session-project-choice');

    expect(within(choice).queryByRole('checkbox', { name: 'Worker' })).not.toBeInTheDocument();
    expect(within(choice).getByText('To add other projects, connect again.')).toBeInTheDocument();
    expect(within(choice).getByTestId('project-picker-count')).toHaveTextContent('2 of 2 projects chosen');

    fireEvent.click(projectCheckbox('Api'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));

    await waitFor(() => expect(api.selectOctopusImportProjects).toHaveBeenLastCalledWith('session-1', 1, ['Projects-1'], expect.anything()));
    await waitFor(() => expect(api.previewOctopusImport).toHaveBeenCalledTimes(2));
    expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
  });

  // ── Lost answers: the session's state decides what "Try again" and "Check status" do ─────

  // The page picks the option of a space in the open Select (the selected value shows the same name).
  const pickSpace = async (name: string) => {
    fireEvent.mouseDown(screen.getByLabelText(/Octopus space/));
    const options = await screen.findAllByText(name);
    fireEvent.click(options.find(option => option.closest('.ant-select-item-option'))!);
  };

  it.each([['thrown', 'timeout of 60000ms exceeded'], ['conflict', 'The session is no longer Uploaded.']])(
    'server_extractCommittedButItsAnswerWasLost_TryAgainContinuesFromTheSessionState_NeverExtractsAgain %s',
    async (mode, text) => {
      if (mode === 'thrown') api.extractOctopusImport.mockRejectedValueOnce(new Error(text));
      else api.extractOctopusImport.mockResolvedValueOnce(failure(409, text, 'SessionStateConflict'));
      api.getOctopusImportStatus.mockResolvedValue(statusIs(OctopusImportSessionState.Extracted));
      renderPage();
      await connectToServer();
      fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
      await screen.findByText(text);

      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

      await screen.findByText('By project');
      expect(api.extractOctopusImport).toHaveBeenCalledTimes(1);
      expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
      expect(api.fetchOctopusImportHistory).toHaveBeenCalledTimes(3);
    },
  );

  it('file_extractAnswerLost_TryAgainOpensTheProjectChoice_WithoutUploadingOrExtractingAgain', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.extractOctopusImport.mockRejectedValueOnce(new Error('timeout of 60000ms exceeded'));
    api.getOctopusImportStatus.mockResolvedValue(statusIs(OctopusImportSessionState.Extracted));
    renderPage();
    await pickFile();
    await screen.findByText('timeout of 60000ms exceeded');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByRole('button', { name: 'Preview import' });
    expect(api.extractOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.uploadOctopusImport).toHaveBeenCalledTimes(1);
  });

  it.each([['file'], ['server']])('previewOfAnExpiredSession_TryAgainSaysItExpired_AndStartAgainBeginsANewSession %s', async source => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    api.previewOctopusImport.mockResolvedValueOnce(failure(409, 'The session is no longer Extracted.', 'SessionStateConflict'));
    api.getOctopusImportStatus.mockResolvedValue(statusIs(OctopusImportSessionState.Expired));
    renderPage();
    if (source === 'file') await pickFileAndPreview();
    else {
      await connectToServer();
      fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    }
    await screen.findByText('The session is no longer Extracted.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText(/The import session expired/);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    if (source === 'file') {
      await screen.findByRole('button', { name: 'Preview import' });
      expect(api.uploadOctopusImport).toHaveBeenCalledTimes(2);
    } else {
      await screen.findByText('By project');
      expect(api.connectOctopusImport).toHaveBeenCalledTimes(2);
    }
  });

  // A session closed for reaching its maximum age says so (from the server's reason), not the generic idle-expiry text.
  it.each([
    ['maxAgeReason', 'This import session reached its maximum age of 168 hours and was closed.'],
    ['noReason', 'The import session expired. Read from the Octopus server again.'],
  ])('expiredSession_%s_ShowsWhyItExpired', async (_, expected) => {
    const expired = session(OctopusImportSessionState.Expired);
    if (_ === 'maxAgeReason') expired.result = { diagnostics: [{ severity: 'Blocker', code: SESSION_MAX_AGE_REACHED, message: expected }] } as unknown as OctopusImportSession['result'];
    api.previewOctopusImport.mockResolvedValueOnce(failure(409, 'The session is no longer Extracted.', 'SessionStateConflict'));
    api.getOctopusImportStatus.mockResolvedValue(ok({ session: expired, blockerSummary: noBlockers }));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('The session is no longer Extracted.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText(expected);
    expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  });

  it('previewOfASessionTheServerNoLongerHas_OffersStartAgain_NotTryAgain', async () => {
    api.previewOctopusImport.mockResolvedValueOnce(failure(404, 'Import session not found.', 'SessionNotFound'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));

    await screen.findByText('Import session not found.');

    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled();
  });

  it('confirmAnswerLost_AfterTheServerStartedTheImport_FollowsIt_NeverValidatesAgain', async () => {
    api.confirmOctopusImport.mockRejectedValueOnce(new Error('Network Error'));
    api.getOctopusImportStatus.mockResolvedValueOnce(statusIs(OctopusImportSessionState.Importing));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Project list', {}, { timeout: 6000 });
    expect(api.validateOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('confirmRefused_BeforeTheImportStarted_StaysReady_AndTryAgainImports', async () => {
    api.confirmOctopusImport.mockResolvedValueOnce(failure(502, 'Bad gateway.'));
    api.getOctopusImportStatus.mockResolvedValueOnce(statusIs(OctopusImportSessionState.Validated));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await screen.findByText('Bad gateway.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByText('Project list', {}, { timeout: 6000 });
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(2);
  });

  it('confirmAnswerLost_AndTheStatusUnreadable_OffersCheckStatus_WithEveryServerInputDisabled', async () => {
    api.confirmOctopusImport.mockRejectedValueOnce(new Error('Network Error'));
    api.getOctopusImportStatus.mockResolvedValueOnce(failure(502, 'Bad gateway.'));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const checkStatus = await screen.findByRole('button', { name: 'Check status' });
    expect(screen.getByLabelText('Server URL')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeDisabled();

    fireEvent.click(checkStatus);

    await screen.findByText('Project list', {}, { timeout: 6000 });
    expect(api.validateOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.confirmOctopusImport).toHaveBeenCalledTimes(1);
  });

  it('checkStatus_OfAnImportThatNeverStarted_ReturnsToTheImport_InsteadOfPollingForTenMinutes', async () => {
    api.confirmOctopusImport.mockRejectedValueOnce(new Error('Network Error'));
    api.getOctopusImportStatus
      .mockResolvedValueOnce(failure(502, 'Bad gateway.'))
      .mockResolvedValueOnce(statusIs(OctopusImportSessionState.Validated));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Check status' }));

    await screen.findByRole('button', { name: 'Try again' });
    expect(api.getOctopusImportStatus).toHaveBeenCalledTimes(2);
  });

  it('disablesEveryServerInput_WhileTheImportIsConfirming', async () => {
    api.confirmOctopusImport.mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('By project');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(api.confirmOctopusImport).toHaveBeenCalled());

    expect(screen.getByLabelText('Server URL')).toBeDisabled();
    expect(screen.getByLabelText('API key')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(screen.getByRole('button', { name: READ_FROM_OCTOPUS })).toBeDisabled();
    expect(screen.getByLabelText(/Octopus space/).closest('.ant-select')).toHaveClass('ant-select-disabled');
    expect(screen.getByTestId('import-section-preview-summary')).toHaveTextContent('Importing…');
  });

  it.each([['another file'], ['no file']])('file_%s_WhileThePreviewIsShown_DropsThatPreview_SoItIsNeverImportedUnderAnotherName', async change => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    renderPage();
    await pickFileAndPreview();
    await screen.findByText('By project');

    if (change === 'another file') chooseFile(new File(['zip2'], 'other.zip', { type: 'application/zip' }));
    else fireEvent.click(screen.getByRole('button', { name: 'Remove selected zip file' }));

    expect(screen.queryByText('By project')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: IMPORT_AFTER_LOADING })).not.toBeInTheDocument();
  });

  // A momentary edit (one keystroke, a project unticked and ticked again, another space and back) never loses a stopped read.
  it.each([['url'], ['project'], ['space']])('server_aMomentaryEdit_KeepsTheStoppedRead_ResumableOnceTheInputsAreBack %s', async edit => {
    api.fetchOctopusImportHistory.mockReset();
    api.fetchOctopusImportHistory
      .mockResolvedValueOnce(ok(progress(0, false)))
      .mockResolvedValueOnce(failure(400, 'The Octopus server could not be reached.', 'Unreachable'))
      .mockResolvedValue(ok(progress(2, true)));
    renderPage();
    await connectToServer();
    fireEvent.click(screen.getByRole('button', { name: READ_FROM_OCTOPUS }));
    await screen.findByText('The Octopus server could not be reached.');

    if (edit === 'url') {
      fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.comx' } });
      fireEvent.change(screen.getByLabelText('Server URL'), { target: { value: 'https://octopus.example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Connect$/ }));
      await screen.findByText(CONNECTED);
    } else if (edit === 'project') {
      fireEvent.click(projectCheckbox('Web'));
      expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeDisabled();
      fireEvent.click(projectCheckbox('Web'));
    } else {
      await pickSpace('Other');
      await waitFor(() => expect(api.listOctopusServerProjects).toHaveBeenLastCalledWith(expect.anything(), 'Spaces-2', 1));
      await pickSpace('Default');
    }

    await waitFor(() => expect(screen.getByRole('button', { name: 'Resume fetch' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Resume fetch' }));
    await screen.findByText('By project');
    expect(api.connectOctopusImport).toHaveBeenCalledTimes(1);
    expect(api.fetchOctopusImportHistory).toHaveBeenLastCalledWith('session-1', 1, expect.anything(), 'Spaces-1', expect.anything());
  });

  // Stable callbacks keep React.memo effective: a render of the page that keeps the plan never re-renders the preview panels.
  it('handsThePreviewPanelsTheSameCallbacks_OnEveryRenderOfThePage', async () => {
    api.uploadOctopusImport.mockResolvedValue(ok({ session: session(OctopusImportSessionState.Uploaded), blockerSummary: noBlockers }));
    mockPreview(fillPlan(true));
    renderPage();
    await pickFileAndPreview();
    const pairing = await screen.findByTestId('fill-pairing');
    previewCallbacks.changeProjects.length = 0;
    previewCallbacks.fillFromFile.length = 0;

    fireEvent.click(within(pairing).getByRole('checkbox'));
    fireEvent.click(within(pairing).getByRole('checkbox'));

    expect(previewCallbacks.changeProjects.length).toBeGreaterThan(1);
    expect(new Set(previewCallbacks.changeProjects).size).toBe(1);
    expect(previewCallbacks.changeProjects[0]).toBeInstanceOf(Function);
    expect(new Set(previewCallbacks.fillFromFile).size).toBe(1);
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Picks the export file, then previews it with the picker untouched (every project ticked).
async function pickFileAndPreview() {
  await pickFile();
  fireEvent.click(await screen.findByRole('button', { name: 'Preview import' }));
}

function chooseFile(file: File) {
  fireEvent.change(document.getElementById('import-zip-file-input')!, { target: { files: [file] } });
}

function pickFile() {
  chooseFile(new File(['zip'], 'export.zip', { type: 'application/zip' }));
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  return waitFor(() => expect(screen.getByRole('button', { name: 'Read file' })).toBeEnabled(), { timeout: 2000 })
    .then(() => fireEvent.click(screen.getByRole('button', { name: 'Read file' })));
}

function historyFetch() {
  return {
    serverHost: 'octopus.example.com', octopusSpaceId: 'Spaces-1', installationId: 'install-1', octopusVersion: '2024.1', spaceless: false,
    projectIds: [] as string[], projectIndex: 2, phase: OctopusHistoryFetchPhase.Done, totalBytes: 0, done: true,
    counts: { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 },
  };
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

function choicesPlan(): OctopusImportPreviewPlan {
  const choice = (reason: OctopusImportChoiceReason, followsSourceId: string | null = null) => ({
    reason, selected: false, defaultSelected: false, followsSourceId, ownerName: "Deployment process of 'Web'",
  });
  return {
    generatedAt: '',
    resources: [
      { ...resource('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1'), sourceName: 'Web' },
      { ...resource('DeploymentStep', 'Steps-2', OctopusImportPreviewAction.Skip, 'Projects-1'), choice: choice(OctopusImportChoiceReason.DeletedInSquid) },
      { ...resource('DeploymentStep', 'Steps-7', OctopusImportPreviewAction.Skip, 'Projects-1'), choice: choice(OctopusImportChoiceReason.AddedInOctopus) },
      {
        ...resource('DeploymentAction', 'Actions-71', OctopusImportPreviewAction.Skip, 'Projects-1'),
        choice: choice(OctopusImportChoiceReason.AddedInOctopus, 'Steps-7'),
      },
    ],
    requiredInputs: [],
    diagnostics: [],
    hasBlockers: false,
    summary: {
      isUpToDate: true,
      counts: counts({ alreadyImported: 1, skip: 3 }),
      kinds: [],
      projects: [{
        sourceId: 'Projects-1', sourceName: 'Web', counts: counts({ alreadyImported: 1, skip: 3 }), isUpToDate: true, kinds: [],
        destination: { state: OctopusImportProjectDestinationState.Existing, projectId: 501, projectName: 'Web', projectSlug: null },
      }],
      space: { counts: counts(), kinds: [], isUpToDate: true },
      skipReasons: [],
      choices: [
        { reason: OctopusImportChoiceReason.DeletedInSquid, total: 1, selected: 0 },
        { reason: OctopusImportChoiceReason.AddedInOctopus, total: 1, selected: 0 },
      ],
    },
  };
}

// What the server returns for a posted selection: ticked roots (and their followers) are created; the counts follow.
function replannedChoices(posted: OctopusImportPreviewPlan): OctopusImportPreviewPlan {
  const selectedOf = (item: OctopusImportPreviewResource) =>
    posted.resources.find(root => root.sourceId === (item.choice?.followsSourceId ?? item.sourceId))?.choice?.selected ?? false;
  const resources = posted.resources.map(item => item.choice
    ? { ...item, previewAction: selectedOf(item) ? OctopusImportPreviewAction.Create : OctopusImportPreviewAction.Skip, choice: { ...item.choice, selected: selectedOf(item) } }
    : item);
  const created = resources.filter(item => item.previewAction === OctopusImportPreviewAction.Create).length;
  return {
    ...posted,
    resources,
    summary: { ...posted.summary!, isUpToDate: created === 0, counts: counts({ alreadyImported: 1, create: created, skip: 3 - created }) },
  };
}
