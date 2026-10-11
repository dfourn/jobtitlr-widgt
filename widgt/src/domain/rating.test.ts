import { averageOf, totalOf } from './rating';
import type { RatingCounts } from './types';

/** The data in the brief's reference design (B2.1). */
const REFERENCE: RatingCounts = { 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 };
const NO_REVIEWS: RatingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

describe('totalOf', () => {
  it.each<[string, RatingCounts, number]>([
    ['the reference data', REFERENCE, 1232],
    ['no reviews', NO_REVIEWS, 0],
    ['a single 1-star review', { 5: 0, 4: 0, 3: 0, 2: 0, 1: 1 }, 1],
  ])('AC-2.1 sums the counts for %s', (_name, counts, expected) => {
    expect(totalOf(counts)).toBe(expected);
  });
});

describe('averageOf', () => {
  it.each<[string, RatingCounts, number]>([
    ['the reference data (5677 / 1232)', REFERENCE, 5677 / 1232],
    ['only 5-star reviews', { 5: 3, 4: 0, 3: 0, 2: 0, 1: 0 }, 5],
    ['only 1-star reviews', { 5: 0, 4: 0, 3: 0, 2: 0, 1: 7 }, 1],
    ['one 5-star and one 4-star review', { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 }, 4.5],
  ])('AC-2.1 weights each star by its count for %s', (_name, counts, expected) => {
    expect(averageOf(counts)).toBe(expected);
  });

  it('AC-2.1 gives about 4.608 for the reference data', () => {
    expect(averageOf(REFERENCE)).toBeCloseTo(4.608, 3);
  });

  it('AC-2.2 returns null, not NaN, when there are no reviews', () => {
    expect(averageOf(NO_REVIEWS)).toBeNull();
  });
});
