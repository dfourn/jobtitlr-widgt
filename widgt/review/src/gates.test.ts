// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkContractLock, computeLock, serialiseLock } from './gates';
import { memoryFs } from './io/fs';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

const tree = {
  'review/contract/widget.spec.ts': "test('AC-1.1 renders', () => {});",
  'review/contract/helpers/viewports.ts': 'export const widths = [320, 768, 1280];',
  'review/reference/widget-reference.png': new Uint8Array([137, 80, 78, 71]),
  'review/rubric.json': '{"criteria":[]}',
  'review/src/score.ts': 'not locked',
  'src/App.tsx': 'not locked',
};

function lockedTree(overrides: Record<string, string | Uint8Array | undefined> = {}): Record<string, string | Uint8Array> {
  const merged = { ...tree, 'review/contract.lock': serialiseLock(computeLock(memoryFs(tree))), ...overrides };
  return Object.fromEntries(
    Object.entries(merged).filter((entry): entry is [string, string | Uint8Array] => entry[1] !== undefined),
  );
}

describe('AC-L3 contract lock (G4)', () => {
  it('AC-L3 hashes contract, reference and rubric files, sorted by path', () => {
    const lock = computeLock(memoryFs(tree));
    expect(Object.keys(lock)).toEqual([
      'review/contract/helpers/viewports.ts',
      'review/contract/widget.spec.ts',
      'review/reference/widget-reference.png',
      'review/rubric.json',
    ]);
    expect(lock['review/rubric.json']).toBe(sha('{"criteria":[]}'));
  });

  it('AC-L3 serialises the lock as stable, pretty JSON with a trailing newline', () => {
    const text = serialiseLock({ 'b.ts': '2', 'a.ts': '1' });
    expect(text).toBe('{\n  "a.ts": "1",\n  "b.ts": "2"\n}\n');
  });

  it('AC-L3 passes when nothing under the lock changed', () => {
    const gate = checkContractLock(memoryFs(lockedTree()));
    expect(gate).toMatchObject({ id: 'G4', passed: true });
  });

  it('AC-L3 ignores changes outside the locked scope', () => {
    const gate = checkContractLock(memoryFs(lockedTree({ 'src/App.tsx': 'changed', 'review/src/score.ts': 'changed' })));
    expect(gate.passed).toBe(true);
  });

  it.each([
    { name: 'a contract spec is edited', change: { 'review/contract/widget.spec.ts': "test('AC-1.1 renders', () => { /* weaker */ });" }, detail: 'changed: review/contract/widget.spec.ts' },
    { name: 'the reference image is replaced', change: { 'review/reference/widget-reference.png': new Uint8Array([1]) }, detail: 'changed: review/reference/widget-reference.png' },
    { name: 'the rubric is edited', change: { 'review/rubric.json': '{"criteria":[1]}' }, detail: 'changed: review/rubric.json' },
    { name: 'a contract file is deleted', change: { 'review/contract/helpers/viewports.ts': undefined }, detail: 'removed: review/contract/helpers/viewports.ts' },
    { name: 'a contract file is added', change: { 'review/contract/extra.spec.ts': 'x' }, detail: 'added: review/contract/extra.spec.ts' },
  ])('AC-L3 fails when $name', ({ change, detail }) => {
    const gate = checkContractLock(memoryFs(lockedTree(change)));
    expect(gate.passed).toBe(false);
    expect(gate.detail).toContain(detail);
  });

  it('AC-L3 fails with a clear message when the lock file is missing', () => {
    const gate = checkContractLock(memoryFs(tree));
    expect(gate.passed).toBe(false);
    expect(gate.detail).toMatch(/contract\.lock is missing.*review:lock/);
  });

  it('AC-L3 fails when the lock file is not valid JSON', () => {
    const gate = checkContractLock(memoryFs({ ...tree, 'review/contract.lock': '{ nope' }));
    expect(gate.passed).toBe(false);
    expect(gate.detail).toMatch(/not valid/);
  });
});
