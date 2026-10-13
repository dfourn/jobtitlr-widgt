import { formatCount } from '../../domain';
import type { RatingRowModel, StarRating } from '../../domain';
import { StarIcon } from '../StarIcon/StarIcon';
import { rowName } from './rowName';
import styles from './BreakdownRow.module.css';

export interface BreakdownRowProps {
  readonly row: RatingRowModel;
  /** A BCP 47 locale tag. */
  readonly locale: string;
  /** Whether this row is the selected one. */
  readonly selected: boolean;
  /** The toggle callback, or null in static mode (AC-4.1). */
  readonly onToggle: ((rating: StarRating) => void) | null;
}

/**
 * One row of the breakdown: the rating digit, a small decorative star, the
 * share bar and the count (AC-1.2). In static mode it is a plain list item
 * whose aria-label names it (AC-3.3); in interactive mode the same content
 * sits in a toggle button (AC-4.2). The bar's width is the rating's share of
 * all reviews, passed as `--fill` (ADR 0001).
 */
export function BreakdownRow({ row, locale, selected, onToggle }: BreakdownRowProps) {
  const name = rowName(row, locale);
  const content = (
    <>
      <span className={styles.digit}>{row.rating}</span>
      <StarIcon />
      <span className={styles.track} data-testid={`bar-track-${row.rating}`}>
        <span
          className={styles.fill}
          data-testid={`bar-fill-${row.rating}`}
          style={{ '--fill': String(row.share) }}
        />
      </span>
      <span className={styles.count}>{formatCount(row.count, locale)}</span>
    </>
  );
  if (onToggle === null) {
    return (
      <li aria-label={name}>
        <span className={styles.content}>{content}</span>
      </li>
    );
  }
  const toggle = onToggle;
  return (
    <li>
      <button
        type="button"
        className={styles.button}
        aria-pressed={selected}
        aria-label={name}
        onClick={() => toggle(row.rating)}
      >
        {content}
      </button>
    </li>
  );
}
