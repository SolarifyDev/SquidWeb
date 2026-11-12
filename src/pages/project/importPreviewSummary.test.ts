import { describe, expect, it } from 'vitest';
import {
  OctopusHistoryFetchPhase,
  OctopusImportPreviewAction,
  OctopusImportResourceOutcomeState,
  type OctopusImportPreviewPlan,
  type OctopusImportPreviewResource,
} from 'pages/apis/octopusImport';
import {
  fetchProgressPercent,
  isNothingNew,
  listedResources,
  summarizeActions,
  summarizeByProject,
  withoutHistoryRows,
} from './importPreviewSummary';

const resource = (
  sourceType: string,
  sourceId: string,
  previewAction: OctopusImportPreviewAction,
  ownerProjectSourceId: string | null = null,
  sourceName = sourceId,
): OctopusImportPreviewResource => ({
  sourceId,
  sourceType,
  sourceName,
  previewAction,
  outcomeState: OctopusImportResourceOutcomeState.Pending,
  destinationId: null,
  ownerProjectSourceId,
  requiredInputs: [],
  diagnostics: [],
});

const { Create, ReuseExisting, Skip, AlreadyImported, Update, Blocked } = OctopusImportPreviewAction;

describe('importPreviewSummary', () => {
  it('enumOrdinals_matchBackend', () => {
    // The backend serializes these enums as their ordinals; the values are append-only.
    expect(OctopusImportPreviewAction.AlreadyImported).toBe(6);
    expect(OctopusImportPreviewAction.Update).toBe(7);
    expect(OctopusImportResourceOutcomeState.Failed).toBe(6);
    expect(OctopusImportResourceOutcomeState.Updated).toBe(7);
    expect(OctopusHistoryFetchPhase.Done).toBe(2);
  });

  it('summarize_groupsByProjectAndAction', () => {
    const resources = [
      resource('Environment', 'Environments-1', ReuseExisting),
      resource('Project', 'Projects-2', Create, 'Projects-2', 'Zeta'),
      resource('Release', 'Releases-21', Create, 'Projects-2'),
      resource('Deployment', 'Deployments-21', Create, 'Projects-2'),
      resource('ServerTask', 'ServerTasks-21', Create, 'Projects-2'),
      resource('Project', 'Projects-1', AlreadyImported, 'Projects-1', 'Alpha'),
      resource('Channel', 'Channels-1', AlreadyImported, 'Projects-1'),
      resource('Release', 'Releases-11', AlreadyImported, 'Projects-1'),
      resource('Release', 'Releases-12', Update, 'Projects-1'),
      resource('Deployment', 'Deployments-11', Update, 'Projects-1'),
      resource('Deployment', 'Deployments-12', Skip, 'Projects-1'),
    ];

    const rows = summarizeByProject(resources);

    expect(rows.map(row => row.projectName)).toEqual(['Alpha', 'Zeta']);
    expect(rows[0]).toMatchObject({
      projectSourceId: 'Projects-1',
      counts: { create: 0, alreadyImported: 3, update: 2, skip: 1 },
      newReleases: 1,
      newDeployments: 1,
    });
    expect(rows[1]).toMatchObject({
      projectSourceId: 'Projects-2',
      counts: { create: 4, alreadyImported: 0, update: 0, skip: 0 },
      newReleases: 1,
      newDeployments: 1,
    });
    expect(summarizeActions(resources)).toEqual({
      create: 4, reuse: 1, alreadyImported: 3, update: 2, skip: 1, other: 0,
    });
  });

  it('summarize_projectMissingFromPlan_FallsBackToItsSourceId', () => {
    const rows = summarizeByProject([resource('Release', 'Releases-1', Create, 'Projects-9')]);

    expect(rows[0].projectName).toBe('Projects-9');
  });

  it('nothingNew_whenAllAlreadyImported', () => {
    const imported = [
      resource('Project', 'Projects-1', AlreadyImported, 'Projects-1'),
      resource('Release', 'Releases-1', AlreadyImported, 'Projects-1'),
      resource('Deployment', 'Deployments-1', Skip, 'Projects-1'),
      resource('Environment', 'Environments-1', ReuseExisting),
    ];

    expect(isNothingNew(imported)).toBe(true);
    expect(isNothingNew([])).toBe(true);
    expect(isNothingNew([...imported, resource('Deployment', 'Deployments-2', Update, 'Projects-1')])).toBe(false);
    expect(isNothingNew([...imported, resource('Release', 'Releases-2', Create, 'Projects-1')])).toBe(false);
  });

  it('listedResources_KeepsAlreadyImportedWithALabel', () => {
    const listed = listedResources([
      resource('Project', 'Projects-1', Create),
      resource('Project', 'Projects-2', AlreadyImported),
      resource('Project', 'Projects-3', Skip),
      resource('Project', 'Projects-4', Blocked),
      resource('Environment', 'Environments-1', Create),
    ], 'project');

    expect(listed.map(item => [item.resource.sourceId, item.label])).toEqual([
      ['Projects-1', null],
      ['Projects-2', 'Already imported'],
    ]);
  });

  it('withoutHistoryRows_DropsReleaseDeploymentAndTaskRows', () => {
    const plan: OctopusImportPreviewPlan = {
      generatedAt: '2026-11-12T00:00:00Z',
      resources: [
        resource('Project', 'Projects-1', Create),
        resource('Release', 'Releases-1', Create),
        resource('Deployment', 'Deployments-1', Create),
        resource(' ServerTask ', 'ServerTasks-1', Create),
      ],
      requiredInputs: [],
      diagnostics: [],
      hasBlockers: false,
    };

    expect(withoutHistoryRows(plan).resources.map(item => item.sourceId)).toEqual(['Projects-1']);
    expect(plan.resources).toHaveLength(4);
  });

  it.each([
    [null, 0],
    [{ projectIndex: 0, projectCount: 0, done: false }, 0],
    [{ projectIndex: 1, projectCount: 4, done: false }, 25],
    [{ projectIndex: 4, projectCount: 4, done: false }, 99],
    [{ projectIndex: 4, projectCount: 4, done: true }, 100],
  ])('fetchProgressPercent(%o) = %i', (partial, expected) => {
    const progress = partial
      ? {
        phase: OctopusHistoryFetchPhase.Releases,
        counts: { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 },
        totalBytes: 0,
        ...partial,
      }
      : null;

    expect(fetchProgressPercent(progress)).toBe(expected);
  });
});
