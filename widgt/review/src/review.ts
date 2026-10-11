/**
 * `npm run review`: runs every check once and writes review/runs/latest/
 * (spec 03 §2, AC-L1). Needs no AI: the judge is off unless --judge is given.
 *
 *   npm run review -- [--judge none|claude|glm] [--strict] [--baseline <report.json>]
 *                     [--contract-results <path>] [--axe <path>] [--screenshot <path>]
 *                     [--reference <path>] [--spec <path>]
 *
 * Paths are relative to widgt/. --strict exits with 1 when a gate fails.
 */
import { parseArgs } from 'node:util';
import { defaultPaths, WIDGT_ROOT, type ReviewPaths } from './config';
import { nodeFs } from './io/fs';
import { nodeRunner } from './io/runner';
import { createJudge, type JudgeKind } from './judge/judge';
import { runReview, summarise } from './run-review';

/** Parses `--judge`. */
export function parseJudgeKind(value: string | undefined): JudgeKind {
  if (value === undefined || value === 'none' || value === 'claude' || value === 'glm') return value ?? 'none';
  throw new Error(`--judge must be none, claude or glm, not "${value}"`);
}

/** Applies path overrides from the command line. */
export function pathsFrom(values: Readonly<Record<string, string | boolean | undefined>>): ReviewPaths {
  const base = defaultPaths();
  const pick = (key: string, fallback: string): string => {
    const value = values[key];
    return typeof value === 'string' ? value : fallback;
  };
  return {
    ...base,
    contractResults: pick('contract-results', base.contractResults),
    axeResults: pick('axe', base.axeResults),
    visualScreenshot: pick('screenshot', base.visualScreenshot),
    reference: pick('reference', base.reference),
    spec: pick('spec', base.spec),
  };
}

/** Options shared by review and loop for the paths. */
export const PATH_OPTIONS = {
  'contract-results': { type: 'string' },
  axe: { type: 'string' },
  screenshot: { type: 'string' },
  reference: { type: 'string' },
  spec: { type: 'string' },
} as const;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      judge: { type: 'string' },
      strict: { type: 'boolean', default: false },
      baseline: { type: 'string' },
      ...PATH_OPTIONS,
    },
  });
  const paths = pathsFrom(values);
  const runner = nodeRunner(WIDGT_ROOT);
  const report = await runReview(
    {
      root: WIDGT_ROOT,
      fs: nodeFs(WIDGT_ROOT),
      runner,
      judge: createJudge(parseJudgeKind(values.judge), runner, process.env),
      now: () => new Date(),
      log: (line) => {
        console.log(`· ${line}`);
      },
    },
    { paths, iteration: null, baselineReport: values.baseline ?? `${paths.latestDir}/report.json` },
  );
  console.log('');
  console.log(summarise(report, `review/runs/latest/report.md`));
  return values.strict && !report.gatesPassed ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  },
);
