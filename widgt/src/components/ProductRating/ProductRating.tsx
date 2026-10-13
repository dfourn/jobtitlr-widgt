import { useId, useState } from 'react';
import { DEFAULT_LOCALE, summarise } from '../../domain';
import type { LabelFor, RatingCounts, StarRating } from '../../domain';
import { BrandLine } from '../BrandLine/BrandLine';
import { RatingBreakdown } from '../RatingBreakdown/RatingBreakdown';
import { RatingLabel } from '../RatingLabel/RatingLabel';
import { ScoreText } from '../ScoreText/ScoreText';
import { StarRow } from '../StarRow/StarRow';
import styles from './ProductRating.module.css';

export interface ProductRatingProps {
  /** Reviews per star rating. The only required input; validated on render. */
  readonly counts: RatingCounts;
  /** The heading, which names the section. Defaults to "Product Rating". */
  readonly heading?: string;
  /** A BCP 47 locale tag. Defaults to en-GB (A-W11). */
  readonly locale?: string;
  /** Maps the rounded score to a label (AC-2.4). Defaults to the A-W6 bands. */
  readonly labelFor?: LabelFor;
  /** Controlled mode: decides which row is pressed (AC-4.6). */
  readonly selectedRating?: StarRating | null;
  /** Rows become toggle buttons when set (AC-4.2). */
  readonly onRatingSelect?: (rating: StarRating | null) => void;
}

/**
 * A product's rating summary (spec 02). Everything rendered is derived once
 * from the counts by `summarise` (AC-7.3), which throws a RangeError on
 * invalid counts, fail fast, during render (AC-2.3); the widget does not
 * catch its own error.
 */
export function ProductRating({
  counts,
  heading = 'Product Rating',
  locale = DEFAULT_LOCALE,
  labelFor,
  selectedRating,
  onRatingSelect,
}: ProductRatingProps) {
  const headingId = useId();
  const [internal, setInternal] = useState<StarRating | null>(null);
  const summary = summarise(counts, labelFor);
  const pressed = selectedRating !== undefined ? selectedRating : internal;
  const onToggle =
    onRatingSelect === undefined
      ? null
      : (rating: StarRating) => {
          // Decide the next value here, never inside a setState updater:
          // StrictMode runs updaters twice, which would toggle twice.
          const next = pressed === rating ? null : rating;
          if (selectedRating === undefined) setInternal(next);
          onRatingSelect(next);
        };
  return (
    <section data-testid="product-rating" aria-labelledby={headingId} className={styles.root}>
      <div className={styles.body}>
        {summary.kind === 'rated' ? <RatingLabel label={summary.label} /> : null}
        <StarRow fills={summary.fills} />
        <ScoreText score={summary.score} locale={locale} />
        <BrandLine heading={heading} headingId={headingId} />
        <RatingBreakdown
          rows={summary.rows}
          locale={locale}
          selectedRating={pressed}
          onToggle={onToggle}
        />
      </div>
    </section>
  );
}
