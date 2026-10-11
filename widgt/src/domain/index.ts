/**
 * The widget's domain layer: pure rating maths and formatting, with no React or DOM.
 * Components import from here, never from the individual files.
 */
export { isStarRating, STAR_RATINGS } from './types';
export type { RatingCounts, StarRating } from './types';
export {
  averageOf,
  defaultLabelFor,
  roundScore,
  shareOf,
  starFills,
  summarise,
  totalOf,
  validateCounts,
} from './rating';
export type {
  EmptySummaryModel,
  LabelFor,
  RatedSummaryModel,
  RatingRowModel,
  RatingSummaryModel,
  StarFills,
} from './rating';
export { DEFAULT_LOCALE, formatCount, formatPercent } from './format';
