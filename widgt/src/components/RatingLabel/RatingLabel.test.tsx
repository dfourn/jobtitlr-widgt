import { render, screen } from '@testing-library/react';
import { RatingLabel } from './RatingLabel';

describe('RatingLabel', () => {
  it('AC-3.4 keeps the label sentence case in the DOM', () => {
    render(<RatingLabel label="Excellent" />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('Excellent').textContent).toBe('Excellent');
  });
});
