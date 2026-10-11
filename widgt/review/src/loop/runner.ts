import { pad2, TOP_FAILURES, type GateReport, type ReviewReport } from '../report';
import { SIGNAL_KEYS, type Failure, type RegionDiagnostic, type SignalKey } from '../types';
import { buildPrompt } from './prompt';
import { shouldStop, type StopOptions, type StopReason } from './stop';

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
  /**
   * Feedback for the next prompt: failed gates, the top failures and the visual
   * region diagnostics (absent in loop states saved before AC-L10). Never judge output.
   */
  readonly feedback: {
    readonly gates: readonly GateReport[];
    readonly failures: readonly Failure[];
    readonly visualRegions?: readonly RegionDiagnostic[] | null;
  };
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
  let state = initial;

  const reviewAndCommit = async (iteration: number, summary: string, costUsd: number | null): Promise<void> => {
    deps.log(`review: iteration ${pad2(iteration)}`);
    const report = await deps.review(iteration);
    await deps.archive(iteration);
    const record = toRecord(report, iteration, summary, costUsd);
    const previous = state.iterations.at(-1) ?? null;
    state = { ...state, pending: null, iterations: [...state.iterations, record] };
    await deps.saveState(state);
    await deps.publish(state);
    const sha = await deps.commit(commitMessage(record, previous, deps.generator.name));
    state = { ...state, iterations: state.iterations.map((r) => (r === record ? { ...r, sha } : r)) };
    await deps.saveState(state);
    deps.log(`committed iteration ${pad2(iteration)}: ${record.total.toFixed(1)}${sha === null ? '' : ` (${sha})`}`);
  };

  if (state.pending !== null) {
    await reviewAndCommit(state.pending, options.note ?? (await deps.describeChanges()), null);
  } else if (state.iterations.length === 0) {
    await reviewAndCommit(0, 'baseline', null);
  }

  for (;;) {
    const decision = shouldStop(state.iterations, state.spentUsd, options);
    if (decision.stop) {
      deps.log(`stop: ${decision.message}`);
      return { status: 'stopped', reason: decision.reason, message: decision.message, state };
    }
    const last = state.iterations.at(-1);
    if (last === undefined) throw new Error('the loop has no reviewed iteration to build on');

    const iteration = last.iteration + 1;
    const prompt = buildPrompt({
      iteration,
      spec: deps.spec,
      lastTotal: last.total,
      failedGates: last.feedback.gates,
      failures: last.feedback.failures,
      visualRegions: last.feedback.visualRegions ?? null,
    });
    const promptPath = await deps.writePrompt(iteration, prompt);
    const remainingBudgetUsd = options.maxBudgetUsd === null ? null : Math.max(0, options.maxBudgetUsd - state.spentUsd);
    deps.log(`generate: iteration ${pad2(iteration)} with ${deps.generator.name}`);
    const outcome = await deps.generator.generate(prompt, { iteration, promptPath, remainingBudgetUsd });

    if (outcome.kind === 'handoff') {
      state = { ...state, pending: iteration };
      await deps.saveState(state);
      return { status: 'handoff', iteration, promptPath, state };
    }

    state = { ...state, spentUsd: state.spentUsd + (outcome.costUsd ?? 0) };
    const summary =
      outcome.summary ?? (outcome.error === null ? await deps.describeChanges() : `generator error: ${outcome.error}`);
    await reviewAndCommit(iteration, summary, outcome.costUsd);
  }
}

/** Keeps what the loop needs from a report. The judge's scores stay in report.json only. */
function toRecord(report: ReviewReport, iteration: number, summary: string, costUsd: number | null): IterationRecord {
  const signals = {} as Record<SignalKey, number | null>;
  for (const key of SIGNAL_KEYS) signals[key] = report.signals[key].value;
  return {
    iteration,
    total: report.total,
    gatesPassed: report.gatesPassed,
    failedGates: report.failedGates,
    signals,
    contract: report.contract,
    sha: null,
    summary,
    costUsd,
    feedback: {
      gates: report.gates.filter((gate) => !gate.passed),
      failures: report.failures.slice(0, TOP_FAILURES),
      visualRegions: report.visualRegions,
    },
  };
}

/**
 * The commit message of an iteration (spec 03 §4), for example
 * `loop(iter-03): score 78 -> 86 (+8), a11y 100, contract 18/22`.
 */
export function commitMessage(record: IterationRecord, previous: IterationRecord | null, generator: string): string {
  const now = Math.round(record.total);
  const head =
    previous === null
      ? `baseline score ${String(now)}`
      : `score ${String(Math.round(previous.total))} -> ${String(now)} (${signedInt(now - Math.round(previous.total))})`;
  const parts = [
    head,
    record.gatesPassed ? null : `gates failed ${record.failedGates.join(' ')}`,
    record.signals.a11y === null ? null : `a11y ${String(Math.round(record.signals.a11y))}`,
    record.contract === null ? null : `contract ${String(record.contract.passed)}/${String(record.contract.total)}`,
  ].filter((part): part is string => part !== null);
  const trailers = [`Generator: ${generator}`, ...(record.costUsd === null ? [] : [`Cost-USD: ${record.costUsd.toFixed(2)}`])];
  return `loop(iter-${pad2(record.iteration)}): ${parts.join(', ')}\n\n${record.summary}\n\n${trailers.join('\n')}\n`;
}

function signedInt(value: number): string {
  return value < 0 ? String(value) : `+${String(value)}`;
}
