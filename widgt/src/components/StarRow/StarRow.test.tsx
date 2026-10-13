import { render, screen } from '@testing-library/react';
import { StarRow } from './StarRow';

describe('StarRow', () => {
  it('AC-3.2 wraps the five stars in an element hidden from assistive technology', () => {
    render(<StarRow fills={[1, 1, 1, 1, 0.6]} />);
    for (const position of [1, 2, 3, 4, 5]) {
      const star = screen.getByTestId(`star-${position}`);
      expect(star.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('AC-1.4 maps the fills onto the star positions in order', () => {
    render(<StarRow fills={[0.1, 0.2, 0.3, 0.4, 0.5]} />);
    expect(screen.getByTestId('star-1').getAttribute('style')).toContain('0.1');
    expect(screen.getByTestId('star-5').getAttribute('style')).toContain('0.5');
  });
});
