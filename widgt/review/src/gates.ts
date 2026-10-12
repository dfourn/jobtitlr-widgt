import { createHash } from 'node:crypto';
import type { ReadonlyFs } from './io/fs';
import type { CommandRunner } from './io/runner';
import type { GateId, GateResult } from './types';

/** What the contract lock (G4) covers. Paths are relative to the widgt root. */
export interface LockScope {
  /** Directories hashed recursively. */
  readonly dirs: readonly string[];
  /** Single files hashed when present. */
  readonly files: readonly string[];
}

/**
 * Spec 03 G4 scope: everything that decides what the review measures.
 * - `review/contract`, `review/reference` and `review/rubric.json`: the tests,
 *   the target image and the weights.
 * - `review/playwright.config.ts`: its `grep` or `testIgnore` could skip
 *   contract tests without touching a spec file.
 * - `review/src`: the gates and signals themselves, snapshots included.
 * - The ESLint, TypeScript and Vite configs: G1, G2 and the unit tests run
 *   under them, so loosening one would hide failures.
 * - `package.json` and `package-lock.json`: they define the scripts the gates
 *   run and the tool versions.
 * There are no globs, so each file is listed.
 */
export const DEFAULT_LOCK_SCOPE: LockScope = {
  dirs: ['review/contract', 'review/reference', 'review/src'],
  files: [
    'review/rubric.json',
    'review/playwright.config.ts',
    'review/tsconfig.json',
    'eslint.config.js',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'vite.config.ts',
    'package.json',
    'package-lock.json',
  ],
};

export const DEFAULT_LOCK_FILE = 'review/contract.lock';

/**
 * File names operating systems drop into folders on their own (macOS Finder, Windows Explorer).
 * They are never tracked, so hashing them would fail G4 on one machine and not another. Exactly
 * these names are skipped; any other file in a locked folder, dotfiles included, is locked.
 */
export const OS_JUNK_FILES: readonly string[] = ['.DS_Store', 'Thumbs.db'];

const isOsJunk = (path: string): boolean => OS_JUNK_FILES.includes(path.slice(path.lastIndexOf('/') + 1));

/** A lock: POSIX path -> sha256 hex digest, with keys sorted. */
export type ContractLock = Readonly<Record<string, string>>;

/** Hashes every file in `scope` but OS junk ({@link OS_JUNK_FILES}), sorted by path. Pure apart from reading `fs`. */
export function computeLock(fs: ReadonlyFs, scope: LockScope = DEFAULT_LOCK_SCOPE): ContractLock {
  const paths = new Set<string>(scope.dirs.flatMap((dir) => fs.listFiles(dir)).filter((path) => !isOsJunk(path)));
  for (const file of scope.files) {
    if (fs.exists(file)) paths.add(file);
  }
  const lock: Record<string, string> = {};
  for (const path of [...paths].sort()) {
    lock[path] = createHash('sha256').update(fs.readBytes(path)).digest('hex');
  }
  return lock;
}

/** Serialises a lock as stable, diff-friendly JSON. */
export function serialiseLock(lock: ContractLock): string {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/**
 * G4: the files under the lock still hash to what `review/contract.lock`
 * records (AC-L3). Only a human re-writes the lock, with `npm run review:lock`.
 */
export function checkContractLock(
  fs: ReadonlyFs,
  lockFile: string = DEFAULT_LOCK_FILE,
  scope: LockScope = DEFAULT_LOCK_SCOPE,
): GateResult {
  const gate = (passed: boolean, detail: string): GateResult => ({ id: 'G4', name: 'Contract lock', passed, detail });
  if (!fs.exists(lockFile)) {
    return gate(false, `${lockFile} is missing; a human must run npm run review:lock`);
  }
  const expected = parseLock(fs.readText(lockFile));
  if (expected === null) {
    return gate(false, `${lockFile} is not valid lock JSON (path -> sha256)`);
  }
  const diff = diffLocks(expected, computeLock(fs, scope));
  const parts = [
    diff.changed.length > 0 ? `changed: ${diff.changed.join(', ')}` : '',
    diff.added.length > 0 ? `added: ${diff.added.join(', ')}` : '',
    diff.removed.length > 0 ? `removed: ${diff.removed.join(', ')}` : '',
  ].filter((part) => part !== '');
  return parts.length === 0
    ? gate(true, `${String(Object.keys(expected).length)} locked files unchanged`)
    : gate(false, `locked files differ from ${lockFile}; ${parts.join('; ')}`);
}

/** Parses lock JSON, returning `null` unless it is an object of string hashes. */
export function parseLock(text: string): ContractLock | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries: [string, unknown][] = Object.entries(value);
  const lock: Record<string, string> = {};
  for (const [path, hash] of entries) {
    if (typeof hash !== 'string') return null;
    lock[path] = hash;
  }
  return lock;
}

interface LockDiff {
  readonly changed: readonly string[];
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

function diffLocks(expected: ContractLock, actual: ContractLock): LockDiff {
  const expectedPaths = Object.keys(expected);
  const actualPaths = Object.keys(actual);
  return {
    changed: expectedPaths.filter((path) => path in actual && actual[path] !== expected[path]),
    added: actualPaths.filter((path) => !(path in expected)),
    removed: expectedPaths.filter((path) => !(path in actual)),
  };
}

/**
 * Files in the lock scope that changed, appeared or disappeared since `before`, a lock computed
 * at the start of the same review (AC-L3). The comparison is in memory, not with
 * `review/contract.lock`, because a unit test could rewrite the lock along with the files.
 */
export function lockChangesSince(fs: ReadonlyFs, before: ContractLock, scope: LockScope = DEFAULT_LOCK_SCOPE): string[] {
  const diff = diffLocks(before, computeLock(fs, scope));
  return [...diff.changed, ...diff.added, ...diff.removed].sort();
}

/** G4 with the files that changed during the review: the gate fails when there are any. */
export function withChangesDuringReview(gate: GateResult, changed: readonly string[]): GateResult {
  if (changed.length === 0) return gate;
  const note = `locked files changed during the review: ${changed.join(', ')}`;
  return { ...gate, passed: false, detail: gate.passed ? note : `${gate.detail}; ${note}` };
}

/** A forbidden pattern for G5. */
export interface ForbiddenPattern {
  readonly label: string;
  readonly regex: RegExp;
}

/**
 * G5 patterns: anything that hides a failing check. `xdescribe(` and
 * `@ts-nocheck` go beyond the spec's list for the same reason.
 */
export const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  { label: '.skip(', regex: /\.skip\s*\(/ },
  { label: '.only(', regex: /\.only\s*\(/ },
  { label: 'xit(', regex: /\bxit\s*\(/ },
  { label: 'xdescribe(', regex: /\bxdescribe\s*\(/ },
  { label: '@ts-ignore', regex: /@ts-ignore/ },
  { label: '@ts-expect-error', regex: /@ts-expect-error/ },
  { label: '@ts-nocheck', regex: /@ts-nocheck/ },
  { label: 'eslint-disable', regex: /eslint-disable/ },
];

/**
 * Where G5 looks. `review/src/` is deliberately not scanned: it is where the
 * patterns above are defined and tested, so it would always match itself.
 * It is safe to leave out because the generator may not edit `review/**`.
 */
export const DEFAULT_SCAN_DIRS: readonly string[] = ['src', 'review/contract'];

const SCANNED_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/;

export interface PatternViolation {
  readonly file: string;
  readonly line: number;
  readonly pattern: string;
}

/** Lists every forbidden pattern in source files under `dirs`. */
export function findForbiddenPatterns(
  fs: ReadonlyFs,
  dirs: readonly string[] = DEFAULT_SCAN_DIRS,
  patterns: readonly ForbiddenPattern[] = FORBIDDEN_PATTERNS,
): PatternViolation[] {
  const violations: PatternViolation[] = [];
  const files = dirs.flatMap((dir) => fs.listFiles(dir)).filter((file) => SCANNED_EXTENSIONS.test(file));
  for (const file of files) {
    fs.readText(file)
      .split(/\r?\n/)
      .forEach((text, index) => {
        for (const pattern of patterns) {
          if (pattern.regex.test(text)) violations.push({ file, line: index + 1, pattern: pattern.label });
        }
      });
  }
  return violations;
}

/** G5: no forbidden pattern in `src/` or `review/contract/` (AC-L4). */
export function checkForbiddenPatterns(fs: ReadonlyFs, dirs: readonly string[] = DEFAULT_SCAN_DIRS): GateResult {
  const violations = findForbiddenPatterns(fs, dirs);
  const shown = violations.slice(0, 5).map((v) => `${v.file}:${String(v.line)} ${v.pattern}`);
  const more = violations.length > shown.length ? `, and ${String(violations.length - shown.length)} more` : '';
  return {
    id: 'G5',
    name: 'Forbidden patterns',
    passed: violations.length === 0,
    detail: violations.length === 0 ? `none in ${dirs.join(', ')}` : `found ${shown.join(', ')}${more}`,
  };
}

/**
 * G6: the number of unit and component tests in `src/` has not gone down
 * since the previous run, so deleting tests cannot make the suite pass.
 * `current` is `null` when the test results could not be read.
 */
export function checkTestCount(current: number | null, previous: number | null): GateResult {
  const gate = (passed: boolean, detail: string): GateResult => ({ id: 'G6', name: 'Test count', passed, detail });
  if (current === null) return gate(false, 'unit test results are missing');
  if (previous === null) return gate(true, `${String(current)} tests (no previous run)`);
  if (current < previous) {
    return gate(false, `${String(current)} tests, down from ${String(previous)} (-${String(previous - current)})`);
  }
  return gate(true, `${String(current)} tests (was ${String(previous)})`);
}

/** A gate that passes when a command exits with 0. */
export interface CommandGate {
  readonly id: GateId;
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
}

/** G1-G3 of spec 03. */
export const COMMAND_GATES: readonly CommandGate[] = [
  { id: 'G1', name: 'TypeScript', command: 'npm', args: ['run', 'typecheck'] },
  { id: 'G2', name: 'ESLint', command: 'npm', args: ['run', 'lint'] },
  { id: 'G3', name: 'Build', command: 'npm', args: ['run', 'build'] },
];

/** A gate result plus a few lines of the command's output, for the report. */
export interface CommandGateResult extends GateResult {
  readonly excerpt: readonly string[];
}

/** Runs G1-G3 one after the other. Each gate runs even if an earlier one failed. */
export async function runCommandGates(
  runner: CommandRunner,
  gates: readonly CommandGate[] = COMMAND_GATES,
): Promise<CommandGateResult[]> {
  const results: CommandGateResult[] = [];
  for (const gate of gates) {
    const commandLine = [gate.command, ...gate.args].join(' ');
    const run = await runner.run(gate.command, gate.args);
    const passed = run.code === 0;
    results.push({
      id: gate.id,
      name: gate.name,
      passed,
      detail: passed ? `${commandLine} passed` : `${commandLine} exited with ${String(run.code)}`,
      excerpt: passed ? [] : errorExcerpt(`${run.stdout}\n${run.stderr}`),
    });
  }
  return results;
}

/**
 * The few lines of a command's output worth showing: lines that mention an
 * error, else the last lines. ANSI colours are stripped and lines truncated,
 * because spec 03 §5 forbids feeding whole logs back to the generator.
 */
export function errorExcerpt(output: string, maxLines = 5): string[] {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const errors = lines.filter((line) => /\berror\b|\bfailed\b/i.test(line));
  const chosen = errors.length > 0 ? errors.slice(0, maxLines) : lines.slice(-maxLines);
  return chosen.map((line) => (line.length > 200 ? `${line.slice(0, 199)}…` : line));
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

/** Removes ANSI colour codes. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}
