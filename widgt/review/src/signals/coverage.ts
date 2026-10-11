import type { ReadonlyFs } from '../io/fs';
import type { UnitResults } from './unit';

/**
 * The AC sub-IDs of spec 02 (`**AC-4.3**`), limited to the given groups
 * (default AC-1 to AC-7; AC-8 is delivery, which unit tests cannot cite).
 * Sorted numerically and de-duplicated.
 */
export function parseSpecAcIds(spec: string, groups: readonly number[] = [1, 2, 3, 4, 5, 6, 7]): string[] {
  const ids = new Set<string>();
  for (const match of spec.matchAll(/\*\*AC-(\d+)\.(\d+)\*\*/g)) {
    if (groups.includes(Number(match[1]))) ids.add(`AC-${match[1] ?? ''}.${match[2] ?? ''}`);
  }
  return [...ids].sort((a, b) => {
    const [a1 = 0, a2 = 0] = a.slice(3).split('.').map(Number);
    const [b1 = 0, b2 = 0] = b.slice(3).split('.').map(Number);
    return a1 - b1 || a2 - b2;
  });
}

/** Spec 02 groups whose criteria unit and component tests can check (AC-L11). */
export const UNIT_TESTABLE_GROUPS = [1, 2, 3, 4] as const;

/**
 * IDs in those groups that jsdom cannot check, so a unit test citing them
 * would only be citing them for coverage. The contract tests check them.
 */
export const UNIT_EXCLUDED_AC_IDS: Readonly<Record<string, string>> = {
  'AC-3.6': 'axe at WCAG 2.2 AA needs a real browser rendering',
  'AC-3.7': 'focus visibility and its contrast need computed styles',
  'AC-4.7': 'visual distinctness needs computed CSS, which jsdom lacks with CSS Modules',
};

/** The spec 02 IDs unit and component tests can check: groups 1-4 minus the exclusions (AC-L11). */
export function unitTestableAcIds(spec: string): string[] {
  return parseSpecAcIds(spec, UNIT_TESTABLE_GROUPS).filter((id) => !(id in UNIT_EXCLUDED_AC_IDS));
}

/**
 * AC IDs cited by one test or describe title. Test names start with their AC
 * ID (spec 02 §6), so a title that starts with `AC-x.y` cites every ID in it
 * (`'AC-4.2 AC-4.3 toggles'` cites both); a title that only mentions an ID
 * later (`'renders (see AC-1.1)'`) cites none.
 */
export function titleAcIds(title: string): string[] {
  if (!/^\s*AC-\d+\.\d+/.test(title)) return [];
  return title.match(/AC-\d+\.\d+/g) ?? [];
}

export interface AcCoverage {
  /** 0-100, or `null` when the spec or the unit results could not be read. */
  readonly value: number | null;
  readonly required: readonly string[];
  readonly cited: readonly string[];
  readonly detail: string;
}

/**
 * Share of spec 02's unit-testable IDs cited by at least one **passing** unit
 * test (AC-L11). Citations come from the Vitest results, not the source, so a
 * failing test earns nothing. A test cites the IDs of its own title and of its
 * describe titles.
 */
export function acCoverage(fs: ReadonlyFs, specPath: string, results: UnitResults | null): AcCoverage {
  if (!fs.exists(specPath)) {
    return { value: null, required: [], cited: [], detail: `spec not found: ${specPath}` };
  }
  const required = unitTestableAcIds(fs.readText(specPath));
  if (required.length === 0) {
    return { value: null, required, cited: [], detail: `no AC IDs found in ${specPath}` };
  }
  if (results === null) {
    return { value: null, required, cited: [], detail: 'AC coverage unknown: unit test results not found' };
  }
  const found = new Set(results.tests.filter((t) => t.passed).flatMap((t) => t.titlePath.flatMap(titleAcIds)));
  const cited = required.filter((id) => found.has(id));
  const share = (cited.length / required.length) * 100;
  return {
    value: share,
    required,
    cited,
    detail: `AC coverage ${String(Math.round(share))}% (${String(cited.length)}/${String(required.length)})`,
  };
}
