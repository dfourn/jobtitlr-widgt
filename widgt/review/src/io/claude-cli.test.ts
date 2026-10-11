// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_GLM_BASE_URL, glmEnv, parseClaudeJson } from './claude-cli';

describe('AC-L7 claude CLI output', () => {
  it('AC-L7 reads result, structured output and cost', () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', total_cost_usd: 0.42, structured_output: { a: 1 } });
    expect(parseClaudeJson(stdout)).toEqual({ isError: false, result: 'ok', structured: { a: 1 }, costUsd: 0.42 });
  });

  it('AC-L7 falls back to JSON inside the result text', () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Here: {"a": 2}' });
    expect(parseClaudeJson(stdout)?.structured).toEqual({ a: 2 });
  });

  it('AC-L7 flags errors such as a hit budget', () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, total_cost_usd: 3 });
    expect(parseClaudeJson(stdout)).toMatchObject({ isError: true, costUsd: 3 });
  });

  it('AC-L7 returns null for anything else', () => {
    expect(parseClaudeJson('')).toBeNull();
    expect(parseClaudeJson('Error: not logged in')).toBeNull();
  });

  it('AC-L7 maps GLM variables onto the Anthropic ones, with a default endpoint', () => {
    expect(glmEnv({ GLM_API_KEY: 'k' })).toEqual({ ANTHROPIC_BASE_URL: DEFAULT_GLM_BASE_URL, ANTHROPIC_AUTH_TOKEN: 'k' });
  });
});
