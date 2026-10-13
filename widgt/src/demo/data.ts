import type { RatingCounts } from '../domain';

/** The counts shown on the demo page (total 1232, average 4.608, score 4.6). */
export const REFERENCE_COUNTS: RatingCounts = Object.freeze({ 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 });

/** The counts behind `/?empty=1` (spec 02 section 8). */
export const EMPTY_COUNTS: RatingCounts = Object.freeze({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
