import { acIdOfTitlePath } from './ac';
import type { ContractResults } from './contract';

/** Whether the widget rendered, and why not. */
export interface Presence {
  readonly present: boolean;
  /** Empty when present; otherwise one line naming the cause. */
  readonly reason: string;
}

const PRESENCE_IDS = ['AC-1.1', 'AC-1.2'] as const;

/**
 * The widget-presence precondition (AC-L8). The widget counts as rendered only
 * when at least one contract test cites AC-1.1, at least one cites AC-1.2, and
 * every test citing either passed. A test cites the AC ID its title path
 * starts with, as for failures ({@link acIdOfTitlePath}).
 */
export function widgetPresence(contract: ContractResults | null): Presence {
  if (contract === null) return { present: false, reason: 'the widget is not rendered (contract results not found)' };
  const cited = (id: string) => contract.cases.filter((c) => acIdOfTitlePath(c.titlePath) === id);
  if (PRESENCE_IDS.some((id) => cited(id).length === 0)) {
    return { present: false, reason: 'the widget is not rendered (no AC-1.1 and AC-1.2 contract tests ran)' };
  }
  if (PRESENCE_IDS.some((id) => cited(id).some((c) => !c.passed))) {
    return { present: false, reason: 'the widget is not rendered (AC-1.1/AC-1.2 contract tests failing)' };
  }
  return { present: true, reason: '' };
}

/** True only when the AC-1.1 and AC-1.2 contract tests all ran and passed. */
export function widgetPresent(contract: ContractResults | null): boolean {
  return widgetPresence(contract).present;
}

/**
 * A signal gated by the precondition: unchanged when the widget is present,
 * otherwise 0 with the reason as its detail.
 */
export function requirePresence(
  presence: Presence,
  signal: { readonly value: number | null; readonly detail: string },
): { readonly value: number | null; readonly detail: string } {
  return presence.present ? signal : { value: 0, detail: `0: ${presence.reason}` };
}
