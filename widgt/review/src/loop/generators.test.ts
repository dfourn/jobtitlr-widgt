// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CommandRunner, RunOptions } from '../io/runner';
import { ClaudeCliGenerator, createGenerator, ExternalGenerator, summariseResult } from './generators';
import type { GenerateContext } from './runner';

const context: GenerateContext = { iteration: 3, promptPath: 'review/runs/iter-03/prompt.md', remainingBudgetUsd: 7.5 };

function runnerReturning(code: number, stdout: string) {
  const calls: { command: string; args: readonly string[]; options: RunOptions | undefined }[] = [];
  const runner: CommandRunner = {
    run: (command, args, options) => {
      calls.push({ command, args, options });
      return Promise.resolve({ code, stdout, stderr: '' });
    },
  };
  return { runner, calls };
}

const success = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '## Split StarRow into its own component\n\nDetails...', total_cost_usd: 1.25 });

describe('AC-L7 Claude CLI generator', () => {
  it('AC-L7 sends the prompt on stdin to claude -p and reads cost and summary', async () => {
    const { runner, calls } = runnerReturning(0, success);
    const outcome = await new ClaudeCliGenerator(runner, { name: 'claude' }).generate('THE PROMPT', context);
    expect(outcome).toEqual({ kind: 'done', costUsd: 1.25, summary: 'Split StarRow into its own component', error: null });
    expect(calls[0]?.command).toBe('claude');
    expect(calls[0]?.options?.input).toBe('THE PROMPT');
    expect(calls[0]?.args).not.toContain('THE PROMPT');
  });

  it('AC-L7 denies prompts, keeps review/ off limits and passes the remaining budget', () => {
    const args = new ClaudeCliGenerator(runnerReturning(0, '').runner, { name: 'claude' }).args(context);
    expect(args.slice(0, 7)).toEqual(['-p', '--output-format', 'json', '--permission-mode', 'dontAsk', '--permission-prompts', 'none']);
    const disallowed = args.slice(args.indexOf('--disallowedTools') + 1);
    expect(disallowed).toEqual(expect.arrayContaining(['Edit(review/**)', 'Write(review/**)', 'Read(review/runs/**)', 'Bash(git *)']));
    expect(args).toEqual(expect.arrayContaining(['--max-budget-usd', '7.50']));
  });

  it('AC-L13 lets the generator write only src/ and index.html, and denies node_modules and .npmrc', () => {
    const args = new ClaudeCliGenerator(runnerReturning(0, '').runner, { name: 'claude' }).args(context);
    expect(args.slice(3, 5)).toEqual(['--permission-mode', 'dontAsk']);
    const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'));
    expect(allowed).toEqual(expect.arrayContaining(['Edit(src/**)', 'Write(src/**)', 'Edit(index.html)', 'Write(index.html)']));
    expect(allowed.filter((tool) => /^(Edit|Write)(\(|$)/.test(tool) && !/^(Edit|Write)\((src\/\*\*|index\.html)\)$/.test(tool))).toEqual([]);
    const disallowed = args.slice(args.indexOf('--disallowedTools') + 1);
    expect(disallowed).toEqual(
      expect.arrayContaining(['Edit(node_modules/**)', 'Write(node_modules/**)', 'Edit(.npmrc)', 'Write(.npmrc)']),
    );
  });

  it('AC-L7 leaves out the budget flag when there is no budget', () => {
    const args = new ClaudeCliGenerator(runnerReturning(0, '').runner, { name: 'claude' }).args({ ...context, remainingBudgetUsd: null });
    expect(args).not.toContain('--max-budget-usd');
  });

  it('AC-L7 reports a failed run with its cost', async () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, result: 'Budget exceeded', total_cost_usd: 7.5 });
    const outcome = await new ClaudeCliGenerator(runnerReturning(1, stdout).runner, { name: 'claude' }).generate('p', context);
    expect(outcome).toEqual({ kind: 'done', costUsd: 7.5, summary: null, error: 'exit 1: Budget exceeded' });
  });

  it('AC-L7 reports output that is not JSON', async () => {
    const outcome = await new ClaudeCliGenerator(runnerReturning(127, '').runner, { name: 'claude' }).generate('p', context);
    expect(outcome).toEqual({ kind: 'done', costUsd: null, summary: null, error: 'exit 127, no JSON result' });
  });

  it('AC-L7 the GLM generator is the same CLI pointed at Z.ai through env overrides', async () => {
    const { runner, calls } = runnerReturning(0, success);
    const generator = createGenerator('glm', runner, { GLM_API_KEY: 'k' }, () => undefined);
    await generator.generate('p', context);
    expect(generator.name).toBe('glm');
    expect(calls[0]?.options?.env).toEqual({ ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic', ANTHROPIC_AUTH_TOKEN: 'k' });
  });
});

describe('AC-L7 external generator', () => {
  it('AC-L7 prints where the prompt is and how to resume, then hands off', async () => {
    const printed: string[] = [];
    const outcome = await new ExternalGenerator((line) => printed.push(line)).generate('p', context);
    expect(outcome).toEqual({ kind: 'handoff' });
    expect(printed.join('\n')).toContain('review/runs/iter-03/prompt.md');
    expect(printed.join('\n')).toContain('npm run loop -- --generator external --resume');
  });

  it('AC-L12 the hand-off runs the guard with plain Node before resuming', async () => {
    const printed: string[] = [];
    await new ExternalGenerator((line) => printed.push(line)).generate('p', context);
    expect(printed.join('\n')).toContain('node review/src/guard.ts && npm run loop -- --generator external --resume');
  });

  it('AC-L7 is selected with --generator external and needs no runner calls', async () => {
    const { runner, calls } = runnerReturning(0, '');
    await createGenerator('external', runner, {}, () => undefined).generate('p', context);
    expect(calls).toEqual([]);
  });
});

describe('AC-L7 summariseResult()', () => {
  it.each([
    { result: null, expected: null },
    { result: '', expected: null },
    { result: '\n\n# Done\nmore', expected: 'Done' },
    { result: 'x'.repeat(150), expected: `${'x'.repeat(99)}…` },
  ])('AC-L7 summarises $result as $expected', ({ result, expected }) => {
    expect(summariseResult(result)).toBe(expected);
  });
});
