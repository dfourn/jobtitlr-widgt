import logoUrl from '../../assets/feefo-logo-placeholder.png';
import styles from './BrandLine.module.css';

export interface BrandLineProps {
  /** The visible heading, which also names the section (AC-3.1). */
  readonly heading: string;
  /** The heading's id, so the section can point at it with aria-labelledby. */
  readonly headingId: string;
  /** Extra class for the line, so the parent can place it in its layout. */
  readonly className?: string | undefined;
}

/**
 * The heading and the logo on one centred line (AC-1.1). The logo is a
 * sibling of the heading, never inside it: an img inside the h2 would turn
 * the section's accessible name into "Product Rating feefo" (AC-3.1).
 */
export function BrandLine({ heading, headingId, className }: BrandLineProps) {
  return (
    <div className={className === undefined ? styles.line : `${styles.line} ${className}`}>
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      <img className={styles.logo} src={logoUrl} alt="feefo" width={94} height={24} />
    </div>
  );
}
