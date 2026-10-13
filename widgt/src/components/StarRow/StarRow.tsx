import type { StarFills } from '../../domain';
import { Star } from '../Star/Star';
import styles from './StarRow.module.css';

export interface StarRowProps {
  /** How full each of the five stars is, star 1 first (from `summarise`). */
  readonly fills: StarFills;
}

/** The five star positions, left (1) to right (5). */
const POSITIONS = [1, 2, 3, 4, 5] as const;

/**
 * The overall score as a graphic (AC-1.4). The score is already shown as text
 * by ScoreText, so the whole row is decorative and hidden from assistive
 * technology (AC-3.2).
 */
export function StarRow({ fills }: StarRowProps) {
  return (
    <div aria-hidden="true" className={styles.row}>
      {POSITIONS.map((position, index) => (
        <Star key={position} position={position} fill={fills[index] ?? 0} />
      ))}
    </div>
  );
}
