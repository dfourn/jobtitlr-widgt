// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, score } from './score';
import type { GateId, GateResult, Signals } from './types';

const passing: readonly GateResult[] = (['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const).map((id) => ({
  id,
  name: id,
  passed: true,
  detail: 'ok',
}));

function withFailed(...failed: GateId[]): GateResult[] {
  return passing.map((gate) => (failed.includes(gate.id) ? { ...gate, passed: false } : gate));
}

function signals(partial: Partial<Signals>): Signals {
  return { contract: 0, unit: 0, a11y: 0, responsive: 0, visual: 0, judge: 0, ...partial };
}

const all = (value: number): Signals => signals({ contract: value, unit: value, a11y: value, responsive: value, visual: value, judge: value });

describe('AC-L2 score()', () => {
  it('AC-L2 the default weights are those of spec 03 and sum to 100', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ contract: 25, unit: 15, a11y: 20, responsive: 15, visual: 10, judge: 15 });
    expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it.each([
    { name: 'everything perfect', input: all(100), total: 100 },
    { name: 'everything zero', input: all(0), total: 0 },
    {
      name: 'a mixed iteration',
      input: signals({ contract: 80, unit: 60, a11y: 100, responsive: 50, visual: 40, judge: 60 }),
      // 20 + 9 + 20 + 7.5 + 4 + 9
      total: 69.5,
    },
    {
      name: 'judge off: its 15 points are spread over the other 85 in proportion',
      input: signals({ contract: 80, unit: 60, a11y: 100, responsive: 50, visual: 40, judge: null }),
      // (20 + 9 + 20 + 7.5 + 4) / 85 * 100 = 71.176...
      total: 71.2,
    },
    { name: 'judge off and everything else perfect still reaches 100', input: { ...all(100), judge: null }, total: 100 },
    { name: 'a missing contract signal scores 0 and is not redistributed', input: { ...all(100), contract: null }, total: 75 },
    { name: 'values above 100 are clamped', input: all(140), total: 100 },
    { name: 'values below 0 are clamped', input: { ...all(100), visual: -20 }, total: 90 },
    { name: 'a non-finite value counts as missing', input: { ...all(100), a11y: Number.NaN }, total: 80 },
  ])('AC-L2 $name -> $total', ({ input, total }) => {
    const result = score(input, DEFAULT_WEIGHTS, passing);
    expect(result.total).toBe(total);
    expect(result.gatesPassed).toBe(true);
    expect(result.failedGates).toEqual([]);
  });

  it('AC-L2 any failed gate caps the total at 0 but keeps the uncapped total for the report', () => {
    const result = score(all(100), DEFAULT_WEIGHTS, withFailed('G2', 'G5'));
    expect(result.total).toBe(0);
    expect(result.uncappedTotal).toBe(100);
    expect(result.gatesPassed).toBe(false);
    expect(result.failedGates).toEqual(['G2', 'G5']);
  });

  it('AC-L2 reports the effective weight and contribution of each signal', () => {
    const result = score(signals({ contract: 80, unit: 60, a11y: 100, responsive: 50, visual: 40, judge: null }), DEFAULT_WEIGHTS, passing);
    expect(result.perSignal.contract.weight).toBe(25);
    expect(result.perSignal.contract.effectiveWeight).toBeCloseTo((25 * 100) / 85, 6);
    expect(result.perSignal.contract.contribution).toBeCloseTo((80 * 25) / 85, 6);
    expect(result.perSignal.judge).toEqual({ value: null, weight: 15, effectiveWeight: 0, contribution: 0 });
  });

  it('AC-L2 lists missing signals but not the judge when it is off', () => {
    const result = score({ ...all(100), contract: null, visual: null, judge: null }, DEFAULT_WEIGHTS, passing);
    expect(result.missing).toEqual(['contract', 'visual']);
  });

  it.each([
    { name: 'weights that do not sum to 100', weights: { ...DEFAULT_WEIGHTS, visual: 11 } },
    { name: 'a negative weight', weights: { ...DEFAULT_WEIGHTS, visual: -10, contract: 45 } },
    { name: 'only the judge carrying weight', weights: { contract: 0, unit: 0, a11y: 0, responsive: 0, visual: 0, judge: 100 } },
  ])('AC-L2 rejects $name with a RangeError', ({ weights }) => {
    expect(() => score({ ...all(50), judge: null }, weights, passing)).toThrow(RangeError);
  });
});
