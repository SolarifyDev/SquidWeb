import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeployment, type DeploymentDto } from 'pages/apis/deployment';
import { getServerTaskDetails, getServerTaskInterruptions, type ServerTaskDetailsDto } from 'pages/apis/serverTask';
import DeploymentDetail from './DeploymentDetail';

vi.mock('pages/apis/deployment', () => ({ getDeployment: vi.fn() }));
vi.mock('pages/apis/project', () => ({ getProjects: vi.fn().mockResolvedValue({ projects: [] }) }));
vi.mock('pages/apis/environment', () => ({ getEnvironments: vi.fn().mockResolvedValue({ environments: [] }) }));
vi.mock('pages/apis/release', () => ({ getReleases: vi.fn().mockResolvedValue({ releases: [] }) }));
vi.mock('pages/apis/channel', () => ({ getChannels: vi.fn().mockResolvedValue({ channels: [] }) }));
vi.mock('pages/apis/lifecycle', () => ({ getLifecycles: vi.fn().mockResolvedValue({ lifecycles: [] }) }));
vi.mock('pages/apis/team', () => ({ getTeams: vi.fn().mockResolvedValue({ teams: [] }) }));
vi.mock('utils/auth', () => ({ getAuthUser: () => null }));
vi.mock('pages/apis/serverTask', async importOriginal => {
  const actual = await importOriginal<typeof import('pages/apis/serverTask')>();
  return {
    ...actual,
    cancelServerTask: vi.fn(),
    getServerTaskDetails: vi.fn(),
    getServerTaskInterruptions: vi.fn().mockResolvedValue({ interruptions: [] }),
    submitInterruption: vi.fn(),
    takeInterruptionResponsibility: vi.fn(),
  };
});

const POLL_INTERVAL_MS = 3000;

const details = (state: string, isImported: boolean): ServerTaskDetailsDto => ({
  task: {
    id: 42,
    name: 'Deploy',
    description: 'Deploy',
    state,
    hasPendingInterruptions: false,
    queueTime: '2026-01-01T00:00:00Z',
    startTime: '2026-01-01T00:00:00Z',
    completedTime: null,
    lastModified: '2026-01-01T00:00:00Z',
    errorMessage: null,
    hasWarningsOrErrors: false,
    spaceId: 1,
    projectId: 1,
    environmentId: 1,
    durationSeconds: 0,
    isImported,
  },
  activityLogs: [],
  physicalLogSize: 0,
} as unknown as ServerTaskDetailsDto);

const renderPage = () => render(
  <MemoryRouter initialEntries={['/Spaces-1/projects/app/releases/1.0.0/deployments/7']}>
    <Routes>
      <Route path="/:spaceId/projects/:projectName/releases/:version/deployments/:deploymentId" element={<DeploymentDetail />} />
    </Routes>
  </MemoryRouter>,
);

const pollIntervals = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(call => call[1] === POLL_INTERVAL_MS);

describe('DeploymentDetail', () => {
  let setIntervalSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    setIntervalSpy = vi.spyOn(window, 'setInterval');
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
  });

  it.each([
    // state, isImported, cancel shown, polls, loads interruptions
    ['Executing', false, true, true, false],
    ['Executing', true, false, false, false],
    ['Paused', false, true, true, true],
    ['Paused', true, false, false, false],
  ])('state=%s isImported=%s: cancel=%s polls=%s interruptions=%s', async (state, isImported, cancel, polls, interruptions) => {
    const task = details(state, isImported);
    vi.mocked(getDeployment).mockResolvedValue({
      deployment: { id: 7, taskId: 42, projectId: 1, releaseId: 1, environmentId: 1 } as unknown as DeploymentDto,
      taskDetails: task,
    });
    vi.mocked(getServerTaskDetails).mockResolvedValue(task);

    renderPage();

    await waitFor(() => expect(getServerTaskDetails).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Imported from Octopus (read-only)') !== null).toBe(isImported));

    expect(screen.queryByRole('button', { name: 'Cancel' }) !== null).toBe(cancel);
    expect(pollIntervals(setIntervalSpy).length > 0).toBe(polls);
    expect(vi.mocked(getServerTaskInterruptions).mock.calls.length > 0).toBe(interruptions);
  });
});
