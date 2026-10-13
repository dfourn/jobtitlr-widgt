import { rowName } from './rowName';

describe('rowName', () => {
  it('AC-3.3 names a row "N stars: C reviews (P%)"', () => {
    expect(rowName({ rating: 5, count: 952, share: 952 / 1232 }, 'en-GB')).toBe(
      '5 stars: 952 reviews (77.3%)',
    );
    expect(rowName({ rating: 4, count: 171, share: 171 / 1232 }, 'en-GB')).toBe(
      '4 stars: 171 reviews (13.9%)',
    );
  });

  it('AC-3.3 uses the singular for 1 star and 1 review', () => {
    expect(rowName({ rating: 1, count: 1, share: 1 }, 'en-GB')).toBe('1 star: 1 review (100%)');
    expect(rowName({ rating: 1, count: 40, share: 40 / 1232 }, 'en-GB')).toBe(
      '1 star: 40 reviews (3.2%)',
    );
  });

  it('AC-2.2 names an empty row without NaN', () => {
    expect(rowName({ rating: 5, count: 0, share: 0 }, 'en-GB')).toBe('5 stars: 0 reviews (0%)');
  });
});
