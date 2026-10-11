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
  void history;
  void spentUsd;
  void options;
  throw new Error('not implemented');
}
