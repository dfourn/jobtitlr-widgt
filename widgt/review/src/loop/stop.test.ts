// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldStop, type IterationScore, type StopOptions } from './stop';

const options: StopOptions = { target: 90, maxIter: 8, maxBudgetUsd: 10 };

/** Builds a history from totals; index 0 is the baseline. */
function history(totals: readonly number[], gatesPassed = true): IterationScore[] {
  return totals.map((total, iteration) => ({ iteration, total, gatesPassed }));
}

describe('AC-L5 shouldStop()', () => {
  it.each([
    { name: 'no review has run yet', totals: [], spent: 0 },
    { name: 'the baseline is below target', totals: [40], spent: 0 },
    { name: 'the score is still climbing', totals: [40, 55, 70], spent: 2 },
    { name: 'it improved by exactly 1 point twice (1 is enough)', totals: [40, 41, 42], spent: 0 },
    { name: 'only one iteration stalled', totals: [40, 70, 70.5], spent: 0 },
    { name: 'it stalled earlier but recovered', totals: [40, 40.5, 40.6, 60], spent: 0 },
    { name: '7 of 8 iterations are used', totals: [10, 20, 30, 40, 50, 60, 70, 80], spent: 0 },
    { name: 'the spend is just under budget', totals: [40, 60], spent: 9.99 },
  ])('AC-L5 keeps going when $name', ({ totals, spent }) => {
    expect(shouldStop(history(totals), spent, options)).toEqual({ stop: false });
  });

  it.each([
    { name: 'the target is reached', totals: [40, 90], spent: 0, reason: 'target' },
    { name: 'the baseline already meets the target', totals: [95], spent: 0, reason: 'target' },
    { name: 'max-iter generator iterations ran', totals: [10, 20, 30, 40, 50, 60, 70, 80, 85], spent: 0, reason: 'max-iter' },
    { name: 'it improved by less than 1 point twice in a row', totals: [40, 60, 60.5, 61], spent: 0, reason: 'plateau' },
    { name: 'the score fell twice in a row', totals: [70, 60, 50], spent: 0, reason: 'plateau' },
    { name: 'the budget is spent', totals: [40, 60], spent: 10, reason: 'budget' },
    { name: 'the target is reached on the last iteration and over budget', totals: [10, 20, 30, 40, 50, 60, 70, 80, 90], spent: 50, reason: 'target' },
  ])('AC-L5 stops with "$reason" when $name', ({ totals, spent, reason }) => {
    const decision = shouldStop(history(totals), spent, options);
    expect(decision).toMatchObject({ stop: true, reason });
  });

  it('AC-L5 does not call it done when the score is high but a gate failed', () => {
    const decision = shouldStop([{ iteration: 0, total: 95, gatesPassed: false }], 0, options);
    expect(decision).toEqual({ stop: false });
  });

  it('AC-L5 ignores the budget when none is set', () => {
    expect(shouldStop(history([40, 60]), 1000, { ...options, maxBudgetUsd: null })).toEqual({ stop: false });
  });

  it('AC-L5 honours a custom plateau rule', () => {
    const strict = { ...options, plateauDelta: 5, plateauRuns: 1 };
    expect(shouldStop(history([40, 44]), 0, strict)).toMatchObject({ stop: true, reason: 'plateau' });
  });

  it('AC-L5 explains why it stopped', () => {
    const decision = shouldStop(history([40, 60, 60.5, 61]), 0, options);
    expect(decision).toMatchObject({ message: 'plateau: less than 1 point gained in each of the last 2 iterations' });
  });
});
