import { render, screen, within } from '@testing-library/react';
import { summarise } from '../../domain';
import { RatingBreakdown } from './RatingBreakdown';

const rows = summarise({ 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 }).rows;

describe('RatingBreakdown', () => {
  it('AC-1.2 lists exactly five rows, 5 down to 1', () => {
    render(<RatingBreakdown rows={rows} locale="en-GB" selectedRating={null} onToggle={null} />);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAttribute('aria-label', '5 stars: 952 reviews (77.3%)');
    expect(items[4]).toHaveAttribute('aria-label', '1 star: 40 reviews (3.2%)');
  });
});
