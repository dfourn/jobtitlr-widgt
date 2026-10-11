// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { memoryFs } from '../io/fs';
import { a11ySignal, AXE_STATES, axeSignal, parseAxeFile, readAxeStates } from './axe';

describe('AC-L1 axe results', () => {
  it.each([
    {
      name: 'counts per state',
      json: { states: { default: { critical: 0, serious: 1, moderate: 0, minor: 2 }, selected: { critical: 1, serious: 0, moderate: 0, minor: 0 } } },
      counts: { critical: 1, serious: 1, moderate: 0, minor: 2 },
      states: ['default', 'selected'],
    },
    {
      name: 'raw axe results per state',
      json: { states: { default: { violations: [{ impact: 'serious', nodes: [1, 2] }, { impact: 'minor' }] } } },
      counts: { critical: 0, serious: 1, moderate: 0, minor: 1 },
      states: ['default'],
    },
    {
      name: 'an array of raw results',
      json: [{ state: 'default', violations: [] }, { state: 'selected', violations: [{ impact: 'critical' }] }],
      counts: { critical: 1, serious: 0, moderate: 0, minor: 0 },
      states: ['default', 'selected'],
    },
    { name: 'a single count object', json: { critical: 0, serious: 0, moderate: 3, minor: 0 }, counts: { critical: 0, serious: 0, moderate: 3, minor: 0 }, states: ['default'] },
  ])('AC-L1 reads $name', ({ json, counts, states }) => {
    expect(parseAxeFile(json)).toEqual({ counts, states });
  });

  it('AC-L1 returns null for an unknown shape', () => {
    expect(parseAxeFile({ hello: 'world' })).toBeNull();
    expect(parseAxeFile(null)).toBeNull();
  });

  it('AC-L1 scores axe counts with the spec 03 formula', () => {
    const signal = a11ySignal({ counts: { critical: 0, serious: 1, moderate: 0, minor: 2 }, states: ['default', 'selected'] }, null);
    expect(signal).toEqual({ value: 83, detail: 'axe (default, selected): 0 critical, 1 serious, 0 moderate, 2 minor' });
  });

  it('AC-L1 falls back to the AC-3.6 contract tests without axe.json, and says so', () => {
    const contract = {
      cases: [
        { titlePath: ['AC-3.6 no axe violations (default)'], file: null, line: null, passed: true, message: '' },
        { titlePath: ['AC-3.6 no axe violations (selected)'], file: null, line: null, passed: false, message: 'x' },
        { titlePath: ['AC-1.1 label'], file: null, line: null, passed: false, message: 'x' },
      ],
      errors: [],
    };
    expect(a11ySignal(null, contract)).toEqual({ value: 50, detail: 'axe.json not found; fallback: 1/2 AC-3.6 contract tests passed' });
  });

  it('AC-L1 is missing when there is neither axe.json nor an AC-3.6 test', () => {
    expect(a11ySignal(null, null).value).toBeNull();
  });
});

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

  it('AC-L9 no axe folder scores 0 and says so', () => {
    expect(axeSignal(readAxeStates(memoryFs({}), dir), dir)).toEqual({ value: 0, detail: `0: no axe results found in ${dir}` });
  });
});
