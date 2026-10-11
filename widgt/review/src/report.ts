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
  return failures
    .map((failure, index) => ({ failure, index }))
    .sort((a, b) => compareFailures(a.failure, b.failure) || a.index - b.index)
    .map(({ failure }) => failure);
}

const SOURCE_ORDER: Readonly<Record<Failure['source'], number>> = { gate: 0, contract: 1, unit: 2 };

function compareFailures(a: Failure, b: Failure): number {
  const ka = acSortKey(a.acId);
  const kb = acSortKey(b.acId);
  for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
    const diff = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
}

/** `AC-4.3` -> [4, 3]; no or unparsable ID sorts last. */
function acSortKey(acId: string | null): number[] {
  const match = acId === null ? null : /^AC-(\d+)(?:\.(\d+))?/.exec(acId);
  if (match === null) return [Number.MAX_SAFE_INTEGER];
  return [Number(match[1]), Number(match[2] ?? 0)];
}

/** Renders `report.md`, the human-readable view of a {@link ReviewReport}. */
export function renderReportMarkdown(report: ReviewReport): string {
  const lines: string[] = [];
  const heading = report.gatesPassed
    ? `# widgt review: ${formatScore(report.total)} / 100`
    : `# widgt review: ${formatScore(report.total)} / 100 (gates failed: ${report.failedGates.join(', ')}; ${formatScore(report.uncappedTotal)} without the cap)`;
  const meta = [
    `Generated ${report.generatedAt}`,
    report.iteration === null ? 'one-off run' : `iteration ${pad2(report.iteration)}`,
    `judge: ${report.judge}`,
    report.testCount === null ? 'unit test count unknown' : `${String(report.testCount)} unit tests`,
  ];
  lines.push(heading, '', meta.join(' · '), '');

  lines.push('## Gates', '', '| Gate | Check | Result | Detail |', '|---|---|---|---|');
  for (const gate of report.gates) {
    lines.push(row([gate.id, gate.name, gate.passed ? 'pass' : '**FAIL**', gate.detail]));
  }
  for (const gate of report.gates.filter((g) => !g.passed && g.excerpt.length > 0)) {
    lines.push('', `**${gate.id} ${gate.name} output (excerpt)**`, '', '```text', ...gate.excerpt, '```');
  }
  lines.push('');

  lines.push(
    '## Signals',
    '',
    '| Signal | Value | Weight | Effective weight | Points | Detail |',
    '|---|---:|---:|---:|---:|---|',
  );
  for (const key of SIGNAL_KEYS) {
    const signal = report.signals[key];
    const value = signal.value === null ? signal.status : signal.value.toFixed(1);
    lines.push(
      row([SIGNAL_LABELS[key], value, String(signal.weight), signal.effectiveWeight.toFixed(1), signal.contribution.toFixed(1), signal.detail]),
    );
  }
  const totalDetail = report.gatesPassed ? '' : 'gates failed: total capped at 0';
  lines.push(row(['**Total**', '', '100', '100.0', `**${report.uncappedTotal.toFixed(1)}**`, totalDetail]), '');
  if (report.missing.length > 0) {
    lines.push(`**Missing signals** (scored 0): ${report.missing.map((key) => SIGNAL_LABELS[key]).join(', ')}`, '');
  }

  if (report.judgeScores !== null) {
    lines.push('## Judge rubric (median of samples, 0-3)', '', '| Criterion | Score |', '|---|---:|');
    for (const [criterion, value] of Object.entries(report.judgeScores)) {
      lines.push(row([criterion, String(value)]));
    }
    lines.push('');
  }

  lines.push('## Top failures', '');
  const ranked = rankFailures(report.failures);
  if (ranked.length === 0) {
    lines.push('None.', '');
  } else {
    lines.push('| # | AC | Source | Test | File | Message |', '|---:|---|---|---|---|---|');
    ranked.slice(0, TOP_FAILURES).forEach((failure, index) => {
      lines.push(
        row([String(index + 1), failure.acId ?? '–', failure.source, failure.title, failure.file ?? '–', truncate(failure.message, 160)]),
      );
    });
    if (ranked.length > TOP_FAILURES) {
      lines.push('', `${String(ranked.length - TOP_FAILURES)} more in report.json.`);
    }
    lines.push('');
  }

  if (report.notes.length > 0) {
    lines.push('## Notes', '', ...report.notes.map((note) => `- ${note}`), '');
  }
  return lines.join('\n');
}

/** Formats a score: whole numbers without decimals, others to one place. */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Zero-pads an iteration number to two digits. */
export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function row(cells: readonly string[]): string {
  return `| ${cells.map(cell).join(' | ')} |`;
}

/** Makes text safe for a markdown table cell: one line, pipes escaped. */
export function cell(text: string): string {
  return text.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
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
  const header = [
    '# Review loop scoreboard',
    '',
    'Written by `npm run loop`. One row per iteration; iteration 00 is the baseline before any generated change. ' +
      'The total is 0 whenever a gate fails. Signals are 0-100; – means missing or off.',
    '',
    '| Iter | Total | Δ | Gates | Contract | Unit | A11y | Responsive | Visual | Judge | Commit | Change |',
    '|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---|',
  ];
  const body = rows.map((entry, index) => {
    const previous = index > 0 ? rows[index - 1] : undefined;
    const delta = previous === undefined ? '–' : signed(entry.total - previous.total);
    const signals = SIGNAL_KEYS.map((key) => {
      const value = entry.signals[key];
      return value === null ? '–' : String(Math.round(value));
    });
    return row([
      pad2(entry.iteration),
      entry.total.toFixed(1),
      delta,
      entry.gatesPassed ? 'pass' : entry.failedGates.join(', '),
      ...signals,
      entry.sha ?? 'this commit',
      entry.summary,
    ]);
  });
  return [...header, ...body, ''].join('\n');
}

/** `+8.0`, `-42.0`, `+0.0`. */
function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded < 0 ? '-' : '+'}${Math.abs(rounded).toFixed(1)}`;
}
