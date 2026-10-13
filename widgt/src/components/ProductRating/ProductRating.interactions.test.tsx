import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RatingCounts, StarRating } from '../../domain';
import { ProductRating } from './ProductRating';

const REFERENCE_COUNTS: RatingCounts = { 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 };

const ROW_NAMES = [
  '5 stars: 952 reviews (77.3%)',
  '4 stars: 171 reviews (13.9%)',
  '3 stars: 55 reviews (4.5%)',
  '2 stars: 14 reviews (1.1%)',
  '1 star: 40 reviews (3.2%)',
] as const;

function rowButton(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

function pressedButtons(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true');
}

describe('ProductRating interactions', () => {
  it('AC-4.1 without onRatingSelect there are no buttons and no tab stops', () => {
    render(<ProductRating counts={REFERENCE_COUNTS} />);
    const widget = screen.getByTestId('product-rating');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(widget.querySelectorAll('[aria-pressed]')).toHaveLength(0);
    expect(widget.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('AC-4.2 with onRatingSelect each row is a toggle button, and clicking one reports and presses it', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn();
    render(<ProductRating counts={REFERENCE_COUNTS} onRatingSelect={onRatingSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    const row5 = rowButton(ROW_NAMES[0]);
    await user.click(row5);
    expect(onRatingSelect).toHaveBeenCalledWith(5);
    expect(row5).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC-4.3 clicking the selected row again reports null and clears it', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn();
    render(<ProductRating counts={REFERENCE_COUNTS} onRatingSelect={onRatingSelect} />);
    const row3 = rowButton(ROW_NAMES[2]);
    await user.click(row3);
    expect(onRatingSelect).toHaveBeenLastCalledWith(3);
    expect(row3).toHaveAttribute('aria-pressed', 'true');
    await user.click(row3);
    expect(onRatingSelect).toHaveBeenLastCalledWith(null);
    expect(row3).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC-4.4 selecting another row moves the selection', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn();
    render(<ProductRating counts={REFERENCE_COUNTS} onRatingSelect={onRatingSelect} />);
    const row5 = rowButton(ROW_NAMES[0]);
    const row2 = rowButton(ROW_NAMES[3]);
    const row1 = rowButton(ROW_NAMES[4]);
    await user.click(row5);
    expect(pressedButtons()).toEqual([row5]);
    await user.click(row2);
    expect(pressedButtons()).toEqual([row2]);
    expect(onRatingSelect).toHaveBeenLastCalledWith(2);
    await user.click(row1);
    expect(pressedButtons()).toEqual([row1]);
    expect(onRatingSelect).toHaveBeenLastCalledWith(1);
  });

  it('AC-4.5 Tab reaches the rows 5 to 1, and Enter and Space toggle them', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn();
    render(<ProductRating counts={REFERENCE_COUNTS} onRatingSelect={onRatingSelect} />);
    for (const name of ROW_NAMES) {
      await user.tab();
      expect(rowButton(name)).toHaveFocus();
    }
    await user.tab();
    expect(document.body).toHaveFocus(); // nothing else inside the widget
    const row1 = rowButton(ROW_NAMES[4]);
    row1.focus();
    await user.keyboard('{Enter}');
    expect(onRatingSelect).toHaveBeenLastCalledWith(1);
    expect(row1).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    expect(onRatingSelect).toHaveBeenLastCalledWith(null);
    expect(row1).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC-4.6 in controlled mode selectedRating decides the pressed row and clicks only call back', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn();
    const { rerender } = render(
      <ProductRating
        counts={REFERENCE_COUNTS}
        selectedRating={3}
        onRatingSelect={onRatingSelect}
      />,
    );
    const row3 = rowButton(ROW_NAMES[2]);
    const row5 = rowButton(ROW_NAMES[0]);
    expect(row3).toHaveAttribute('aria-pressed', 'true');
    await user.click(row5);
    expect(onRatingSelect).toHaveBeenLastCalledWith(5);
    expect(row3).toHaveAttribute('aria-pressed', 'true'); // still controlled
    expect(row5).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <ProductRating
        counts={REFERENCE_COUNTS}
        selectedRating={5}
        onRatingSelect={onRatingSelect}
      />,
    );
    expect(row5).toHaveAttribute('aria-pressed', 'true');
    expect(row3).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC-4.6 clicking the controlled row still reports null for a toggle off', async () => {
    const user = userEvent.setup();
    const onRatingSelect = vi.fn<(rating: StarRating | null) => void>();
    render(
      <ProductRating
        counts={REFERENCE_COUNTS}
        selectedRating={4}
        onRatingSelect={onRatingSelect}
      />,
    );
    await user.click(rowButton(ROW_NAMES[1]));
    expect(onRatingSelect).toHaveBeenLastCalledWith(null);
    expect(rowButton(ROW_NAMES[1])).toHaveAttribute('aria-pressed', 'true');
  });
});
