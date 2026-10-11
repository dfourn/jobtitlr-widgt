import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { abs, defaultPaths, type ReviewPaths, SCREENSHOT_NAMES } from './config';
import { checkContractLock, checkForbiddenPatterns, checkTestCount, runCommandGates } from './gates';
import type { ReadonlyFs } from './io/fs';
import type { CommandRunner } from './io/runner';
import type { Judge, JudgeResult } from './judge/judge';
import { parseRubric } from './judge/rubric';
import { field, numberOf, parseJson } from './json';
import { rankFailures, renderReportMarkdown, type GateReport, type ReviewReport, type SignalReport } from './report';
import { DEFAULT_WEIGHTS, score } from './score';
import { axeSignal, readAxeStates } from './signals/axe';
import { contractSignal, parsePlaywrightReport, responsiveSignal } from './signals/contract';
import { acCoverage } from './signals/coverage';
import { requirePresence, widgetCapture, widgetPresence } from './signals/presence';
import { parseVitestReport, unitPassRate } from './signals/unit';
import { collectVisual } from './signals/visual';
import { GATE_IDS, SIGNAL_KEYS, type SignalKey, type Signals } from './types';

export interface ReviewDeps {
  /** Absolute path of the widgt root. */
  readonly root: string;
  readonly fs: ReadonlyFs;
  readonly runner: CommandRunner;
  readonly judge: Judge;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

export interface ReviewOptions {
  readonly paths: ReviewPaths;
  /** Loop iteration, or `null` for a one-off run. */
  readonly iteration: number | null;
  /** A previous report.json (root-relative) whose test count G6 compares with. */
  readonly baselineReport: string | null;
}

/**
 * Runs every check once and writes report.json and report.md into the latest
 * run folder (spec 03 §2, AC-L1). Needs no AI unless a judge is passed.
 * Missing inputs (no contract specs yet, no screenshots) become missing
 * signals in the report; only a bug in the harness itself throws.
 */
export async function runReview(deps: ReviewDeps, options: ReviewOptions): Promise<ReviewReport> {
  const { root, fs, runner, log } = deps;
  const paths = options.paths;
  const notes: string[] = [];
  const previousCount = options.baselineReport === null ? null : readTestCount(fs, options.baselineReport);

  rmSync(abs(root, paths.latestDir), { recursive: true, force: true });
  mkdirSync(abs(root, paths.screenshotsDir), { recursive: true });

  log('gates: typecheck, lint, build');
  const commandGates = await runCommandGates(runner);
  const lockGate = checkContractLock(fs, paths.lockFile);
  const patternGate = checkForbiddenPatterns(fs);

  log('unit and component tests (vitest)');
  await runner.run('npx', ['--no-install', 'vitest', 'run', '--reporter=json', `--outputFile=${abs(root, paths.vitestResults)}`]);

  // Vitest runs generator-owned tests in Node, which can write files: clear what Playwright writes and the score reads.
  clearContractOutputs(root, paths.latestDir);

  log('contract tests (npm run test:e2e)');
  const e2e = await runner.run('npm', ['run', 'test:e2e'], { env: { REVIEW_RUN_DIR: abs(root, paths.latestDir) } });
  if (/missing script/i.test(`${e2e.stdout}\n${e2e.stderr}`)) {
    notes.push('npm run test:e2e is not defined yet, so no contract tests ran');
  }

  log('collecting signals');
  const contractResults = readJson(fs, paths.contractResults, (json) => parsePlaywrightReport(json, root));
  const contract = contractSignal(contractResults, paths.contractResults);
  const unitResults = readJson(fs, paths.vitestResults, (json) => parseVitestReport(json, root));
  const unitRate = unitPassRate(unitResults);
  const coverage = acCoverage(fs, paths.spec, unitResults);
  // AC-L8: a11y, responsive and visual score 0 unless the widget rendered.
  const presence = widgetPresence(contractResults);
  const a11y = requirePresence(presence, axeSignal(readAxeStates(fs, paths.axeDir), paths.axeDir));
  const responsive = requirePresence(presence, responsiveSignal(contractResults));
  // AC-L10: the widget screenshot counts only when the AC-6.3 capture test, with its anti-cheat checks, passed.
  const captured = widgetCapture(contractResults);
  const scoreable = presence.present ? captured : presence;
  const visualPaths = {
    screenshot: abs(root, paths.visualScreenshot),
    reference: abs(root, paths.reference),
    diff: abs(root, paths.diff),
  };
  const collected = scoreable.present ? collectVisual(visualPaths, root) : null;
  notes.push(...(collected?.notes ?? []));
  const visual = requirePresence(scoreable, collected ?? { value: null, detail: 'not collected' });

  const judged = await runJudge(deps, paths);
  if (judged !== null) {
    writeFileSync(abs(root, `${paths.latestDir}/judge.json`), `${JSON.stringify(judged, null, 2)}\n`);
    notes.push(...judged.errors.map((error) => `judge ${deps.judge.name}: ${error}`));
  }

  const unitValue =
    unitRate.value === null && coverage.value === null ? null : ((unitRate.value ?? 0) + (coverage.value ?? 0)) / 2;
  const signals: Signals = {
    contract: contract.value,
    unit: unitValue,
    a11y: a11y.value,
    responsive: responsive.value,
    visual: visual.value,
    judge: judged?.score ?? null,
  };
  const details: Record<SignalKey, string> = {
    contract: contract.detail,
    unit: `${unitRate.detail}; ${coverage.detail}`,
    a11y: a11y.detail,
    responsive: responsive.detail,
    visual: visual.detail,
    judge: judgeDetail(deps.judge.name, judged),
  };

  const gates: GateReport[] = [
    ...commandGates,
    { ...lockGate, excerpt: [] },
    { ...patternGate, excerpt: [] },
    { ...checkTestCount(unitRate.testCount, previousCount), excerpt: [] },
  ].sort((a, b) => GATE_IDS.indexOf(a.id) - GATE_IDS.indexOf(b.id));

  const result = score(signals, DEFAULT_WEIGHTS, gates);
  const signalReports = {} as Record<SignalKey, SignalReport>;
  for (const key of SIGNAL_KEYS) {
    const off = key === 'judge' && deps.judge.name === 'none';
    const status = off ? 'off' : result.perSignal[key].value === null ? 'missing' : 'ok';
    signalReports[key] = { ...result.perSignal[key], status, detail: details[key] };
  }

  const report: ReviewReport = {
    schemaVersion: 1,
    generatedAt: deps.now().toISOString(),
    iteration: options.iteration,
    judge: deps.judge.name,
    total: result.total,
    uncappedTotal: result.uncappedTotal,
    gatesPassed: result.gatesPassed,
    failedGates: result.failedGates,
    gates,
    signals: signalReports,
    missing: result.missing,
    testCount: unitRate.testCount,
    contract: contractResults === null ? null : { passed: contract.passed, total: contract.total },
    judgeScores: judged === null || judged.score === null ? null : judged.criteria,
    visualRegions: collected?.regions ?? null,
    failures: rankFailures([...contract.failures, ...unitRate.failures]),
    notes,
  };
  writeFileSync(abs(root, `${paths.latestDir}/report.json`), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(abs(root, `${paths.latestDir}/report.md`), renderReportMarkdown(report));
  return report;
}

/**
 * Removes what the contract tests write and the score reads (spec 03 §4), after Vitest and before
 * Playwright, so a file left by a unit test cannot pass for a contract output: the axe results, the
 * screenshots and Playwright's JSON report (deleted too, in case Playwright fails to start). Only
 * inside the run folder, where Playwright writes (`REVIEW_RUN_DIR`); a path given on the command
 * line is only read, never deleted.
 */
function clearContractOutputs(root: string, latestDir: string): void {
  const written = defaultPaths(latestDir);
  for (const dir of [written.axeDir, written.screenshotsDir]) {
    rmSync(abs(root, dir), { recursive: true, force: true });
    mkdirSync(abs(root, dir), { recursive: true });
  }
  rmSync(abs(root, written.contractResults), { force: true });
}

async function runJudge(deps: ReviewDeps, paths: ReviewPaths): Promise<JudgeResult | null> {
  if (deps.judge.name === 'none') return null;
  if (!deps.fs.exists(paths.rubric)) return null;
  deps.log(`judge: ${deps.judge.name} (3 samples)`);
  const screenshots = SCREENSHOT_NAMES.map((name) => `${paths.screenshotsDir}/${name}.png`).filter((p) => deps.fs.exists(p));
  return deps.judge.evaluate({
    rubric: parseRubric(parseJson(deps.fs.readText(paths.rubric))),
    screenshots,
    reference: deps.fs.exists(paths.reference) ? paths.reference : null,
    sourceDir: 'src',
  });
}

function judgeDetail(name: string, judged: JudgeResult | null): string {
  if (name === 'none') return 'judge off; its weight is spread over the other signals';
  if (judged === null) return `judge ${name}: rubric not found`;
  if (judged.score === null) return `judge ${name}: every sample failed`;
  return `judge ${name}: median of ${String(judged.samples)} samples, $${judged.costUsd.toFixed(2)}`;
}

function readJson<T>(fs: ReadonlyFs, path: string, parse: (json: unknown) => T): T | null {
  if (!fs.exists(path)) return null;
  const json = parseJson(fs.readText(path));
  return json === null ? null : parse(json);
}

/** The test count recorded in a previous report.json, or `null`. */
export function readTestCount(fs: ReadonlyFs, reportPath: string): number | null {
  if (!fs.exists(reportPath)) return null;
  return numberOf(field(parseJson(fs.readText(reportPath)), 'testCount'));
}

/** Reads a report.json written by {@link runReview}. */
export function readReport(path: string): ReviewReport | null {
  if (!existsSync(path)) return null;
  const json = parseJson(readFileSync(path, 'utf8'));
  return json !== null && field(json, 'schemaVersion') === 1 ? (json as ReviewReport) : null;
}

/** Prints a short console summary of a report. */
export function summarise(report: ReviewReport, reportPath: string): string {
  const gates = report.gates.map((g) => `${g.id} ${g.passed ? 'pass' : 'FAIL'}`).join('  ');
  const signals = SIGNAL_KEYS.map((key) => {
    const s = report.signals[key];
    const value = s.value === null ? s.status.padStart(7) : s.value.toFixed(1).padStart(7);
    return `  ${key.padEnd(11)}${value}  ${s.detail}`;
  });
  const failed = report.gates.filter((g) => !g.passed).map((g) => `  ${g.id} ${g.name}: ${g.detail}`);
  const total = report.gatesPassed
    ? `${report.total.toFixed(1)} / 100`
    : `0 / 100 (gates failed: ${report.failedGates.join(', ')}; ${report.uncappedTotal.toFixed(1)} without the cap)`;
  return [
    `widgt review (judge: ${report.judge})`,
    `  gates      ${gates}`,
    ...failed,
    ...signals,
    `  total      ${total}`,
    `  failures   ${String(report.failures.length)}`,
    ...report.notes.map((note) => `  note       ${note}`),
    `  report     ${reportPath}`,
  ].join('\n');
}
