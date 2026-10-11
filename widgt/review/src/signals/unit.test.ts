// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseVitestReport, unitPassRate } from './unit';

/** Shaped like Vitest 5's JSON reporter output (trimmed). */
const report = {
  numTotalTests: 4,
  testResults: [
    {
      name: '/repo/widgt/src/domain/rating.test.ts',
      status: 'failed',
      message: '',
      assertionResults: [
        { ancestorTitles: ['roundScore'], title: 'AC-2.1 rounds 4.65 half-up to 4.7', status: 'failed', failureMessages: ['AssertionError: expected 4.6 to be 4.7\n    at rating.test.ts:3'] },
        { ancestorTitles: [], title: 'AC-2.1 rounds 4.608 to 4.6', status: 'passed', failureMessages: [] },
      ],
    },
    { name: '/repo/widgt/src/components/Star/Star.test.tsx', status: 'failed', message: 'SyntaxError: Unexpected token', assertionResults: [] },
    {
      name: '/repo/widgt/review/src/score.test.ts',
      status: 'passed',
      assertionResults: [{ ancestorTitles: [], title: 'AC-L2 harness test', status: 'passed', failureMessages: [] }],
    },
  ],
};

describe('AC-L1 unit test results', () => {
  const results = parseVitestReport(report, '/repo/widgt');

  it('AC-L1 keeps only the generator tests in src/, not the harness tests in review/src/', () => {
    expect(results.tests.map((t) => t.file)).toEqual(['src/domain/rating.test.ts', 'src/domain/rating.test.ts']);
  });

  it('AC-L1 counts a test file that failed to load as one failed test', () => {
    const rate = unitPassRate(results);
    expect(rate.value).toBeCloseTo(100 / 3, 6);
    expect(rate.testCount).toBe(2);
    expect(rate.detail).toBe('1/2 unit tests passed, 1 file(s) failed to run');
  });

  it('AC-L1 extracts failures with AC IDs for feedback', () => {
    expect(unitPassRate(results).failures).toEqual([
      {
        source: 'unit',
        acId: 'AC-2.1',
        title: 'roundScore › AC-2.1 rounds 4.65 half-up to 4.7',
        file: 'src/domain/rating.test.ts',
        message: 'AssertionError: expected 4.6 to be 4.7 at rating.test.ts:3',
      },
      { source: 'unit', acId: null, title: 'test file failed to run', file: 'src/components/Star/Star.test.tsx', message: 'SyntaxError: Unexpected token' },
    ]);
  });

  it('AC-L1 scores 0 with no tests and null with no results', () => {
    expect(unitPassRate({ tests: [], fileErrors: [] })).toMatchObject({ value: 0, testCount: 0 });
    expect(unitPassRate(null)).toMatchObject({ value: null, testCount: null });
  });
});
