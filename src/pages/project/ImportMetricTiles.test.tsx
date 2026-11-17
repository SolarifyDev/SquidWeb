import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImportMetricTiles } from './ImportMetricTiles';

const metrics = [
  { id: 'create', label: 'Create', value: 1234 },
  { id: 'alreadyImported', label: 'Already in Squid', value: 5 },
  { id: 'update', label: 'Update history', value: 0 },
  { id: 'notChosen', label: 'Not chosen', value: 2 },
];

describe('ImportMetricTiles', () => {
  it('showsFourHeadlineTiles_AndTheRestBehindDetails', () => {
    render(<ImportMetricTiles testIdPrefix="tile" metrics={metrics} details={[{ id: 'fill', label: 'Fill secret', value: 3 }]} />);

    expect(screen.getByTestId('tile-create')).toHaveTextContent('Create1,234');
    expect(screen.getByTestId('tile-notChosen')).toHaveTextContent('Not chosen2');
    const details = screen.getByTestId('tile-details');
    expect(details.tagName).toBe('DETAILS');
    expect(details).not.toHaveAttribute('open');
    expect(within(details).getByText('Details')).toBeInTheDocument();
    expect(within(details).getByTestId('tile-fill')).toHaveTextContent('Fill secret3');
  });

  it('labelsAreSentenceCase_NeverUppercased', () => {
    render(<ImportMetricTiles testIdPrefix="tile" metrics={metrics} />);

    expect(screen.getByText('Already in Squid')).not.toHaveClass('uppercase');
  });

  it('showsNoDetailsRow_WithoutDetails', () => {
    render(<ImportMetricTiles testIdPrefix="tile" metrics={metrics} />);

    expect(screen.queryByTestId('tile-details')).not.toBeInTheDocument();
  });

  it.each([
    [0, false],
    [3, true],
  ])('blocked=%i_IsInTheHeadlineRow=%s', (blocked, headline) => {
    render(
      <ImportMetricTiles
        testIdPrefix="tile"
        metrics={metrics}
        details={[{ id: 'fill', label: 'Fill secret', value: 1 }, { id: 'blocked', label: 'Blocked', value: blocked, alwaysVisibleWhenNonZero: true }]}
      />,
    );

    const inDetails = within(screen.getByTestId('tile-details')).queryByTestId('tile-blocked') !== null;
    expect(inDetails).toBe(!headline);
    expect(screen.getByTestId('tile-blocked')).toHaveTextContent(`Blocked${blocked}`);
    expect(screen.getByTestId('tile-blocked').classList.contains('border-red-200')).toBe(headline);
  });
});
