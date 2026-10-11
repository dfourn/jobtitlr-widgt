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
