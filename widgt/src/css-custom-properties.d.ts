import 'react';

/**
 * The data-driven custom properties components set through `style` (ADR 0001):
 * bar fill widths and star fill fractions. React's CSSProperties knows no
 * arbitrary custom properties, so they are declared here once.
 */
declare module 'react' {
  interface CSSProperties {
    '--fill'?: string;
  }
}
