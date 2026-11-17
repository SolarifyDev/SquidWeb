import { describe, expect, it } from 'vitest';
import {
  OctopusHistoryFetchPhase,
  OctopusImportConfirmationFailureReason,
  OctopusImportResumeStep,
  OctopusImportSessionState,
  OctopusImportSourceKind,
  type OctopusImportResumableSession,
  type OctopusImportSession,
} from 'pages/apis/octopusImport';
import { SESSION_PARAM, reopenServerUrl, reopenStepOf, resumeRowText, sessionIdFrom } from './importSessionResume';

const ID = '6a1d2c3b-0000-4000-8000-0000000000aa';

const counts = { releases: 0, deployments: 0, serverTasks: 0, detailsFetched: 0, detailsSkipped: 0 };

const serverSession = (state: OctopusImportSessionState, done: boolean, fetch: Partial<NonNullable<NonNullable<OctopusImportSession['sourceSummary']>['historyFetch']>> = {}): OctopusImportSession => ({
  sessionId: ID,
  destinationSpaceId: 1,
  state,
  sourceSummary: {
    fileName: 'history.zip', contentType: 'application/zip', sizeBytes: 0, detectedFormat: 'OctopusServer', sha256: null,
    historyFetch: {
      serverHost: 'octopus.acme.com', octopusSpaceId: 'Spaces-1', installationId: null, octopusVersion: null, spaceless: false,
      projectIds: [], projectIndex: 0, phase: OctopusHistoryFetchPhase.Catalog, counts, totalBytes: 0, done, ...fetch,
    },
  },
});

const fileSession = (state: OctopusImportSessionState): OctopusImportSession => ({
  sessionId: ID,
  destinationSpaceId: 1,
  state,
  sourceSummary: { fileName: 'export.zip', contentType: 'application/zip', sizeBytes: 1, detectedFormat: 'OctopusExport', sha256: null },
});

const row = (overrides: Partial<OctopusImportResumableSession> = {}): OctopusImportResumableSession => ({
  sessionId: ID,
  state: OctopusImportSessionState.Uploaded,
  resumeStep: OctopusImportResumeStep.ResumeRead,
  sourceKind: OctopusImportSourceKind.OctopusServer,
  serverHost: 'octopus.acme.com',
  octopusSpaceId: 'Spaces-1',
  selectedProjectCount: 12,
  selectedProjectNames: ['Api', 'Worker'],
  createdAt: '2026-11-17T00:00:00Z',
  updatedAt: '2026-11-17T01:00:00Z',
  expiresAt: '2026-11-17T05:00:00Z',
  ...overrides,
});

describe('sessionIdFrom', () => {
  it.each([
    [`?${SESSION_PARAM}=${ID}`, ID],
    [`?other=1&${SESSION_PARAM}=${ID.toUpperCase()}`, ID.toUpperCase()],
    [`?${SESSION_PARAM}=session-1`, null],
    [`?${SESSION_PARAM}=`, null],
    ['', null],
    [`?${SESSION_PARAM}=${ID}%27%3Balert(1)`, null],
  ])('%s -> %s', (search, expected) => {
    expect(sessionIdFrom(search)).toBe(expected);
  });
});

describe('reopenStepOf', () => {
  it.each([
    ['server read in progress', serverSession(OctopusImportSessionState.Uploaded, false), OctopusImportResumeStep.ResumeRead],
    ['server read done', serverSession(OctopusImportSessionState.Uploaded, true), OctopusImportResumeStep.ContinueAfterRead],
    ['file uploaded', fileSession(OctopusImportSessionState.Uploaded), OctopusImportResumeStep.ContinueAfterRead],
    ['extracted', fileSession(OctopusImportSessionState.Extracted), OctopusImportResumeStep.ContinueAfterRead],
    ['previewed', serverSession(OctopusImportSessionState.Previewed, true), OctopusImportResumeStep.Preview],
    ['validated', serverSession(OctopusImportSessionState.Validated, true), OctopusImportResumeStep.Preview],
    ['importing', serverSession(OctopusImportSessionState.Importing, true), OctopusImportResumeStep.FollowImport],
    ['succeeded', serverSession(OctopusImportSessionState.Succeeded, true), null],
    ['failed', fileSession(OctopusImportSessionState.Failed), null],
    ['expired', fileSession(OctopusImportSessionState.Expired), null],
  ])('%s', (_name, session, expected) => {
    expect(reopenStepOf(session)).toBe(expected);
  });

  it('validatedAfterAFailedAttempt_RetryImport', () => {
    const failed = {
      ...serverSession(OctopusImportSessionState.Validated, true),
      lastConfirmationFailure: { attemptId: 'a', reason: OctopusImportConfirmationFailureReason.RolledBack, transient: false, attempts: 1 },
    };
    expect(reopenStepOf(failed)).toBe(OctopusImportResumeStep.RetryImport);
  });
});

describe('reopenServerUrl', () => {
  it('prefersTheKeptUrl_FallsBackToTheHostOverHttps', () => {
    expect(reopenServerUrl(serverSession(OctopusImportSessionState.Uploaded, false, { serverUrl: 'https://octopus.acme.com/octopus' }))).toBe('https://octopus.acme.com/octopus');
    expect(reopenServerUrl(serverSession(OctopusImportSessionState.Uploaded, false))).toBe('https://octopus.acme.com');
    expect(reopenServerUrl(fileSession(OctopusImportSessionState.Uploaded))).toBe('');
  });
});

describe('resumeRowText', () => {
  const now = new Date('2026-11-17T02:00:00Z').getTime();

  it('serverRead_NamesHostSpaceProjectsStepAndExpiry', () => {
    expect(resumeRowText(row(), now)).toBe('octopus.acme.com · Spaces-1 · 12 projects (Api, Worker, …) · reading stopped · expires in 3 h');
  });

  it('readProgress_ShowsHowFarTheReadGot', () => {
    const readProgress = { phase: OctopusHistoryFetchPhase.Done, projectIndex: 0, projectCount: 0, counts, totalBytes: 0, done: true };
    expect(resumeRowText(row({ readProgress }), now)).toContain('reading stopped at 100%');
  });

  it('exportFile_WholeSpace_NamesTheFile', () => {
    const text = resumeRowText(row({ sourceKind: OctopusImportSourceKind.ExportFile, fileName: 'acme.zip', selectedProjectCount: null, selectedProjectNames: [], resumeStep: OctopusImportResumeStep.Preview, expiresAt: '2026-11-17T02:30:00Z' }), now);
    expect(text).toBe('acme.zip · whole space · previewed · expires in 30 min');
  });

  it('allNamesKnown_NoEllipsis', () => {
    expect(resumeRowText(row({ selectedProjectCount: 1, selectedProjectNames: ['Web'] }), now)).toContain('1 project (Web)');
  });
});
