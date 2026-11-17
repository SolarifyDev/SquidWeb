import {
  OctopusImportResumeStep,
  OctopusImportSessionState,
  OctopusImportSourceKind,
  type OctopusHistoryFetchProgress,
  type OctopusImportHistoryFetch,
  type OctopusImportResumableSession,
  type OctopusImportSession,
} from 'pages/apis/octopusImport';
import { fetchProgressPercent } from './importPreviewSummary';

/** The query parameter that keeps the page's import session across a reload. Only the id: never the API key or anything secret. */
export const SESSION_PARAM = 'session';

/** The source format of a session that reads from an Octopus server (OctopusImportServerSourceService.ServerSourceFormat). */
const SERVER_SOURCE_FORMAT = 'OctopusServer';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session id the page's URL names; null when absent or not a session id. */
export const sessionIdFrom = (search: string): string | null => {
  const id = new URLSearchParams(search).get(SESSION_PARAM)?.trim() ?? '';
  return GUID.test(id) ? id : null;
};

export const isServerSession = (session: OctopusImportSession) => session.sourceSummary?.detectedFormat === SERVER_SOURCE_FORMAT;

const afterUpload = (session: OctopusImportSession) =>
  isServerSession(session) && !session.sourceSummary?.historyFetch?.done ? OctopusImportResumeStep.ResumeRead : OctopusImportResumeStep.ContinueAfterRead;

/** Where a reopened session continues; null when there is nothing to continue. Mirrors the backend's OctopusImportResumeSteps. */
export const reopenStepOf = (session: OctopusImportSession): OctopusImportResumeStep | null => {
  switch (Number(session.state)) {
    case OctopusImportSessionState.Uploaded:
      return afterUpload(session);
    case OctopusImportSessionState.Extracted:
      return OctopusImportResumeStep.ContinueAfterRead;
    case OctopusImportSessionState.Previewed:
      return OctopusImportResumeStep.Preview;
    case OctopusImportSessionState.Validated:
      return session.lastConfirmationFailure ? OctopusImportResumeStep.RetryImport : OctopusImportResumeStep.Preview;
    case OctopusImportSessionState.Importing:
      return OctopusImportResumeStep.FollowImport;
    default:
      return null;
  }
};

/** The URL a reopened read resumes with: the one the session kept, or (an older session) its host over https, editable by the user. */
export const reopenServerUrl = (session: OctopusImportSession) => {
  const fetch = session.sourceSummary?.historyFetch;
  if (fetch?.serverUrl) return fetch.serverUrl;
  return fetch?.serverHost ? `https://${fetch.serverHost}` : '';
};

/** The read's progress as the session's cursor records it. */
export const progressOf = (fetch: OctopusImportHistoryFetch): OctopusHistoryFetchProgress => ({
  phase: fetch.phase,
  projectIndex: fetch.projectIndex,
  projectCount: fetch.projectIds?.length ?? 0,
  counts: fetch.counts,
  totalBytes: fetch.totalBytes,
  done: fetch.done,
});

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const projectsText = (row: OctopusImportResumableSession) => {
  const count = row.selectedProjectCount;
  if (count === null || count === undefined) return 'whole space';

  const names = row.selectedProjectNames ?? [];
  if (!names.length) return plural(count, 'project');

  return `${plural(count, 'project')} (${names.join(', ')}${count > names.length ? ', …' : ''})`;
};

const STEP_TEXT: Record<OctopusImportResumeStep, string> = {
  [OctopusImportResumeStep.ResumeRead]: 'reading stopped',
  [OctopusImportResumeStep.ContinueAfterRead]: 'read, not previewed yet',
  [OctopusImportResumeStep.Preview]: 'previewed',
  [OctopusImportResumeStep.FollowImport]: 'importing',
  [OctopusImportResumeStep.RetryImport]: 'import can be tried again',
};

const stepText = (row: OctopusImportResumableSession) =>
  row.resumeStep === OctopusImportResumeStep.ResumeRead && row.readProgress
    ? `reading stopped at ${fetchProgressPercent(row.readProgress)}%`
    : STEP_TEXT[row.resumeStep];

const expiresText = (expiresAt: string, now: number) => {
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 60000));
  return minutes < 60 ? `expires in ${minutes} min` : `expires in ${Math.floor(minutes / 60)} h`;
};

const sourceText = (row: OctopusImportResumableSession) =>
  row.sourceKind === OctopusImportSourceKind.OctopusServer
    ? [row.serverHost ?? row.serverUrl ?? 'Octopus server', row.octopusSpaceId].filter(Boolean).join(' · ')
    : row.fileName ?? 'Export file';

/** One line describing a session to continue, e.g. "octopus.acme.com · Spaces-1 · 12 projects (Api, Worker, …) · reading stopped at 40% · expires in 3 h". */
export const resumeRowText = (row: OctopusImportResumableSession, now = Date.now()) =>
  [sourceText(row), projectsText(row), stepText(row), expiresText(row.expiresAt, now)].join(' · ');
