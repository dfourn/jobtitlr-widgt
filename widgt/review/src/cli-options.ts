import { defaultPaths, type ReviewPaths } from './config';
import type { JudgeKind } from './judge/judge';

/** Parses `--judge`. */
export function parseJudgeKind(value: string | undefined): JudgeKind {
  if (value === undefined || value === 'none' || value === 'claude' || value === 'glm') return value ?? 'none';
  throw new Error(`--judge must be none, claude or glm, not "${value}"`);
}

/** Applies path overrides from the command line. */
export function pathsFrom(values: Readonly<Record<string, string | boolean | undefined>>): ReviewPaths {
  const base = defaultPaths();
  const pick = (key: string, fallback: string): string => {
    const value = values[key];
    return typeof value === 'string' ? value : fallback;
  };
  return {
    ...base,
    contractResults: pick('contract-results', base.contractResults),
    axeDir: pick('axe', base.axeDir),
    visualScreenshot: pick('screenshot', base.visualScreenshot),
    reference: pick('reference', base.reference),
    spec: pick('spec', base.spec),
  };
}

/** Options shared by review and loop for the paths. */
export const PATH_OPTIONS = {
  'contract-results': { type: 'string' },
  axe: { type: 'string' },
  screenshot: { type: 'string' },
  reference: { type: 'string' },
  spec: { type: 'string' },
} as const;
