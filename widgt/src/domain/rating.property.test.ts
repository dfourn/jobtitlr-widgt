import fc from 'fast-check';
import { averageOf, roundScore, shareOf, starFills, summarise, totalOf } from './rating';
import { STAR_RATINGS, type RatingCounts } from './types';

/**
 * A fixed seed makes every run generate the same inputs, so CI, local runs and
 * the review loop (spec 03) always see the same result: a property test that
 * passes or fails depending on the day would make the loop's score noisy and
 * its "test count never drops" gate (G6) untrustworthy. When a property fails,
 * fast-check prints the counterexample, and the seed reproduces it exactly.
 * To explore new inputs, change the seed on purpose, in its own commit.
 */
const PARAMS: fc.Parameters<unknown> = { seed: 20261011, numRuns: 1000 };

// Mostly small counts: with small totals, averages land exactly on x.x5 often
// enough to exercise half-up rounding. Large counts still cover big catalogues.
const count = fc.oneof({ weight: 4, arbitrary: fc.nat({ max: 20 }) }, { weight: 1, arbitrary: fc.nat({ max: 1_000_000 }) });
const anyCounts: fc.Arbitrary<RatingCounts> = fc.record({ 5: count, 4: count, 3: count, 2: count, 1: count });
const someReviews = anyCounts.filter((counts) => totalOf(counts) > 0);
/** Every score the widget can show: 0 (no reviews) and 1.0 to 5.0 in tenths. */
const shownScore = fc.oneof(fc.constant(0), fc.integer({ min: 10, max: 50 }).map((tenths) => tenths / 10));

describe('rating properties (fast-check)', () => {
  it('AC-1.4 every star fill is an exact tenth in [0, 1] and fills never increase from star 1 to star 5', () => {
    fc.assert(
      fc.property(shownScore, (score) => {
        const fills = starFills(score);
        expect(fills.every((fill) => fill >= 0 && fill <= 1)).toBe(true);
        // Exact tenths: 0.5999999999999996 (from 4.6 - 4) would fail here.
        expect(fills.every((fill) => Number.isInteger(fill * 10))).toBe(true);
        for (let star = 1; star < fills.length; star += 1) {
          expect(fills[star]).toBeLessThanOrEqual(fills[star - 1] ?? Number.NaN);
        }
      }),
      PARAMS,
    );
  });

  it('AC-1.4 the star fills add up to exactly the score shown', () => {
    fc.assert(
      fc.property(shownScore, (score) => {
        const sum = starFills(score).reduce((total, fill) => total + fill, 0);
        expect(sum).toBe(score);
      }),
      PARAMS,
    );
  });

  it('AC-2.1 the score is in [1, 5] whenever there is at least one review', () => {
    fc.assert(
      fc.property(someReviews, (counts) => {
        const { score } = summarise(counts);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      }),
      PARAMS,
    );
  });

  it('AC-2.1 rounding the floating-point average matches exact integer half-up rounding', () => {
    fc.assert(
      fc.property(someReviews, (counts) => {
        // round(10 × weighted / total) half-up is floor((20 × weighted + total) / (2 × total)),
        // which BigInt computes with no floating point at all.
        const total = BigInt(totalOf(counts));
        const weighted = STAR_RATINGS.reduce((sum, star) => sum + BigInt(star * counts[star]), 0n);
        const exactTenths = (20n * weighted + total) / (2n * total);
        expect(roundScore(averageOf(counts) ?? Number.NaN)).toBe(Number(exactTenths) / 10);
      }),
      PARAMS,
    );
  });

  it('AC-1.3 the shares add up to 1 whenever there is at least one review', () => {
    fc.assert(
      fc.property(someReviews, (counts) => {
        const total = totalOf(counts);
        const sum = STAR_RATINGS.reduce((acc, star) => acc + shareOf(counts[star], total), 0);
        expect(sum).toBeCloseTo(1, 12);
      }),
      PARAMS,
    );
  });
});
