import type { ScoreResult, SignalScore } from './score';
import type { Failure, GateResult, SignalKey } from './types';
import { SIGNAL_KEYS } from './types';

/** Human labels for the signals, in report order. */
export const SIGNAL_LABELS: Readonly<Record<SignalKey, string>> = {
  contract: 'Contract tests',
  unit: 'Unit tests + AC coverage',
  a11y: 'Accessibility (axe)',
  responsive: 'Responsiveness',
  visual: 'Visual similarity',
  judge: 'AI judge',
};

/** How a signal was obtained. */
export type SignalStatus = 'ok' | 'missing' | 'off';

export interface SignalReport extends SignalScore {
  readonly status: SignalStatus;
  /** One line: where the value came from, or why it is missing. */
  readonly detail: string;
}

export interface GateReport extends GateResult {
  /** A few lines of tool output for a failed command gate. */
  readonly excerpt: readonly string[];
}

/** `report.json`: everything one review run found. */
export interface ReviewReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  /** Loop iteration, or `null` for a one-off `npm run review`. */
  readonly iteration: number | null;
  readonly judge: string;
  readonly total: number;
  readonly uncappedTotal: number;
  readonly gatesPassed: boolean;
  readonly failedGates: ScoreResult['failedGates'];
  readonly gates: readonly GateReport[];
  readonly signals: Readonly<Record<SignalKey, SignalReport>>;
  readonly missing: readonly SignalKey[];
  /** Unit and component tests found in `src/` (G6). */
  readonly testCount: number | null;
  /** Contract tests passed / run, when the results could be read. */
  readonly contract: { readonly passed: number; readonly total: number } | null;
  /** Judge criterion medians (0-3). Scores only: the judge's prose stays out of reports. */
  readonly judgeScores: Readonly<Record<string, number>> | null;
  /** Every failure, ranked. The markdown and the prompt show the top 10. */
  readonly failures: readonly Failure[];
  readonly notes: readonly string[];
}

/** How many failures report.md and the generator prompt show. */
export const TOP_FAILURES = 10;

/**
 * Orders failures for feedback: by AC ID (numerically, so AC-1.10 follows
 * AC-1.9), contract before unit within an AC, failures without an AC last.
 * Stable for equal keys.
 */
export function rankFailures(failures: readonly Failure[]): Failure[] {
  void failures;
  throw new Error('not implemented');
}

/** Renders `report.md`, the human-readable view of a {@link ReviewReport}. */
export function renderReportMarkdown(report: ReviewReport): string {
  void report;
  void SIGNAL_KEYS;
  throw new Error('not implemented');
}

/** One row of `review/runs/scoreboard.md`. */
export interface ScoreboardRow {
  readonly iteration: number;
  readonly total: number;
  readonly gatesPassed: boolean;
  readonly failedGates: readonly string[];
  readonly signals: Readonly<Record<SignalKey, number | null>>;
  /** Commit SHA, or `null` for the row being committed right now. */
  readonly sha: string | null;
  readonly summary: string;
}

/** Renders `review/runs/scoreboard.md`: one row per iteration, oldest first. */
export function renderScoreboard(rows: readonly ScoreboardRow[]): string {
  void rows;
  throw new Error('not implemented');
}
