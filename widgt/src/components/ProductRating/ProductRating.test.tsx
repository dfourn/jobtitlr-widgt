import { render, screen, within } from '@testing-library/react';
import type { RatingCounts } from '../../domain';
import { ProductRating } from './ProductRating';

const REFERENCE_COUNTS: RatingCounts = { 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 };
const TOTAL = 1232;

function renderWidget(counts: RatingCounts = REFERENCE_COUNTS) {
  return render(<ProductRating counts={counts} />);
}

/** Reads a data-driven `--fill` custom property off an element's inline style. */
function fillOf(element: HTMLElement): number {
  const match = /--fill:\s*([^;]+)/.exec(element.getAttribute('style') ?? '');
  return Number.parseFloat((match?.[1] ?? '').trim());
}

describe('ProductRating', () => {
  it('AC-1.1 shows the label, the score text, the heading and the logo', () => {
    renderWidget();
    expect(screen.getByText('Excellent')).toBeVisible();
    expect(screen.getByText('4.6 out of 5')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Product Rating' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'feefo' })).toBeVisible();
  });

  it('AC-1.2 lists 5 rows from 5 down to 1 with the reference counts', () => {
    renderWidget();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const expected = [
      ['5', '952'],
      ['4', '171'],
      ['3', '55'],
      ['2', '14'],
      ['1', '40'],
    ] as const;
    rows.forEach((row, index) => {
      const [digit, count] = expected[index] ?? ['', ''];
      expect(within(row).getByText(digit)).toBeInTheDocument();
      expect(within(row).getByText(count)).toBeInTheDocument();
    });
  });

  it('AC-1.3 each bar fill is that rating share of the total, inside its track', () => {
    renderWidget();
    const expected = [
      { rating: 5, count: 952 },
      { rating: 4, count: 171 },
      { rating: 3, count: 55 },
      { rating: 2, count: 14 },
      { rating: 1, count: 40 },
    ];
    for (const { rating, count } of expected) {
      const fill = screen.getByTestId(`bar-fill-${rating}`);
      expect(fill.parentElement).toBe(screen.getByTestId(`bar-track-${rating}`));
      expect(fillOf(fill)).toBeCloseTo(count / TOTAL);
    }
  });

  it('AC-1.4 the five stars fills are [1, 1, 1, 1, 0.6]', () => {
    renderWidget();
    const expectedFills = [1, 1, 1, 1, 0.6];
    expectedFills.forEach((fill, index) => {
      expect(fillOf(screen.getByTestId(`star-${index + 1}`))).toBeCloseTo(fill);
    });
  });

  it('AC-1.5 counts are formatted for the locale', () => {
    renderWidget({ 5: 1232, 4: 0, 3: 0, 2: 0, 1: 0 });
    expect(screen.getByText('1,232')).toBeInTheDocument();
  });

  it('AC-2.2 with zero reviews it says "No reviews yet", fills no star and renders no NaN', () => {
    renderWidget({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    expect(screen.getByText('No reviews yet')).toBeVisible();
    for (const position of [1, 2, 3, 4, 5]) {
      expect(fillOf(screen.getByTestId(`star-${position}`))).toBe(0);
    }
    const widget = screen.getByTestId('product-rating');
    expect(widget.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.queryByText('Excellent')).not.toBeInTheDocument();
  });

  it('AC-2.4 labelFor receives the rounded score', () => {
    const labelFor = vi.fn(() => 'Great');
    render(<ProductRating counts={REFERENCE_COUNTS} labelFor={labelFor} />);
    expect(labelFor).toHaveBeenCalledWith(4.6);
    expect(screen.getByText('Great')).toBeVisible();
  });

  it('AC-3.1 the widget is a section named "Product rating"', () => {
    renderWidget();
    const widget = screen.getByRole('region', { name: 'Product Rating' });
    expect(widget.tagName).toBe('SECTION');
    expect(widget).toHaveAttribute('data-testid', 'product-rating');
  });

  it('AC-3.2 the star graphic is hidden and the logo is the only image', () => {
    renderWidget();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    for (const position of [1, 2, 3, 4, 5]) {
      const star = screen.getByTestId(`star-${position}`);
      expect(star.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('AC-3.3 static rows are list items named "N stars: C reviews (P%)"', () => {
    renderWidget();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      '5 stars: 952 reviews (77.3%)',
      '4 stars: 171 reviews (13.9%)',
      '3 stars: 55 reviews (4.5%)',
      '2 stars: 14 reviews (1.1%)',
      '1 star: 40 reviews (3.2%)',
    ]);
  });

  it('AC-3.4 the label and score text are sentence case in the DOM', () => {
    renderWidget();
    expect(screen.getByText('Excellent').textContent).toBe('Excellent');
    expect(screen.getByText('4.6 out of 5').textContent).toBe('4.6 out of 5');
  });

  it('AC-3.5 the logo is an img with alt "feefo" and the breakdown stars are decorative', () => {
    renderWidget();
    expect(screen.getByRole('img', { name: 'feefo' })).toHaveAttribute('alt', 'feefo');
    const list = screen.getByRole('list');
    expect(within(list).queryAllByRole('img')).toHaveLength(0);
    const smallStars = list.querySelectorAll('svg');
    expect(smallStars).toHaveLength(5);
    for (const star of smallStars) {
      expect(star.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
