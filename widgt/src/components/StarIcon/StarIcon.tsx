import styles from './StarIcon.module.css';

/** A five-point star as one inline path, filled with `currentColor`. */
const STAR_PATH =
  'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

/**
 * A decorative star glyph (AC-3.2, AC-3.5). It is purely visual, so the svg is
 * hidden from assistive technology and never focusable; it carries no name.
 * Parents size it with CSS and colour it through `currentColor`.
 */
export function StarIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={STAR_PATH} />
    </svg>
  );
}
