import { averageOf, roundScore, totalOf } from './rating';
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

describe('roundScore', () => {
  it.each<[number, number]>([
    [4.608, 4.6],
    [4.64, 4.6],
    [4.6499, 4.6],
    // x.x5 must round half-up. 4.35, 1.15 and 2.55 are stored as doubles just
    // below the decimal value, which is exactly where `toFixed(1)` rounds down.
    [4.65, 4.7],
    [4.25, 4.3],
    [1.05, 1.1],
    [4.35, 4.4],
    [1.15, 1.2],
    [2.55, 2.6],
    [4.95, 5],
    [5, 5],
    [1, 1],
  ])('AC-2.1 rounds %s half-up to %s', (average, expected) => {
    expect(roundScore(average)).toBe(expected);
  });

  it.each<[string, number, RatingCounts]>([
    ['93 / 20 = 4.65', 4.7, { 5: 13, 4: 7, 3: 0, 2: 0, 1: 0 }],
    ['87 / 20 = 4.35', 4.4, { 5: 7, 4: 13, 3: 0, 2: 0, 1: 0 }],
    ['the reference data', 4.6, REFERENCE],
  ])('AC-2.1 rounds an average computed from counts (%s) to %s', (_name, expected, counts) => {
    const average = averageOf(counts);
    expect(average).not.toBeNull();
    expect(roundScore(average ?? Number.NaN)).toBe(expected);
  });
});
