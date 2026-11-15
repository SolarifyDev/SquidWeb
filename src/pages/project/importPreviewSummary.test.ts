import { describe, expect, it } from 'vitest';
import {
  OctopusHistoryFetchPhase,
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
} from 'pages/apis/octopusImport';
import {
  fetchPhaseLabel,
  fetchProgressPercent,
  historyFetchNotices,
  isNothingNew,
  listedResources,
  summarizeActions,
  summarizeByProject,
  withoutHistoryRows,
  changedResources,
  describeFillDestination,
  errorKindHint,
  fetchFailureRecovery,
  fetchPositionLabel,
  fillDestinationLink,
  fillResources,
  importSteps,
  isUpToDate,
  missingSecretLink,
  permissionProblem,
  planToValidate,
  projectDestinationLink,
  scopeSummary,
  skippedResources,
  withheldSecrets,
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
    expect(historyFetchNotices(fetched({ releases: 1 }))).toEqual({ projectsNotFound: 0, detailsTooLarge: 0, nothingFound: false });
  });

  it('flagsNothingFound_OnlyWhenEveryProjectIsMissingAndNothingWasRead', () => {
    expect(historyFetchNotices(fetched({ projectsNotFound: 2 })).nothingFound).toBe(true);
    expect(historyFetchNotices(fetched({ projectsNotFound: 1 })).nothingFound).toBe(false);
    expect(historyFetchNotices(fetched({ projectsNotFound: 2, releases: 1 })).nothingFound).toBe(false);
  });

  it('reportsOversizedDetails', () => {
    expect(historyFetchNotices(fetched({ detailsTooLarge: 3 })).detailsTooLarge).toBe(3);
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
    [at(OctopusHistoryFetchPhase.Releases), 'Reading releases (project 1 of 2)'],
    [at(OctopusHistoryFetchPhase.ProjectConfiguration), 'Reading project configuration (project 1 of 2)'],
    [at(OctopusHistoryFetchPhase.Catalog, { catalogIndex: 3, catalogKindCount: 14 }), 'Reading space configuration (kind 4 of 14)'],
    [at(OctopusHistoryFetchPhase.Catalog), 'Reading space configuration'],
    [at(OctopusHistoryFetchPhase.Closure), 'Reading referenced resources'],
    [at(OctopusHistoryFetchPhase.Done, { done: true }), 'Finished reading from Octopus'],
  ])('labels %#', (progress, label) => {
    expect(fetchPositionLabel(progress)).toBe(label);
  });
});

describe('importSteps', () => {
  const input = (phase: string, overrides: Partial<Parameters<typeof importSteps>[1]> = {}) => ({
    phase, lastActivePhase: null, probed: false, fetchStarted: false, ...overrides,
  });

  it('namesTheStepsOfEachSource', () => {
    expect(importSteps('file', input('idle')).titles).toEqual(['Select file', 'Read file', 'Preview', 'Import']);
    expect(importSteps('server', input('idle')).titles)
      .toEqual(['Connect', 'Choose space', 'Read from Octopus', 'Preview', 'Import']);
  });

  it.each([
    ['idle', {}, 0, 'process'],
    ['uploading', {}, 1, 'process'],
    ['extracting', {}, 1, 'process'],
    ['previewing', {}, 2, 'process'],
    ['ready', {}, 2, 'process'],
    ['validating', {}, 3, 'process'],
    ['confirming', {}, 3, 'process'],
    ['statusUnknown', {}, 3, 'process'],
    ['succeeded', {}, 3, 'finish'],
    ['failed', { lastActivePhase: 'extracting' }, 1, 'error'],
    ['failed', { lastActivePhase: 'ready' }, 2, 'error'],
    ['failed', { lastActivePhase: 'confirming' }, 3, 'error'],
    ['failed', {}, 0, 'error'],
  ] as const)('file: %s %o -> step %i (%s)', (phase, overrides, current, status) => {
    const steps = importSteps('file', input(phase, overrides));
    expect({ current: steps.current, status: steps.status }).toEqual({ current, status });
  });

  it.each([
    ['idle', {}, 0, 'process'],
    ['idle', { probed: true }, 1, 'process'],
    ['idle', { probed: true, fetchStarted: true }, 2, 'process'],
    ['connecting', { probed: true }, 2, 'process'],
    ['fetching', { probed: true }, 2, 'process'],
    ['extracting', { probed: true }, 3, 'process'],
    ['previewing', { probed: true }, 3, 'process'],
    ['ready', { probed: true }, 3, 'process'],
    ['validating', {}, 4, 'process'],
    ['confirming', {}, 4, 'process'],
    ['statusUnknown', {}, 4, 'process'],
    ['succeeded', {}, 4, 'finish'],
    ['failed', { probed: true, lastActivePhase: 'connecting' }, 2, 'error'],
    ['failed', { probed: true, lastActivePhase: 'fetching' }, 2, 'error'],
    ['failed', { probed: true, lastActivePhase: 'previewing' }, 3, 'error'],
    ['failed', { probed: true, lastActivePhase: 'confirming' }, 4, 'error'],
    ['failed', { probed: true }, 1, 'error'],
  ] as const)('server: %s %o -> step %i (%s)', (phase, overrides, current, status) => {
    const steps = importSteps('server', input(phase, overrides));
    expect({ current: steps.current, status: steps.status }).toEqual({ current, status });
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
    ['NotServerSource', /Start again/],
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
