/** The part of an iteration the stop rules look at. Iteration 0 is the baseline. */
export interface IterationScore {
  readonly iteration: number;
  readonly total: number;
  readonly gatesPassed: boolean;
}

export interface StopOptions {
  /** Done when the total reaches this and every gate passes (spec 03: 90). */
  readonly target: number;
  /** The most generator iterations to run, not counting the baseline. */
  readonly maxIter: number;
  /** Stop once the generator has reported this much spend; `null` means no budget. */
  readonly maxBudgetUsd: number | null;
  /** An improvement smaller than this counts as no progress (spec 03: 1 point). */
  readonly plateauDelta?: number;
  /** How many iterations in a row without progress make a plateau (spec 03: 2). */
  readonly plateauRuns?: number;
}

export type StopReason = 'target' | 'max-iter' | 'plateau' | 'budget';

export type StopDecision =
  | { readonly stop: false }
  | { readonly stop: true; readonly reason: StopReason; readonly message: string };

/**
 * Decides whether the loop should stop after the latest review (spec 03 §3,
 * AC-L5). Reaching the target wins over every other reason, so a run that hits
 * 90 on its last allowed iteration is reported as done.
 */
export function shouldStop(history: readonly IterationScore[], spentUsd: number, options: StopOptions): StopDecision {
  const last = history.at(-1);
  if (last === undefined) return { stop: false };
  const delta = options.plateauDelta ?? 1;
  const runs = options.plateauRuns ?? 2;

  if (last.gatesPassed && last.total >= options.target) {
    return stop('target', `target reached: ${String(last.total)} >= ${String(options.target)} with every gate passing`);
  }
  if (options.maxBudgetUsd !== null && spentUsd >= options.maxBudgetUsd) {
    return stop('budget', `budget spent: $${spentUsd.toFixed(2)} of $${options.maxBudgetUsd.toFixed(2)}`);
  }
  const generated = history.filter((entry) => entry.iteration > 0).length;
  if (generated >= options.maxIter) {
    return stop('max-iter', `max-iter reached: ${String(generated)} iterations`);
  }
  if (isPlateau(history.map((entry) => entry.total), delta, runs)) {
    return stop('plateau', `plateau: less than ${String(delta)} point${delta === 1 ? '' : 's'} gained in each of the last ${String(runs)} iterations`);
  }
  return { stop: false };
}

function stop(reason: StopReason, message: string): StopDecision {
  return { stop: true, reason, message };
}

/** True when each of the last `runs` steps gained less than `delta`. */
function isPlateau(totals: readonly number[], delta: number, runs: number): boolean {
  if (totals.length < runs + 1) return false;
  const recent = totals.slice(-(runs + 1));
  return recent.slice(1).every((total, index) => total - (recent[index] ?? total) < delta);
}
