import { render, screen } from '@testing-library/react';
import { Star } from './Star';

/** Reads the raw inline `--fill` value, so a unit can be seen if one appears. */
function fillTextOf(element: HTMLElement): string {
  const match = /--fill:\s*([^;]+)/.exec(element.getAttribute('style') ?? '');
  return (match?.[1] ?? '').trim();
}

describe('Star', () => {
  it('AC-1.4 exposes its fill as a unitless --fill custom property', () => {
    render(<Star position={5} fill={0.6} />);
    const star = screen.getByTestId('star-5');
    expect(star).toBeInTheDocument();
    expect(fillTextOf(star)).toBe('0.6');
  });

  it('AC-1.4 keeps --fill unitless so a full star is 1 and an empty one is 0', () => {
    const { rerender } = render(<Star position={1} fill={1} />);
    expect(fillTextOf(screen.getByTestId('star-1'))).toBe('1');
    rerender(<Star position={1} fill={0} />);
    expect(fillTextOf(screen.getByTestId('star-1'))).toBe('0');
  });
});
