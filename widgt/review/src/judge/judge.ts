import type { CommandRunner } from '../io/runner';
import { glmEnv, parseClaudeJson } from '../io/claude-cli';
import { arrayOf, field, numberOf, stringOf } from '../json';
import { judgeSchema, type Rubric } from './rubric';

export interface JudgeInput {
  readonly rubric: Rubric;
  /** Screenshot paths, relative to the working directory, that exist. */
  readonly screenshots: readonly string[];
  /** The reference image path, or `null` when it is missing. */
  readonly reference: string | null;
  /** Where the widget's source lives, for the code criteria. */
  readonly sourceDir: string;
}

export interface JudgeResult {
  /** 0-100 from the per-criterion medians, or `null` when every sample failed. */
  readonly score: number | null;
  /** Median score per criterion (0-3). */
  readonly criteria: Readonly<Record<string, number>>;
  /** How many samples returned a usable answer. */
  readonly samples: number;
  readonly costUsd: number;
  /**
   * The judge's prose, per criterion and sample. Written to judge.json for
   * people only; it never reaches report.md or the generator (spec 03 §5).
   */
  readonly evidence: Readonly<Record<string, readonly string[]>>;
  readonly errors: readonly string[];
}

/** Scores the widget against the rubric. `null` means the judge is off. */
export interface Judge {
  readonly name: string;
  evaluate(input: JudgeInput): Promise<JudgeResult | null>;
}

/** The default: no AI. Its weight is redistributed by `score()`. */
export class NoJudge implements Judge {
  readonly name = 'none';

  evaluate(): Promise<JudgeResult | null> {
    return Promise.resolve(null);
  }
}

export interface CliJudgeOptions {
  readonly name: string;
  readonly command?: string;
  /** Spec 03: the median of 3 samples. */
  readonly samples?: number;
  /** Extra environment, for example the GLM endpoint and token. */
  readonly env?: Readonly<Record<string, string>>;
  readonly model?: string;
  readonly timeoutMs?: number;
}

/**
 * A judge that shells out to `claude -p` with `--json-schema`, one call per
 * sample, and takes the median of each criterion. The judge may only read
 * files: it gets the Read, Glob and Grep tools and nothing else.
 */
export class CliJudge implements Judge {
  readonly name: string;
  private readonly runner: CommandRunner;
  private readonly options: CliJudgeOptions;

  constructor(runner: CommandRunner, options: CliJudgeOptions) {
    this.runner = runner;
    this.options = options;
    this.name = options.name;
  }

  async evaluate(input: JudgeInput): Promise<JudgeResult> {
    const samples = this.options.samples ?? 3;
    const prompt = buildJudgePrompt(input);
    const args = this.args(input.rubric);
    const answers: { scores: Record<string, number>; evidence: Record<string, string> }[] = [];
    const errors: string[] = [];
    let costUsd = 0;
    for (let sample = 1; sample <= samples; sample += 1) {
      const run = await this.runner.run(this.options.command ?? 'claude', args, {
        input: prompt,
        ...(this.options.env === undefined ? {} : { env: this.options.env }),
        timeoutMs: this.options.timeoutMs ?? 600_000,
      });
      const parsed = parseClaudeJson(run.stdout);
      costUsd += parsed?.costUsd ?? 0;
      const answer = parsed === null || parsed.isError ? null : parseJudgeAnswer(parsed.structured, input.rubric);
      if (answer === null) {
        errors.push(`sample ${String(sample)}: ${run.code === 0 ? 'no valid rubric scores in the output' : `exit ${String(run.code)}`}`);
      } else {
        answers.push(answer);
      }
    }
    return combineSamples(answers, input.rubric, costUsd, errors);
  }

  private args(rubric: Rubric): string[] {
    return [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(judgeSchema(rubric)),
      '--tools',
      'Read,Glob,Grep',
      '--allowedTools',
      'Read',
      'Glob',
      'Grep',
      '--permission-mode',
      'dontAsk',
      '--no-session-persistence',
      ...(this.options.model === undefined ? [] : ['--model', this.options.model]),
    ];
  }
}

/** The judge prompt: rubric, anchors, and where to look. Pure. */
export function buildJudgePrompt(input: JudgeInput): string {
  const criteria = input.rubric.criteria.flatMap((c) => [
    `### ${c.id} (${c.brief.join(', ')})`,
    c.question,
    ...(['0', '1', '2', '3'] as const).map((k) => `- ${k}: ${c.anchors[k]}`),
    '',
  ]);
  return [
    'You are reviewing a React product rating widget against a rubric. You did not write it.',
    input.rubric.instructions,
    '',
    '## Images (use the Read tool to view them)',
    input.reference === null ? '- Reference: not available' : `- Reference design: ${input.reference}`,
    ...input.screenshots.map((s) => `- Screenshot: ${s}`),
    '',
    `## Source code: ${input.sourceDir}/ (use Glob, Grep and Read)`,
    '',
    '## Rubric',
    '',
    ...criteria,
    'Return one entry per criterion with its id, an integer score 0-3 and one or two sentences of evidence.',
  ].join('\n');
}

/** Reads one sample's structured output; `null` unless every criterion has a 0-3 integer. */
export function parseJudgeAnswer(
  structured: unknown,
  rubric: Rubric,
): { scores: Record<string, number>; evidence: Record<string, string> } | null {
  const scores: Record<string, number> = {};
  const evidence: Record<string, string> = {};
  for (const entry of arrayOf(field(structured, 'criteria'))) {
    const id = stringOf(field(entry, 'id'));
    const value = numberOf(field(entry, 'score'));
    if (id === null || value === null || !Number.isInteger(value) || value < 0 || value > 3) continue;
    scores[id] = value;
    evidence[id] = stringOf(field(entry, 'evidence')) ?? '';
  }
  return rubric.criteria.every((c) => c.id in scores) ? { scores, evidence } : null;
}

/** Median of a non-empty list (mean of the middle two for an even count). */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

function combineSamples(
  answers: readonly { scores: Record<string, number>; evidence: Record<string, string> }[],
  rubric: Rubric,
  costUsd: number,
  errors: readonly string[],
): JudgeResult {
  if (answers.length === 0) {
    return { score: null, criteria: {}, samples: 0, costUsd, evidence: {}, errors };
  }
  const criteria: Record<string, number> = {};
  const evidence: Record<string, string[]> = {};
  for (const c of rubric.criteria) {
    criteria[c.id] = median(answers.map((a) => a.scores[c.id] ?? 0));
    evidence[c.id] = answers.map((a) => a.evidence[c.id] ?? '');
  }
  const sum = Object.values(criteria).reduce((a, b) => a + b, 0);
  const score = Math.round((sum / (3 * rubric.criteria.length)) * 1000) / 10;
  return { score, criteria, samples: answers.length, costUsd, evidence, errors };
}

/** The judges selectable with `--judge`. */
export type JudgeKind = 'none' | 'claude' | 'glm';

/** Builds a judge. `glm` is the same CLI judge pointed at Z.ai through env overrides. */
export function createJudge(kind: JudgeKind, runner: CommandRunner, env: Readonly<Record<string, string | undefined>>): Judge {
  switch (kind) {
    case 'none':
      return new NoJudge();
    case 'claude':
      return new CliJudge(runner, { name: 'claude' });
    case 'glm':
      return new CliJudge(runner, {
        name: 'glm',
        env: glmEnv(env),
        ...(env.GLM_MODEL === undefined ? {} : { model: env.GLM_MODEL }),
      });
  }
}
