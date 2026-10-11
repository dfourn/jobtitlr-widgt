import type { ReviewReport } from '../report';
import type { Failure } from '../types';

/** Builds a contract failure for tests. */
export function failure(acId: string | null, source: Failure['source'] = 'contract', title = `${acId ?? 'untagged'} test`): Failure {
  return { source, acId, title, file: 'review/contract/widget.spec.ts', message: 'expected true' };
}

/** A realistic report with a failed gate, a missing signal and the judge off. */
export const sampleReport: ReviewReport = {
  schemaVersion: 1,
  generatedAt: '2026-10-11T12:00:00.000Z',
  iteration: 3,
  judge: 'none',
  total: 0,
  uncappedTotal: 63.4,
  gatesPassed: false,
  failedGates: ['G2'],
  gates: [
    { id: 'G1', name: 'TypeScript', passed: true, detail: 'npm run typecheck passed', excerpt: [] },
    { id: 'G2', name: 'ESLint', passed: false, detail: 'npm run lint exited with 1', excerpt: ['3:7  error  x | y is unused'] },
    { id: 'G4', name: 'Contract lock', passed: true, detail: '12 locked files unchanged', excerpt: [] },
  ],
  signals: {
    contract: { value: 81.8, weight: 25, effectiveWeight: 29.41, contribution: 24.06, status: 'ok', detail: '18/22 contract tests passed' },
    unit: { value: 70, weight: 15, effectiveWeight: 17.65, contribution: 12.35, status: 'ok', detail: '40/40 unit tests passed; AC coverage 40% (14/34)' },
    a11y: { value: 85, weight: 20, effectiveWeight: 23.53, contribution: 20, status: 'ok', detail: 'axe: 0 critical, 1 serious, 0 moderate, 0 minor' },
    responsive: { value: 50, weight: 15, effectiveWeight: 17.65, contribution: 8.82, status: 'ok', detail: '2/4 AC-5 contract tests passed' },
    visual: { value: null, weight: 10, effectiveWeight: 11.76, contribution: 0, status: 'missing', detail: 'screenshot not found: review/runs/latest/screenshots/visual-widget.png' },
    judge: { value: null, weight: 15, effectiveWeight: 0, contribution: 0, status: 'off', detail: 'judge off; weight redistributed' },
  },
  missing: ['visual'],
  testCount: 40,
  contract: { passed: 18, total: 22 },
  judgeScores: null,
  visualRegions: null,
  failures: [
    failure('AC-4.3'),
    failure('AC-5.2'),
    { source: 'unit', acId: 'AC-2.1', title: 'AC-2.1 rounds 4.65 | 4.7', file: 'src/domain/rating.test.ts', message: 'expected 4.6\nto be 4.7' },
  ],
  notes: ['contract results: 1 test file failed to load'],
};

