/** A file the workspace guard refuses, and why (AC-L12). */
export interface ForbiddenFile {
  readonly name: string;
  readonly why: string;
}

/** Stub: implemented in the next commit. */
export function forbiddenFilesIn(exists: (name: string) => boolean): ForbiddenFile[] {
  void exists;
  return [];
}

/** Stub: implemented in the next commit. */
export function installEnv(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined) out[key] = value;
  return out;
}

export interface GuardOptions {
  readonly exists: (name: string) => boolean;
  readonly install: () => number;
  readonly print: (line: string) => void;
}

/** Stub: implemented in the next commit. */
export function runGuard(options: GuardOptions): number {
  void options;
  return 0;
}
