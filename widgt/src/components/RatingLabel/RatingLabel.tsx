import styles from './RatingLabel.module.css';

export interface RatingLabelProps {
  /** The word for the score, for example "Excellent". Sentence case (A-W10). */
  readonly label: string;
}

/**
 * The word shown above the stars (AC-1.1). The DOM text stays sentence case;
 * the reference's uppercase comes from CSS only (AC-3.4).
 */
export function RatingLabel({ label }: RatingLabelProps) {
  return <p className={styles.label}>{label}</p>;
}
