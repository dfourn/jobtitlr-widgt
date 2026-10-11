import type { ReadonlyFs } from '../io/fs';
import { arrayOf, field, isRecord, numberOf, stringOf } from '../json';
import { axeScore, type AxeCounts } from '../score';
import type { ContractResults } from './contract';

const ZERO: AxeCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };

function add(a: AxeCounts, b: AxeCounts): AxeCounts {
  return {
    critical: a.critical + b.critical,
    serious: a.serious + b.serious,
    moderate: a.moderate + b.moderate,
    minor: a.minor + b.minor,
  };
}

/** Counts from either `{critical, serious, moderate, minor}` or a raw axe result `{violations: [...]}`. */
function countsOf(value: unknown): AxeCounts | null {
  if (!isRecord(value)) return null;
  if ('violations' in value) {
    return arrayOf(value.violations).reduce<AxeCounts>((counts, violation) => {
      const impact = stringOf(field(violation, 'impact'));
      return impact === 'critical' || impact === 'serious' || impact === 'moderate' || impact === 'minor'
        ? { ...counts, [impact]: counts[impact] + 1 }
        : counts;
    }, ZERO);
  }
  const keys = ['critical', 'serious', 'moderate', 'minor'] as const;
  if (!keys.some((key) => key in value)) return null;
  const [critical, serious, moderate, minor] = keys.map((key) => numberOf(value[key]) ?? 0);
  return { critical: critical ?? 0, serious: serious ?? 0, moderate: moderate ?? 0, minor: minor ?? 0 };
}

export interface AxeSummary {
  readonly counts: AxeCounts;
  readonly states: readonly string[];
}

/**
 * Reads `axe.json`, written by the contract tests. Accepted shapes, so the
 * contract tests can stay simple:
 * - `{ "states": { "default": <counts or axe result>, "selected": ... } }`
 * - `[ { "state": "default", "violations": [...] }, ... ]`
 * - a single `<counts or axe result>`
 * where counts are `{critical, serious, moderate, minor}` and an axe result is
 * `{violations: [{impact}]}` (violated rules are counted, not nodes).
 * Counts are summed over states. Returns `null` for anything unrecognised.
 */
export function parseAxeFile(json: unknown): AxeSummary | null {
  const states = field(json, 'states');
  if (isRecord(states)) {
    return combine(Object.entries(states).map(([name, value]) => [name, countsOf(value)] as const));
  }
  if (Array.isArray(json)) {
    return combine(json.map((value, index) => [stringOf(field(value, 'state')) ?? `state ${String(index + 1)}`, countsOf(value)] as const));
  }
  const single = countsOf(json);
  return single === null ? null : { counts: single, states: ['default'] };
}

function combine(entries: readonly (readonly [string, AxeCounts | null])[]): AxeSummary | null {
  const valid = entries.filter((entry): entry is readonly [string, AxeCounts] => entry[1] !== null);
  if (valid.length === 0) return null;
  return { counts: valid.reduce((sum, [, counts]) => add(sum, counts), ZERO), states: valid.map(([name]) => name) };
}

/**
 * The accessibility signal. Prefers `axe.json`; without it, falls back to the
 * pass rate of the AC-3.6 contract tests (the axe checks), and says so.
 */
export function a11ySignal(
  axe: AxeSummary | null,
  contract: ContractResults | null,
): { readonly value: number | null; readonly detail: string } {
  if (axe !== null) {
    const c = axe.counts;
    return {
      value: axeScore(c),
      detail: `axe (${axe.states.join(', ')}): ${String(c.critical)} critical, ${String(c.serious)} serious, ${String(c.moderate)} moderate, ${String(c.minor)} minor`,
    };
  }
  const cases = contract?.cases.filter((c) => /^AC-3\.6\b/.test(c.titlePath.at(-1) ?? '')) ?? [];
  if (cases.length === 0) return { value: null, detail: 'axe.json not found and no AC-3.6 contract test ran' };
  const passed = cases.filter((c) => c.passed).length;
  return {
    value: (passed / cases.length) * 100,
    detail: `axe.json not found; fallback: ${String(passed)}/${String(cases.length)} AC-3.6 contract tests passed`,
  };
}

/** The states the AC-3.6 contract tests check, one `<state>.json` each. */
export const AXE_STATES = ['default', 'static', 'selected'] as const;

/** Per-state counts read from the axe folder; `null` marks an unreadable file. */
export type AxeStates = ReadonlyMap<string, AxeCounts | null>;

/** Reads `<dir>/<state>.json` for every state file in `dir`. */
export function readAxeStates(fs: ReadonlyFs, dir: string): AxeStates {
  void fs;
  void dir;
  return new Map();
}

/** The accessibility signal: the mean per-state axe score over {@link AXE_STATES}. */
export function axeSignal(states: AxeStates, source: string): { readonly value: number | null; readonly detail: string } {
  void states;
  void source;
  return { value: null, detail: '' };
}
