import { describe, expect, it } from 'vitest';
import {
  OctopusImportConfirmationPhase,
  OctopusImportConfirmationStage,
  OctopusImportResourceOutcomeState,
  OctopusImportSessionState,
} from 'pages/apis/octopusImport';
import {
  CONFIRM_PHASE_LABELS,
  CONFIRM_STAGE_LABELS,
  confirmCurrentLabel,
  confirmLogLine,
  confirmPhaseLine,
  confirmProgressKey,
  confirmProgressPercent,
  confirmProgressStatus,
  isImportingSession,
  kindNoun,
} from './importConfirmProgress';
import { confirmProgress } from './importConfirmProgress.testData';

const numericValues = (values: object) => Object.values(values).filter((value): value is number => typeof value === 'number');

describe('confirmProgressPercent', () => {
  it('isZero_WithoutProgress', () => {
    expect(confirmProgressPercent(null)).toBe(0);
  });

  it('isHeldBelow100_UntilTheImportCommitted', () => {
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 4990 }))).toBe(99);
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 4990, stage: OctopusImportConfirmationStage.Committing }))).toBe(99);
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 4990, finished: true, stage: OctopusImportConfirmationStage.RolledBack }))).toBe(99);
  });

  it('is100_OnlyOnceSucceeded', () => {
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 4990, finished: true, stage: OctopusImportConfirmationStage.Succeeded }))).toBe(100);
  });

  it('followsTheItemsDone_AndSurvivesAnEmptyPlan', () => {
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 2495 }))).toBe(49);
    expect(confirmProgressPercent(confirmProgress({ itemsDone: 0, itemsTotal: 0 }))).toBe(0);
  });
});

describe('labels', () => {
  it('everyStageHasALabel', () => {
    numericValues(OctopusImportConfirmationStage).forEach(stage => expect(CONFIRM_STAGE_LABELS[stage as OctopusImportConfirmationStage]).toBeTruthy());
  });

  it('everyPhaseHasALabel', () => {
    numericValues(OctopusImportConfirmationPhase).forEach(phase => expect(CONFIRM_PHASE_LABELS[phase as OctopusImportConfirmationPhase]).toBeTruthy());
  });

  it('kindNoun_SplitsTheKindIntoWords', () => {
    expect(kindNoun('DeploymentStep')).toBe('deployment step');
    expect(kindNoun('Release')).toBe('release');
  });
});

describe('confirmCurrentLabel', () => {
  it('namesTheItem_ItsProject_AndItsPosition', () => {
    expect(confirmCurrentLabel(confirmProgress())).toBe('Importing release 1.2.3 of Project X (3,121 of 4,990)');
  });

  it('aProjectIsNotOfItself', () => {
    const current = { phase: OctopusImportConfirmationPhase.Projects, kind: 'Project', name: 'Web', projectName: 'Web', index: 2 };

    expect(confirmCurrentLabel(confirmProgress({ current, itemsTotal: 9 }))).toBe('Importing project Web (2 of 9)');
  });

  it('readsAsTheStage_WhenNoItemIsCurrent', () => {
    expect(confirmCurrentLabel(confirmProgress({ current: null, stage: OctopusImportConfirmationStage.WaitingForSpaceLock }))).toBe('Waiting for another import in this space');
  });
});

describe('confirmLogLine', () => {
  it('saysWhatHappenedToTheItem', () => {
    const entry = { at: '', stage: OctopusImportConfirmationStage.Importing, kind: 'Release', name: '1.2.3', projectName: 'Project X', outcome: OctopusImportResourceOutcomeState.Created };

    expect(confirmLogLine(entry)).toBe('Created release 1.2.3 (Project X)');
  });

  it('readsAStageChangeAsTheStage', () => {
    expect(confirmLogLine({ at: '', stage: OctopusImportConfirmationStage.Committing })).toBe('Committing');
  });

  it('fallsBackToProcessed_WithoutAnOutcome', () => {
    expect(confirmLogLine({ at: '', stage: OctopusImportConfirmationStage.Importing, kind: 'Environment', name: 'Production' })).toBe('Processed environment Production');
  });
});

describe('the rest', () => {
  it('phaseLine', () => {
    expect(confirmPhaseLine({ phase: OctopusImportConfirmationPhase.Releases, done: 3120, total: 4990 })).toBe('Releases 3,120/4,990');
  });

  it.each([
    [OctopusImportConfirmationStage.Importing, 'active'],
    [OctopusImportConfirmationStage.Succeeded, 'success'],
    [OctopusImportConfirmationStage.Failed, 'exception'],
    [OctopusImportConfirmationStage.RolledBack, 'exception'],
  ])('status_%s', (stage, expected) => {
    expect(confirmProgressStatus(stage)).toBe(expected);
  });

  it('progressKey_ChangesWhenTheImportMoves', () => {
    expect(confirmProgressKey(null)).toBe('');
    expect(confirmProgressKey(confirmProgress())).toBe(confirmProgressKey(confirmProgress()));
    expect(confirmProgressKey(confirmProgress({ itemsDone: 3121 }))).not.toBe(confirmProgressKey(confirmProgress()));
    expect(confirmProgressKey(confirmProgress({ updatedAt: '2026-11-17T00:02:00Z' }))).not.toBe(confirmProgressKey(confirmProgress()));
  });

  it('isImportingSession', () => {
    expect(isImportingSession({ state: OctopusImportSessionState.Importing })).toBe(true);
    expect(isImportingSession({ state: OctopusImportSessionState.Validated })).toBe(false);
    expect(isImportingSession(null)).toBe(false);
  });
});
