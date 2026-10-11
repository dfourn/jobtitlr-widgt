// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDGT_ROOT } from '../config';
import { memoryFs } from '../io/fs';
import { acCoverage, citedAcIds, parseSpecAcIds, unitTestableAcIds } from './coverage';
import type { UnitResults, UnitTest } from './unit';

const spec = [
  '- **AC-1.1** shows the label',
  '- **AC-1.2** five rows',
  '- **AC-2.1** rounding',
  '- **AC-4.10** made-up tenth item',
  '- **AC-8.1** delivery (not counted)',
  'AC-3.1 without bold is prose, not a criterion',
].join('\n');

describe('AC-L1 AC coverage', () => {
  it('AC-L1 parses AC-1..7 sub-IDs from the spec, numerically sorted', () => {
    expect(parseSpecAcIds(spec)).toEqual(['AC-1.1', 'AC-1.2', 'AC-2.1', 'AC-4.10']);
  });

  it.each([
    { source: "it('AC-1.1 shows the label', () => {});", ids: ['AC-1.1'] },
    { source: 'test("AC-2.1 rounds", () => {});', ids: ['AC-2.1'] },
    { source: 'it.each(rows)(`AC-2.1 rounds $input`, () => {});', ids: ['AC-2.1'] },
    { source: "describe('AC-4.2 AC-4.3 toggling', () => {});", ids: ['AC-4.2', 'AC-4.3'] },
    { source: "// it('AC-1.1 commented out', () => {});", ids: [] },
    { source: "/* it('AC-1.1 block comment') */", ids: [] },
    { source: "it('renders (see AC-1.1)', () => {});", ids: [] },
  ])('AC-L1 finds $ids in $source', ({ source, ids }) => {
    expect([...citedAcIds(source)]).toEqual(ids);
  });

  it('AC-L1 measures the share of spec IDs cited by test files under src/', () => {
    const fs = memoryFs({
      'docs/02.md': spec,
      'src/domain/rating.test.ts': "it('AC-2.1 rounds', () => {}); it('AC-1.1 label', () => {});",
      'src/domain/rating.ts': "const label = 'AC-1.2 not a test file';",
      'review/contract/widget.spec.ts': "test('AC-1.2 rows', () => {});",
    });
    const coverage = acCoverage(fs, 'docs/02.md');
    expect(coverage.value).toBe(50);
    expect(coverage.cited).toEqual(['AC-1.1', 'AC-2.1']);
    expect(coverage.detail).toBe('AC coverage 50% (2/4)');
  });

  it('AC-L1 reports a missing spec instead of throwing', () => {
    expect(acCoverage(memoryFs({}), 'docs/02.md')).toMatchObject({ value: null, detail: 'spec not found: docs/02.md' });
  });
});

describe('AC-L11 unit AC coverage counts passing unit tests over the unit-testable IDs', () => {
  const unitSpec = ['- **AC-1.1** label', '- **AC-1.2** rows', '- **AC-5.2** overflow', '- **AC-6.1** font'].join('\n');
  const fs = memoryFs({ 'docs/02.md': unitSpec });
  const test = (title: string, passed: boolean, ancestors: readonly string[] = []): UnitTest => ({
    file: 'src/domain/rating.test.ts',
    titlePath: [...ancestors, title],
    passed,
    message: passed ? '' : 'expected 1 to be 2',
  });

  it("AC-L11 a failing test's citation does not count", () => {
    const results: UnitResults = { tests: [test('AC-1.1 shows the label', true), test('AC-1.2 five rows', false)], fileErrors: [] };
    expect(acCoverage(fs, 'docs/02.md', results)).toMatchObject({ cited: ['AC-1.1'], value: 50, detail: 'AC coverage 50% (1/2)' });
  });

  it('AC-L11 a describe title cites its IDs for the passing tests inside it', () => {
    const results: UnitResults = { tests: [test('renders', true, ['AC-1.1 AC-1.2 the breakdown'])], fileErrors: [] };
    expect(acCoverage(fs, 'docs/02.md', results).cited).toEqual(['AC-1.1', 'AC-1.2']);
  });

  it('AC-L11 an AC-5.x or AC-6.x citation does not count', () => {
    const results: UnitResults = { tests: [test('AC-5.2 no overflow', true), test('AC-6.1 uses Poppins', true)], fileErrors: [] };
    const coverage = acCoverage(fs, 'docs/02.md', results);
    expect(coverage.required).toEqual(['AC-1.1', 'AC-1.2']);
    expect(coverage).toMatchObject({ cited: [], value: 0 });
  });

  it('AC-L11 the denominator is the 20 unit-testable IDs of spec 02', () => {
    const spec = readFileSync(join(WIDGT_ROOT, '..', 'docs', 'specs', '02-widgt.md'), 'utf8');
    const ids = unitTestableAcIds(spec);
    expect(ids).toHaveLength(20);
    expect(ids).toEqual([
      ...['AC-1.1', 'AC-1.2', 'AC-1.3', 'AC-1.4', 'AC-1.5'],
      ...['AC-2.1', 'AC-2.2', 'AC-2.3', 'AC-2.4'],
      ...['AC-3.1', 'AC-3.2', 'AC-3.3', 'AC-3.4', 'AC-3.5'],
      ...['AC-4.1', 'AC-4.2', 'AC-4.3', 'AC-4.4', 'AC-4.5', 'AC-4.6'],
    ]);
  });
});
