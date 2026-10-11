import type { GateReport, ReviewReport } from '../report';
import type { Failure } from '../types';

/**
 * Everything the generator may see (spec 03 §5). There is deliberately no
 * field for the judge: its scores and prose never reach the generator, so it
 * cannot learn to please the judge instead of meeting the spec.
 */
export interface PromptInput {
  readonly iteration: number;
  /** The full text of spec 02. */
  readonly spec: string;
  readonly lastTotal: number | null;
  readonly failedGates: readonly GateReport[];
  readonly failures: readonly Failure[];
}

/** Picks the allowed fields from a report. Anything else in the report is dropped. */
export function promptInputFromReport(report: ReviewReport | null, spec: string, iteration: number): PromptInput {
  void report;
  void spec;
  void iteration;
  throw new Error('not implemented');
}

/** Builds the generator prompt for one iteration. Pure. */
export function buildPrompt(input: PromptInput): string {
  void input;
  throw new Error('not implemented');
}
