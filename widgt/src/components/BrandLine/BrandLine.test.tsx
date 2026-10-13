import { render, screen } from '@testing-library/react';
import { BrandLine } from './BrandLine';

describe('BrandLine', () => {
  it('AC-1.1 renders the heading and the feefo logo', () => {
    render(<BrandLine heading="Product Rating" headingId="heading-id" />);
    expect(screen.getByRole('heading', { name: 'Product Rating' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'feefo' })).toBeInTheDocument();
  });

  it('AC-3.1 keeps the logo outside the heading it names', () => {
    render(<BrandLine heading="Product Rating" headingId="heading-id" />);
    expect(screen.getByRole('img', { name: 'feefo' }).closest('h2')).toBeNull();
  });
});
