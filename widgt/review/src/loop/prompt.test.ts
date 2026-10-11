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
