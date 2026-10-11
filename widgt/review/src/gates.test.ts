// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkContractLock, checkForbiddenPatterns, computeLock, findForbiddenPatterns, serialiseLock } from './gates';
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
  const files: Record<string, string | Uint8Array> = {};
  for (const [path, content] of Object.entries(merged)) {
    if (content !== undefined) files[path] = content;
  }
  return files;
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

describe('AC-L4 forbidden patterns (G5)', () => {
  const clean = {
    'src/domain/rating.test.ts': "it('AC-2.1 rounds half-up', () => {\n  expect(1).toBe(1);\n});\n",
    'src/main.tsx': 'process.exit(0);\nemitter.exit(1);\n',
    'review/contract/widget.spec.ts': "test('AC-1.1 renders', async () => {});\n",
  };

  it('AC-L4 passes on clean sources', () => {
    expect(checkForbiddenPatterns(memoryFs(clean))).toMatchObject({ id: 'G5', passed: true });
  });

  it.each([
    { pattern: '.skip(', line: "it.skip('AC-2.1 rounds', () => {});" },
    { pattern: '.skip(', line: "describe.skip('AC-4 interactions', () => {});" },
    { pattern: '.only(', line: "test.only('AC-1.1 renders', () => {});" },
    { pattern: 'xit(', line: "xit('AC-2.1 rounds', () => {});" },
    { pattern: 'xdescribe(', line: "xdescribe('AC-2', () => {});" },
    { pattern: '@ts-ignore', line: '// @ts-ignore' },
    { pattern: '@ts-expect-error', line: '// @ts-expect-error' },
    { pattern: '@ts-nocheck', line: '// @ts-nocheck' },
    { pattern: 'eslint-disable', line: '// eslint-disable-next-line @typescript-eslint/no-explicit-any' },
    { pattern: 'eslint-disable', line: '/* eslint-disable */' },
  ])('AC-L4 fails on $pattern in $line', ({ pattern, line }) => {
    const fs = memoryFs({ ...clean, 'src/components/Star/Star.test.tsx': `import x from 'y';\n${line}\n` });
    expect(findForbiddenPatterns(fs)).toEqual([{ file: 'src/components/Star/Star.test.tsx', line: 2, pattern }]);
    const gate = checkForbiddenPatterns(fs);
    expect(gate.passed).toBe(false);
    expect(gate.detail).toContain(`src/components/Star/Star.test.tsx:2 ${pattern}`);
  });

  it('AC-L4 also scans the contract specs', () => {
    const fs = memoryFs({ ...clean, 'review/contract/widget.spec.ts': "test.skip('AC-1.1 renders', async () => {});" });
    expect(checkForbiddenPatterns(fs).passed).toBe(false);
  });

  it('AC-L4 ignores review/src, where the patterns themselves are defined', () => {
    const fs = memoryFs({ ...clean, 'review/src/gates.ts': "const label = '.skip(';" });
    expect(checkForbiddenPatterns(fs).passed).toBe(true);
  });

  it('AC-L4 ignores non-source files such as images and CSS', () => {
    const fs = memoryFs({ ...clean, 'src/notes.md': 'never use .only( here', 'src/a.css': '/* @ts-ignore */' });
    expect(checkForbiddenPatterns(fs).passed).toBe(true);
  });
});
