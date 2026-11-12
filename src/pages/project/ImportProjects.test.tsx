import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('ImportProjects', () => {
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
});
