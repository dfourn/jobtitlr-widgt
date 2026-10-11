import { SIGNAL_KEYS } from './types';
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
  assertValidWeights(weights);
  const judgeOff = !isMeasured(signals.judge);
  const redistributable = judgeOff ? 100 - weights.judge : 100;
  if (redistributable <= 0) {
    throw new RangeError('The judge is off and no other signal carries weight');
  }

  const perSignal = {} as Record<SignalKey, SignalScore>;
  const missing: SignalKey[] = [];
  let uncapped = 0;
  for (const key of SIGNAL_KEYS) {
    const raw = signals[key];
    const value = isMeasured(raw) ? clamp(raw, 0, 100) : null;
    const effectiveWeight = key === 'judge' && judgeOff ? 0 : (weights[key] * 100) / redistributable;
    const contribution = ((value ?? 0) * effectiveWeight) / 100;
    perSignal[key] = { value, weight: weights[key], effectiveWeight, contribution };
    if (value === null && key !== 'judge') missing.push(key);
    uncapped += contribution;
  }

  const failedGates = gates.filter((gate) => !gate.passed).map((gate) => gate.id);
  const uncappedTotal = roundTo1(uncapped);
  return {
    total: failedGates.length > 0 ? 0 : uncappedTotal,
    uncappedTotal,
    perSignal,
    gatesPassed: failedGates.length === 0,
    failedGates,
    missing,
  };
}

function assertValidWeights(weights: Weights): void {
  const values = SIGNAL_KEYS.map((key) => weights[key]);
  if (values.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new RangeError('Weights must be finite and >= 0');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) {
    throw new RangeError(`Weights must sum to 100, got ${String(sum)}`);
  }
}

function isMeasured(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

/** Clamps `value` into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}
