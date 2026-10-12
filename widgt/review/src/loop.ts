/**
 * `npm run loop`: generate -> review -> commit until a stop condition holds
 * (spec 03 §2-§4).
 *
 *   npm run loop -- --generator claude|glm|external [--max-iter 8] [--target 90]
 *                   [--max-budget-usd 10] [--judge none|claude|glm]
 *   npm run loop -- --generator external --resume [--note "what changed"]
 *
 * Exit codes: 0 stopped (see the reason), 75 waiting for an external agent,
 * 2 error. Every iteration is committed with `git add -A widgt`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseJudgeKind, PATH_OPTIONS, pathsFrom } from './cli-options';
import { abs, SCREENSHOT_NAMES, WIDGT_ROOT, type ReviewPaths } from './config';
import { renderIndexHtml, type IndexModel } from './html';
import { nodeFs } from './io/fs';
import { nodeRunner, type CommandRunner } from './io/runner';
import { createJudge, type Judge } from './judge/judge';
import { field, parseJson } from './json';
import { createGenerator, HANDOFF_EXIT_CODE, type GeneratorKind } from './loop/generators';
import { initialState, runLoop, type LoopDeps, type LoopState } from './loop/runner';
import { pad2, renderScoreboard } from './report';
import { runReview } from './run-review';

const STATE_FILE = 'review/runs/loop-state.json';

function parseGeneratorKind(value: string | undefined): GeneratorKind {
  if (value === 'claude' || value === 'glm' || value === 'external') return value;
  throw new Error('--generator must be claude, glm or external');
}

function positiveNumber(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number`);
  return parsed;
}

function loadState(): LoopState | null {
  const path = abs(WIDGT_ROOT, STATE_FILE);
  if (!existsSync(path)) return null;
  const json = parseJson(readFileSync(path, 'utf8'));
  return field(json, 'version') === 1 ? (json as LoopState) : null;
}

function iterDir(paths: ReviewPaths, iteration: number): string {
  return `${paths.runsDir}/iter-${pad2(iteration)}`;
}

/** The page model: each iteration with whichever images exist. */
function indexModel(state: LoopState, paths: ReviewPaths, target: number): IndexModel {
  const exists = (runsRelative: string): string | null =>
    existsSync(abs(WIDGT_ROOT, `${paths.runsDir}/${runsRelative}`)) ? runsRelative : null;
  return {
    generatedAt: new Date().toISOString(),
    target,
    reference: existsSync(abs(WIDGT_ROOT, paths.reference)) ? '../reference/widget-reference.png' : null,
    iterations: state.iterations.map((record) => {
      const dir = `iter-${pad2(record.iteration)}`;
      return {
        iteration: record.iteration,
        total: record.total,
        gatesPassed: record.gatesPassed,
        failedGates: record.failedGates,
        sha: record.sha,
        summary: record.summary,
        signals: record.signals,
        images: [
          ...SCREENSHOT_NAMES.map((name) => ({ label: name.replace('-', ' '), src: exists(`${dir}/screenshots/${name}.png`) })),
          { label: 'diff vs reference', src: exists(`${dir}/diff.png`) },
        ],
      };
    }),
  };
}

async function git(runner: CommandRunner, args: readonly string[], input?: string): Promise<string> {
  const result = await runner.run('git', args, input === undefined ? {} : { input });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function nodeDeps(runner: CommandRunner, judge: Judge, kind: GeneratorKind, paths: ReviewPaths, target: number): LoopDeps {
  const fs = nodeFs(WIDGT_ROOT);
  const log = (line: string): void => {
    console.log(`· ${line}`);
  };
  return {
    generator: createGenerator(kind, runner, process.env, (text) => {
      console.log(text);
    }),
    spec: readFileSync(abs(WIDGT_ROOT, paths.spec), 'utf8'),
    guard: async () => {
      // Plain Node, not npm and not tsx: see review/src/guard.ts (AC-L12).
      const run = await runner.run(process.execPath, ['review/src/guard.ts']);
      if (run.code !== 0) {
        throw new Error(`the workspace guard refused to review (exit ${String(run.code)}):\n${run.stderr.trim()}`);
      }
    },
    review: (iteration) =>
      runReview(
        { root: WIDGT_ROOT, fs, runner, judge, now: () => new Date(), log },
        { paths, iteration, baselineReport: iteration === 0 ? null : `${iterDir(paths, iteration - 1)}/report.json` },
      ),
    archive: (iteration) => {
      cpSync(abs(WIDGT_ROOT, paths.latestDir), abs(WIDGT_ROOT, iterDir(paths, iteration)), { recursive: true });
      return Promise.resolve();
    },
    writePrompt: (iteration, prompt) => {
      const path = `${iterDir(paths, iteration)}/prompt.md`;
      mkdirSync(abs(WIDGT_ROOT, iterDir(paths, iteration)), { recursive: true });
      writeFileSync(abs(WIDGT_ROOT, path), prompt);
      return Promise.resolve(path);
    },
    publish: (state) => {
      writeFileSync(
        abs(WIDGT_ROOT, `${paths.runsDir}/scoreboard.md`),
        renderScoreboard(state.iterations),
      );
      writeFileSync(abs(WIDGT_ROOT, `${paths.runsDir}/index.html`), renderIndexHtml(indexModel(state, paths, target)));
      return Promise.resolve();
    },
    commit: async (message) => {
      await git(runner, ['add', '-A', '--', '.']);
      const staged = await runner.run('git', ['diff', '--cached', '--quiet']);
      if (staged.code === 0) return null;
      await git(runner, ['commit', '-q', '-F', '-'], message);
      return git(runner, ['rev-parse', '--short', 'HEAD']);
    },
    saveState: (state) => {
      writeFileSync(abs(WIDGT_ROOT, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
      return Promise.resolve();
    },
    describeChanges: async () => {
      await git(runner, ['add', '-A', '--', 'src', 'index.html']);
      const stat = await git(runner, ['diff', '--cached', '--shortstat', '--', 'src', 'index.html']);
      return stat === '' ? 'no source changes' : stat;
    },
    log,
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      generator: { type: 'string' },
      'max-iter': { type: 'string' },
      target: { type: 'string' },
      'max-budget-usd': { type: 'string' },
      judge: { type: 'string' },
      resume: { type: 'boolean', default: false },
      note: { type: 'string' },
      ...PATH_OPTIONS,
    },
  });
  const kind = parseGeneratorKind(values.generator);
  const target = positiveNumber('target', values.target, 90);
  const options = {
    target,
    maxIter: positiveNumber('max-iter', values['max-iter'], 8),
    maxBudgetUsd: values['max-budget-usd'] === undefined ? null : positiveNumber('max-budget-usd', values['max-budget-usd'], 0),
    note: values.note ?? null,
  };
  const paths = pathsFrom(values);
  const runner = nodeRunner(WIDGT_ROOT);
  const judge = createJudge(parseJudgeKind(values.judge), runner, process.env);

  const saved = loadState();
  if (values.resume && saved === null) throw new Error(`--resume needs ${STATE_FILE}; start a loop without --resume first`);
  if (!values.resume && saved !== null) {
    throw new Error(`a loop already ran (${STATE_FILE}); pass --resume to continue it, or move the file away to start over`);
  }
  mkdirSync(abs(WIDGT_ROOT, paths.runsDir), { recursive: true });

  const outcome = await runLoop(nodeDeps(runner, judge, kind, paths, target), options, saved ?? initialState(kind));
  console.log('');
  for (const r of outcome.state.iterations) {
    console.log(`  iter-${pad2(r.iteration)}  ${r.total.toFixed(1).padStart(5)}  ${r.gatesPassed ? 'gates pass' : `gates failed ${r.failedGates.join(' ')}`}  ${r.summary}`);
  }
  if (outcome.status === 'handoff') {
    console.log(`\nWaiting for an external agent on iteration ${pad2(outcome.iteration)} (exit ${String(HANDOFF_EXIT_CODE)}).`);
    return HANDOFF_EXIT_CODE;
  }
  console.log(`\nStopped: ${outcome.message}. Scoreboard: review/runs/scoreboard.md, page: review/runs/index.html`);
  return 0;
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
