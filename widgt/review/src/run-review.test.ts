// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultPaths, type ReviewPaths } from './config';
import { computeLock, serialiseLock } from './gates';
import { nodeFs } from './io/fs';
import type { CommandRunner } from './io/runner';
import { NoJudge, type Judge, type JudgeResult } from './judge/judge';
import type { ReviewReport } from './report';
import { runReview } from './run-review';
import { writePng } from './signals/visual';

function whiteImage(width: number, height: number) {
  return { width, height, data: new Uint8Array(width * height * 4).fill(255) };
}

/** Files the contract tests write, as a unit test might forge them (relative to the run folder). */
const FORGEABLE = ['axe/selected.json', 'screenshots/visual-widget.png', 'contract-results.json'] as const;

interface FakeToolsOptions {
  /** The AC-1.1 and AC-1.2 contract tests pass (the widget-presence precondition). */
  readonly rendered: boolean;
  /** The AC-6.3 widget-capture contract test passes; when `false` it fails but still leaves its screenshot. */
  readonly captured: boolean;
  /** A unit test writes every file in {@link FORGEABLE} into the run folder while Vitest runs. */
  readonly forge: boolean;
  /** When set, the contract tests write nothing at all, as if Playwright failed to start. */
  readonly e2eWritesNothing: boolean;
  /** Receives, when the contract tests start, which forgeable files still exist. */
  readonly seenAtE2e: Map<string, boolean>;
  /** Runs while Vitest runs, as a unit test with file access might. */
  readonly tamper: () => void;
}

/**
 * Plays the other tools: Vitest writes its JSON, the contract tests write theirs and the widget screenshot.
 */
function fakeTools(root: string, calls: string[], options: FakeToolsOptions): CommandRunner {
  const { rendered, captured } = options;
  const latest = join(root, 'review', 'runs', 'latest');
  return {
    run: (command, args, runOptions) => {
      calls.push([command, ...args].join(' '));
      const outputFile = args.find((arg) => arg.startsWith('--outputFile='));
      if (outputFile !== undefined) options.tamper();
      if (outputFile !== undefined && options.forge) {
        for (const file of FORGEABLE) {
          mkdirSync(join(latest, file, '..'), { recursive: true });
          writeFileSync(join(latest, file), file.endsWith('.json') ? '{"violations": [], "suites": []}' : 'forged');
        }
        writePng(join(latest, 'screenshots', 'visual-widget.png'), whiteImage(360, 405));
      }
      if (args.includes('test:e2e')) {
        for (const file of FORGEABLE) options.seenAtE2e.set(file, existsSync(join(latest, file)));
      }
      if (args.includes('test:e2e') && options.e2eWritesNothing) {
        return Promise.resolve({ code: 1, stdout: '', stderr: 'Error: Process from config.webServer exited early.' });
      }
      if (outputFile !== undefined) {
        writeFileSync(
          outputFile.slice('--outputFile='.length),
          JSON.stringify({
            testResults: [
              {
                name: join(root, 'src', 'domain', 'rating.test.ts'),
                status: 'passed',
                assertionResults: [{ ancestorTitles: [], title: 'AC-1.1 shows the label', status: 'passed', failureMessages: [] }],
              },
            ],
          }),
        );
      }
      if (args.includes('test:e2e')) {
        const runDir = runOptions?.env?.REVIEW_RUN_DIR ?? '';
        writeFileSync(
          join(runDir, 'contract-results.json'),
          JSON.stringify({
            suites: [
              {
                title: 'widget.spec.ts',
                file: 'widget.spec.ts',
                specs: [
                  { title: 'AC-1.1 shows the label', file: 'widget.spec.ts', line: 1, tests: [{ status: rendered ? 'expected' : 'unexpected', results: [] }] },
                  { title: 'AC-1.2 five rows', file: 'widget.spec.ts', line: 2, tests: [{ status: 'expected', results: [] }] },
                  { title: 'AC-4.3 clicking the selected row clears it', file: 'widget.spec.ts', line: 3, tests: [{ status: 'unexpected', results: [{ error: { message: 'Expected "false"' } }] }] },
                  { title: 'AC-5.2 no overflow at 320', file: 'widget.spec.ts', line: 8, tests: [{ status: 'expected', results: [] }] },
                ],
                suites: [
                  {
                    title: 'at the reference width',
                    specs: [
                      {
                        title: 'AC-6.3 captures the widget in its 360px wrapper for the similarity score',
                        file: 'visual.spec.ts',
                        line: 9,
                        tests: [{ status: captured ? 'expected' : 'unexpected', results: captured ? [] : [{ error: { message: 'no CSS image anywhere on the page' } }] }],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        );
        writePng(join(runDir, 'screenshots', 'visual-widget.png'), whiteImage(360, 405));
      }
      return Promise.resolve({ code: 0, stdout: '', stderr: '' });
    },
  };
}

describe('AC-L1 runReview()', () => {
  let base = '';
  let root = '';
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'widgt-review-'));
    root = join(base, 'widgt');
    mkdirSync(join(base, 'docs', 'specs'), { recursive: true });
    writeFileSync(join(base, 'docs', 'specs', '02-widgt.md'), '- **AC-1.1** label\n- **AC-1.2** rows\n');
    mkdirSync(join(root, 'src', 'domain'), { recursive: true });
    writePng(join(root, 'review', 'reference', 'widget-reference.png'), whiteImage(401, 443));
    writeFileSync(join(root, 'review', 'contract.lock'), serialiseLock(computeLock(nodeFs(root))));
  });
  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  async function review(
    rendered = true,
    tools: Partial<FakeToolsOptions> = {},
    paths: ReviewPaths = defaultPaths(),
    judge: (calls: readonly string[]) => Judge = () => new NoJudge(),
  ): Promise<{ report: ReviewReport; calls: string[]; seenAtE2e: Map<string, boolean> }> {
    const calls: string[] = [];
    const seenAtE2e = new Map<string, boolean>();
    const options: FakeToolsOptions = {
      rendered,
      captured: true,
      forge: false,
      e2eWritesNothing: false,
      seenAtE2e,
      tamper: () => undefined,
      ...tools,
    };
    const report = await runReview(
      { root, fs: nodeFs(root), runner: fakeTools(root, calls, options), judge: judge(calls), now: () => new Date('2026-10-11T12:00:00Z'), log: () => undefined },
      { paths, iteration: null, baselineReport: 'review/runs/latest/report.json' },
    );
    return { report, calls, seenAtE2e };
  }

  it('AC-L1 runs the gates, then the contract tests, then Vitest, without any AI', async () => {
    const { calls } = await review();
    expect(calls).toEqual([
      'npm run typecheck',
      'npm run lint',
      'npm run build',
      'npm run test:e2e',
      `npx --no-install vitest run --reporter=json --outputFile=${join(root, 'review', 'runs', 'latest', 'vitest-results.json')}`,
    ]);
  });

  it('AC-L1 the judge runs before any unit test can touch the screenshots', async () => {
    writeFileSync(
      join(root, 'review', 'rubric.json'),
      JSON.stringify({ criteria: [{ id: 'layout', question: 'q', anchors: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' } }] }),
    );
    let seen: string[] = [];
    const spy = (calls: readonly string[]): Judge => ({
      name: 'claude',
      evaluate: (): Promise<JudgeResult | null> => {
        seen = [...calls];
        return Promise.resolve(null);
      },
    });
    await review(true, {}, defaultPaths(), spy);
    expect(seen).toContain('npm run test:e2e');
    expect(seen.filter((call) => call.includes('vitest'))).toEqual([]);
  });

  it('AC-L1 writes report.json and report.md with every signal scored', async () => {
    const { report } = await review();
    const latest = join(root, 'review', 'runs', 'latest');
    expect(existsSync(join(latest, 'report.md'))).toBe(true);
    expect(existsSync(join(latest, 'diff.png'))).toBe(true);
    expect(JSON.parse(readFileSync(join(latest, 'report.json'), 'utf8'))).toEqual(report);
    expect(report.gatesPassed).toBe(true);
    expect(report.signals.contract.value).toBe(80);
    expect(report.signals.unit.value).toBe(75);
    expect(report.signals.responsive.value).toBe(100);
    expect(report.signals.visual.value).toBe(100);
    expect(report.signals.a11y).toMatchObject({ value: 0, status: 'ok', detail: '0: no axe results found in review/runs/latest/axe' });
    expect(report.signals.judge.status).toBe('off');
    // (80*25 + 75*15 + 0*20 + 100*15 + 100*10) / 85
    expect(report.total).toBe(66.2);
    expect(report.failures.map((f) => f.acId)).toEqual(['AC-4.3']);
  });

  it('AC-L8 scores a11y, responsive and visual 0 with the reason when the widget is not rendered', async () => {
    const { report } = await review(false);
    const reason = '0: the widget is not rendered (AC-1.1/AC-1.2 contract tests failing)';
    expect(report.signals.a11y).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.responsive).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.visual).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.contract.value).toBe(60);
    expect(report.signals.unit.value).toBe(75);
  });

  it('AC-L10 report.json carries the visual region diagnostics when the widget is rendered', async () => {
    const { report } = await review();
    expect(report.visualRegions?.map((region) => region.name)).toEqual(['label', 'stars', 'score', 'brand', 'rows']);
  });

  it('AC-L10 report.json has no region diagnostics when the widget is not rendered', async () => {
    const { report } = await review(false);
    expect(report.visualRegions).toBeNull();
  });

  it.each([
    { ac: 'AC-L9', file: 'axe/selected.json' },
    { ac: 'AC-L10', file: 'screenshots/visual-widget.png' },
    { ac: 'AC-L8', file: 'contract-results.json' },
  ])('$ac a forged $file is not in the run folder when the contract tests run', async ({ file }) => {
    const { seenAtE2e } = await review(true, { forge: true });
    expect(seenAtE2e.get(file)).toBe(false);
  });

  it.each([true, false])(
    'AC-L8 contract outputs a unit test writes do not change the score (widget rendered: %s)',
    async (rendered) => {
      const clean = await review(rendered);
      const forged = await review(rendered, { forge: true });
      expect(forged.report.signals).toEqual(clean.report.signals);
      expect(forged.report.contract).toEqual(clean.report.contract);
    },
  );

  it('AC-L9 never deletes results the command line points at outside the run folder', async () => {
    const saved = { axe: join(root, 'saved', 'axe', 'default.json'), results: join(root, 'saved', 'results.json') };
    mkdirSync(join(root, 'saved', 'axe'), { recursive: true });
    writeFileSync(saved.axe, JSON.stringify({ state: 'default', violations: [] }));
    writeFileSync(saved.results, JSON.stringify({ suites: [] }));
    await review(true, {}, { ...defaultPaths(), axeDir: 'saved/axe', contractResults: 'saved/results.json' });
    expect([existsSync(saved.axe), existsSync(saved.results)]).toEqual([true, true]);
  });

  it('AC-L9 an axe result forged by a unit test does not score when the contract tests write none', async () => {
    const { report } = await review(true, { forge: true });
    expect(report.signals.a11y.detail).toBe('0: no axe results found in review/runs/latest/axe');
  });

  it('AC-L8 contract results forged by a unit test are not read when Playwright fails to start', async () => {
    const { report } = await review(true, { forge: true, e2eWritesNothing: true });
    expect(report.signals.contract).toMatchObject({ value: null, status: 'missing' });
    expect(report.signals.visual.value).toBe(0);
  });

  it('AC-L10 scores visual 0 with the reason unless the AC-6.3 widget-capture contract test passed', async () => {
    const { report } = await review(true, { captured: false });
    expect(existsSync(join(root, 'review', 'runs', 'latest', 'screenshots', 'visual-widget.png'))).toBe(true);
    expect(report.signals.visual).toMatchObject({
      value: 0,
      status: 'ok',
      detail: '0: the widget capture is not trusted (the AC-6.3 widget-capture contract test failed)',
    });
    expect(report.visualRegions).toBeNull();
  });

  it('AC-L1 fails G6 when the test count drops below the previous run', async () => {
    await review();
    const latest = join(root, 'review', 'runs', 'latest', 'report.json');
    const previous = JSON.parse(readFileSync(latest, 'utf8')) as ReviewReport;
    writeFileSync(latest, JSON.stringify({ ...previous, testCount: 5 }));
    const { report } = await review();
    expect(report.gates.find((g) => g.id === 'G6')).toMatchObject({ passed: false, detail: '1 tests, down from 5 (-4)' });
    expect(report.total).toBe(0);
  });

  it('AC-L3 fails G4 when a locked file changes', async () => {
    writeFileSync(join(root, 'review', 'rubric.json'), '{}');
    const { report } = await review();
    expect(report.failedGates).toEqual(['G4']);
  });

  it.each([
    { lockToo: false, how: 'a locked file' },
    { lockToo: true, how: 'a locked file and the lock to match' },
  ])('AC-L3 fails G4 when a unit test rewrites $how during the review', async ({ lockToo }) => {
    const tamper = (): void => {
      writeFileSync(join(root, 'review', 'reference', 'widget-reference.png'), 'not the reference');
      if (lockToo) writeFileSync(join(root, 'review', 'contract.lock'), serialiseLock(computeLock(nodeFs(root))));
    };
    const { report } = await review(true, { tamper });
    expect(report.failedGates).toEqual(['G4']);
    expect(report.gates.find((g) => g.id === 'G4')?.detail).toContain(
      'changed during the review: review/reference/widget-reference.png',
    );
  });
});
