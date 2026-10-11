// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultPaths } from './config';
import { computeLock, serialiseLock } from './gates';
import { nodeFs } from './io/fs';
import type { CommandRunner } from './io/runner';
import { NoJudge } from './judge/judge';
import type { ReviewReport } from './report';
import { runReview } from './run-review';
import { writePng } from './signals/visual';

function whiteImage(size: number) {
  return { width: size, height: size, data: new Uint8Array(size * size * 4).fill(255) };
}

/**
 * Plays the other tools: Vitest writes its JSON, the contract tests write theirs and a screenshot.
 * With `rendered`, the AC-1.1 and AC-1.2 contract tests pass (the widget-presence precondition).
 */
function fakeTools(root: string, calls: string[], rendered: boolean): CommandRunner {
  return {
    run: (command, args, options) => {
      calls.push([command, ...args].join(' '));
      const outputFile = args.find((arg) => arg.startsWith('--outputFile='));
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
        const runDir = options?.env?.REVIEW_RUN_DIR ?? '';
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
              },
            ],
          }),
        );
        writePng(join(runDir, 'screenshots', 'visual-401.png'), whiteImage(8));
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
    writePng(join(root, 'review', 'reference', 'widget-reference.png'), whiteImage(8));
    writeFileSync(join(root, 'review', 'contract.lock'), serialiseLock(computeLock(nodeFs(root))));
  });
  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  async function review(rendered = true): Promise<{ report: ReviewReport; calls: string[] }> {
    const calls: string[] = [];
    const report = await runReview(
      { root, fs: nodeFs(root), runner: fakeTools(root, calls, rendered), judge: new NoJudge(), now: () => new Date('2026-10-11T12:00:00Z'), log: () => undefined },
      { paths: defaultPaths(), iteration: null, baselineReport: 'review/runs/latest/report.json' },
    );
    return { report, calls };
  }

  it('AC-L1 runs the gates, Vitest and the contract tests without any AI', async () => {
    const { calls } = await review();
    expect(calls).toEqual([
      'npm run typecheck',
      'npm run lint',
      'npm run build',
      `npx --no-install vitest run --reporter=json --outputFile=${join(root, 'review', 'runs', 'latest', 'vitest-results.json')}`,
      'npm run test:e2e',
    ]);
  });

  it('AC-L1 writes report.json and report.md with every signal scored', async () => {
    const { report } = await review();
    const latest = join(root, 'review', 'runs', 'latest');
    expect(existsSync(join(latest, 'report.md'))).toBe(true);
    expect(existsSync(join(latest, 'diff.png'))).toBe(true);
    expect(JSON.parse(readFileSync(join(latest, 'report.json'), 'utf8'))).toEqual(report);
    expect(report.gatesPassed).toBe(true);
    expect(report.signals.contract.value).toBe(75);
    expect(report.signals.unit.value).toBe(75);
    expect(report.signals.responsive.value).toBe(100);
    expect(report.signals.visual.value).toBe(100);
    expect(report.signals.a11y).toMatchObject({ value: 0, status: 'ok', detail: '0: no axe results found in review/runs/latest/axe' });
    expect(report.signals.judge.status).toBe('off');
    // (75*25 + 75*15 + 0*20 + 100*15 + 100*10) / 85
    expect(report.total).toBe(64.7);
    expect(report.failures.map((f) => f.acId)).toEqual(['AC-4.3']);
  });

  it('AC-L8 scores a11y, responsive and visual 0 with the reason when the widget is not rendered', async () => {
    const { report } = await review(false);
    const reason = '0: the widget is not rendered (AC-1.1/AC-1.2 contract tests failing)';
    expect(report.signals.a11y).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.responsive).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.visual).toMatchObject({ value: 0, status: 'ok', detail: reason });
    expect(report.signals.contract.value).toBe(50);
    expect(report.signals.unit.value).toBe(75);
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
});
