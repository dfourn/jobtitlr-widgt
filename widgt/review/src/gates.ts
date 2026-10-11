import { createHash } from 'node:crypto';
import type { ReadonlyFs } from './io/fs';
import type { GateResult } from './types';

/** What the contract lock (G4) covers. Paths are relative to the widgt root. */
export interface LockScope {
  /** Directories hashed recursively. */
  readonly dirs: readonly string[];
  /** Single files hashed when present. */
  readonly files: readonly string[];
}

/**
 * Spec 03 G4 scope. `review/playwright.config.ts` is added to the spec's list
 * because it decides which contract tests run: editing its `grep` or
 * `testIgnore` would skip tests without touching a spec file.
 */
export const DEFAULT_LOCK_SCOPE: LockScope = {
  dirs: ['review/contract', 'review/reference'],
  files: ['review/rubric.json', 'review/playwright.config.ts'],
};

export const DEFAULT_LOCK_FILE = 'review/contract.lock';

/** A lock: POSIX path -> sha256 hex digest, with keys sorted. */
export type ContractLock = Readonly<Record<string, string>>;

/** Hashes every file in `scope` (sorted by path). Pure apart from reading `fs`. */
export function computeLock(fs: ReadonlyFs, scope: LockScope = DEFAULT_LOCK_SCOPE): ContractLock {
  const paths = new Set<string>(scope.dirs.flatMap((dir) => fs.listFiles(dir)));
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
