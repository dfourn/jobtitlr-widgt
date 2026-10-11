// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ReviewReport } from '../report';
import { failure, sampleReport } from '../testing/fixtures';
import {
  commitMessage,
  initialState,
  runLoop,
  type GenerateOutcome,
  type Generator,
  type IterationRecord,
  type LoopDeps,
  type LoopOptions,
  type LoopState,
} from './runner';

const options: LoopOptions = { target: 90, maxIter: 8, maxBudgetUsd: 10, note: null };

/** A passing report with the given total and one failure tagged with the iteration. */
function reportWith(total: number, iteration: number): ReviewReport {
  return {
    ...sampleReport,
    iteration,
    total,
    uncappedTotal: total,
    gatesPassed: true,
    failedGates: [],
    gates: [],
    failures: [failure(`AC-1.${String(iteration + 1)}`)],
  };
}

interface Harness {
  readonly deps: LoopDeps;
  readonly prompts: Map<number, string>;
  readonly commits: string[];
  readonly archived: number[];
  readonly published: LoopState[];
  readonly saved: LoopState[];
  readonly generated: { iteration: number; remaining: number | null }[];
}

/** Fake world: reviews return scripted totals, the generator returns scripted outcomes. */
function harness(totals: readonly number[], outcomes: (iteration: number) => GenerateOutcome = () => ({ kind: 'done', costUsd: null, summary: 'edited', error: null })): Harness {
  const prompts = new Map<number, string>();
  const commits: string[] = [];
  const archived: number[] = [];
  const published: LoopState[] = [];
  const saved: LoopState[] = [];
  const generated: { iteration: number; remaining: number | null }[] = [];
  const generator: Generator = {
    name: 'fake',
    generate: (_prompt, context) => {
      generated.push({ iteration: context.iteration, remaining: context.remainingBudgetUsd });
      return Promise.resolve(outcomes(context.iteration));
    },
  };
  const deps: LoopDeps = {
    generator,
    spec: 'SPEC 02 TEXT',
    review: (iteration) => {
      const total = totals[iteration];
      return total === undefined ? Promise.reject(new Error(`no scripted total for ${String(iteration)}`)) : Promise.resolve(reportWith(total, iteration));
    },
    archive: (iteration) => {
      archived.push(iteration);
      return Promise.resolve();
    },
    writePrompt: (iteration, prompt) => {
      prompts.set(iteration, prompt);
      return Promise.resolve(`review/runs/iter-0${String(iteration)}/prompt.md`);
    },
    publish: (state) => {
      published.push(state);
      return Promise.resolve();
    },
    commit: (message) => {
      commits.push(message);
      return Promise.resolve(`sha${String(commits.length - 1)}`);
    },
    saveState: (state) => {
      saved.push(state);
      return Promise.resolve();
    },
    describeChanges: () => Promise.resolve('3 files changed'),
    log: () => undefined,
  };
  return { deps, prompts, commits, archived, published, saved, generated };
}

describe('AC-L5 the loop stops on each stop condition', () => {
  it('AC-L5 stops when the target is reached with gates passing', async () => {
    const h = harness([40, 70, 92]);
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'target' });
    expect(h.generated.map((g) => g.iteration)).toEqual([1, 2]);
  });

  it('AC-L5 does not call the generator when the baseline already meets the target', async () => {
    const h = harness([95]);
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'target' });
    expect(h.generated).toEqual([]);
  });

  it('AC-L5 stops after max-iter generator iterations', async () => {
    const h = harness([10, 30, 50, 70]);
    const outcome = await runLoop(h.deps, { ...options, maxIter: 2 }, initialState('fake'));
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'max-iter' });
    expect(h.generated).toHaveLength(2);
  });

  it('AC-L5 stops on a plateau', async () => {
    const h = harness([40, 40.5, 40.8, 60]);
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'plateau' });
    expect(h.generated).toHaveLength(2);
  });

  it('AC-L5 stops when the reported spend reaches the budget, passing the remainder to the generator', async () => {
    const h = harness([10, 30, 50, 70], () => ({ kind: 'done', costUsd: 6, summary: 'edited', error: null }));
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'budget' });
    expect(h.generated).toEqual([
      { iteration: 1, remaining: 10 },
      { iteration: 2, remaining: 4 },
    ]);
    expect(outcome.state.spentUsd).toBe(12);
  });
});

describe('AC-L6 every iteration is archived, scored and committed', () => {
  it('AC-L6 archives, publishes and commits once per iteration, baseline included', async () => {
    const h = harness([40, 70, 92]);
    await runLoop(h.deps, options, initialState('fake'));
    expect(h.archived).toEqual([0, 1, 2]);
    expect(h.commits.map((m) => m.split('\n')[0])).toEqual([
      'loop(iter-00): baseline score 40, a11y 85, contract 18/22',
      'loop(iter-01): score 40 -> 70 (+30), a11y 85, contract 18/22',
      'loop(iter-02): score 70 -> 92 (+22), a11y 85, contract 18/22',
    ]);
    expect(h.published.at(-1)?.iterations.map((r) => r.iteration)).toEqual([0, 1, 2]);
  });

  it('AC-L6 publishes each row before its commit and records the SHA afterwards', async () => {
    const h = harness([40, 92]);
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(h.published[0]?.iterations[0]?.sha).toBeNull();
    expect(h.published[1]?.iterations.map((r) => r.sha)).toEqual(['sha0', null]);
    expect(outcome.state.iterations.map((r) => r.sha)).toEqual(['sha0', 'sha1']);
  });

  it('AC-L6 uses the generator summary, or describes the change when there is none', async () => {
    const h = harness([40, 50, 92], (iteration) => ({ kind: 'done', costUsd: null, summary: iteration === 1 ? 'added StarRow' : null, error: null }));
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome.state.iterations.map((r) => r.summary)).toEqual(['baseline', 'added StarRow', '3 files changed']);
  });

  it('AC-L6 still reviews and commits when the generator reports an error', async () => {
    const h = harness([40, 92], () => ({ kind: 'done', costUsd: 1, summary: null, error: 'exit 1' }));
    const outcome = await runLoop(h.deps, options, initialState('fake'));
    expect(outcome.state.iterations[1]?.summary).toBe('generator error: exit 1');
    expect(h.commits).toHaveLength(2);
  });
});

describe('AC-L7 prompts and the external generator', () => {
  it('AC-L7 builds each prompt from spec 02 and the previous review', async () => {
    const h = harness([40, 70, 92]);
    await runLoop(h.deps, options, initialState('fake'));
    expect(h.prompts.get(1)).toContain('SPEC 02 TEXT');
    expect(h.prompts.get(1)).toContain('[AC-1.1]');
    expect(h.prompts.get(2)).toContain('[AC-1.2]');
    expect(h.prompts.get(2)).toContain('Last score: 70 / 100');
  });

  it('AC-L10 carries the visual region hint from the last review into the next prompt', async () => {
    const h = harness([40, 92]);
    const regions = [{ name: 'stars', similarity: 0.4, best: { dx: 0, dy: 4, similarity: 0.9 } }];
    const deps: LoopDeps = { ...h.deps, review: (iteration) => h.deps.review(iteration).then((report) => ({ ...report, visualRegions: regions })) };
    await runLoop(deps, options, initialState('fake'));
    expect(h.prompts.get(1)).toContain("Visual: the weakest region is 'stars' (0.40)");
  });

  it('AC-L7 hands off to an external agent and resumes where it left off', async () => {
    const h = harness([40, 70, 92], () => ({ kind: 'handoff' }));
    const first = await runLoop(h.deps, options, initialState('external'));
    expect(first).toMatchObject({ status: 'handoff', iteration: 1, promptPath: 'review/runs/iter-01/prompt.md' });
    expect(first.state.pending).toBe(1);
    expect(h.saved.at(-1)?.pending).toBe(1);
    expect(h.commits).toHaveLength(1);

    const second = await runLoop(h.deps, { ...options, note: 'split StarRow out' }, first.state);
    expect(second).toMatchObject({ status: 'handoff', iteration: 2 });
    expect(second.state.iterations.map((r) => [r.iteration, r.summary])).toEqual([
      [0, 'baseline'],
      [1, 'split StarRow out'],
    ]);
    expect(h.commits[1]?.split('\n')[0]).toBe('loop(iter-01): score 40 -> 70 (+30), a11y 85, contract 18/22');

    const third = await runLoop(h.deps, options, second.state);
    expect(third).toMatchObject({ status: 'stopped', reason: 'target' });
  });
});

describe('AC-L6 commitMessage()', () => {
  const base: IterationRecord = {
    iteration: 3,
    total: 86,
    gatesPassed: true,
    failedGates: [],
    signals: { contract: 81.8, unit: 70, a11y: 100, responsive: 50, visual: 40, judge: null },
    contract: { passed: 18, total: 22 },
    sha: null,
    summary: 'split the breakdown row',
    costUsd: 0.42,
    feedback: { gates: [], failures: [] },
  };

  it.each([
    { name: 'an improvement', record: base, previous: { ...base, iteration: 2, total: 78 }, subject: 'loop(iter-03): score 78 -> 86 (+8), a11y 100, contract 18/22' },
    { name: 'a regression', record: { ...base, total: 70.4 }, previous: { ...base, total: 78.6 }, subject: 'loop(iter-03): score 79 -> 70 (-9), a11y 100, contract 18/22' },
    {
      name: 'a failed gate',
      record: { ...base, total: 0, gatesPassed: false, failedGates: ['G1', 'G5'] },
      previous: { ...base, total: 78 },
      subject: 'loop(iter-03): score 78 -> 0 (-78), gates failed G1 G5, a11y 100, contract 18/22',
    },
    {
      name: 'the baseline with missing signals',
      record: { ...base, iteration: 0, total: 0, signals: { ...base.signals, a11y: null }, contract: null },
      previous: null,
      subject: 'loop(iter-00): baseline score 0',
    },
  ])('AC-L6 summarises $name in the subject', ({ record, previous, subject }) => {
    expect(commitMessage(record, previous, 'claude').split('\n')[0]).toBe(subject);
  });

  it('AC-L6 explains the change, the generator and the cost in the body', () => {
    const message = commitMessage(base, { ...base, total: 78 }, 'claude');
    expect(message).toContain('\n\nsplit the breakdown row\n');
    expect(message).toContain('Generator: claude');
    expect(message).toContain('Cost-USD: 0.42');
  });
});
