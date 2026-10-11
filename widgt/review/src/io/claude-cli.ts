import { field, numberOf, parseJson, stringOf } from '../json';

/** What `claude -p --output-format json` prints, reduced to the fields the harness uses. */
export interface ClaudeJsonResult {
  readonly isError: boolean;
  /** The final assistant text. */
  readonly result: string | null;
  /** The validated object when `--json-schema` was passed. */
  readonly structured: unknown;
  /** Notional cost; reported for subscription logins too. */
  readonly costUsd: number | null;
}

/**
 * Parses the single JSON object printed by `claude -p --output-format json`.
 * Returns `null` when stdout is not that object (for example a crash).
 */
export function parseClaudeJson(stdout: string): ClaudeJsonResult | null {
  const json = parseJson(stdout.trim());
  if (field(json, 'type') !== 'result') return null;
  const result = stringOf(field(json, 'result'));
  let structured = field(json, 'structured_output');
  if (structured === undefined && result !== null) {
    // Older CLI versions put schema output in `result` as text.
    const match = /\{[\s\S]*\}/.exec(result);
    structured = match === null ? undefined : parseJson(match[0]);
  }
  return {
    isError: field(json, 'is_error') === true || field(json, 'subtype') !== 'success',
    result,
    structured: structured ?? null,
    costUsd: numberOf(field(json, 'total_cost_usd')),
  };
}

/** Default Z.ai Anthropic-compatible endpoint for GLM. */
export const DEFAULT_GLM_BASE_URL = 'https://api.z.ai/api/anthropic';

/**
 * Environment overrides that point the `claude` CLI at GLM: `ANTHROPIC_BASE_URL`
 * and `ANTHROPIC_AUTH_TOKEN`, taken from `GLM_BASE_URL` and `GLM_API_KEY`.
 * Throws when `GLM_API_KEY` is not set.
 */
export function glmEnv(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const key = env.GLM_API_KEY;
  if (key === undefined || key === '') {
    throw new Error('GLM_API_KEY is not set; export it (and optionally GLM_BASE_URL, GLM_MODEL) to use --generator glm or --judge glm');
  }
  return {
    ANTHROPIC_BASE_URL: env.GLM_BASE_URL ?? DEFAULT_GLM_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: key,
  };
}
