import { glmEnv, parseClaudeJson } from '../io/claude-cli';
import type { CommandRunner } from '../io/runner';
import type { GenerateContext, GenerateOutcome, Generator } from './runner';

/**
 * The only tools the generator may use (AC-L13; `dontAsk` denies everything else): read anything,
 * write the widget's own files (`src/**` and `index.html`), and run the project's own checks.
 */
export const GENERATOR_ALLOWED_TOOLS: readonly string[] = [
  'Read',
  'Glob',
  'Grep',
  'Edit(src/**)',
  'Write(src/**)',
  'Edit(index.html)',
  'Write(index.html)',
  'Bash(npm test)',
  'Bash(npm test *)',
  'Bash(npm run typecheck)',
  'Bash(npm run lint)',
  'Bash(npm run build)',
  'Bash(npx vitest *)',
];

/**
 * Denied even if allowed elsewhere; `dontAsk` already denies anything not
 * allowed, so this list states the most important refusals explicitly.
 * `review/**` holds the contract, the thresholds and the reports (the judge's
 * prose is in runs/); the configs decide what the gates check; a `.npmrc` or
 * a patched `node_modules` would change how the tools run (AC-L12). This is
 * the tool-level guard; G4, G5 and the workspace guard are the checks that do
 * not depend on it.
 */
export const GENERATOR_DISALLOWED_TOOLS: readonly string[] = [
  'Edit(review/**)',
  'Write(review/**)',
  'Read(review/runs/**)',
  'Edit(package.json)',
  'Write(package.json)',
  'Edit(package-lock.json)',
  'Edit(eslint.config.js)',
  'Edit(vite.config.ts)',
  'Edit(tsconfig*.json)',
  'Write(eslint.config.js)',
  'Write(vite.config.ts)',
  'Write(tsconfig*.json)',
  'Edit(node_modules/**)',
  'Write(node_modules/**)',
  'Edit(.npmrc)',
  'Write(.npmrc)',
  'Bash(git *)',
  'Bash(npm run review*)',
];

export interface ClaudeCliGeneratorOptions {
  readonly name: string;
  readonly command?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly model?: string;
  readonly timeoutMs?: number;
}

/**
 * Edits the widget with headless Claude Code: `claude -p` with the prompt on
 * stdin, in `dontAsk` mode, so anything not on the allow list is denied
 * rather than prompted (AC-L13), and `review/**` off limits. Flags checked
 * against claude 2.1.296 --help.
 */
export class ClaudeCliGenerator implements Generator {
  readonly name: string;
  private readonly runner: CommandRunner;
  private readonly options: ClaudeCliGeneratorOptions;

  constructor(runner: CommandRunner, options: ClaudeCliGeneratorOptions) {
    this.runner = runner;
    this.options = options;
    this.name = options.name;
  }

  async generate(prompt: string, context: GenerateContext): Promise<GenerateOutcome> {
    const run = await this.runner.run(this.options.command ?? 'claude', this.args(context), {
      input: prompt,
      ...(this.options.env === undefined ? {} : { env: this.options.env }),
      timeoutMs: this.options.timeoutMs ?? 45 * 60_000,
    });
    const parsed = parseClaudeJson(run.stdout);
    if (parsed === null) {
      return { kind: 'done', costUsd: null, summary: null, error: `exit ${String(run.code)}, no JSON result` };
    }
    const failed = parsed.isError || run.code !== 0;
    return {
      kind: 'done',
      costUsd: parsed.costUsd,
      summary: failed ? null : summariseResult(parsed.result),
      error: failed ? `exit ${String(run.code)}${parsed.result === null ? '' : `: ${firstLine(parsed.result)}`}` : null,
    };
  }

  /** The CLI arguments. Variadic flags are followed by another flag, and the prompt goes on stdin. */
  args(context: GenerateContext): string[] {
    return [
      '-p',
      '--output-format',
      'json',
      '--permission-mode',
      'dontAsk',
      '--permission-prompts',
      'none',
      '--allowedTools',
      ...GENERATOR_ALLOWED_TOOLS,
      '--disallowedTools',
      ...GENERATOR_DISALLOWED_TOOLS,
      ...(context.remainingBudgetUsd === null ? [] : ['--max-budget-usd', context.remainingBudgetUsd.toFixed(2)]),
      ...(this.options.model === undefined ? [] : ['--model', this.options.model]),
      '--name',
      `widgt loop iter-${String(context.iteration).padStart(2, '0')}`,
    ];
  }
}

function firstLine(text: string): string {
  return (text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '').trim().slice(0, 160);
}

/** A one-line change summary from the generator's final message. */
export function summariseResult(result: string | null): string | null {
  if (result === null) return null;
  const line = firstLine(result.replace(/^#+\s*/gm, ''));
  return line === '' ? null : line.length > 100 ? `${line.slice(0, 99)}…` : line;
}

/** Exit code of `npm run loop` when it hands an iteration to an external agent (EX_TEMPFAIL). */
export const HANDOFF_EXIT_CODE = 75;

/**
 * Hands each iteration to another agent (for example Claude in Cowork with
 * subagents): the prompt is already in runs/iter-NN/prompt.md, so this prints
 * what to do next and returns a handoff; the CLI then exits with
 * {@link HANDOFF_EXIT_CODE}. The review and commit steps are unchanged.
 */
export class ExternalGenerator implements Generator {
  readonly name = 'external';
  private readonly print: (line: string) => void;

  constructor(print: (line: string) => void) {
    this.print = print;
  }

  generate(_prompt: string, context: GenerateContext): Promise<GenerateOutcome> {
    this.print(externalInstructions(context));
    return Promise.resolve({ kind: 'handoff' });
  }
}

/** What an external agent (or the person driving it) should do next. */
export function externalInstructions(context: GenerateContext): string {
  const iteration = String(context.iteration).padStart(2, '0');
  return [
    `Iteration ${iteration} is waiting for an external agent.`,
    `  1. Give the agent the prompt in ${context.promptPath}. It may edit src/ (and index.html) only.`,
    '  2. When it has finished, from widgt/ run:',
    '       node review/src/guard.ts && npm run loop -- --generator external --resume --note "<one line on what changed>"',
    '     The guard runs first, with plain Node: it refuses files such as a .npmrc that npm would load,',
    '     and reinstalls node_modules. Then the loop reviews and commits this iteration and writes the next prompt.',
  ].join('\n');
}

export type GeneratorKind = 'claude' | 'glm' | 'external';

/** Builds a generator for `--generator` (AC-L7). */
export function createGenerator(
  kind: GeneratorKind,
  runner: CommandRunner,
  env: Readonly<Record<string, string | undefined>>,
  print: (line: string) => void,
): Generator {
  switch (kind) {
    case 'claude':
      return new ClaudeCliGenerator(runner, { name: 'claude' });
    case 'glm':
      return new ClaudeCliGenerator(runner, {
        name: 'glm',
        env: glmEnv(env),
        ...(env.GLM_MODEL === undefined ? {} : { model: env.GLM_MODEL }),
      });
    case 'external':
      return new ExternalGenerator(print);
  }
}
