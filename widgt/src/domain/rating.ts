import { STAR_RATINGS, type RatingCounts } from './types';

/**
 * Total number of reviews.
 * @param counts - Reviews per star rating.
 */
export function totalOf(counts: RatingCounts): number {
  return STAR_RATINGS.reduce((sum, star) => sum + counts[star], 0);
}

/**
 * Mean star rating: Σ(star × count) / total.
 * @param counts - Reviews per star rating.
 * @returns The unrounded mean, or `null` when there are no reviews (never NaN).
 */
export function averageOf(counts: RatingCounts): number | null {
  const total = totalOf(counts);
  if (total === 0) return null;
  const weighted = STAR_RATINGS.reduce((sum, star) => sum + star * counts[star], 0);
  return weighted / total;
}

/**
 * Rounds an average to one decimal place, half-up (4.65 -> 4.7).
 *
 * Deliberately not `toFixed(1)`: that rounds the exact binary value, and
 * 4.35 is stored as 4.34999…, so it gives "4.3". Multiplying by 10 rounds
 * the product back onto 43.5 exactly, so `Math.round` sees the true half.
 *
 * @param average - A mean star rating (positive, so half-up and half-away-from-zero agree).
 */
export function roundScore(average: number): number {
  return Math.round(average * 10) / 10;
}

/** How full each of the five stars is, from star 1 to star 5. Each value is in [0, 1]. */
export type StarFills = readonly [number, number, number, number, number];

/**
 * How full each star should be drawn for a score.
 * Pass the **rounded** score so the stars always agree with the score text.
 * @param score - A score from {@link roundScore}, or 0 when there are no reviews.
 */
export function starFills(score: number): StarFills {
  void score;
  throw new Error('not implemented');
}
