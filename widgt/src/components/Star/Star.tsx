import type { StarRating } from '../../domain';
import { StarIcon } from '../StarIcon/StarIcon';
import styles from './Star.module.css';

export interface StarProps {
  /** Which of the five positions this tile occupies, 1 (left) to 5 (right). */
  readonly position: StarRating;
  /** How much of the tile is filled, as a fraction in [0, 1]. */
  readonly fill: number;
}

/**
 * One star tile of the overall score (AC-1.4). The fill arrives as the
 * `--fill` custom property (ADR 0001) and drives the tile's gradient: filled
 * in the accent colour up to `--fill`, grey beyond it.
 */
export function Star({ position, fill }: StarProps) {
  return (
    <span data-testid={`star-${position}`} className={styles.tile} style={{ '--fill': String(fill) }}>
      <StarIcon />
    </span>
  );
}
