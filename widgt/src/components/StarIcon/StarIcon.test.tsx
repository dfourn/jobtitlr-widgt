import { render } from '@testing-library/react';
import { StarIcon } from './StarIcon';

describe('StarIcon', () => {
  it('AC-3.2 is an svg hidden from assistive technology', () => {
    const { container } = render(<StarIcon />);
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('focusable')).toBe('false');
  });

  it('AC-3.5 carries no name of its own', () => {
    const { container } = render(<StarIcon />);
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('aria-label')).toBeNull();
    expect(icon?.querySelector('title')).toBeNull();
  });
});
