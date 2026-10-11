/** Locale used when the host does not pass one (A-W11). */
export const DEFAULT_LOCALE = 'en-GB';

/**
 * Formats a review count with the locale's grouping (1232 -> "1,232" in en-GB).
 * @param count - A whole number of reviews.
 * @param locale - A BCP 47 locale tag.
 */
export function formatCount(count: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(count);
}

/**
 * Formats a share as a percentage with at most one decimal place (0.7727 -> "77.3%" in en-GB).
 * @param share - A fraction in [0, 1], for example from `shareOf`.
 * @param locale - A BCP 47 locale tag.
 */
export function formatPercent(share: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share);
}
