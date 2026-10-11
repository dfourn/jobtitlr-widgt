import type { GateReport, ReviewReport } from '../report';
import type { Failure, SignalKey } from '../types';
import { type StopOptions, type StopReason } from './stop';

/** What the loop keeps about one reviewed iteration (iteration 0 is the baseline). */
export interface IterationRecord {
  readonly iteration: number;
  readonly total: number;
  readonly gatesPassed: boolean;
  readonly failedGates: readonly string[];
  readonly signals: Readonly<Record<SignalKey, number | null>>;
  readonly contract: { readonly passed: number; readonly total: number } | null;
  /** The commit made for this iteration, once known. */
  readonly sha: string | null;
  readonly summary: string;
  readonly costUsd: number | null;
  /** Feedback for the next prompt: failed gates and the top failures. Never judge output. */
  readonly feedback: { readonly gates: readonly GateReport[]; readonly failures: readonly Failure[] };
}

/** `review/runs/loop-state.json`: lets `--resume` continue after an external generator. */
export interface LoopState {
  readonly version: 1;
  readonly generator: string;
  readonly spentUsd: number;
  /** An iteration whose prompt was handed to an external agent and is awaiting review. */
  readonly pending: number | null;
  readonly iterations: readonly IterationRecord[];
}

/** The result of asking a generator for one iteration of edits. */
export type GenerateOutcome =
  | { readonly kind: 'done'; readonly costUsd: number | null; readonly summary: string | null; readonly error: string | null }
  | { readonly kind: 'handoff' };

export interface GenerateContext {
  readonly iteration: number;
  /** Where the prompt was written (root-relative). */
  readonly promptPath: string;
  /** What is left of `--max-budget-usd`, or `null` without a budget. */
  readonly remainingBudgetUsd: number | null;
}

/** Edits the widget. Adapters: claude, glm, external (AC-L7). */
export interface Generator {
  readonly name: string;
  generate(prompt: string, context: GenerateContext): Promise<GenerateOutcome>;
}

/** Everything the loop does to the outside world, injected so tests use fakes (AC-L5, AC-L6). */
export interface LoopDeps {
  readonly generator: Generator;
  /** The text of spec 02. */
  readonly spec: string;
  /** Runs `npm run review` for an iteration and returns its report. */
  review(iteration: number): Promise<ReviewReport>;
  /** Copies runs/latest to runs/iter-NN. */
  archive(iteration: number): Promise<void>;
  /** Writes runs/iter-NN/prompt.md and returns its root-relative path. */
  writePrompt(iteration: number, prompt: string): Promise<string>;
  /** Rewrites runs/scoreboard.md and runs/index.html. */
  publish(state: LoopState): Promise<void>;
  /** `git add -A widgt && git commit`; returns the short SHA, or `null` if nothing was committed. */
  commit(message: string): Promise<string | null>;
  saveState(state: LoopState): Promise<void>;
  /** A fallback change summary, for example `git diff --shortstat`. */
  describeChanges(): Promise<string>;
  log(line: string): void;
}

export interface LoopOptions extends StopOptions {
  /** A change summary for a resumed external iteration (`--note`). */
  readonly note: string | null;
}

export type LoopOutcome =
  | { readonly status: 'stopped'; readonly reason: StopReason; readonly message: string; readonly state: LoopState }
  | { readonly status: 'handoff'; readonly iteration: number; readonly promptPath: string; readonly state: LoopState };

/** A fresh state for a new loop. */
export function initialState(generator: string): LoopState {
  return { version: 1, generator, spentUsd: 0, pending: null, iterations: [] };
}

/**
 * The outer loop of spec 03: review the baseline, then repeat generate ->
 * review -> archive -> publish -> commit until a stop condition holds. With an
 * external generator it returns a handoff after writing the prompt; calling
 * it again with the saved state (`--resume`) reviews that iteration and goes on.
 */
export async function runLoop(deps: LoopDeps, options: LoopOptions, initial: LoopState): Promise<LoopOutcome> {
  void deps;
  void options;
  void initial;
  return Promise.reject(new Error('not implemented'));
}

/**
 * The commit message of an iteration (spec 03 §4), for example
 * `loop(iter-03): score 78 -> 86 (+8), a11y 100, contract 18/22`.
 */
export function commitMessage(record: IterationRecord, previous: IterationRecord | null, generator: string): string {
  void record;
  void previous;
  void generator;
  throw new Error('not implemented');
}
