import type { GateId, GateResult, SignalKey, Signals, Weights } from './types';

/** Weights of spec 03 §3. They sum to 100. */
export const DEFAULT_WEIGHTS: Weights = {
  contract: 25,
  unit: 15,
  a11y: 20,
  responsive: 15,
  visual: 10,
  judge: 15,
};

export interface SignalScore {
  /** The measured value on 0-100, clamped, or `null` when it was missing. */
  readonly value: number | null;
  /** The configured weight. */
  readonly weight: number;
  /** The weight after the judge's share has been redistributed. */
  readonly effectiveWeight: number;
  /** Points this signal adds to the total (value x effectiveWeight / 100). */
  readonly contribution: number;
}

export interface ScoreResult {
  /** 0-100, one decimal place. 0 whenever a gate failed. */
  readonly total: number;
  /** What the total would have been without the gate cap, for the report. */
  readonly uncappedTotal: number;
  readonly perSignal: Readonly<Record<SignalKey, SignalScore>>;
  readonly gatesPassed: boolean;
  readonly failedGates: readonly GateId[];
  /** Signals that could not be measured. The judge is not listed when it is off. */
  readonly missing: readonly SignalKey[];
}

/**
 * Combines the signals into one score (spec 03 §3, AC-L2).
 *
 * - Any failed gate caps the total at 0.
 * - A `null` judge means "judge off": its weight is spread over the other
 *   signals in proportion to their own weights.
 * - Any other `null` signal scores 0 and is reported as missing. Its weight is
 *   deliberately not redistributed, otherwise breaking a check would pay.
 */
export function score(signals: Signals, weights: Weights, gates: readonly GateResult[]): ScoreResult {
  void signals;
  void weights;
  void gates;
  throw new Error('not implemented');
}
