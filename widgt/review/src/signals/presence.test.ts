// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDGT_ROOT } from '../config';
import type { ContractCase, ContractResults } from './contract';
import { WIDGET_CAPTURE_TITLE, widgetCapture, widgetPresence, widgetPresent } from './presence';

function contractCase(title: string, passed: boolean, describe: readonly string[] = []): ContractCase {
  return { titlePath: [...describe, title], file: 'review/contract/rendering.spec.ts', line: 1, passed, message: passed ? '' : 'x' };
}

function results(...cases: ContractCase[]): ContractResults {
  return { cases, errors: [] };
}

const label = (passed: boolean) => contractCase('AC-1.1 shows the label, the score text, the heading and the feefo logo', passed);
const rows = (passed: boolean) => contractCase('AC-1.2 the breakdown has exactly 5 rows', passed);

describe('AC-L8 the widget-presence precondition', () => {
  it('AC-L8 the widget is present when every AC-1.1 and AC-1.2 contract test passed', () => {
    const contract = results(label(true), rows(true), contractCase('AC-1.2 rows at 320px', true, ['responsive']), contractCase('AC-4.3 clears', false));
    expect(widgetPresent(contract)).toBe(true);
    expect(widgetPresence(contract)).toEqual({ present: true, reason: '' });
  });

  it.each([
    { name: 'AC-1.1 fails', cases: [label(false), rows(true)] },
    { name: 'AC-1.2 fails', cases: [label(true), rows(false)] },
    { name: 'one of two AC-1.2 tests fails', cases: [label(true), rows(true), contractCase('AC-1.2 rows again', false)] },
  ])('AC-L8 the widget is absent when $name', ({ cases }) => {
    expect(widgetPresence(results(...cases))).toEqual({
      present: false,
      reason: 'the widget is not rendered (AC-1.1/AC-1.2 contract tests failing)',
    });
  });

  it.each([
    { name: 'no AC-1.1 test ran', contract: results(rows(true)) },
    { name: 'no AC-1.2 test ran', contract: results(label(true)) },
    { name: 'no contract test ran', contract: results() },
  ])('AC-L8 the widget is absent when $name', ({ contract }) => {
    expect(widgetPresence(contract)).toEqual({
      present: false,
      reason: 'the widget is not rendered (no AC-1.1 and AC-1.2 contract tests ran)',
    });
  });

  it('AC-L8 the widget is absent when the contract results are missing', () => {
    expect(widgetPresent(null)).toBe(false);
    expect(widgetPresence(null).reason).toBe('the widget is not rendered (contract results not found)');
  });
});

describe('AC-L10 the widget screenshot is scored only after its capture test passed', () => {
  const capture = (passed: boolean) =>
    contractCase('AC-6.3 captures the widget in its 360px wrapper for the similarity score', passed, ['AC-6 visual fidelity', 'at the reference width']);
  const pageShot = contractCase('AC-6.3 captures a full-page screenshot at 320px', true, ['AC-6 visual fidelity']);

  it('AC-L10 the capture is trusted when the widget-capture test passed', () => {
    expect(widgetCapture(results(capture(true), pageShot))).toEqual({ present: true, reason: '' });
  });

  it('AC-L10 the capture is not trusted when the widget-capture test failed', () => {
    expect(widgetCapture(results(capture(false), pageShot))).toEqual({
      present: false,
      reason: 'the widget capture is not trusted (the AC-6.3 widget-capture contract test failed)',
    });
  });

  it.each([
    { name: 'only the full-page captures ran', contract: results(pageShot) },
    { name: 'the contract results are missing', contract: null },
  ])('AC-L10 the capture is not trusted when $name', ({ contract }) => {
    expect(widgetCapture(contract)).toEqual({
      present: false,
      reason: 'the widget capture is not trusted (no AC-6.3 widget-capture contract test ran)',
    });
  });

  it('AC-L10 the title prefix names exactly one test in the contract', () => {
    const spec = readFileSync(join(WIDGT_ROOT, 'review', 'contract', 'visual.spec.ts'), 'utf8');
    expect(spec.split(`test('${WIDGET_CAPTURE_TITLE}`)).toHaveLength(2);
  });
});
