// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { memoryFs } from '../io/fs';
import { acCoverage, citedAcIds, parseSpecAcIds } from './coverage';

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
