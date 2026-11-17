import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportStepSection } from './ImportStepSection';

const renderSection = (status: 'done' | 'current' | 'error' | 'future') => render(
  <ImportStepSection id="connect" number={2} title="Connect" status={status} summary="Octopus 2026.1" actions={<button type="button">Go</button>}>
    <div>Body</div>
  </ImportStepSection>,
);

describe('ImportStepSection', () => {
  it.each([
    ['done', 'Done', false],
    ['current', 'Current step', true],
    ['error', 'Failed', true],
  ] as const)('%s_ShowsItsCircleTheSummaryAndTheBody', (status, statusText, showsNumber) => {
    renderSection(status);

    const section = screen.getByTestId('import-section-connect');
    expect(section).toHaveAttribute('data-status', status);
    expect(within(section).getByRole('heading', { name: 'Connect' })).toBeInTheDocument();
    expect(within(section).getByTestId('section-circle')).toHaveTextContent(statusText);
    expect(within(section).getByTestId('section-circle').textContent?.startsWith('2')).toBe(showsNumber);
    expect(screen.getByTestId('import-section-connect-summary')).toHaveTextContent('Octopus 2026.1');
    expect(within(section).getByText('Body')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('future_ShowsOnlyTheMutedHeader', () => {
    renderSection('future');

    const section = screen.getByTestId('import-section-connect');
    expect(section).toHaveAttribute('data-status', 'future');
    expect(within(section).getByRole('heading', { name: 'Connect' })).toHaveClass('text-slate-400');
    expect(within(section).getByTestId('section-circle')).toHaveTextContent('2Not started');
    expect(screen.queryByTestId('import-section-connect-summary')).not.toBeInTheDocument();
    expect(within(section).queryByText('Body')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Go' })).not.toBeInTheDocument();
  });
});
