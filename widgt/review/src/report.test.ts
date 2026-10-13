// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rankFailures, renderReportMarkdown, renderScoreboard, type ScoreboardRow } from './report';
import { failure, sampleReport } from './testing/fixtures';

describe('AC-L1 rankFailures()', () => {
  it('AC-L1 orders by AC number, contract before unit, untagged last', () => {
    const ranked = rankFailures([
      failure(null),
      failure('AC-1.10'),
      failure('AC-2.1', 'unit'),
      failure('AC-1.9'),
      failure('AC-2.1', 'contract'),
    ]);
    expect(ranked.map((f) => `${f.acId ?? '-'} ${f.source}`)).toEqual([
      'AC-1.9 contract',
      'AC-1.10 contract',
      'AC-2.1 contract',
      'AC-2.1 unit',
      '- contract',
    ]);
  });
});

describe('AC-L1 renderReportMarkdown()', () => {
  it('AC-L1 renders gates, signals and failures as a stable document', async () => {
    await expect(renderReportMarkdown(sampleReport)).toMatchFileSnapshot('./__snapshots__/report.md');
  });

  it('AC-L1 shows the gate cap next to the uncapped score', () => {
    expect(renderReportMarkdown(sampleReport)).toContain('# widgt review: 0 / 100 (gates failed: G2; 63.4 without the cap)');
  });

  it('AC-L1 escapes pipes and newlines inside table cells', () => {
    const markdown = renderReportMarkdown(sampleReport);
    expect(markdown).toContain('AC-2.1 rounds 4.65 \\| 4.7');
    expect(markdown).toContain('expected 4.6 to be 4.7');
  });

  it('AC-L1 lists at most 10 failures and says how many more there are', () => {
    const many = Array.from({ length: 13 }, (_, i) => failure(`AC-1.${String(i + 1)}`));
    const markdown = renderReportMarkdown({ ...sampleReport, failures: many });
    expect(markdown).toContain('| 10 | AC-1.10 |');
    expect(markdown).not.toContain('| 11 |');
    expect(markdown).toContain('3 more in report.json');
  });

  it('AC-L1 reports missing signals instead of hiding them', () => {
    expect(renderReportMarkdown(sampleReport)).toContain('**Missing signals** (scored 0): Visual similarity');
  });
});

describe('AC-L10 visual region diagnostics in report.md', () => {
  const regions = [
    { name: 'label', similarity: 0.6642, best: { dx: 0, dy: 4, similarity: 1 } },
    { name: 'rows', similarity: 0.4449, best: { dx: -3, dy: 0, similarity: 0.9 } },
  ];

  it('AC-L10 shows each region with its similarity and best offset', () => {
    const markdown = renderReportMarkdown({ ...sampleReport, visualRegions: regions });
    expect(markdown).toContain(
      [
        '## Visual regions (diagnostics, not scored)',
        '',
        '| Region | Similarity | Best offset (px) | Similarity there |',
        '|---|---:|---|---:|',
        '| label | 0.664 | (0, +4) | 1.000 |',
        '| rows | 0.445 | (-3, 0) | 0.900 |',
      ].join('\n'),
    );
  });

  it('AC-L10 leaves the section out without diagnostics', () => {
    expect(renderReportMarkdown({ ...sampleReport, visualRegions: null })).not.toContain('Visual regions');
  });
});

describe('AC-L6 renderScoreboard()', () => {
  const signals = { contract: 40, unit: 50, a11y: 100, responsive: 25, visual: null, judge: null };
  const rows: ScoreboardRow[] = [
    { iteration: 0, total: 42, gatesPassed: true, failedGates: [], signals, sha: 'abc1234', summary: 'baseline' },
    { iteration: 1, total: 0, gatesPassed: false, failedGates: ['G1', 'G2'], signals, sha: 'def5678', summary: 'broke the types' },
    { iteration: 2, total: 57.5, gatesPassed: true, failedGates: [], signals: { ...signals, judge: 66.7 }, sha: null, summary: 'fixed | rows' },
  ];

  it('AC-L6 renders one row per iteration with signals, delta, gates and commit', async () => {
    await expect(renderScoreboard(rows)).toMatchFileSnapshot('./__snapshots__/scoreboard.md');
  });

  it('AC-L6 marks the row being committed as this commit', () => {
    expect(renderScoreboard(rows)).toContain('| this commit | fixed \\| rows |');
  });

  it('AC-L6 shows the change from the previous iteration', () => {
    const markdown = renderScoreboard(rows);
    expect(markdown).toContain('| 01 | 0.0 | -42.0 | G1, G2 |');
    expect(markdown).toContain('| 02 | 57.5 | +57.5 | pass |');
  });
});
