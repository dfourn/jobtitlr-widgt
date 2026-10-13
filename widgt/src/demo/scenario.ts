/** Which demo page to render, chosen by the URL (spec 02 section 8). */
export interface Scenario {
  /** Wire `onRatingSelect` and show the selection status. */
  readonly interactive: boolean;
  /** Render with all counts zero. */
  readonly empty: boolean;
  /** The bare screenshot page: static, white, widget in a 360px wrapper. */
  readonly visual: boolean;
}

/**
 * Parses the demo page's query string. `visual` wins over `interactive`
 * because the screenshot page must be static (spec 02 section 8).
 */
export function parseScenario(search: string): Scenario {
  const params = new URLSearchParams(search);
  const visual = params.get('visual') === '1';
  return {
    visual,
    empty: params.get('empty') === '1',
    interactive: !visual && params.get('interactive') !== '0',
  };
}
