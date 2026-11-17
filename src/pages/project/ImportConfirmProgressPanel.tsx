import React from 'react';
import { Progress } from 'antd';
import type { OctopusImportConfirmationProgress } from 'pages/apis/octopusImport';
import { ImportDisclosure } from './ImportDisclosure';
import {
  confirmCurrentLabel,
  confirmLogLine,
  confirmPhaseLine,
  confirmProgressPercent,
  confirmProgressStatus,
} from './importConfirmProgress';

/**
 * How far the running import is: a bar, the item being imported now, the count per phase and the recent activity. Before the server's
 * first progress write it shows an indeterminate start; once the import ended it keeps its final state, the activity folded away.
 */
export const ImportConfirmProgressPanel: React.FC<{ progress?: OctopusImportConfirmationProgress | null }> = ({ progress }) => {
  if (!progress)
    return (
      <div data-testid="confirm-progress" className="space-y-1 text-xs text-slate-500">
        <Progress className="!mb-0" percent={100} status="active" showInfo={false} size="small" />
        <div data-testid="confirm-progress-current">Starting the import...</div>
      </div>
    );

  return (
    <div data-testid="confirm-progress" className="space-y-1.5 text-xs text-slate-500">
      <Progress className="!mb-0" percent={confirmProgressPercent(progress)} status={confirmProgressStatus(progress.stage)} size="small" />
      <div data-testid="confirm-progress-current" className="font-medium text-slate-700">
        {confirmCurrentLabel(progress)}
        {progress.attempt > 1 ? ` (retry ${progress.attempt - 1})` : ''}
      </div>
      {progress.phases.length ? (
        <div data-testid="confirm-progress-phases" className="flex flex-wrap gap-x-3 gap-y-0.5">
          {progress.phases.map(phase => (
            <span key={phase.phase}>{confirmPhaseLine(phase)}</span>
          ))}
        </div>
      ) : null}
      {progress.recentLog.length ? (
        <ImportDisclosure key={String(progress.finished)} summary="Recent activity" bordered={false} defaultOpen={!progress.finished} testId="confirm-progress-activity">
          <ol data-testid="confirm-progress-log" className="max-h-48 space-y-0.5 overflow-y-auto">
            {[...progress.recentLog].reverse().map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="truncate">
                {confirmLogLine(entry)}
              </li>
            ))}
          </ol>
        </ImportDisclosure>
      ) : null}
    </div>
  );
};
