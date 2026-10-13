import styles from './ScoreText.module.css';

export interface ScoreTextProps {
  /** The rounded score, or null when there are no reviews. */
  readonly score: number | null;
  /** A BCP 47 locale tag. */
  readonly locale: string;
}

/**
 * "4.6 out of 5" (AC-1.1), or "No reviews yet" when there are none (AC-2.2).
 * One element with exactly that text, so it can double as the text alternative
 * the star graphic never provides (AC-3.2). The uppercase in the reference is
 * CSS only (AC-3.4), and the empty state keeps sentence case.
 */
export function ScoreText({ score, locale }: ScoreTextProps) {
  const formatted =
    score === null
      ? 'No reviews yet'
      : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score)} out of 5`;
  return <p className={score === null ? styles.empty : styles.score}>{formatted}</p>;
}
