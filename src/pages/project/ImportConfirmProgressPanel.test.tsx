import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OctopusImportConfirmationStage, OctopusImportResourceOutcomeState } from 'pages/apis/octopusImport';
import { ImportConfirmProgressPanel } from './ImportConfirmProgressPanel';
import { confirmProgress } from './importConfirmProgress.testData';

const created = (name: string) => ({ at: name, stage: OctopusImportConfirmationStage.Importing, kind: 'Release', name, projectName: 'Project X', outcome: OctopusImportResourceOutcomeState.Created });

describe('ImportConfirmProgressPanel', () => {
  it('showsTheBar_TheCurrentItem_ThePhases_AndTheActivityNewestFirst', () => {
    render(<ImportConfirmProgressPanel progress={confirmProgress({ recentLog: [created('1.2.1'), created('1.2.2')] })} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-progress-current')).toHaveTextContent('Importing release 1.2.3 of Project X (3,121 of 4,990)');
    expect(screen.getByTestId('confirm-progress-phases')).toHaveTextContent('Releases 3,120/4,990');
    const lines = within(screen.getByTestId('confirm-progress-log')).getAllByRole('listitem').map(item => item.textContent);
    expect(lines).toEqual(['Created release 1.2.2 (Project X)', 'Created release 1.2.1 (Project X)']);
    expect(screen.getByTestId('confirm-progress-activity')).toHaveAttribute('open');
  });

  it('startsIndeterminate_BeforeTheFirstProgress', () => {
    render(<ImportConfirmProgressPanel progress={null} />);

    expect(screen.getByTestId('confirm-progress-current')).toHaveTextContent('Starting the import...');
    expect(screen.queryByTestId('confirm-progress-log')).not.toBeInTheDocument();
  });

  it('foldsTheActivityAway_OnceFinished', () => {
    render(<ImportConfirmProgressPanel progress={confirmProgress({ current: null, finished: true, stage: OctopusImportConfirmationStage.RolledBack, recentLog: [created('1.2.1')] })} />);

    expect(screen.getByTestId('confirm-progress-current')).toHaveTextContent('Rolled back, nothing was imported');
    expect(screen.getByTestId('confirm-progress-activity')).not.toHaveAttribute('open');
  });

  it('saysWhichRetryItIs', () => {
    render(<ImportConfirmProgressPanel progress={confirmProgress({ attempt: 2 })} />);

    expect(screen.getByTestId('confirm-progress-current')).toHaveTextContent('(retry 1)');
  });
});
