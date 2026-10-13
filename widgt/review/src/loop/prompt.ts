import { formatOffset, formatScore, pad2, rankFailures, TOP_FAILURES } from '../report';
import type { GateReport, ReviewReport } from '../report';
import { REGION_SEARCH, type Failure, type RegionDiagnostic } from '../types';

/**
 * Everything the generator may see (spec 03 §5). There is deliberately no
 * field for the judge: its scores and prose never reach the generator, so it
 * cannot learn to please the judge instead of meeting the spec.
 */
export interface PromptInput {
  readonly iteration: number;
  /** The full text of spec 02. */
  readonly spec: string;
  readonly lastTotal: number | null;
  readonly failedGates: readonly GateReport[];
  readonly failures: readonly Failure[];
  /** Visual region diagnostics of the last review; `null` when the widget did not render. */
  readonly visualRegions: readonly RegionDiagnostic[] | null;
}

/** Picks the allowed fields from a report. Anything else in the report is dropped. */
export function promptInputFromReport(report: ReviewReport | null, spec: string, iteration: number): PromptInput {
  return {
    iteration,
    spec,
    lastTotal: report?.total ?? null,
    failedGates: report?.gates.filter((gate) => !gate.passed) ?? [],
    failures: report === null ? [] : rankFailures(report.failures).slice(0, TOP_FAILURES),
    visualRegions: report?.visualRegions ?? null,
  };
}

/**
 * One line naming the weakest visual region and the offset where it matches
 * best (AC-L10). It says where the widget differs, not how to fix it.
 * `null` without diagnostics.
 */
export function visualHint(regions: readonly RegionDiagnostic[] | null): string | null {
  let weakest: RegionDiagnostic | null = null;
  for (const region of regions ?? []) {
    if (weakest === null || region.similarity < weakest.similarity) weakest = region;
  }
  if (weakest === null) return null;
  const head = `Visual: the weakest region is '${weakest.name}' (${weakest.similarity.toFixed(2)})`;
  const { dx, dy, similarity } = weakest.best;
  if (dx === 0 && dy === 0) return `${head}; no offset within ${String(REGION_SEARCH)} px matches it better.`;
  const where = [
    dx === 0 ? '' : `${String(Math.abs(dx))} px to the ${dx > 0 ? 'right' : 'left'}`,
    dy === 0 ? '' : `${String(Math.abs(dy))} px ${dy > 0 ? 'lower' : 'higher'}`,
  ].filter((part) => part !== '');
  return `${head}; it matches the reference best at an offset of ${formatOffset(weakest.best)} px (${similarity.toFixed(2)}), i.e. ${where.join(' and ')}.`;
}

/** Builds the generator prompt for one iteration. Pure. */
export function buildPrompt(input: PromptInput): string {
  const gateIds = input.failedGates.map((gate) => gate.id).join(', ');
  const state =
    input.lastTotal === null
      ? 'No review has run yet.'
      : `Last score: ${formatScore(input.lastTotal)} / 100${gateIds === '' ? '' : ` (gates failed: ${gateIds})`}.`;

  const gates = input.failedGates.flatMap((gate) => [
    `- ${gate.id} ${gate.name}: ${gate.detail}`,
    ...(gate.excerpt.length > 0 ? ['  ```text', ...gate.excerpt.map((line) => `  ${line}`), '  ```'] : []),
  ]);
  const failures = input.failures
    .slice(0, TOP_FAILURES)
    .map(
      (failure, index) =>
        `${String(index + 1)}. [${failure.acId ?? 'no AC'}] ${failure.source}: ${oneLine(failure.title)}` +
        `${failure.file === null ? '' : ` (${failure.file})`}: ${oneLine(failure.message).slice(0, 300)}`,
    );

  const hint = visualHint(input.visualRegions);

  return [
    `# widgt: iteration ${pad2(input.iteration)}`,
    '',
    'You are improving the React product rating widget in this folder (`widgt/`, your working directory).',
    'Implement spec 02, which is included in full below. An independent, automated review scores your work after you stop;',
    'it runs Playwright contract tests, axe, the unit tests, a screenshot comparison and the gates listed here.',
    '',
    '## Rules',
    '',
    '- Work in `src/` (components, domain logic, styles, tests) and `index.html` only.',
    '- Do not edit anything under `review/`, `package.json`, `package-lock.json` or the TypeScript, ESLint and Vite configuration. Do not add dependencies.',
    '- Never skip or delete tests, and never suppress a check (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`): each of these fails a hard gate and the score becomes 0.',
    '- Start every test name with the AC it covers, for example `AC-4.3 clicking the selected row clears it`.',
    '- Before you stop, run `npm run typecheck`, `npm run lint` and `npm test`, and fix what they report.',
    '',
    '## Current state',
    '',
    state,
    ...(hint === null ? [] : ['', hint]),
    '',
    '## Failed gates',
    '',
    ...(gates.length > 0 ? gates : ['None.']),
    '',
    `## Top failures (up to ${String(TOP_FAILURES)}, fix these first)`,
    '',
    ...(failures.length > 0 ? failures : ['No failures recorded.']),
    '',
    '## Spec 02',
    '',
    input.spec.trim(),
    '',
  ].join('\n');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
