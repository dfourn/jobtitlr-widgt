import type { RatingRowModel, StarRating } from '../../domain';
import { BreakdownRow } from '../BreakdownRow/BreakdownRow';
import styles from './RatingBreakdown.module.css';

export interface RatingBreakdownProps {
  /** The five rows from `summarise`, ordered 5 down to 1. */
  readonly rows: readonly RatingRowModel[];
  /** A BCP 47 locale tag. */
  readonly locale: string;
  /** The currently selected rating, or null when none is. */
  readonly selectedRating: StarRating | null;
  /** The toggle callback, or null in static mode (AC-4.1). */
  readonly onToggle: ((rating: StarRating) => void) | null;
  /** Extra class for the list, so the parent can place it in its layout. */
  readonly className?: string | undefined;
}

/**
 * The per-rating breakdown as a real list (AC-3.3): a ul of five rows,
 * 5 down to 1 (AC-1.2).
 */
export function RatingBreakdown({
  rows,
  locale,
  selectedRating,
  onToggle,
  className,
}: RatingBreakdownProps) {
  return (
    <ul className={className === undefined ? styles.list : `${styles.list} ${className}`}>
      {rows.map((row) => (
        <BreakdownRow
          key={row.rating}
          row={row}
          locale={locale}
          selected={selectedRating === row.rating}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}
