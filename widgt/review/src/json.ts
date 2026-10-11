/** Narrowing helpers for JSON from other tools, which is `unknown` until checked. */

export type JsonRecord = Readonly<Record<string, unknown>>;

/** True for a plain JSON object. */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value[key]` when `value` is an object, else `undefined`. */
export function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/** The array at `value`, or an empty array. */
export function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The string at `value`, or `null`. */
export function stringOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The finite number at `value`, or `null`. */
export function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Parses JSON text, returning `null` instead of throwing. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
