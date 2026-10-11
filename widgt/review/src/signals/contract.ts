import { isAbsolute, posix, relative, sep } from 'node:path';
import { stripAnsi } from '../gates';
import { arrayOf, field, numberOf, stringOf } from '../json';
import type { Failure } from '../types';
import { acIdOfTitlePath } from './ac';

/** One contract test run in one Playwright project. */
export interface ContractCase {
  /** Describe titles followed by the test title (no file or project). */
  readonly titlePath: readonly string[];
  readonly file: string | null;
  readonly line: number | null;
  readonly passed: boolean;
  readonly message: string;
}

export interface ContractResults {
  readonly cases: readonly ContractCase[];
  /** Top-level errors, for example a test file that failed to load or a web server that did not start. */
  readonly errors: readonly string[];
}

/**
 * Reads Playwright's JSON reporter output. Unknown shapes produce an empty
 * result rather than throwing. `root` is the widgt root, used to make file
 * paths relative to it.
 */
export function parsePlaywrightReport(json: unknown, root: string | null = null): ContractResults {
  const rootDir = stringOf(field(field(json, 'config'), 'rootDir'));
  const cases: ContractCase[] = [];
  const visit = (suite: unknown, titles: readonly string[]): void => {
    const title = stringOf(field(suite, 'title')) ?? '';
    // A file-level suite's title is the file name; it is not a describe title.
    const isFileSuite = stringOf(field(suite, 'file')) === title && titles.length === 0;
    const path = isFileSuite || title === '' ? titles : [...titles, title];
    for (const spec of arrayOf(field(suite, 'specs'))) {
      const specTitle = stringOf(field(spec, 'title')) ?? '(untitled)';
      const file = stringOf(field(spec, 'file'));
      for (const test of arrayOf(field(spec, 'tests'))) {
        const status = stringOf(field(test, 'status'));
        const results = arrayOf(field(test, 'results'));
        const last = results.at(-1);
        cases.push({
          titlePath: [...path, specTitle],
          file: file === null ? null : displayPath(file, rootDir, root),
          line: numberOf(field(spec, 'line')),
          passed: status === 'expected' || status === 'flaky',
          message: status === 'expected' || status === 'flaky' ? '' : resultMessage(last, status),
        });
      }
    }
    for (const child of arrayOf(field(suite, 'suites'))) visit(child, path);
  };
  for (const suite of arrayOf(field(json, 'suites'))) visit(suite, []);
  const errors = arrayOf(field(json, 'errors'))
    .map((error) => stringOf(field(error, 'message')))
    .filter((message): message is string => message !== null)
    .map((message) => firstLines(message, 2));
  return { cases, errors };
}

function resultMessage(result: unknown, status: string | null): string {
  const direct = stringOf(field(field(result, 'error'), 'message'));
  const listed = arrayOf(field(result, 'errors'))
    .map((error) => stringOf(field(error, 'message')))
    .find((message) => message !== null);
  const message = direct ?? listed ?? null;
  if (message !== null) return firstLines(message, 3);
  return status === 'skipped' ? 'skipped' : `status ${status ?? 'unknown'}`;
}

/** Strips colours and keeps the first `count` non-empty lines, joined. */
export function firstLines(text: string, count: number): string {
  return stripAnsi(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, count)
    .join(' ');
}

function displayPath(file: string, rootDir: string | null, root: string | null): string {
  if (rootDir === null || root === null) return file;
  const absolute = isAbsolute(file) ? file : `${rootDir}${sep}${file}`;
  return relative(root, absolute).split(sep).join(posix.sep);
}

/** Contract pass rate plus failures for feedback. */
export interface ContractSignal {
  readonly value: number | null;
  readonly passed: number;
  readonly total: number;
  readonly detail: string;
  readonly failures: readonly Failure[];
}

/** Turns contract results into the contract signal (passed / run x 100). */
export function contractSignal(results: ContractResults | null, source: string): ContractSignal {
  if (results === null) {
    return { value: null, passed: 0, total: 0, detail: `contract results not found: ${source}`, failures: [] };
  }
  const total = results.cases.length;
  const passed = results.cases.filter((c) => c.passed).length;
  const failures: Failure[] = [
    ...results.cases.filter((c) => !c.passed).map((c) => toFailure(c)),
    ...results.errors.map((message) => ({ source: 'contract' as const, acId: null, title: 'contract run error', file: null, message })),
  ];
  const errorNote = results.errors.length > 0 ? `; ${String(results.errors.length)} run error(s)` : '';
  if (total === 0) {
    return { value: 0, passed, total, detail: `no contract tests ran${errorNote}`, failures };
  }
  return {
    value: (passed / total) * 100,
    passed,
    total,
    detail: `${String(passed)}/${String(total)} contract tests passed${errorNote}`,
    failures,
  };
}

function toFailure(c: ContractCase): Failure {
  const location = c.file === null ? null : c.line === null ? c.file : `${c.file}:${String(c.line)}`;
  return {
    source: 'contract',
    acId: acIdOfTitlePath(c.titlePath),
    title: c.titlePath.join(' › '),
    file: location,
    message: c.message,
  };
}

/** Responsiveness: the pass rate of contract tests whose title starts with AC-5 (B2.3). */
export function responsiveSignal(results: ContractResults | null): { readonly value: number | null; readonly detail: string } {
  if (results === null) return { value: null, detail: 'contract results not found' };
  const cases = results.cases.filter((c) => /^AC-5(?:\.|\b)/.test(c.titlePath.at(-1) ?? ''));
  if (cases.length === 0) return { value: null, detail: 'no contract test title starts with AC-5' };
  const passed = cases.filter((c) => c.passed).length;
  return {
    value: (passed / cases.length) * 100,
    detail: `${String(passed)}/${String(cases.length)} AC-5 contract tests passed`,
  };
}
