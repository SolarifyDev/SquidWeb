import {
  OctopusImportConfirmationPhase,
  OctopusImportConfirmationStage,
  OctopusImportResourceOutcomeState,
  OctopusImportSessionState,
  type OctopusImportConfirmationLogEntry,
  type OctopusImportConfirmationProgress,
  type OctopusImportSession,
} from 'pages/apis/octopusImport';

/** Percent for the import progress bar; held below 100 until the import has committed. */
export const confirmProgressPercent = (progress: OctopusImportConfirmationProgress | null | undefined) => {
  if (!progress) return 0;
  if (progress.finished && progress.stage === OctopusImportConfirmationStage.Succeeded) return 100;

  return Math.min(99, Math.floor((99 * progress.itemsDone) / Math.max(1, progress.itemsTotal)));
};

export const CONFIRM_STAGE_LABELS: Record<OctopusImportConfirmationStage, string> = {
  [OctopusImportConfirmationStage.Validating]: 'Validating the plan',
  [OctopusImportConfirmationStage.WaitingForSpaceLock]: 'Waiting for another import in this space',
  [OctopusImportConfirmationStage.Importing]: 'Importing',
  [OctopusImportConfirmationStage.FillingSecrets]: 'Filling secrets',
  [OctopusImportConfirmationStage.RecordingSourceMap]: 'Recording import mapping',
  [OctopusImportConfirmationStage.Committing]: 'Committing',
  [OctopusImportConfirmationStage.Succeeded]: 'Import complete',
  [OctopusImportConfirmationStage.Failed]: 'Import failed',
  [OctopusImportConfirmationStage.RolledBack]: 'Rolled back, nothing was imported',
};

export const confirmStageLabel = (stage: OctopusImportConfirmationStage) => CONFIRM_STAGE_LABELS[stage] ?? 'Importing';

export const CONFIRM_PHASE_LABELS: Record<OctopusImportConfirmationPhase, string> = {
  [OctopusImportConfirmationPhase.ProjectGroups]: 'Project groups',
  [OctopusImportConfirmationPhase.Environments]: 'Environments',
  [OctopusImportConfirmationPhase.Lifecycles]: 'Lifecycles',
  [OctopusImportConfirmationPhase.Feeds]: 'Feeds',
  [OctopusImportConfirmationPhase.Accounts]: 'Accounts',
  [OctopusImportConfirmationPhase.Teams]: 'Teams',
  [OctopusImportConfirmationPhase.LibraryVariableSets]: 'Library variable sets',
  [OctopusImportConfirmationPhase.Projects]: 'Projects',
  [OctopusImportConfirmationPhase.Channels]: 'Channels',
  [OctopusImportConfirmationPhase.Variables]: 'Variables',
  [OctopusImportConfirmationPhase.Processes]: 'Deployment processes',
  [OctopusImportConfirmationPhase.Releases]: 'Releases',
  [OctopusImportConfirmationPhase.Deployments]: 'Deployments',
};

export const confirmPhaseLabel = (phase: OctopusImportConfirmationPhase) => CONFIRM_PHASE_LABELS[phase] ?? 'Other';

const OUTCOME_VERBS: Partial<Record<OctopusImportResourceOutcomeState, string>> = {
  [OctopusImportResourceOutcomeState.Created]: 'Created',
  [OctopusImportResourceOutcomeState.Reused]: 'Reused',
  [OctopusImportResourceOutcomeState.Skipped]: 'Skipped',
  [OctopusImportResourceOutcomeState.Unsupported]: 'Skipped unsupported',
  [OctopusImportResourceOutcomeState.Blocked]: 'Blocked',
  [OctopusImportResourceOutcomeState.Failed]: 'Failed',
  [OctopusImportResourceOutcomeState.Updated]: 'Updated',
  [OctopusImportResourceOutcomeState.SecretFilled]: 'Filled the secret of',
};

const formatCount = (value: number) => value.toLocaleString('en-US');

/** "DeploymentStep" → "deployment step". */
export const kindNoun = (kind: string) => kind.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

// A project is not "of" itself.
const ofProject = (kind: string, projectName: string | null | undefined) => (projectName && kind !== 'Project' ? projectName : null);

const itemText = (kind: string, name: string | null | undefined) => [kindNoun(kind), name].filter(Boolean).join(' ');

/** What is being imported now, e.g. "Importing release 1.2.3 of Project X (3,120 of 4,990)"; the stage when no item is current. */
export const confirmCurrentLabel = (progress: OctopusImportConfirmationProgress) => {
  const current = progress.current;
  if (!current) return confirmStageLabel(progress.stage);

  const project = ofProject(current.kind, current.projectName);

  return `Importing ${itemText(current.kind, current.name)}${project ? ` of ${project}` : ''} (${formatCount(current.index)} of ${formatCount(progress.itemsTotal)})`;
};

/** One line of the recent activity, e.g. "Created release 1.2.3 (Project X)"; a stage change reads as the stage. */
export const confirmLogLine = (entry: OctopusImportConfirmationLogEntry) => {
  if (!entry.kind) return confirmStageLabel(entry.stage);

  const verb = (entry.outcome != null && OUTCOME_VERBS[entry.outcome]) || 'Processed';
  const project = ofProject(entry.kind, entry.projectName);

  return `${verb} ${itemText(entry.kind, entry.name)}${project ? ` (${project})` : ''}`;
};

/** "Releases 3,120/4,990". */
export const confirmPhaseLine = (phase: { phase: OctopusImportConfirmationPhase; done: number; total: number }) =>
  `${confirmPhaseLabel(phase.phase)} ${formatCount(phase.done)}/${formatCount(phase.total)}`;

export const confirmProgressStatus = (stage: OctopusImportConfirmationStage): 'active' | 'success' | 'exception' => {
  if (stage === OctopusImportConfirmationStage.Succeeded) return 'success';
  if (stage === OctopusImportConfirmationStage.Failed || stage === OctopusImportConfirmationStage.RolledBack) return 'exception';

  return 'active';
};

/** Changes whenever the import moves; the page gives up waiting only after this stays the same for the whole stall timeout. */
export const confirmProgressKey = (progress: OctopusImportConfirmationProgress | null | undefined) =>
  progress ? `${progress.attemptId}|${progress.attempt}|${progress.updatedAt}|${progress.itemsDone}` : '';

/** The session's import is running on the server. */
export const isImportingSession = (session: Pick<OctopusImportSession, 'state'> | null | undefined) =>
  session != null && Number(session.state) === OctopusImportSessionState.Importing;
