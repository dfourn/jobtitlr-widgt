// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  checkContractLock,
  checkForbiddenPatterns,
  checkTestCount,
  computeLock,
  errorExcerpt,
  findForbiddenPatterns,
  runCommandGates,
  serialiseLock,
} from './gates';
import type { CommandRunner, RunResult } from './io/runner';
import { memoryFs } from './io/fs';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Files locked since Phase 0: the harness source, the configs and the package files. */
const CONFIG_AND_HARNESS = {
  'eslint.config.js': 'export default [];',
  'package-lock.json': '{"lockfileVersion":3}',
  'package.json': '{"name":"widgt"}',
  'review/src/__snapshots__/report.md': '# Report',
  'review/src/score.ts': 'export const total = 0;',
  'review/tsconfig.json': '{"include":["src"]}',
  'tsconfig.app.json': '{"include":["src"]}',
  'tsconfig.json': '{"files":[]}',
  'tsconfig.node.json': '{"include":["vite.config.ts"]}',
  'vite.config.ts': 'export default {};',
};

const tree = {
  'review/contract/widget.spec.ts': "test('AC-1.1 renders', () => {});",
  'review/contract/helpers/viewports.ts': 'export const widths = [320, 768, 1280];',
  'review/reference/widget-reference.png': new Uint8Array([137, 80, 78, 71]),
  'review/rubric.json': '{"criteria":[]}',
  'review/playwright.config.ts': 'export default {};',
  ...CONFIG_AND_HARNESS,
  'src/App.tsx': 'not locked',
  'src/main.tsx': 'not locked',
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
  it('AC-L3 hashes the contract, reference, rubric, configs, package files and harness source, sorted by path', () => {
    const lock = computeLock(memoryFs(tree));
    expect(Object.keys(lock)).toEqual([
      'eslint.config.js',
      'package-lock.json',
      'package.json',
      'review/contract/helpers/viewports.ts',
      'review/contract/widget.spec.ts',
      'review/playwright.config.ts',
      'review/reference/widget-reference.png',
      'review/rubric.json',
      'review/src/__snapshots__/report.md',
      'review/src/score.ts',
      'review/tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.json',
      'tsconfig.node.json',
      'vite.config.ts',
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
    const gate = checkContractLock(memoryFs(lockedTree({ 'src/App.tsx': 'changed', 'src/main.tsx': 'changed' })));
    expect(gate.passed).toBe(true);
  });

  it.each(Object.keys(CONFIG_AND_HARNESS))('AC-L3 fails when %s is changed', (path) => {
    const gate = checkContractLock(memoryFs(lockedTree({ [path]: 'changed' })));
    expect(gate.passed).toBe(false);
    expect(gate.detail).toContain(`changed: ${path}`);
  });

  it('AC-L3 fails when a harness source file is added', () => {
    const gate = checkContractLock(memoryFs(lockedTree({ 'review/src/signals/extra.ts': 'export {};' })));
    expect(gate.passed).toBe(false);
    expect(gate.detail).toContain('added: review/src/signals/extra.ts');
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

describe('AC-L4 test count never goes down (G6)', () => {
  it.each([
    { current: 12, previous: 10, passed: true, detail: '12 tests (was 10)' },
    { current: 10, previous: 10, passed: true, detail: '10 tests (was 10)' },
    { current: 9, previous: 10, passed: false, detail: '9 tests, down from 10 (-1)' },
    { current: 0, previous: 3, passed: false, detail: '0 tests, down from 3 (-3)' },
    { current: 4, previous: null, passed: true, detail: '4 tests (no previous run)' },
    { current: null, previous: 4, passed: false, detail: 'unit test results are missing' },
    { current: null, previous: null, passed: false, detail: 'unit test results are missing' },
  ])('AC-L4 current=$current previous=$previous -> passed=$passed', ({ current, previous, passed, detail }) => {
    expect(checkTestCount(current, previous)).toEqual({ id: 'G6', name: 'Test count', passed, detail });
  });
});

describe('AC-L1 command gates (G1-G3)', () => {
  function fakeRunner(results: Record<string, RunResult>): CommandRunner & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      run: (command, args) => {
        const key = [command, ...args].join(' ');
        calls.push(key);
        return Promise.resolve(results[key] ?? { code: 0, stdout: '', stderr: '' });
      },
    };
  }

  it('AC-L1 runs typecheck, lint and build and passes on exit code 0', async () => {
    const runner = fakeRunner({});
    const gates = await runCommandGates(runner);
    expect(runner.calls).toEqual(['npm run typecheck', 'npm run lint', 'npm run build']);
    expect(gates.map((g) => [g.id, g.passed])).toEqual([
      ['G1', true],
      ['G2', true],
      ['G3', true],
    ]);
  });

  it('AC-L1 fails a gate on a non-zero exit, keeps running the others and keeps an excerpt', async () => {
    const runner = fakeRunner({
      'npm run lint': { code: 1, stdout: '\n/src/App.tsx\n  3:7  error  x is unused  no-unused-vars\n\n1 problem\n', stderr: '' },
    });
    const gates = await runCommandGates(runner);
    expect(runner.calls).toHaveLength(3);
    const lint = gates[1];
    expect(lint).toMatchObject({ id: 'G2', passed: false, detail: 'npm run lint exited with 1' });
    expect(lint?.excerpt).toEqual(['3:7  error  x is unused  no-unused-vars']);
  });
});

describe('AC-L1 errorExcerpt()', () => {
  const esc = String.fromCharCode(27);

  it('AC-L1 keeps only lines that mention errors, without colours', () => {
    const output = `> tsc\n${esc}[31msrc/a.ts(1,7): error TS2322: Type 'string' is not assignable${esc}[0m\nok line\n`;
    expect(errorExcerpt(output)).toEqual(["src/a.ts(1,7): error TS2322: Type 'string' is not assignable"]);
  });

  it('AC-L1 falls back to the last non-empty lines when nothing mentions an error', () => {
    expect(errorExcerpt('a\nb\n\nc\nd\n', 2)).toEqual(['c', 'd']);
  });

  it('AC-L1 caps the number of lines and truncates long lines to 200 characters', () => {
    const output = Array.from({ length: 9 }, (_, i) => `error ${String(i)} ${'x'.repeat(300)}`).join('\n');
    const excerpt = errorExcerpt(output, 3);
    expect(excerpt).toHaveLength(3);
    expect(excerpt.every((line) => line.length <= 200)).toBe(true);
  });
});
