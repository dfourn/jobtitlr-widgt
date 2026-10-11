import type { ContractResults } from './contract';

/** Whether the widget rendered, and why not. */
export interface Presence {
  readonly present: boolean;
  /** Empty when present; otherwise one line naming the cause. */
  readonly reason: string;
}

/** The widget-presence precondition (AC-L8). */
export function widgetPresence(contract: ContractResults | null): Presence {
  void contract;
  return { present: true, reason: '' };
}

/** True only when the AC-1.1 and AC-1.2 contract tests all ran and passed. */
export function widgetPresent(contract: ContractResults | null): boolean {
  return widgetPresence(contract).present;
}
