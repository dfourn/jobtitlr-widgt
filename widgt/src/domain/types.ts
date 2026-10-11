/** A star rating a reviewer can give: a whole number from 1 to 5. */
export type StarRating = 1 | 2 | 3 | 4 | 5;

/** Number of reviews for each star rating. Every count is a finite integer >= 0. */
export type RatingCounts = Readonly<Record<StarRating, number>>;

/** Every star rating, in display order (5 down to 1). Frozen so no caller can reorder it. */
export const STAR_RATINGS: readonly [5, 4, 3, 2, 1] = Object.freeze([5, 4, 3, 2, 1] as const);

/**
 * Type guard: is `value` one of the five star ratings?
 * @param value - Anything, typically from untyped input.
 */
export function isStarRating(value: unknown): value is StarRating {
  return (STAR_RATINGS as readonly unknown[]).includes(value);
}
