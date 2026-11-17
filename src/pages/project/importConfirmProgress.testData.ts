import {
  OctopusImportConfirmationPhase,
  OctopusImportConfirmationStage,
  type OctopusImportConfirmationProgress,
} from 'pages/apis/octopusImport';

/** A running import's progress for tests: release 1.2.3 of Project X, 3,120 of 4,990 done. */
export const confirmProgress = (extra: Partial<OctopusImportConfirmationProgress> = {}): OctopusImportConfirmationProgress => ({
  attemptId: 'attempt-1',
  attempt: 1,
  stage: OctopusImportConfirmationStage.Importing,
  itemsDone: 3120,
  itemsTotal: 4990,
  phases: [{ phase: OctopusImportConfirmationPhase.Releases, done: 3120, total: 4990 }],
  current: { phase: OctopusImportConfirmationPhase.Releases, kind: 'Release', name: '1.2.3', projectName: 'Project X', index: 3121 },
  recentLog: [],
  finished: false,
  startedAt: '2026-11-17T00:00:00Z',
  updatedAt: '2026-11-17T00:01:00Z',
  ...extra,
});
