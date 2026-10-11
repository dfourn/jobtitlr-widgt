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
 * @param average - A mean star rating.
 */
export function roundScore(average: number): number {
  void average;
  throw new Error('not implemented');
}
