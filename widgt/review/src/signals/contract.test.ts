// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contractSignal, parsePlaywrightReport, responsiveSignal } from './contract';

/** Shaped like Playwright 1.56's JSON reporter output (trimmed). */
const report = {
  config: { rootDir: '/repo/widgt/review/contract' },
  suites: [
    {
      title: 'widget.spec.ts',
      file: 'widget.spec.ts',
      specs: [
        { title: 'AC-1.1 shows the label', file: 'widget.spec.ts', line: 4, tests: [{ status: 'expected', results: [{ status: 'passed', errors: [] }] }] },
        {
          title: 'AC-4.3 clicking the selected row clears it',
          file: 'widget.spec.ts',
          line: 9,
          tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message: '\u001b[31mError: expect(locator).toHaveAttribute\u001b[39m\n\nExpected: "false"\nReceived: "true"\n    at x' } }] }],
        },
      ],
      suites: [
        {
          title: 'responsive',
          file: 'widget.spec.ts',
          specs: [
            { title: 'AC-5.2 no overflow at 320', file: 'widget.spec.ts', line: 20, tests: [{ status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] }] },
            { title: 'AC-5.2 no overflow at 768', file: 'widget.spec.ts', line: 24, tests: [{ status: 'unexpected', results: [{ status: 'timedOut', errors: [{ message: 'Test timeout of 30000ms exceeded.' }] }] }] },
          ],
        },
      ],
    },
  ],
  errors: [],
};

describe('AC-L1 contract results', () => {
  const results = parsePlaywrightReport(report, '/repo/widgt');

  it('AC-L1 reads every test with its describe path and a file relative to the widgt root', () => {
    expect(results.cases.map((c) => c.titlePath.join(' > '))).toEqual([
      'AC-1.1 shows the label',
      'AC-4.3 clicking the selected row clears it',
      'responsive > AC-5.2 no overflow at 320',
      'responsive > AC-5.2 no overflow at 768',
    ]);
    expect(results.cases[0]?.file).toBe('review/contract/widget.spec.ts');
  });

  it('AC-L1 counts flaky tests as passed', () => {
    expect(results.cases.map((c) => c.passed)).toEqual([true, false, true, false]);
  });

  it('AC-L1 scores the pass rate and extracts failures with AC IDs and short messages', () => {
    const signal = contractSignal(results, 'contract-results.json');
    expect(signal).toMatchObject({ value: 50, passed: 2, total: 4, detail: '2/4 contract tests passed' });
    expect(signal.failures[0]).toEqual({
      source: 'contract',
      acId: 'AC-4.3',
      title: 'AC-4.3 clicking the selected row clears it',
      file: 'review/contract/widget.spec.ts:9',
      message: 'Error: expect(locator).toHaveAttribute Expected: "false" Received: "true"',
    });
    expect(signal.failures[1]).toMatchObject({ acId: 'AC-5.2', message: 'Test timeout of 30000ms exceeded.' });
  });

  it('AC-L1 reports missing results as a missing signal, not as a crash', () => {
    expect(contractSignal(null, 'review/runs/latest/contract-results.json')).toMatchObject({
      value: null,
      detail: 'contract results not found: review/runs/latest/contract-results.json',
    });
  });

  it('AC-L1 scores 0 when no test ran and surfaces run errors as failures', () => {
    const broken = parsePlaywrightReport({ suites: [], errors: [{ message: 'Error: webServer exited early\nmore' }] });
    const signal = contractSignal(broken, 'x');
    expect(signal.value).toBe(0);
    expect(signal.detail).toBe('no contract tests ran; 1 run error(s)');
    expect(signal.failures).toEqual([{ source: 'contract', acId: null, title: 'contract run error', file: null, message: 'Error: webServer exited early more' }]);
  });

  it('AC-L1 tolerates JSON of an unknown shape', () => {
    expect(parsePlaywrightReport('nonsense')).toEqual({ cases: [], errors: [] });
  });

  it('AC-L1 derives responsiveness from tests whose title starts with AC-5', () => {
    expect(responsiveSignal(results)).toEqual({ value: 50, detail: '1/2 AC-5 contract tests passed' });
    expect(responsiveSignal({ cases: [], errors: [] }).value).toBeNull();
    expect(responsiveSignal(null).value).toBeNull();
  });
});
