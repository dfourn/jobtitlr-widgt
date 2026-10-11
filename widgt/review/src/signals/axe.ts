import type { ReadonlyFs } from '../io/fs';
import { field, parseJson, stringOf } from '../json';
import { axeScore, type AxeCounts } from '../score';

/** The states the AC-3.6 contract tests check, one `<state>.json` each. */
export const AXE_STATES = ['default', 'static', 'selected'] as const;

/** Per-state counts read from the axe folder; `null` marks an unreadable file. */
export type AxeStates = ReadonlyMap<string, AxeCounts | null>;

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;

/**
 * Counts the violated rules of one state file, `{state, violations: [{id,
 * impact, nodes}]}`, by impact. A raw axe result has the same `violations`
 * array, so it is accepted too. Rules are counted, not nodes; a rule with no
 * impact counts for nothing. Returns `null` when there is no `violations` array.
 */
export function parseAxeState(json: unknown): AxeCounts | null {
  const violations = field(json, 'violations');
  if (!Array.isArray(violations)) return null;
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const violation of violations) {
    const impact = stringOf(field(violation, 'impact'));
    const key = IMPACTS.find((name) => name === impact);
    if (key !== undefined) counts[key] += 1;
  }
  return counts;
}

/**
 * Reads every `<dir>/<state>.json` (not nested folders). The state is named by
 * the file. A file that is not JSON or has no `violations` array maps to `null`.
 * Empty when the folder is missing.
 */
export function readAxeStates(fs: ReadonlyFs, dir: string): AxeStates {
  const states = new Map<string, AxeCounts | null>();
  for (const file of fs.listFiles(dir)) {
    const name = file.slice(dir.length + 1);
    if (name.includes('/') || !name.endsWith('.json')) continue;
    states.set(name.slice(0, -'.json'.length), parseAxeState(parseJson(fs.readText(file))));
  }
  return states;
}

function describeCounts(counts: AxeCounts): string {
  const parts = IMPACTS.filter((impact) => counts[impact] > 0).map((impact) => `${String(counts[impact])} ${impact}`);
  return parts.length === 0 ? '' : ` (${parts.join(', ')})`;
}

/**
 * The accessibility signal (AC-L9): the mean of the per-state axe scores over
 * {@link AXE_STATES}. A state whose file is missing or unreadable scores 0 and
 * is named, so an unrendered state cannot raise the mean. With no state files
 * at all the value is 0, not missing; whether the widget rendered at all is the
 * precondition's call (AC-L8).
 */
export function axeSignal(states: AxeStates, source: string): { readonly value: number; readonly detail: string } {
  if (states.size === 0) return { value: 0, detail: `0: no axe results found in ${source}` };
  const parts: string[] = [];
  let sum = 0;
  for (const state of AXE_STATES) {
    const counts = states.get(state);
    if (counts === undefined) {
      parts.push(`${state} 0 (missing)`);
    } else if (counts === null) {
      parts.push(`${state} 0 (unreadable)`);
    } else {
      const value = axeScore(counts);
      sum += value;
      parts.push(`${state} ${String(value)}${describeCounts(counts)}`);
    }
  }
  return { value: sum / AXE_STATES.length, detail: `axe, mean of ${AXE_STATES.join(', ')}: ${parts.join('; ')}` };
}
