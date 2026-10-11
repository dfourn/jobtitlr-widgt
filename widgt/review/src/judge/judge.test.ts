// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CommandRunner, RunOptions } from '../io/runner';
import { buildJudgePrompt, CliJudge, createJudge, median, NoJudge, type JudgeInput } from './judge';
import { judgeSchema, parseRubric, type Rubric } from './rubric';

const rubric: Rubric = {
  instructions: 'Pick the lower anchor when unsure.',
  criteria: [
    { id: 'layout-fidelity', brief: ['B2.2'], question: 'Does it look right?', anchors: { '0': 'no', '1': 'meh', '2': 'close', '3': 'same' } },
    { id: 'readability', brief: ['B2.6'], question: 'Is it readable?', anchors: { '0': 'no', '1': 'meh', '2': 'yes', '3': 'very' } },
  ],
};

const input: JudgeInput = {
  rubric,
  screenshots: ['review/runs/latest/screenshots/visual-401.png'],
  reference: 'review/reference/widget-reference.png',
  sourceDir: 'src',
};

function cliOutput(scores: Record<string, number>, cost = 0.02): string {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'done',
    total_cost_usd: cost,
    structured_output: { criteria: Object.entries(scores).map(([id, score]) => ({ id, score, evidence: `evidence for ${id}` })) },
  });
}

/** A runner that replays canned stdout and records every call. */
function scriptedRunner(outputs: readonly { code: number; stdout: string }[]) {
  const calls: { command: string; args: readonly string[]; options: RunOptions | undefined }[] = [];
  let index = 0;
  const runner: CommandRunner = {
    run: (command, args, options) => {
      calls.push({ command, args, options });
      const output = outputs[index] ?? { code: 1, stdout: '' };
      index += 1;
      return Promise.resolve({ ...output, stderr: '' });
    },
  };
  return { runner, calls };
}

describe('AC-L1 judge', () => {
  it('AC-L1 NoJudge returns null so its weight is redistributed', async () => {
    expect(await new NoJudge().evaluate()).toBeNull();
  });

  it('AC-L1 the CLI judge takes the median of 3 samples per criterion', async () => {
    const { runner, calls } = scriptedRunner([
      { code: 0, stdout: cliOutput({ 'layout-fidelity': 3, readability: 1 }) },
      { code: 0, stdout: cliOutput({ 'layout-fidelity': 1, readability: 2 }) },
      { code: 0, stdout: cliOutput({ 'layout-fidelity': 2, readability: 2 }) },
    ]);
    const result = await new CliJudge(runner, { name: 'claude' }).evaluate(input);
    expect(calls).toHaveLength(3);
    expect(result.criteria).toEqual({ 'layout-fidelity': 2, readability: 2 });
    expect(result.score).toBe(66.7);
    expect(result.samples).toBe(3);
    expect(result.costUsd).toBeCloseTo(0.06, 6);
    expect(result.evidence['readability']).toHaveLength(3);
  });

  it('AC-L1 calls claude -p with JSON output, the rubric schema, read-only tools and the prompt on stdin', async () => {
    const { runner, calls } = scriptedRunner([{ code: 0, stdout: cliOutput({ 'layout-fidelity': 3, readability: 3 }) }]);
    await new CliJudge(runner, { name: 'claude', samples: 1 }).evaluate(input);
    const call = calls[0];
    expect(call?.command).toBe('claude');
    expect(call?.args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--json-schema', '--tools', 'Read,Glob,Grep']));
    expect(call?.args).toContain(JSON.stringify(judgeSchema(rubric)));
    expect(call?.args).not.toContain('Edit');
    expect(call?.options?.input).toContain('review/reference/widget-reference.png');
  });

  it('AC-L1 ignores failed or malformed samples and reports them', async () => {
    const { runner } = scriptedRunner([
      { code: 1, stdout: '' },
      { code: 0, stdout: cliOutput({ 'layout-fidelity': 9, readability: 1 }) },
      { code: 0, stdout: cliOutput({ 'layout-fidelity': 3, readability: 3 }) },
    ]);
    const result = await new CliJudge(runner, { name: 'claude' }).evaluate(input);
    expect(result.samples).toBe(1);
    expect(result.criteria).toEqual({ 'layout-fidelity': 3, readability: 3 });
    expect(result.errors).toEqual(['sample 1: exit 1', 'sample 2: no valid rubric scores in the output']);
  });

  it('AC-L1 returns a null score when every sample fails', async () => {
    const { runner } = scriptedRunner([]);
    const result = await new CliJudge(runner, { name: 'claude' }).evaluate(input);
    expect(result.score).toBeNull();
    expect(result.errors).toHaveLength(3);
  });

  it('AC-L1 the GLM judge is the same CLI with the endpoint and token from GLM_* variables', async () => {
    const { runner, calls } = scriptedRunner([{ code: 0, stdout: cliOutput({ 'layout-fidelity': 1, readability: 1 }) }]);
    const judge = createJudge('glm', runner, { GLM_API_KEY: 'secret', GLM_BASE_URL: 'https://glm.example/anthropic', GLM_MODEL: 'glm-4.6' });
    await judge.evaluate(input);
    expect(judge.name).toBe('glm');
    expect(calls[0]?.options?.env).toEqual({ ANTHROPIC_BASE_URL: 'https://glm.example/anthropic', ANTHROPIC_AUTH_TOKEN: 'secret' });
    expect(calls[0]?.args).toEqual(expect.arrayContaining(['--model', 'glm-4.6']));
  });

  it('AC-L1 refuses the GLM judge without GLM_API_KEY', () => {
    expect(() => createJudge('glm', scriptedRunner([]).runner, {})).toThrow(/GLM_API_KEY/);
  });

  it.each([
    { values: [3], expected: 3 },
    { values: [3, 1, 2], expected: 2 },
    { values: [0, 3], expected: 1.5 },
    { values: [2, 2, 0, 3], expected: 2 },
  ])('AC-L1 median of $values is $expected', ({ values, expected }) => {
    expect(median(values)).toBe(expected);
  });

  it('AC-L1 the prompt lists every criterion with its anchors', () => {
    const prompt = buildJudgePrompt(input);
    expect(prompt).toContain('### layout-fidelity (B2.2)');
    expect(prompt).toContain('- 3: very');
    expect(prompt).toContain('Screenshot: review/runs/latest/screenshots/visual-401.png');
  });
});

describe('AC-L1 review/rubric.json', () => {
  const rubricJson: unknown = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'rubric.json'), 'utf8'));

  it('AC-L1 has 5-6 criteria with 0-3 anchors tied to B2.2, B2.4, B2.6 and B2.7', () => {
    const parsed = parseRubric(rubricJson);
    expect(parsed.criteria.length).toBeGreaterThanOrEqual(5);
    expect(parsed.criteria.length).toBeLessThanOrEqual(6);
    const brief = new Set(parsed.criteria.flatMap((c) => c.brief));
    for (const item of ['B2.2', 'B2.4', 'B2.6', 'B2.7']) expect(brief).toContain(item);
  });

  it('AC-L1 rejects a rubric without anchors', () => {
    expect(() => parseRubric({ criteria: [{ id: 'x', question: 'y' }] })).toThrow(/anchors/);
  });
});
