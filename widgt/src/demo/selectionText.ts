import type { StarRating } from '../domain';

/** The status line under the widget: "Selected: none", "Selected: 5 stars", "Selected: 1 star". */
export function selectionText(rating: StarRating | null): string {
  if (rating === null) {
    return 'Selected: none';
  }
  return `Selected: ${rating} ${rating === 1 ? 'star' : 'stars'}`;
}
