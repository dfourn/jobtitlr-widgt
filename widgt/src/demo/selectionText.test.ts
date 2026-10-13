import type { StarRating } from '../domain';
import { selectionText } from './selectionText';

describe('selectionText', () => {
  it.each<[StarRating | null, string]>([
    [null, 'Selected: none'],
    [5, 'Selected: 5 stars'],
    [4, 'Selected: 4 stars'],
    [1, 'Selected: 1 star'],
  ])('§8 selectionText shows "%s" as "%s"', (rating, expected) => {
    expect(selectionText(rating)).toBe(expected);
  });
});
