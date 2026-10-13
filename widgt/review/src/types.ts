/**
 * Shared vocabulary of the review harness (spec 03). Kept free of I/O so every
 * pure module (score, gates, report, loop) can depend on it.
 */

/** The weighted signals of spec 03 §3, in the order they are reported. */
export const SIGNAL_KEYS = ['contract', 'unit', 'a11y', 'responsive', 'visual', 'judge'] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

/** A signal value on a 0-100 scale, or `null` when it could not be measured. */
export type SignalValue = number | null;

export type Signals = Readonly<Record<SignalKey, SignalValue>>;

export type Weights = Readonly<Record<SignalKey, number>>;

/** The hard gates of spec 03 §3. */
export const GATE_IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const;

export type GateId = (typeof GATE_IDS)[number];

export interface GateResult {
  readonly id: GateId;
  readonly name: string;
  readonly passed: boolean;
  /** One short line explaining the outcome, safe to show to the generator. */
  readonly detail: string;
}

/** Where a failure was observed. */
export type FailureSource = 'contract' | 'unit' | 'gate';

/** One actionable failure, fed back to the generator (spec 03 §5). */
export interface Failure {
  readonly source: FailureSource;
  /** The AC ID cited by the failing test, for example `AC-4.3`. */
  readonly acId: string | null;
  readonly title: string;
  readonly file: string | null;
  readonly message: string;
}

/** How far, in px, the visual region diagnostics search for a better fit in each direction (AC-L10). */
export const REGION_SEARCH = 8;

/** Visual diagnostics for one region of the reference card (AC-L10). Not scored. */
export interface RegionDiagnostic {
  readonly name: string;
  /** Foreground similarity of the region at the reference position. */
  readonly similarity: number;
  /**
   * The offset within ±8 px at which the region matches best: the candidate's
   * content sits at the reference position plus (dx, dy), so (0, 4) means 4 px
   * lower. Ties go to the smallest shift.
   */
  readonly best: { readonly dx: number; readonly dy: number; readonly similarity: number };
}
