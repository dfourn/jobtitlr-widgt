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
  void fs;
  void scope;
  void createHash;
  throw new Error('not implemented');
}

/** Serialises a lock as stable, diff-friendly JSON. */
export function serialiseLock(lock: ContractLock): string {
  void lock;
  throw new Error('not implemented');
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
  void fs;
  void lockFile;
  void scope;
  throw new Error('not implemented');
}
