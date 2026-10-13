import { render, screen } from '@testing-library/react';
import { ScoreText } from './ScoreText';

describe('ScoreText', () => {
  it('AC-1.1 shows the score with exactly one decimal, so 5 reads "5.0 out of 5"', () => {
    render(<ScoreText score={5} locale="en-GB" />);
    expect(screen.getByText('5.0 out of 5')).toBeInTheDocument();
  });

  it('AC-1.1 shows a typical score as "4.6 out of 5"', () => {
    render(<ScoreText score={4.6} locale="en-GB" />);
    expect(screen.getByText('4.6 out of 5')).toBeInTheDocument();
  });

  it('AC-2.2 says "No reviews yet" when there is no score', () => {
    render(<ScoreText score={null} locale="en-GB" />);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });
});
