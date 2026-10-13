import { render, screen } from '@testing-library/react';
import type { RatingRowModel } from '../../domain';
import { BreakdownRow } from './BreakdownRow';

const ROW: RatingRowModel = { rating: 5, count: 952, share: 952 / 1232 };

function fillOf(element: HTMLElement): number {
  const match = /--fill:\s*([^;]+)/.exec(element.getAttribute('style') ?? '');
  return Number.parseFloat((match?.[1] ?? '').trim());
}

describe('BreakdownRow', () => {
  it('AC-1.2 shows the rating digit and the formatted count as their own elements', () => {
    render(
      <BreakdownRow row={ROW} locale="en-GB" selected={false} onToggle={null} />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('952')).toBeInTheDocument();
  });

  it('AC-1.3 sizes the bar fill to the rating share of the total', () => {
    render(
      <BreakdownRow row={ROW} locale="en-GB" selected={false} onToggle={null} />,
    );
    expect(screen.getByTestId('bar-fill-5')).toBeInTheDocument();
    expect(fillOf(screen.getByTestId('bar-fill-5'))).toBeCloseTo(952 / 1232);
  });

  it('AC-3.3 names the static row for assistive technology', () => {
    render(
      <BreakdownRow row={ROW} locale="en-GB" selected={false} onToggle={null} />,
    );
    expect(screen.getByRole('listitem', { name: '5 stars: 952 reviews (77.3%)' })).toBeInTheDocument();
  });

  it('AC-4.2 renders a named toggle button in interactive mode', () => {
    render(
      <BreakdownRow row={ROW} locale="en-GB" selected={false} onToggle={() => undefined} />,
    );
    const button = screen.getByRole('button', { name: '5 stars: 952 reviews (77.3%)' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
