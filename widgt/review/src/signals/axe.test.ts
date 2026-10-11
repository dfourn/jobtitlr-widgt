// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { a11ySignal, parseAxeFile } from './axe';

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
