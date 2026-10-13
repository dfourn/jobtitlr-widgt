import { formatCount, formatPercent } from '../../domain';
import type { RatingRowModel } from '../../domain';

/**
 * A row's accessible name (AC-3.3): "5 stars: 952 reviews (77.3%)", with the
 * singular "1 star" and "1 review". Pure string formatting of domain values,
 * which components may do (AC-7.3).
 */
export function rowName(row: RatingRowModel, locale: string): string {
  const stars = row.rating === 1 ? 'star' : 'stars';
  const reviews = row.count === 1 ? 'review' : 'reviews';
  return `${row.rating} ${stars}: ${formatCount(row.count, locale)} ${reviews} (${formatPercent(row.share, locale)})`;
}
