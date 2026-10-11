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
import { parseJudgeKind, PATH_OPTIONS, pathsFrom } from './cli-options';
import { WIDGT_ROOT } from './config';
import { nodeFs } from './io/fs';
import { nodeRunner } from './io/runner';
import { createJudge } from './judge/judge';
import { runReview, summarise } from './run-review';

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
