import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OctopusImportResumeStep, OctopusImportSessionState, OctopusImportSourceKind, type OctopusImportResumableSession } from 'pages/apis/octopusImport';
import { ImportResumeList } from './ImportResumeList';

const row = (sessionId: string): OctopusImportResumableSession => ({
  sessionId,
  state: OctopusImportSessionState.Uploaded,
  resumeStep: OctopusImportResumeStep.ResumeRead,
  sourceKind: OctopusImportSourceKind.OctopusServer,
  serverHost: 'octopus.acme.com',
  octopusSpaceId: 'Spaces-1',
  selectedProjectCount: 2,
  selectedProjectNames: ['Api', 'Worker'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
});

describe('ImportResumeList', () => {
  it('rendersOneRowPerSession_WithoutAnyKeyField', () => {
    render(<ImportResumeList sessions={[row('a'), row('b')]} onContinue={vi.fn()} />);

    expect(screen.getAllByTestId('import-resume-row')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Continue an earlier import' })).toBeInTheDocument();
    expect(document.querySelector('input')).toBeNull();
    expect(screen.getAllByTestId('import-resume-row')[0]).toHaveTextContent('octopus.acme.com · Spaces-1 · 2 projects (Api, Worker)');
  });

  it('hiddenWhenThereIsNothingToContinue', () => {
    const { container } = render(<ImportResumeList sessions={[]} onContinue={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('continue_HandsTheRowsSessionId', () => {
    const onContinue = vi.fn();
    render(<ImportResumeList sessions={[row('a'), row('b')]} onContinue={onContinue} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' })[1]);

    expect(onContinue).toHaveBeenCalledWith('b');
  });
});
