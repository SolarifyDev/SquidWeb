import { describe, expect, it, vi } from 'vitest';
import {
  OctopusHistoryFetchPhase,
  OctopusImportChoiceReason,
  OctopusImportPreviewAction,
  OctopusImportResourceOutcomeState,
  type OctopusHistoryFetchProgress,
  type OctopusImportPreviewPlan,
  OctopusImportProjectDestinationState,
  OctopusImportRequiredInputKind,
  type OctopusImportChangeCounts,
  type OctopusImportMissingSensitiveValue,
  type OctopusImportPreviewResource,
  type OctopusImportPreviewSummary,
  type OctopusImportRequiredInput,
  type OctopusImportFillPairing,
  OctopusImportCompatibilitySeverity,
  OctopusImportFillEvidenceState,
  type OctopusImportOriginEvidence,
} from 'pages/apis/octopusImport';
import {
  choiceGroups,
  hasChoices,
  followersText,
  selectionChanged,
  withSelection,
  fetchPhaseLabel,
  fetchProgressPercent,
  historyFetchNotices,
  isNothingNew,
  listedResources,
  summarizeActions,
  summarizeByProject,
  changeCountsOf,
  kindCountsOf,
  withoutHistoryRows,
  changedResources,
  describeFillDestination,
  errorKindHint,
  fetchFailureRecovery,
  fetchPositionLabel,
  fillDestinationLink,
  fillResources,
  importSections,
  isUpToDate,
  missingSecretLink,
  permissionProblem,
  planToValidate,
  projectDestinationLink,
  scopeSummary,
  skippedResources,
  withheldSecrets,
  originNotice,
  originProof,
  pairingCopy,
  IMPORT_ORIGIN_PAIRING_REQUIRED,
  IMPORT_ORIGIN_UNPROVEN,
  NOT_USED_BY_CHOSEN_PROJECTS,
  PROJECT_NOT_CHOSEN,
  CONFIG_AS_CODE_NOT_SUPPORTED,
  outsideSelectionResources,
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
    expect(OctopusImportPreviewAction.FillMissingSecret).toBe(8);
    expect(OctopusImportResourceOutcomeState.SecretFilled).toBe(8);
    expect([
      OctopusHistoryFetchPhase.Catalog, OctopusHistoryFetchPhase.ProjectConfiguration, OctopusHistoryFetchPhase.Closure,
    ]).toEqual([3, 4, 5]);
    expect([
      OctopusImportRequiredInputKind.SensitiveVariableValue, OctopusImportRequiredInputKind.FeedPassword,
      OctopusImportRequiredInputKind.AccountSecret, OctopusImportRequiredInputKind.CertificatePrivateKey,
      OctopusImportRequiredInputKind.SensitiveActionProperty,
    ]).toEqual([0, 1, 2, 3, 4]);
    expect([
      OctopusImportProjectDestinationState.New, OctopusImportProjectDestinationState.Existing,
      OctopusImportProjectDestinationState.NotImported,
    ]).toEqual([0, 1, 2]);
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
      create: 4, reuse: 1, alreadyImported: 3, update: 2, fill: 0, skip: 1, other: 0,
    });
  });

  it('changeCountsOf_CountsEachActionLikeTheServerSummary', () => {
    const resources = [
      resource('Project', 'Projects-1', Create, 'Projects-1'),
      resource('Release', 'Releases-1', Create, 'Projects-1'),
      resource('Release', 'Releases-2', AlreadyImported, 'Projects-1'),
      resource('Deployment', 'Deployments-1', Update, 'Projects-1'),
      resource('Environment', 'Environments-1', ReuseExisting),
      resource('Variable', 'Db.Password', OctopusImportPreviewAction.FillMissingSecret),
      resource('ServerTask', 'ServerTasks-1', Skip, 'Projects-1'),
      resource('Feed', 'Feeds-1', OctopusImportPreviewAction.Unsupported),
      resource('Lifecycle', 'Lifecycles-1', OctopusImportPreviewAction.Blocked),
      resource('Channel', 'Channels-1', OctopusImportPreviewAction.RenameRequired, 'Projects-1'),
    ];

    expect(changeCountsOf(resources)).toEqual({
      alreadyImported: 1, reused: 1, create: 2, update: 1, fill: 1, skip: 1, unsupported: 1, blocked: 2, total: 10, incremental: 5,
    });
    expect(kindCountsOf(resources).find(kind => kind.kind === 'Release')?.counts).toMatchObject({ create: 1, alreadyImported: 1, total: 2 });
    expect(kindCountsOf(resources).map(kind => kind.kind)).toEqual(['Project', 'Release', 'Deployment', 'Environment', 'Variable', 'ServerTask', 'Feed', 'Lifecycle', 'Channel']);
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
    expect(isNothingNew([...imported, resource('Variable', 'Db.Password', OctopusImportPreviewAction.FillMissingSecret)])).toBe(false);
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
    [{ projectIndex: 0, projectCount: 0, done: false }, 95],
    [{ projectIndex: 1, projectCount: 4, done: false }, 32],
    [{ projectIndex: 4, projectCount: 4, done: false }, 95],
    [{ projectIndex: 4, projectCount: 4, done: true }, 100],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.ProjectConfiguration }, 10],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Deployments, phaseItemsDone: 1200, phaseItemsTotal: 5431 }, 51],
    [{ projectIndex: 1, projectCount: 4, done: false, phase: OctopusHistoryFetchPhase.Deployments, phaseItemsDone: 0, phaseItemsTotal: null }, 38],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Deployments, phaseItemsDone: 5431, phaseItemsTotal: 5431 }, 95],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Deployments, phaseItemsDone: 6000, phaseItemsTotal: 5431 }, 95],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Releases, phaseItemsDone: 0, phaseItemsTotal: 0 }, 39],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Releases, phaseItemsDone: 498, phaseItemsTotal: 4990 }, 16],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 1, catalogKindCount: 4, phaseItemsDone: 50, phaseItemsTotal: 100 }, 3],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 1, catalogKindCount: 4, phaseItemsTotal: null }, 2],
    [{ projectIndex: 0, projectCount: 1, done: false, phase: OctopusHistoryFetchPhase.Catalog }, 0],
    [{ projectIndex: 2, projectCount: 2, done: false, phase: OctopusHistoryFetchPhase.Closure, phaseItemsDone: 0, phaseItemsTotal: null }, 95],
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

describe('fetchProgressPercent across a whole fetch', () => {
  // Every poll of a two-project fetch, in the order the server moves: the catalog (a chunk ending on a kind boundary
  // reports no total), each project's configuration, releases and deployments (no total until their first page), the closure.
  const polls: Partial<OctopusHistoryFetchProgress>[] = [
    { phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 0, catalogKindCount: 3, phaseItemsTotal: null },
    { phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 0, catalogKindCount: 3, phaseItemsDone: 100, phaseItemsTotal: 100 },
    { phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 1, catalogKindCount: 3, phaseItemsTotal: null },
    { phase: OctopusHistoryFetchPhase.Catalog, catalogIndex: 2, catalogKindCount: 3, phaseItemsDone: 30, phaseItemsTotal: 30 },
    ...[0, 1].flatMap(projectIndex => [
      { phase: OctopusHistoryFetchPhase.ProjectConfiguration, projectIndex },
      { phase: OctopusHistoryFetchPhase.Releases, projectIndex, phaseItemsTotal: null },
      { phase: OctopusHistoryFetchPhase.Releases, projectIndex, phaseItemsDone: 4990, phaseItemsTotal: 4990 },
      { phase: OctopusHistoryFetchPhase.Deployments, projectIndex, phaseItemsTotal: null },
      { phase: OctopusHistoryFetchPhase.Deployments, projectIndex, phaseItemsDone: 300, phaseItemsTotal: 5431 },
      { phase: OctopusHistoryFetchPhase.Deployments, projectIndex, phaseItemsDone: 5431, phaseItemsTotal: 5431 },
    ]),
    { phase: OctopusHistoryFetchPhase.Closure, projectIndex: 2 },
    { phase: OctopusHistoryFetchPhase.Done, projectIndex: 2, done: true },
  ];

  it('neverGoesBackwards_AndEndsAt100', () => {
    const percents = polls.map(poll => fetchProgressPercent({
      projectIndex: 0,
      projectCount: 2,
      done: false,
      counts: { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 },
      totalBytes: 0,
      ...poll,
    } as OctopusHistoryFetchProgress));

    percents.forEach((percent, index) => expect(percent).toBeGreaterThanOrEqual(percents[index - 1] ?? 0));
    expect(percents.at(-1)).toBe(100);
    expect(new Set(percents).size).toBeGreaterThan(polls.length / 2);
  });
});

describe('fetchPhaseLabel', () => {
  it.each([
    [OctopusHistoryFetchPhase.Releases, 'Reading releases'],
    [OctopusHistoryFetchPhase.Deployments, 'Reading deployments'],
    [OctopusHistoryFetchPhase.Done, 'Finished reading from Octopus'],
    [OctopusHistoryFetchPhase.Catalog, 'Reading space configuration'],
    [OctopusHistoryFetchPhase.ProjectConfiguration, 'Reading project configuration'],
    [OctopusHistoryFetchPhase.Closure, 'Reading referenced resources'],
  ])('labels phase %s', (phase, label) => {
    expect(fetchPhaseLabel(phase)).toBe(label);
  });
});

describe('historyFetchNotices', () => {
  const fetched = (counts: Partial<OctopusHistoryFetchProgress['counts']>, projectCount = 2): OctopusHistoryFetchProgress => ({
    phase: OctopusHistoryFetchPhase.Done,
    projectIndex: projectCount,
    projectCount,
    counts: { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0, ...counts },
    totalBytes: 0,
    done: true,
  });

  it('treatsMissingFieldsAsZero_ForAnOlderServer', () => {
    expect(historyFetchNotices(fetched({ releases: 1 }))).toEqual({ projectsNotFound: 0, detailsTooLarge: 0, configAsCodeProjects: 0, nothingFound: false });
  });

  it('flagsNothingFound_OnlyWhenEveryProjectIsMissingAndNothingWasRead', () => {
    expect(historyFetchNotices(fetched({ projectsNotFound: 2 })).nothingFound).toBe(true);
    expect(historyFetchNotices(fetched({ projectsNotFound: 1 })).nothingFound).toBe(false);
    expect(historyFetchNotices(fetched({ projectsNotFound: 2, releases: 1 })).nothingFound).toBe(false);
  });

  it('reportsOversizedDetails', () => {
    expect(historyFetchNotices(fetched({ detailsTooLarge: 3 })).detailsTooLarge).toBe(3);
  });

  it('reportsConfigAsCodeProjects', () => {
    expect(historyFetchNotices(fetched({ configAsCodeProjects: 2 })).configAsCodeProjects).toBe(2);
  });
});

describe('fetchPositionLabel', () => {
  const at = (phase: OctopusHistoryFetchPhase, extra: Partial<OctopusHistoryFetchProgress> = {}): OctopusHistoryFetchProgress => ({
    phase,
    projectIndex: 1,
    projectCount: 2,
    counts: { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 },
    totalBytes: 0,
    done: false,
    ...extra,
  });

  it.each([
    [at(OctopusHistoryFetchPhase.Releases), 'Reading releases (project 2 of 2 chosen)'],
    [at(OctopusHistoryFetchPhase.Releases, { projectIndex: 0, projectCount: 1 }), 'Reading releases (project 1 of 1 chosen)'],
    [at(OctopusHistoryFetchPhase.ProjectConfiguration), 'Reading project configuration (project 2 of 2 chosen)'],
    [at(OctopusHistoryFetchPhase.Deployments, { projectIndex: 0, projectCount: 1, phaseItemsDone: 1200, phaseItemsTotal: 5431 }),
      'Reading deployments (project 1 of 1 chosen): 1,200 of 5,431'],
    [at(OctopusHistoryFetchPhase.Releases, { phaseItemsDone: 30, phaseItemsTotal: 4990 }), 'Reading releases (project 2 of 2 chosen): 30 of 4,990'],
    [at(OctopusHistoryFetchPhase.Deployments, { phaseItemsDone: 0, phaseItemsTotal: null }), 'Reading deployments (project 2 of 2 chosen)'],
    [at(OctopusHistoryFetchPhase.Catalog, { catalogIndex: 3, catalogKindCount: 14, phaseItemsDone: 20, phaseItemsTotal: 75 }),
      'Reading space configuration (kind 4 of 14): 20 of 75'],
    [at(OctopusHistoryFetchPhase.ProjectConfiguration, { phaseItemsDone: 0, phaseItemsTotal: null }), 'Reading project configuration (project 2 of 2 chosen)'],
    [at(OctopusHistoryFetchPhase.Catalog, { catalogIndex: 3, catalogKindCount: 14 }), 'Reading space configuration (kind 4 of 14)'],
    [at(OctopusHistoryFetchPhase.Catalog), 'Reading space configuration'],
    [at(OctopusHistoryFetchPhase.Closure), 'Reading referenced resources'],
    [at(OctopusHistoryFetchPhase.Done, { done: true }), 'Finished reading from Octopus'],
  ])('labels %#', (progress, label) => {
    expect(fetchPositionLabel(progress)).toBe(label);
  });
});

describe('importSections', () => {
  const input = (phase: string, overrides: Partial<Parameters<typeof importSections>[1]> = {}) => ({
    phase, lastActivePhase: null, probed: false, fetchStarted: false, ...overrides,
  });

  const statuses = (sections: ReturnType<typeof importSections>) => sections.map(section => section.status);

  it('namesTheSectionsOfEachSource', () => {
    expect(importSections('file', input('idle')).map(section => section.title))
      .toEqual(['Source', 'File', 'Read file', 'Projects', 'Preview and import']);
    expect(importSections('server', input('idle')).map(section => section.title))
      .toEqual(['Source', 'Connect', 'Space and projects', 'Read from Octopus', 'Preview and import']);
  });

  it('marksTheSectionsBeforeTheCurrentDone_AndTheOnesAfterItFuture', () => {
    expect(statuses(importSections('server', input('fetching', { probed: true }))))
      .toEqual(['done', 'done', 'done', 'current', 'future']);
  });

  it('marksEverySectionDone_WhenTheImportSucceeded', () => {
    expect(statuses(importSections('file', input('succeeded')))).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it.each([
    ['idle', {}, 1, 'current'],
    ['uploading', {}, 2, 'current'],
    ['extracting', {}, 2, 'current'],
    ['choosing', {}, 3, 'current'],
    ['previewing', {}, 4, 'current'],
    ['ready', {}, 4, 'current'],
    ['validating', {}, 4, 'current'],
    ['confirming', {}, 4, 'current'],
    ['statusUnknown', {}, 4, 'current'],
    ['failed', { lastActivePhase: 'extracting' }, 2, 'error'],
    ['failed', { lastActivePhase: 'choosing' }, 3, 'error'],
    ['failed', { lastActivePhase: 'ready' }, 4, 'error'],
    ['failed', { lastActivePhase: 'confirming' }, 4, 'error'],
    ['failed', {}, 1, 'error'],
  ] as const)('file: %s %o -> section %i (%s)', (phase, overrides, index, status) => {
    const sections = importSections('file', input(phase, overrides));
    expect(sections[index].status).toBe(status);
    expect(sections.filter(section => section.status === 'current' || section.status === 'error')).toHaveLength(1);
  });

  it.each([
    ['idle', {}, 1, 'current'],
    ['idle', { probed: true }, 2, 'current'],
    ['idle', { probed: true, fetchStarted: true }, 3, 'current'],
    ['choosing', { probed: true }, 2, 'current'],
    ['connecting', { probed: true }, 3, 'current'],
    ['fetching', { probed: true }, 3, 'current'],
    ['extracting', { probed: true }, 4, 'current'],
    ['previewing', { probed: true }, 4, 'current'],
    ['ready', { probed: true }, 4, 'current'],
    ['validating', {}, 4, 'current'],
    ['confirming', {}, 4, 'current'],
    ['statusUnknown', {}, 4, 'current'],
    ['failed', { probed: true, lastActivePhase: 'connecting' }, 3, 'error'],
    ['failed', { probed: true, lastActivePhase: 'fetching' }, 3, 'error'],
    ['failed', { probed: true, lastActivePhase: 'previewing' }, 4, 'error'],
    ['failed', { probed: true, lastActivePhase: 'confirming' }, 4, 'error'],
    ['failed', { probed: true }, 2, 'error'],
  ] as const)('server: %s %o -> section %i (%s)', (phase, overrides, index, status) => {
    const sections = importSections('server', input(phase, overrides));
    expect(sections[index].status).toBe(status);
    expect(sections.filter(section => section.status === 'current' || section.status === 'error')).toHaveLength(1);
  });
});

describe('fetchFailureRecovery', () => {
  it.each([
    // Same session, same key: everything read so far is kept.
    [400, 'Unreachable', false, 'resume'],
    [409, 'Concurrency', false, 'resume'],
    [400, 'Rejected', false, 'resume'],
    [502, null, false, 'resume'],
    [503, undefined, false, 'resume'],
    [408, null, false, 'resume'],
    [429, null, false, 'resume'],
    [0, null, true, 'resume'],
    // Connect again (another key, or the right server/space) before resuming.
    [400, 'Unauthorized', false, 'reconnect'],
    [400, 'KeyRestricted', false, 'reconnect'],
    [400, 'KeyUserMismatch', false, 'reconnect'],
    [400, 'NotOctopus', false, 'reconnect'],
    [400, 'Denied', false, 'reconnect'],
    [400, 'NotFound', false, 'reconnect'],
    [400, 'ServerMismatch', false, 'reconnect'],
    // The session cannot continue.
    [404, 'SessionNotFound', false, 'restart'],
    [409, 'SessionStateConflict', false, 'restart'],
    [409, 'SessionExpired', false, 'restart'],
    [400, 'NotServerSource', false, 'restart'],
    [404, null, false, 'restart'],
    // Retrying cannot help.
    [400, 'TooLarge', false, 'none'],
    [400, null, false, 'none'],
    [400, 'SomethingNew', false, 'none'],
  ] as const)('code %i kind %s thrown %s -> %s', (code, kind, thrown, expected) => {
    expect(fetchFailureRecovery(code, kind, thrown)).toBe(expected);
  });
});

describe('errorKindHint', () => {
  it.each([
    ['KeyRestricted', /read-only service account/],
    ['Unauthorized', /rejected the API key/],
    ['KeyUserMismatch', /another Octopus user/],
    ['ServerMismatch', /another Octopus server or space/],
    ['NotOctopus', /server URL and the Octopus space/],
    ['Denied', /server URL and the Octopus space/],
    ['NotFound', /server URL and the Octopus space/],
    ['Unreachable', /could not be reached/],
    ['Rejected', /refused a request/],
    ['Concurrency', /already running/],
    ['TooLarge', /SQUID_OCTOPUS_IMPORT_HISTORY_MAX_BYTES/],
    ['SessionNotFound', /Start again/],
    ['SessionStateConflict', /Start again/],
    ['SessionExpired', /maximum age/],
    ['NotServerSource', /Start again/],
    ['ProjectSelection', /at least one project/],
    ['ProjectSelectionBeyondRead', /Connect again to add projects/],
  ])('%s', (kind, text) => {
    expect(errorKindHint(kind)).toMatch(text);
  });

  it('isNull_ForNoOrAnUnknownKind', () => {
    expect(errorKindHint(null)).toBeNull();
    expect(errorKindHint(undefined)).toBeNull();
    expect(errorKindHint('SomethingNew')).toBeNull();
  });
});

describe('permissionProblem', () => {
  const permissions = (overrides = {}) => ({
    octopusSpaceId: 'Spaces-1', sufficient: true, restricted: [], missing: [], incomplete: false, ...overrides,
  });

  it('isNull_WhenSufficientOrUnknownOrForAnotherSpace', () => {
    expect(permissionProblem(permissions(), 'Spaces-1')).toBeNull();
    expect(permissionProblem(null, 'Spaces-1')).toBeNull();
    expect(permissionProblem(permissions({ sufficient: false, missing: ['TaskView'] }), 'Spaces-2')).toBeNull();
  });

  it('listsRestrictedMissingAndIncomplete', () => {
    const problem = permissionProblem(
      permissions({ sufficient: false, restricted: ['ProjectView'], missing: ['TaskView', 'FeedView'], incomplete: true }),
      'Spaces-1',
    );

    expect(problem).toEqual([
      'Limited to some projects, environments, tenants or project groups: ProjectView',
      'Not granted: TaskView, FeedView',
      'Octopus could not report the complete permission set of this key.',
    ]);
  });

  it('appliesToASpacelessServer_WhenNoSpaceIsChosen', () => {
    expect(permissionProblem(permissions({ octopusSpaceId: null, sufficient: false, missing: ['TaskView'] }), null))
      .toEqual(['Not granted: TaskView']);
  });
});

const counts = (overrides: Partial<OctopusImportChangeCounts> = {}): OctopusImportChangeCounts => ({
  alreadyImported: 0, reused: 0, create: 0, update: 0, fill: 0, skip: 0, unsupported: 0, blocked: 0, total: 0, incremental: 0,
  ...overrides,
});

const summary = (isUpToDate: boolean): OctopusImportPreviewSummary => ({
  isUpToDate,
  counts: counts(),
  kinds: [],
  projects: [],
  space: { counts: counts(), kinds: [], isUpToDate },
  skipReasons: [],
});

const planOf = (resources: OctopusImportPreviewResource[], extra: Partial<OctopusImportPreviewPlan> = {}): OctopusImportPreviewPlan => ({
  generatedAt: '', resources, requiredInputs: [], diagnostics: [], hasBlockers: false, ...extra,
});

describe('isUpToDate', () => {
  it('trustsTheServerSummary_WhenPresent', () => {
    const created = [resource('Project', 'Projects-1', Create)];

    expect(isUpToDate(planOf(created, { summary: summary(true) }))).toBe(true);
    expect(isUpToDate(planOf([], { summary: summary(false) }))).toBe(false);
  });

  it('fallsBackToTheResourceActions_ForAnOlderServer', () => {
    expect(isUpToDate(planOf([resource('Project', 'Projects-1', AlreadyImported)]))).toBe(true);
    expect(isUpToDate(planOf([resource('Project', 'Projects-1', Create)]))).toBe(false);
  });
});

describe('planToValidate', () => {
  it('dropsHistoryRows_AndRecordsThePairingConfirmation', () => {
    const pairing = {
      required: true, confirmed: false, installationId: 'install-1', serverHost: 'octopus.example.com', octopusSpaceId: 'Spaces-1',
      octopusVersion: '2026.1', fileExportSourceId: null, recordedExportSourceId: null, matchingStructureIds: 3,
    };
    const plan = planOf([resource('Project', 'Projects-1', AlreadyImported), resource('Release', 'Releases-1', Create)], { fillPairing: pairing });

    const posted = planToValidate(plan, true);

    expect(posted.resources.map(item => item.sourceType)).toEqual(['Project']);
    expect(posted.fillPairing?.confirmed).toBe(true);
    expect(planToValidate(plan, false).fillPairing?.confirmed).toBe(false);
    expect(plan.fillPairing?.confirmed).toBe(false);
  });

  it('leavesAPlanWithoutPairingAlone', () => {
    expect(planToValidate(planOf([]), true).fillPairing).toBeUndefined();
  });
});

describe('destination links', () => {
  const destination = (state: OctopusImportProjectDestinationState, projectName: string | null, projectSlug: string | null) => ({
    state, projectId: state === OctopusImportProjectDestinationState.Existing ? 501 : null, projectName, projectSlug,
  });

  it.each([
    [destination(OctopusImportProjectDestinationState.Existing, 'Web App', 'web-app'), '/Spaces-1/projects/web-app'],
    [destination(OctopusImportProjectDestinationState.Existing, 'Web App', null), '/Spaces-1/projects/Web%20App'],
    [destination(OctopusImportProjectDestinationState.Existing, null, null), null],
    [destination(OctopusImportProjectDestinationState.New, null, null), null],
    [destination(OctopusImportProjectDestinationState.New, 'Web App', 'web-app'), null],
    [destination(OctopusImportProjectDestinationState.NotImported, 'Web App', 'web-app'), null],
    [destination(OctopusImportProjectDestinationState.NotImported, null, null), null],
  ])('project %#', (value, expected) => {
    expect(projectDestinationLink('Spaces-1', value)).toBe(expected);
  });

  it.each([
    [{ ownerKind: 'Project', ownerId: 501, ownerName: 'Web App', variableSetId: 601 }, '/Spaces-1/projects/Web%20App/variables', 'project "Web App"'],
    [{ ownerKind: 'LibraryVariableSet', ownerId: 12, ownerName: 'Shared', variableSetId: 602 }, '/Spaces-1/library/variables/LibraryVariableSets-12', 'library variable set "Shared"'],
    [{ ownerKind: 'Feed', ownerId: 7, ownerName: 'Docker Hub', variableSetId: null }, '/Spaces-1/external/feeds', 'feed "Docker Hub"'],
    [{ ownerKind: 'Project', ownerId: 501, ownerName: null, variableSetId: 601 }, null, 'project 501'],
  ])('fill destination %#', (value, link, text) => {
    expect(fillDestinationLink('Spaces-1', value)).toBe(link);
    expect(describeFillDestination(value)).toBe(text);
  });

  it.each([
    [{ ownerKind: 'Project', ownerName: 'Web App', destinationOwnerId: 501 }, OctopusImportRequiredInputKind.SensitiveVariableValue, '/Spaces-1/projects/Web%20App/variables'],
    [{ ownerKind: 'LibraryVariableSet', ownerName: 'Shared', destinationOwnerId: 12 }, OctopusImportRequiredInputKind.SensitiveVariableValue, '/Spaces-1/library/variables/LibraryVariableSets-12'],
    [{ ownerKind: null, ownerName: null, destinationOwnerId: null }, OctopusImportRequiredInputKind.FeedPassword, '/Spaces-1/external/feeds'],
    [{ ownerKind: null, ownerName: null, destinationOwnerId: null }, OctopusImportRequiredInputKind.AccountSecret, '/Spaces-1/infrastructure/accounts'],
    [{ ownerKind: null, ownerName: null, destinationOwnerId: null }, OctopusImportRequiredInputKind.CertificatePrivateKey, '/Spaces-1/library/certificates'],
    [{ ownerKind: 'Project', ownerName: 'Web App', destinationOwnerId: 501 }, OctopusImportRequiredInputKind.SensitiveActionProperty, '/Spaces-1/projects/Web%20App/deployments/process'],
    [{ ownerKind: null, ownerName: null, destinationOwnerId: null }, OctopusImportRequiredInputKind.SensitiveActionProperty, null],
  ])('missing secret %#', (owner, kind, expected) => {
    const missing: OctopusImportMissingSensitiveValue = {
      kind, name: 'x', field: 'Value', scopeSummary: null, destinationId: 1, fillable: true, ...owner,
    };
    expect(missingSecretLink('Spaces-1', missing)).toBe(expected);
  });
});

describe('resource selections', () => {
  const withChanges = (item: OctopusImportPreviewResource) => ({
    ...item,
    changes: [{ field: 'State', oldValue: 'Executing', newValue: 'Success', valueHidden: false, description: null }],
  });

  const resources = [
    withChanges(resource('Deployment', 'Deployments-1', Update, 'Projects-1')),
    resource('Release', 'Releases-1', AlreadyImported, 'Projects-1'),
    { ...resource('Machine', 'Machines-1', OctopusImportPreviewAction.Unsupported), skipReason: { code: 'unsupported', message: 'Targets are not imported.' } },
    { ...resource('ServerTask', 'ServerTasks-9', Skip, 'Projects-1'), skipReason: { code: 'runbook', message: 'Runbook run.' } },
    {
      ...resource('Variable', 'Db.Password', OctopusImportPreviewAction.FillMissingSecret, 'Projects-1'),
      changes: [{ field: 'Value', oldValue: null, newValue: null, valueHidden: true, description: 'Filled from the export file.' }],
    },
  ];

  it('changedResources_ByOwner', () => {
    expect(changedResources(resources, 'Projects-1').map(item => item.sourceId)).toEqual(['Deployments-1', 'Db.Password']);
    expect(changedResources(resources, null)).toEqual([]);
  });

  it('skippedResources_ByOwner', () => {
    expect(skippedResources(resources, 'Projects-1').map(item => item.sourceId)).toEqual(['ServerTasks-9']);
    expect(skippedResources(resources, null).map(item => item.sourceId)).toEqual(['Machines-1']);
  });

  it.each([
    ['skip reason', { skipReason: { code: PROJECT_NOT_CHOSEN, message: 'Not chosen for this import.' } }],
    ['diagnostic', { diagnostics: [{ severity: OctopusImportCompatibilitySeverity.Info, code: NOT_USED_BY_CHOSEN_PROJECTS, message: 'Not used.' }] }],
  ])('skippedResources_LeavesOutRowsOutsideTheChosenProjects_ByTheir %s', (_by, outside) => {
    const rows = [
      ...resources,
      { ...resource('Lifecycle', 'Lifecycles-9', OctopusImportPreviewAction.Skip), skipReason: { code: 'x', message: 'x' }, ...outside },
    ];

    expect(skippedResources(rows, null).map(item => item.sourceId)).toEqual(['Machines-1']);
    expect(outsideSelectionResources(rows).map(item => item.sourceId)).toEqual(['Lifecycles-9']);
  });

  it('selectionCodes_ArePinnedToTheServers', () => {
    expect(PROJECT_NOT_CHOSEN).toBe('octopus.preview.project_not_chosen');
    expect(NOT_USED_BY_CHOSEN_PROJECTS).toBe('octopus.preview.not_used_by_chosen_projects');
    expect(CONFIG_AS_CODE_NOT_SUPPORTED).toBe('octopus.preview.config_as_code_not_supported');
  });

  it('fillResources_OnlyFillMissingSecret', () => {
    expect(fillResources(resources).map(item => item.sourceId)).toEqual(['Db.Password']);
  });
});

describe('withheldSecrets', () => {
  const input = (overrides: Partial<OctopusImportRequiredInput>): OctopusImportRequiredInput => ({
    kind: OctopusImportRequiredInputKind.SensitiveVariableValue,
    inputKey: 'k',
    sourceId: 'Variables-1',
    sourceType: 'Variable',
    name: 'Db.Password',
    fieldName: 'Value',
    valueType: 'Sensitive',
    hasSourceValue: false,
    isRequired: false,
    fillable: true,
    withheldByServer: true,
    sourceScopes: {},
    ...overrides,
  });

  it('listsSecretsTheServerWithheld_OnResourcesThisImportCreates_WithWhereAndScope', () => {
    const resources = [
      { ...resource('Project', 'Projects-1', Create, 'Projects-1', 'Web'), requiredInputs: [
        input({ inputKey: 'a', sourceScopes: { Environment: ['Production', 'Test'], Role: ['web'] } }),
        input({ inputKey: 'b', name: 'Uploaded', withheldByServer: false, hasSourceValue: true }),
      ] },
      { ...resource('Feed', 'Feeds-1', Create, null, 'Docker Hub'), requiredInputs: [
        input({ inputKey: 'c', kind: OctopusImportRequiredInputKind.FeedPassword, name: 'Docker Hub', fieldName: 'Password', sourceType: 'Feed' }),
      ] },
      { ...resource('Account', 'Accounts-1', Create, null, 'Azure'), requiredInputs: [
        input({ inputKey: 'd', kind: OctopusImportRequiredInputKind.AccountSecret, name: 'Azure', fieldName: 'Password', sourceType: 'Account', fillable: false }),
      ] },
      { ...resource('LibraryVariableSet', 'LibraryVariableSets-1', AlreadyImported, null, 'Shared'), requiredInputs: [
        input({ inputKey: 'e', name: 'Old.Secret' }),
      ] },
    ];

    expect(withheldSecrets(resources)).toEqual([
      { key: 'Projects-1:a', kind: 'Sensitive variable', name: 'Db.Password', where: 'Project "Web"', field: 'Value', scope: 'Environment: Production, Test; Role: web', fillable: true },
      { key: 'Feeds-1:c', kind: 'Feed password', name: 'Docker Hub', where: 'Feed "Docker Hub"', field: 'Password', scope: '', fillable: true },
      { key: 'Accounts-1:d', kind: 'Account secret', name: 'Azure', where: 'Account "Azure"', field: 'Password', scope: '', fillable: false },
    ]);
  });

  it('namesTheOwningProject_ForAResourceInsideAProject', () => {
    const resources = [
      resource('Project', 'Projects-1', Create, 'Projects-1', 'Web'),
      { ...resource('DeploymentProcess', 'deploymentprocess-Projects-1', Create, 'Projects-1', 'Process'), requiredInputs: [
        input({ inputKey: 'p', kind: OctopusImportRequiredInputKind.SensitiveActionProperty, name: 'Deploy', fieldName: 'Octopus.Action.Password', fillable: false }),
      ] },
    ];

    expect(withheldSecrets(resources)[0]).toMatchObject({ kind: 'Step secret', where: 'Project "Web"', field: 'Octopus.Action.Password' });
  });

  it('scopeSummary_EmptyForUnscoped', () => {
    expect(scopeSummary({})).toBe('');
    expect(scopeSummary({ Environment: [] })).toBe('');
  });
});

const pairingOf = (extra: Partial<OctopusImportFillPairing> = {}): OctopusImportFillPairing => ({
  required: true, confirmed: false, installationId: null, serverHost: null, octopusSpaceId: null, octopusVersion: null,
  fileExportSourceId: null, recordedExportSourceId: null, matchingStructureIds: 2, ...extra,
});

const diagnostic = (code: string, severity = OctopusImportCompatibilitySeverity.Warning) => ({ code, severity, message: 'server message' });

describe('pairingCopy', () => {
  // A server read into a space an export file created: the copy names the server and the file's fingerprint, never "export file" as the source.
  it('serverSource_LinkingToAFileSpace_NamesTheServerAndTheRecordedFingerprint', () => {
    const plan = planOf([], {
      diagnostics: [diagnostic(IMPORT_ORIGIN_PAIRING_REQUIRED)],
      fillPairing: pairingOf({ sourceInstallationId: 'inst-x', sourceServerHost: 'octopus-x.example.com', sourceOctopusSpaceId: 'Spaces-2', recordedExportSourceId: 'ABC123' }),
    });

    const copy = pairingCopy(plan);

    expect(copy.title).toBe('Confirm this is the Octopus server this space came from');
    expect(copy.intro).toContain('This Octopus server would link to what an earlier import created in this space');
    expect(copy.intro).toContain('2 matching step, action or phase ids');
    expect(copy.incoming).toEqual(['Server: octopus-x.example.com', 'Space: Spaces-2', 'Installation: inst-x']);
    expect(copy.recorded).toEqual(['Export file fingerprint: ABC123']);
    expect(copy.confirmLabel).toBe('This is the same Octopus server this space was imported from');
    expect([copy.title, copy.intro, copy.confirmLabel].join(' ')).not.toContain('This export file');
  });

  // An export file linking to what a server import created (no secret to fill): it links, it does not fill.
  it('fileSource_LinkingToAServerSpace_SaysItLinks', () => {
    const plan = planOf([], {
      diagnostics: [diagnostic(IMPORT_ORIGIN_PAIRING_REQUIRED)],
      fillPairing: pairingOf({ installationId: 'inst-a', serverHost: 'octopus.example.com', octopusSpaceId: 'Spaces-1', fileExportSourceId: 'FFF000' }),
    });

    const copy = pairingCopy(plan);

    expect(copy.title).toBe('Confirm where this export file comes from');
    expect(copy.intro).toContain('This export file would link to what an earlier import created in this space');
    expect(copy.intro).not.toContain('fill secrets');
    expect(copy.incoming).toEqual(['Export file fingerprint: FFF000']);
    expect(copy.recorded).toEqual(['Server: octopus.example.com', 'Space: Spaces-1', 'Version: unknown', 'Installation: inst-a']);
    expect(copy.confirmLabel).toBe('This export file comes from the same Octopus server this space was imported from');
  });

  // The original case: a file filling secrets an API import left missing.
  it('fileSource_FillingSecrets_SaysItFills', () => {
    const copy = pairingCopy(planOf([], { fillPairing: pairingOf({ serverHost: 'octopus.example.com' }) }));

    expect(copy.intro).toContain('This export file would fill secrets an earlier import read from the Octopus API');
    expect(copy.recorded).toContain('Server: octopus.example.com');
  });
});

const originOf = (state: OctopusImportFillEvidenceState, basis: string | null = null): OctopusImportOriginEvidence => ({
  state, basis, matchingStructureIds: 0, source: 'Octopus installation inst-x (server octopus-x.example.com)', recorded: 'an export file with fingerprint ABC123',
});

describe('originNotice', () => {
  // The server's verdict refuses: the card names both origins, why, and that nothing will be linked.
  it.each([
    [null, 'This import comes from a different Octopus than this space'],
    ['installation-mismatch', 'This import comes from another Octopus installation than this space'],
    ['other-origin-rows', 'This import would link to resources another Octopus source created in this space'],
    ['export-fingerprint-mismatch', "This export file's fingerprint is not one this space was imported from"],
  ])('refusedVerdict_%s_NamesBothOrigins', (basis, title) => {
    const notice = originNotice(planOf([], { origin: originOf(OctopusImportFillEvidenceState.Unproven, basis) }));

    expect(notice?.title).toBe(title);
    expect(notice?.origins).toEqual(['This source: Octopus installation inst-x (server octopus-x.example.com)', 'This space was imported from: an export file with fingerprint ABC123']);
    expect(notice?.hint).toContain('Nothing will be linked or written');
  });

  // Rows a third origin created: the card also names the origins that created them (the server names at most three, counts the rest).
  it.each([
    [['Octopus installation inst-z (server octopus-z.example.com)'], 0, 'Resources it would link to were created by: Octopus installation inst-z (server octopus-z.example.com)'],
    [['inst-1', 'inst-2'], 0, 'Resources it would link to were created by: inst-1 and inst-2'],
    [['inst-1', 'inst-2', 'inst-3'], 2, 'Resources it would link to were created by: inst-1, inst-2, inst-3 and 2 more'],
  ])('otherOriginRows_%j_NamesTheCreatorsAsAThirdLine', (creators, moreCreators, line) => {
    const notice = originNotice(planOf([], { origin: { ...originOf(OctopusImportFillEvidenceState.Unproven, 'other-origin-rows'), creators, moreCreators } }));

    expect(notice?.origins).toEqual(['This source: Octopus installation inst-x (server octopus-x.example.com)', 'This space was imported from: an export file with fingerprint ABC123', line]);
  });

  // A server without the field (or with none to name) renders as before.
  it.each([undefined, null, []])('noCreators_%j_TwoLines', creators => {
    const notice = originNotice(planOf([], { origin: { ...originOf(OctopusImportFillEvidenceState.Unproven, 'other-origin-rows'), creators } }));

    expect(notice?.origins).toHaveLength(2);
  });

  it.each([OctopusImportFillEvidenceState.PairingRequired, OctopusImportFillEvidenceState.Proven])('verdict_%s_NoNotice', state => {
    expect(originNotice(planOf([], { origin: originOf(state, 'installation') }))).toBeNull();
  });

  // A server without the verdict: the refusal is still recognised by its diagnostic, without naming the origins.
  it.each([
    [IMPORT_ORIGIN_UNPROVEN, OctopusImportCompatibilitySeverity.Blocker, true],
    [IMPORT_ORIGIN_PAIRING_REQUIRED, OctopusImportCompatibilitySeverity.Warning, false],
    ['octopus.preview.something_else', OctopusImportCompatibilitySeverity.Blocker, false],
  ])('noVerdict_%s_NoticeOnlyWhenRefused', (code, severity, expected) => {
    const notice = originNotice(planOf([], { diagnostics: [diagnostic(code, severity)] }));

    expect(notice !== null).toBe(expected);
    if (!expected) return;
    expect(notice?.title).toBe('This import comes from a different Octopus than this space');
    expect(notice?.origins).toEqual([]);
    expect(notice?.hint).toContain('Nothing will be linked or written');
    expect(notice?.hint).toContain('Import it into another space');
  });

  it('noPlan_NoNotice', () => {
    expect(originNotice(null)).toBeNull();
  });
});

describe('originProof', () => {
  it.each([
    ['installation', 'Same Octopus as this space, proven by its installation id: it links to what earlier imports created.'],
    ['export-fingerprint', 'Same Octopus as this space, proven by its export file fingerprint: it links to what earlier imports created.'],
    ['confirmed-pairing', 'Same Octopus as this space, proven by the pairing you confirmed: it links to what earlier imports created.'],
  ])('proven_%s_NamesTheBasis', (basis, text) => {
    expect(originProof(planOf([], { origin: originOf(OctopusImportFillEvidenceState.Proven, basis) }))).toBe(text);
  });

  it.each([OctopusImportFillEvidenceState.PairingRequired, OctopusImportFillEvidenceState.Unproven])('notProven_%s_NoProof', state => {
    expect(originProof(planOf([], { origin: originOf(state, null) }))).toBeNull();
  });

  it('noVerdict_NoProof', () => {
    expect(originProof(planOf([]))).toBeNull();
    expect(originProof(null)).toBeNull();
  });
});

const chosen = (
  sourceType: string,
  sourceId: string,
  reason: OctopusImportChoiceReason,
  selected: boolean,
  followsSourceId: string | null = null,
): OctopusImportPreviewResource => ({
  ...resource(sourceType, sourceId, selected ? Create : Skip, 'Projects-1'),
  choice: { reason, selected, defaultSelected: selected, followsSourceId, ownerName: "Deployment process of 'Web'" },
});

const { DeletedInSquid, AddedInOctopus, MissedByEarlierImport } = OctopusImportChoiceReason;

const choicePlan = () => planOf([
  resource('Project', 'Projects-1', AlreadyImported, 'Projects-1'),
  chosen('DeploymentStep', 'Steps-2', DeletedInSquid, false),
  chosen('DeploymentStep', 'Steps-7', AddedInOctopus, false),
  chosen('DeploymentAction', 'Actions-71', AddedInOctopus, false, 'Steps-7'),
  chosen('DeploymentAction', 'Actions-72', AddedInOctopus, false, 'Steps-7'),
  chosen('Channel', 'Channels-3', AddedInOctopus, true),
  chosen('DeploymentStep', 'Projects-2/step/Steps-1', MissedByEarlierImport, true),
  chosen('DeploymentAction', 'Projects-2/action/Actions-1', MissedByEarlierImport, true, 'Projects-2/step/Steps-1'),
  resource('Release', 'Releases-9', Create, 'Projects-1'),
]);

describe('choices', () => {
  it('reasonOrdinals_matchBackend', () => {
    expect([DeletedInSquid, AddedInOctopus, MissedByEarlierImport]).toEqual([0, 1, 2]);
  });

  it('choiceGroups_GroupsRootsByReason_CountsFollowers_AndNeverListsAFollower', () => {
    const groups = choiceGroups(choicePlan().resources);

    expect(groups.deleted.map(row => row.resource.sourceId)).toEqual(['Steps-2']);
    expect(groups.added.map(row => row.resource.sourceId)).toEqual(['Steps-7', 'Channels-3']);
    expect(groups.added[0].followers.map(row => row.sourceId)).toEqual(['Actions-71', 'Actions-72']);
    expect(groups.added[1].followers).toEqual([]);
    expect(groups.deleted[0].followers).toEqual([]);
    expect(groups.missed.map(row => row.resource.sourceId)).toEqual(['Projects-2/step/Steps-1']);
    expect(groups.missed[0].followers.map(row => row.sourceId)).toEqual(['Projects-2/action/Actions-1']);
  });

  it.each([
    ['deleted', DeletedInSquid],
    ['added', AddedInOctopus],
    ['missed', MissedByEarlierImport],
  ] as const)('hasChoices_IsTrue_ForAnyOneGroup(%s)', (_, reason) => {
    expect(hasChoices(choiceGroups([chosen('DeploymentStep', 'Steps-1', reason, false)]))).toBe(true);
  });

  it('hasChoices_IsFalse_WithoutChoices', () => {
    expect(hasChoices(choiceGroups([resource('Project', 'Projects-1', Create)]))).toBe(false);
  });

  it('choiceGroups_IsEmpty_ForAPlanWithoutChoices', () => {
    expect(choiceGroups([resource('Project', 'Projects-1', Create)])).toEqual({ deleted: [], added: [], missed: [] });
  });

  it('followersText_NamesTheKind_OrItems_WhenMixed', () => {
    const groups = choiceGroups(choicePlan().resources);

    expect(followersText(groups.added[0].followers)).toBe('+2 actions');
    expect(followersText(groups.added[0].followers.slice(0, 1))).toBe('+1 action');
    expect(followersText([])).toBeNull();
    expect(followersText([...groups.added[0].followers, resource('Variable', 'v-1', Create)])).toBe('+3 items');
  });

  it('withSelection_SetsOnlyTheNamedRoots_AndLeavesThePlanUntouched', () => {
    const plan = choicePlan();

    const next = withSelection(plan, ['Steps-7', 'Actions-71', 'Releases-9'], true);

    const selected = (items: OctopusImportPreviewResource[], id: string) => items.find(item => item.sourceId === id)?.choice?.selected;
    expect(selected(next.resources, 'Steps-7')).toBe(true);
    expect(selected(next.resources, 'Actions-71')).toBe(false);
    expect(selected(next.resources, 'Steps-2')).toBe(false);
    expect(next.resources.find(item => item.sourceId === 'Releases-9')?.choice).toBeUndefined();
    expect(next.resources.map(item => item.previewAction)).toEqual(plan.resources.map(item => item.previewAction));
    expect(selected(plan.resources, 'Steps-7')).toBe(false);
    expect(next.resources[1]).toBe(plan.resources[1]);
  });

  it('selectionChanged_IsTrue_OnlyWhileARootDiffersFromThePreviewedPlan', () => {
    const previewed = choicePlan();
    const ticked = withSelection(previewed, ['Steps-2'], true);

    expect(selectionChanged(previewed, previewed)).toBe(false);
    expect(selectionChanged(ticked, previewed)).toBe(true);
    expect(selectionChanged(withSelection(ticked, ['Steps-2'], false), previewed)).toBe(false);
    expect(selectionChanged(planOf([]), planOf([]))).toBe(false);
  });

  it('planToValidate_KeepsTheChoices_AndStripsHistory', () => {
    const plan = withSelection(choicePlan(), ['Steps-2', 'Channels-3'], true);

    const posted = planToValidate(withSelection(plan, ['Channels-3'], false), false);

    expect(posted.resources.some(item => item.sourceType === 'Release')).toBe(false);
    expect(posted.resources.filter(item => item.choice).map(item => [item.sourceId, item.choice?.selected])).toEqual([
      ['Steps-2', true], ['Steps-7', false], ['Actions-71', false], ['Actions-72', false], ['Channels-3', false],
      ['Projects-2/step/Steps-1', true], ['Projects-2/action/Actions-1', true],
    ]);
  });
});

// A whole-space preview carries tens of thousands of rows: the derived lists walk them a fixed number of times, never once per row.
describe('preview scaling', () => {
  const ARRAY_METHODS = ['filter', 'find', 'findIndex', 'some', 'every', 'map', 'flatMap', 'forEach', 'reduce', 'includes', 'indexOf'] as const;

  const row = (sourceType: string, sourceId: string, previewAction: OctopusImportPreviewAction, owner: string | null): OctopusImportPreviewResource => ({
    sourceId, sourceType, sourceName: sourceId, previewAction, outcomeState: OctopusImportResourceOutcomeState.Pending,
    destinationId: null, ownerProjectSourceId: owner, requiredInputs: [], diagnostics: [],
  });

  const withheldInput = (key: string): OctopusImportRequiredInput => ({
    kind: OctopusImportRequiredInputKind.SensitiveVariableValue, inputKey: key, sourceId: key, sourceType: 'Variable', name: key,
    fieldName: 'Value', valueType: 'Sensitive', hasSourceValue: false, isRequired: false, fillable: true, withheldByServer: true,
    sourceScopes: {},
  });

  // n choice roots, each with two followers, n withheld secrets, among history rows of one project.
  const rows = (n: number) => {
    const resources: OctopusImportPreviewResource[] = [row('Project', 'Projects-1', OctopusImportPreviewAction.AlreadyImported, 'Projects-1')];
    for (let i = 0; i < n; i++) {
      const choice = { reason: OctopusImportChoiceReason.AddedInOctopus, selected: false, defaultSelected: false, ownerName: null };
      resources.push({ ...row('DeploymentStep', `Steps-${i}`, OctopusImportPreviewAction.Skip, 'Projects-1'), choice: { ...choice, followsSourceId: null } });
      resources.push({ ...row('DeploymentAction', `Actions-${i}-a`, OctopusImportPreviewAction.Skip, 'Projects-1'), choice: { ...choice, followsSourceId: `Steps-${i}` } });
      resources.push({ ...row('DeploymentAction', `Actions-${i}-b`, OctopusImportPreviewAction.Skip, 'Projects-1'), choice: { ...choice, followsSourceId: `Steps-${i}` } });
      resources.push({ ...row('Variable', `Variables-${i}`, OctopusImportPreviewAction.Create, 'Projects-1'), requiredInputs: [withheldInput(`k${i}`)] });
      resources.push(row('Release', `Releases-${i}`, OctopusImportPreviewAction.Create, 'Projects-1'));
    }
    return resources;
  };

  // How often the derivation walks the whole list: a constant, whatever the number of rows.
  const passesOver = (n: number, derive: (resources: OctopusImportPreviewResource[]) => unknown) => {
    const resources = rows(n);
    const spies = ARRAY_METHODS.map(method => vi.spyOn(resources as unknown as Record<string, (...args: unknown[]) => unknown>, method));
    derive(resources);
    return spies.reduce((total, spy) => total + spy.mock.calls.length, 0);
  };

  it('choiceGroups_findsEveryFollower_InAFixedNumberOfPasses', () => {
    const groups = choiceGroups(rows(50));

    expect(groups.added).toHaveLength(50);
    expect(groups.added[7].followers.map(follower => follower.sourceId)).toEqual(['Actions-7-a', 'Actions-7-b']);
    expect(passesOver(200, choiceGroups)).toBe(passesOver(10, choiceGroups));
  });

  it('withheldSecrets_namesTheProjectOfEachSecret_InAFixedNumberOfPasses', () => {
    const secrets = withheldSecrets(rows(3));

    expect(secrets.map(secret => secret.where)).toEqual(['Project "Projects-1"', 'Project "Projects-1"', 'Project "Projects-1"']);
    expect(passesOver(200, withheldSecrets)).toBe(passesOver(10, withheldSecrets));
  });

  it('summarizeByProject_namesEachProject_InAFixedNumberOfPasses', () => {
    expect(summarizeByProject(rows(3))[0]).toMatchObject({ projectSourceId: 'Projects-1', projectName: 'Projects-1', newReleases: 3 });
    expect(passesOver(200, summarizeByProject)).toBe(passesOver(10, summarizeByProject));
  });

  it('withSelection_ticksEveryGivenRoot_WithoutSearchingTheGivenIdsPerRow', () => {
    const plan = { generatedAt: '', resources: rows(200), requiredInputs: [], diagnostics: [], hasBlockers: false } as OctopusImportPreviewPlan;
    const ids = Array.from({ length: 200 }, (_, i) => `Steps-${i}`);
    const searches = ['includes', 'indexOf', 'some', 'find'].map(method => vi.spyOn(ids as unknown as Record<string, (...args: unknown[]) => unknown>, method));

    const ticked = withSelection(plan, ids, true);

    expect(ticked.resources.filter(item => item.choice?.selected).map(item => item.sourceId)).toEqual(ids);
    searches.forEach(search => expect(search).not.toHaveBeenCalled());
  });
});
