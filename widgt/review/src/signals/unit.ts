import { relative, sep } from 'node:path';
import { arrayOf, field, stringOf } from '../json';
import type { Failure } from '../types';
import { acIdOfTitlePath } from './ac';
import { firstLines } from './contract';

export interface UnitTest {
  readonly file: string;
  readonly titlePath: readonly string[];
  readonly passed: boolean;
  readonly message: string;
}

export interface UnitResults {
  readonly tests: readonly UnitTest[];
  /** Test files that failed before any test ran (syntax error, failed import). */
  readonly fileErrors: readonly { readonly file: string; readonly message: string }[];
}

/**
 * Reads Vitest's JSON reporter output, keeping only test files under
 * `<root>/<dir>/` (default `src/`). The harness's own tests in `review/src/`
 * run in the same Vitest process but are not the generator's tests.
 */
export function parseVitestReport(json: unknown, root: string, dir = 'src'): UnitResults {
  const tests: UnitTest[] = [];
  const fileErrors: { file: string; message: string }[] = [];
  for (const fileResult of arrayOf(field(json, 'testResults'))) {
    const name = stringOf(field(fileResult, 'name'));
    if (name === null) continue;
    const file = relative(root, name).split(sep).join('/');
    if (!file.startsWith(`${dir}/`)) continue;
    const assertions = arrayOf(field(fileResult, 'assertionResults'));
    for (const assertion of assertions) {
      const ancestors = arrayOf(field(assertion, 'ancestorTitles')).map((t) => stringOf(t) ?? '');
      const title = stringOf(field(assertion, 'title')) ?? '(untitled)';
      const status = stringOf(field(assertion, 'status'));
      const messages = arrayOf(field(assertion, 'failureMessages')).map((m) => stringOf(m) ?? '');
      tests.push({
        file,
        titlePath: [...ancestors, title],
        passed: status === 'passed',
        message: status === 'passed' ? '' : firstLines(messages[0] ?? `status ${status ?? 'unknown'}`, 3),
      });
    }
    const fileStatus = stringOf(field(fileResult, 'status'));
    if (assertions.length === 0 && fileStatus === 'failed') {
      fileErrors.push({ file, message: firstLines(stringOf(field(fileResult, 'message')) ?? 'failed to run', 3) });
    }
  }
  return { tests, fileErrors };
}

export interface UnitPassRate {
  /** 0-100, or `null` when the results are missing. */
  readonly value: number | null;
  /** The number of tests in `src/`, for G6. */
  readonly testCount: number | null;
  readonly detail: string;
  readonly failures: readonly Failure[];
}

/**
 * Pass rate of the generator's tests. A test file that failed to load counts
 * as one failed test, otherwise breaking a file would hide its failures.
 * No tests at all scores 0: no evidence earns no credit.
 */
export function unitPassRate(results: UnitResults | null): UnitPassRate {
  if (results === null) return { value: null, testCount: null, detail: 'unit test results not found', failures: [] };
  const passed = results.tests.filter((t) => t.passed).length;
  const total = results.tests.length + results.fileErrors.length;
  const failures: Failure[] = [
    ...results.tests
      .filter((t) => !t.passed)
      .map((t) => ({ source: 'unit' as const, acId: acIdOfTitlePath(t.titlePath), title: t.titlePath.join(' › '), file: t.file, message: t.message })),
    ...results.fileErrors.map((e) => ({ source: 'unit' as const, acId: null, title: 'test file failed to run', file: e.file, message: e.message })),
  ];
  const broken = results.fileErrors.length > 0 ? `, ${String(results.fileErrors.length)} file(s) failed to run` : '';
  return {
    value: total === 0 ? 0 : (passed / total) * 100,
    testCount: results.tests.length,
    detail: `${String(passed)}/${String(results.tests.length)} unit tests passed${broken}`,
    failures,
  };
}
