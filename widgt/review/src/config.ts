import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCK_FILE } from './gates';

/** The widgt root (two levels up from review/src). */
export const WIDGT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every path the harness reads or writes, relative to the widgt root (POSIX).
 * The defaults match the contract test agreement; each can be overridden from
 * the command line (see review.ts).
 */
export interface ReviewPaths {
  readonly runsDir: string;
  readonly latestDir: string;
  /** Written by the Playwright contract tests (JSON reporter). */
  readonly contractResults: string;
  /** Written by `vitest run --reporter=json`. */
  readonly vitestResults: string;
  /** Optional; written by the contract tests when they record axe counts. */
  readonly axeResults: string;
  readonly screenshotsDir: string;
  /** The `?visual=1` screenshot at 401px, compared with the reference. */
  readonly visualScreenshot: string;
  readonly reference: string;
  readonly diff: string;
  readonly lockFile: string;
  readonly rubric: string;
  /** Spec 02, for AC coverage and the generator prompt. */
  readonly spec: string;
}

/** The screenshots the contract tests take, by file name. */
export const SCREENSHOT_NAMES = ['visual-401', 'viewport-320', 'viewport-768', 'viewport-1280'] as const;

/** Default paths of spec 03 §4. */
export function defaultPaths(latestDir = 'review/runs/latest'): ReviewPaths {
  return {
    runsDir: 'review/runs',
    latestDir,
    contractResults: `${latestDir}/contract-results.json`,
    vitestResults: `${latestDir}/vitest-results.json`,
    axeResults: `${latestDir}/axe.json`,
    screenshotsDir: `${latestDir}/screenshots`,
    visualScreenshot: `${latestDir}/screenshots/visual-401.png`,
    reference: 'review/reference/widget-reference.png',
    diff: `${latestDir}/diff.png`,
    lockFile: DEFAULT_LOCK_FILE,
    rubric: 'review/rubric.json',
    spec: '../docs/specs/02-widgt.md',
  };
}

/** Resolves a root-relative POSIX path to an absolute OS path. */
export function abs(root: string, path: string): string {
  return join(root, ...path.split('/'));
}
