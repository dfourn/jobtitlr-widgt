import { useState } from 'react';
import { ProductRating } from './components/ProductRating/ProductRating';
import type { Scenario } from './demo/scenario';
import { parseScenario } from './demo/scenario';
import { EMPTY_COUNTS, REFERENCE_COUNTS } from './demo/data';
import { selectionText } from './demo/selectionText';
import type { StarRating } from './domain';
import styles from './App.module.css';

/** Parsed once at module level: the URL never changes during render. */
const PAGE_SCENARIO = parseScenario(window.location.search);

export interface AppProps {
  /** The page's scenario; tests pass one, the page uses the URL. */
  readonly scenario?: Scenario;
}

/**
 * The demo page (spec 02 section 8). `.page` and `.container` stay plain
 * blocks: the widget centres itself with `margin-inline: auto`, and a flex or
 * grid parent would collapse its `container-type` width to zero.
 */
export function App({ scenario = PAGE_SCENARIO }: AppProps) {
  const [selected, setSelected] = useState<StarRating | null>(null);
  const counts = scenario.empty ? EMPTY_COUNTS : REFERENCE_COUNTS;
  if (scenario.visual) {
    return (
      <main className={styles.visualPage}>
        <h1 className={styles.visuallyHidden}>widgt demo</h1>
        <div className={styles.visualWrapper}>
          <ProductRating counts={counts} />
        </div>
      </main>
    );
  }
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>widgt demo</h1>
      <div className={styles.container}>
        <ProductRating
          counts={counts}
          {...(scenario.interactive ? { onRatingSelect: setSelected } : {})}
        />
      </div>
      {scenario.interactive ? (
        <p role="status" data-testid="selection" className={styles.selection}>
          {selectionText(selected)}
        </p>
      ) : null}
    </main>
  );
}
