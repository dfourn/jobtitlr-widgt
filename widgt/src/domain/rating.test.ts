import {
  averageOf,
  defaultLabelFor,
  roundScore,
  shareOf,
  starFills,
  totalOf,
  validateCounts,
  type StarFills,
} from './rating';
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

describe('starFills', () => {
  it.each<[number, StarFills]>([
    [5, [1, 1, 1, 1, 1]],
    [4, [1, 1, 1, 1, 0]],
    [3, [1, 1, 1, 0, 0]],
    [1, [1, 0, 0, 0, 0]],
  ])('AC-1.4 fills whole stars for a score of %s', (score, expected) => {
    expect(starFills(score)).toEqual(expected);
  });

  it.each<[number, StarFills]>([
    [4.6, [1, 1, 1, 1, 0.6]],
    [4.7, [1, 1, 1, 1, 0.7]],
    [3.3, [1, 1, 1, 0.3, 0]],
    [2.9, [1, 1, 0.9, 0, 0]],
    [1.1, [1, 0.1, 0, 0, 0]],
  ])('AC-1.4 fills the partial star to the exact tenth for a score of %s', (score, expected) => {
    expect(starFills(score)).toEqual(expected);
  });

  it('AC-2.2 fills no stars for a score of 0 (no reviews)', () => {
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('shareOf', () => {
  it.each<[number, number, number]>([
    [952, 1232, 0.773],
    [171, 1232, 0.139],
    [40, 1232, 0.032],
    [7, 7, 1],
    [0, 7, 0],
  ])('AC-1.3 gives %s of %s a share of about %s', (count, total, expected) => {
    expect(shareOf(count, total)).toBeCloseTo(expected, 3);
  });

  it('AC-2.2 returns 0, not NaN, when there are no reviews', () => {
    expect(shareOf(0, 0)).toBe(0);
  });
});

describe('defaultLabelFor', () => {
  it.each<[number, string]>([
    [5, 'Excellent'],
    [4.6, 'Excellent'],
    [4.5, 'Excellent'],
    [4.49, 'Very good'],
    [4, 'Very good'],
    [3.99, 'Good'],
    [3, 'Good'],
    [2.99, 'Fair'],
    [2, 'Fair'],
    [1.99, 'Poor'],
    [1, 'Poor'],
  ])('AC-2.1 labels a score of %s as "%s" (A-W6 bands)', (score, expected) => {
    expect(defaultLabelFor(score)).toBe(expected);
  });
});

describe('validateCounts', () => {
  it.each<[string, RatingCounts]>([
    ['the reference data', REFERENCE],
    ['no reviews', NO_REVIEWS],
  ])('AC-2.3 accepts %s and returns the same counts', (_name, counts) => {
    expect(validateCounts(counts)).toEqual(counts);
  });

  it('AC-2.3 accepts counts parsed from JSON, where the keys are strings', () => {
    const parsed: unknown = JSON.parse('{"5":952,"4":171,"3":55,"2":14,"1":40}');
    expect(validateCounts(parsed)).toEqual(REFERENCE);
  });

  it('AC-2.3 returns a frozen copy, so later mutation of the input cannot leak in', () => {
    const input = { 5: 1, 4: 2, 3: 3, 2: 4, 1: 5 };
    const validated = validateCounts(input);
    input[5] = 99;
    expect(validated[5]).toBe(1);
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it.each<[string, unknown, RegExp]>([
    ['a negative count', -1, /3 stars.*-1/],
    ['NaN', Number.NaN, /3 stars.*NaN/],
    ['a fraction', 1.5, /3 stars.*1\.5/],
    ['Infinity', Number.POSITIVE_INFINITY, /3 stars.*Infinity/],
    ['-Infinity', Number.NEGATIVE_INFINITY, /3 stars.*-Infinity/],
    ['a numeric string', '5', /3 stars.*"5"/],
    ['null', null, /3 stars.*null/],
  ])('AC-2.3 throws a RangeError naming the star for %s', (_name, badCount, message) => {
    const counts: unknown = { ...REFERENCE, 3: badCount };
    expect(() => validateCounts(counts)).toThrow(RangeError);
    expect(() => validateCounts(counts)).toThrow(message);
  });

  it('AC-2.3 throws a RangeError naming the star when a key is missing from untyped JSON', () => {
    const parsed: unknown = JSON.parse('{"5":952,"4":171,"3":55,"2":14}');
    expect(() => validateCounts(parsed)).toThrow(RangeError);
    expect(() => validateCounts(parsed)).toThrow(/1 star\b.*missing/);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a number', 5],
    ['an array', [0, 40, 14, 55, 171, 952]],
  ])('AC-2.3 throws a TypeError when the input is %s rather than an object', (_name, input) => {
    expect(() => validateCounts(input)).toThrow(TypeError);
  });
});
