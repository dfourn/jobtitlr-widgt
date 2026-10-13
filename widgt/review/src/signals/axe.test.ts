// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryFs, nodeFs } from '../io/fs';
import { AXE_STATES, axeSignal, parseAxeState, readAxeStates } from './axe';

describe('AC-L9 accessibility over the expected states', () => {
  const dir = 'review/runs/latest/axe';
  const counts = (critical: number, serious: number, moderate: number, minor: number) => ({ critical, serious, moderate, minor });

  it('AC-L9 the expected states are default, static and selected', () => {
    expect(AXE_STATES).toEqual(['default', 'static', 'selected']);
  });

  it('AC-L9 reads one file per state and counts violated rules, not nodes', () => {
    const fs = memoryFs({
      [`${dir}/default.json`]: JSON.stringify({ state: 'default', violations: [{ id: 'color-contrast', impact: 'serious', nodes: 4 }, { id: 'region', impact: 'moderate', nodes: 1 }] }),
      [`${dir}/static.json`]: JSON.stringify({ state: 'static', violations: [] }),
      [`${dir}/selected.json`]: JSON.stringify({ state: 'selected', violations: [{ id: 'list', impact: null, nodes: 2 }] }),
    });
    expect(readAxeStates(fs, dir)).toEqual(
      new Map([
        ['default', counts(0, 1, 1, 0)],
        ['selected', counts(0, 0, 0, 0)],
        ['static', counts(0, 0, 0, 0)],
      ]),
    );
  });

  it('AC-L9 also accepts a raw axe result for a state, where nodes is an array', () => {
    const raw = { violations: [{ id: 'color-contrast', impact: 'critical', nodes: [{ target: ['a'] }, { target: ['b'] }] }], passes: [] };
    expect(parseAxeState(raw)).toEqual(counts(1, 0, 0, 0));
  });

  it('AC-L9 averages the per-state scores over the three states', () => {
    const states = new Map([
      ['default', counts(0, 1, 0, 2)],
      ['static', counts(0, 0, 0, 0)],
      ['selected', counts(1, 0, 0, 0)],
    ]);
    expect(axeSignal(states, dir)).toEqual({
      value: (83 + 100 + 75) / 3,
      detail: 'axe, mean of default, static, selected: default 83 (1 serious, 2 minor); static 100; selected 75 (1 critical)',
    });
  });

  it('AC-L9 a missing state scores 0 and is named', () => {
    const states = new Map([
      ['default', counts(0, 0, 0, 0)],
      ['static', counts(0, 0, 0, 0)],
    ]);
    expect(axeSignal(states, dir)).toEqual({
      value: 200 / 3,
      detail: 'axe, mean of default, static, selected: default 100; static 100; selected 0 (missing)',
    });
  });

  it('AC-L9 an unreadable state counts as missing', () => {
    const fs = memoryFs({
      [`${dir}/default.json`]: JSON.stringify({ state: 'default', violations: [] }),
      [`${dir}/static.json`]: '{"state": "static", "violations": [',
      [`${dir}/selected.json`]: JSON.stringify({ state: 'selected', result: 'clean' }),
    });
    expect(axeSignal(readAxeStates(fs, dir), dir)).toEqual({
      value: 100 / 3,
      detail: 'axe, mean of default, static, selected: default 100; static 0 (unreadable); selected 0 (unreadable)',
    });
  });

  it.each(['runs/axe/', './runs/axe', './runs/axe/'])('AC-L9 reads the states from --axe %s like runs/axe', (given) => {
    const root = mkdtempSync(join(tmpdir(), 'widgt-axe-'));
    try {
      mkdirSync(join(root, 'runs', 'axe'), { recursive: true });
      for (const state of AXE_STATES) {
        writeFileSync(join(root, 'runs', 'axe', `${state}.json`), JSON.stringify({ state, violations: [] }));
      }
      expect([...readAxeStates(nodeFs(root), given).keys()].sort()).toEqual(['default', 'selected', 'static']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-L9 no axe folder scores 0 and says so', () => {
    expect(axeSignal(readAxeStates(memoryFs({}), dir), dir)).toEqual({ value: 0, detail: `0: no axe results found in ${dir}` });
  });
});
