import type { ReadonlyFs } from '../io/fs';

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

const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/**
 * AC IDs cited by test titles in a test file. Test names start with their AC
 * ID (spec 02 §6), so every string literal that starts with `AC-x.y` counts,
 * and every ID inside it (`'AC-4.2 AC-4.3 toggles'` cites both). Comments are
 * stripped first so a commented-out test does not count.
 */
export function citedAcIds(source: string): Set<string> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const ids = new Set<string>();
  for (const literal of withoutComments.match(STRING_LITERAL) ?? []) {
    const body = literal.slice(1, -1);
    if (!/^\s*AC-\d+\.\d+/.test(body)) continue;
    for (const id of body.match(/AC-\d+\.\d+/g) ?? []) ids.add(id);
  }
  return ids;
}

export interface AcCoverage {
  /** 0-100, or `null` when the spec could not be read. */
  readonly value: number | null;
  readonly required: readonly string[];
  readonly cited: readonly string[];
  readonly detail: string;
}

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Share of spec 02's AC-1..7 sub-IDs cited by at least one test under `testDirs`. */
export function acCoverage(fs: ReadonlyFs, specPath: string, testDirs: readonly string[] = ['src']): AcCoverage {
  if (!fs.exists(specPath)) {
    return { value: null, required: [], cited: [], detail: `spec not found: ${specPath}` };
  }
  const required = parseSpecAcIds(fs.readText(specPath));
  const found = new Set<string>();
  for (const file of testDirs.flatMap((dir) => fs.listFiles(dir)).filter((f) => TEST_FILE.test(f))) {
    for (const id of citedAcIds(fs.readText(file))) found.add(id);
  }
  const cited = required.filter((id) => found.has(id));
  if (required.length === 0) {
    return { value: null, required, cited, detail: `no AC IDs found in ${specPath}` };
  }
  return {
    value: (cited.length / required.length) * 100,
    required,
    cited,
    detail: `AC coverage ${String(Math.round((cited.length / required.length) * 100))}% (${String(cited.length)}/${String(required.length)})`,
  };
}
