// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { failure, sampleReport } from '../testing/fixtures';
import type { ReviewReport } from '../report';
import { buildPrompt, promptInputFromReport } from './prompt';

const spec = '# Spec 02: widgt\n\n- **AC-1.1** With the reference data, the widget shows the label "Excellent".';

describe('AC-L7 generator prompt', () => {
  it('AC-L7 contains spec 02 verbatim', () => {
    expect(buildPrompt(promptInputFromReport(sampleReport, spec, 4))).toContain(spec);
  });

  it('AC-L7 names the iteration and the last score', () => {
    const prompt = buildPrompt(promptInputFromReport(sampleReport, spec, 4));
    expect(prompt).toContain('iteration 04');
    expect(prompt).toContain('Last score: 0 / 100 (gates failed: G2)');
  });

  it('AC-L7 lists failed gates with their excerpt', () => {
    const prompt = buildPrompt(promptInputFromReport(sampleReport, spec, 4));
    expect(prompt).toContain('G2 ESLint: npm run lint exited with 1');
    expect(prompt).toContain('3:7  error  x | y is unused');
    expect(prompt).not.toContain('G1 TypeScript');
  });

  it('AC-L7 lists the top failures ranked, each with AC ID, file and message', () => {
    const prompt = buildPrompt(promptInputFromReport(sampleReport, spec, 4));
    expect(prompt).toContain('1. [AC-2.1] unit: AC-2.1 rounds 4.65 | 4.7 (src/domain/rating.test.ts): expected 4.6 to be 4.7');
    expect(prompt.indexOf('[AC-2.1]')).toBeLessThan(prompt.indexOf('[AC-4.3]'));
  });

  it('AC-L7 caps the failures at 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => failure(`AC-4.${String(i + 1)}`));
    const prompt = buildPrompt(promptInputFromReport({ ...sampleReport, failures: many }, spec, 2));
    expect(prompt).toContain('10. [AC-4.10]');
    expect(prompt).not.toContain('11. [');
  });

  it('AC-L7 never includes anything from the judge', () => {
    const judged: ReviewReport = {
      ...sampleReport,
      judge: 'claude',
      judgeScores: { 'component-boundaries': 1, 'visual-fidelity-layout': 2 },
      signals: {
        ...sampleReport.signals,
        judge: { ...sampleReport.signals.judge, value: 50, status: 'ok', detail: 'The judge thinks the stars look lovely' },
      },
    };
    const prompt = buildPrompt(promptInputFromReport(judged, spec, 4));
    expect(prompt).not.toMatch(/judge/i);
    expect(prompt).not.toContain('component-boundaries');
    expect(prompt).not.toContain('lovely');
  });

  it('AC-L7 works for the first iteration without a previous report', () => {
    const prompt = buildPrompt(promptInputFromReport(null, spec, 1));
    expect(prompt).toContain('No review has run yet');
    expect(prompt).toContain(spec);
  });

  it('AC-L7 states the rules that protect the harness', () => {
    const prompt = buildPrompt(promptInputFromReport(sampleReport, spec, 4));
    expect(prompt).toContain('Do not edit anything under `review/`');
    expect(prompt).toContain('Never skip or delete tests');
  });
});

describe('AC-L10 visual hint in the generator prompt', () => {
  const regions = [
    { name: 'label', similarity: 0.66, best: { dx: 0, dy: 4, similarity: 1 } },
    { name: 'stars', similarity: 0.412, best: { dx: 0, dy: 4, similarity: 0.97 } },
    { name: 'rows', similarity: 0.5, best: { dx: -3, dy: 2, similarity: 0.9 } },
  ];
  const promptWith = (visualRegions: ReviewReport['visualRegions']): string =>
    buildPrompt(promptInputFromReport({ ...sampleReport, visualRegions }, spec, 4));

  it('AC-L10 names the weakest region and where it matches best, in one line', () => {
    const prompt = promptWith(regions);
    expect(prompt).toContain(
      "Visual: the weakest region is 'stars' (0.41); it matches the reference best at an offset of (0, +4) px (0.97), i.e. 4 px lower.",
    );
    expect(prompt.split('\n').filter((line) => line.startsWith('Visual:'))).toHaveLength(1);
  });

  it('AC-L10 describes horizontal and vertical offsets', () => {
    const prompt = promptWith([{ name: 'rows', similarity: 0.5, best: { dx: -3, dy: -2, similarity: 0.9 } }]);
    expect(prompt).toContain('at an offset of (-3, -2) px (0.90), i.e. 3 px to the left and 2 px higher.');
  });

  it('AC-L10 says when no offset fits the weakest region better', () => {
    const prompt = promptWith([{ name: 'score', similarity: 0.3, best: { dx: 0, dy: 0, similarity: 0.3 } }]);
    expect(prompt).toContain("Visual: the weakest region is 'score' (0.30); no offset within 8 px matches it better.");
  });

  it('AC-L10 leaves the line out when the widget is absent', () => {
    expect(promptWith(null)).not.toContain('Visual:');
  });
});
