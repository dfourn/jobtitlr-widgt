/**
 * The workspace guard (spec 03, AC-L12). Run it with plain Node, never through npm:
 *
 *   node review/src/guard.ts [--root <widgt dir>] [--check-only]
 *
 * npm reads a project `.npmrc` before it runs any script, and its `node-options` can load code
 * into every Node process it starts, the review harness included. Vitest and Vite would also
 * prefer a config file of their own over the locked `vite.config.ts`. So the guard refuses a
 * workspace that holds such a file (exit 1). Otherwise it reinstalls the dependencies from
 * `package-lock.json` (`npm ci`), so a patched `node_modules` (git-ignored, so `git status` does not
 * show it) cannot change the tools. The loop runs it before every review, and the external hand-off
 * runs it before resuming.
 *
 * Only `node:` built-ins are imported, so Node runs this file without tsx or a build step.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/** A file the workspace guard refuses, and why (AC-L12). */
export interface ForbiddenFile {
  readonly name: string;
  readonly why: string;
}

const SCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'];

const named = (names: readonly string[], why: string): ForbiddenFile[] => names.map((name) => ({ name, why }));

/**
 * Files at the widgt root that would change how the tools run without touching a locked file.
 * `eslint.config.js` and `vite.config.ts` are locked; ESLint prefers `.js` to any other extension,
 * so other ESLint config names are inert and not listed.
 */
export const FORBIDDEN_FILES: readonly ForbiddenFile[] = [
  ...named(['.npmrc'], 'npm reads it before every npm run, and its node-options can load code into the review'),
  ...named(
    SCRIPT_EXTENSIONS.flatMap((ext) => [`vitest.config.${ext}`, `vitest.workspace.${ext}`]).concat('vitest.workspace.json'),
    'Vitest would use it instead of the locked vite.config.ts',
  ),
  ...named(
    SCRIPT_EXTENSIONS.filter((ext) => ext !== 'ts').map((ext) => `vite.config.${ext}`),
    'Vite would use it instead of, or as well as, the locked vite.config.ts',
  ),
  ...named(
    [
      ...SCRIPT_EXTENSIONS.map((ext) => `postcss.config.${ext}`),
      '.postcssrc',
      ...['json', 'yaml', 'yml', ...SCRIPT_EXTENSIONS].map((ext) => `.postcssrc.${ext}`),
    ],
    'Vite loads it during the build and runs its code',
  ),
];

/** The forbidden files that exist, judged by `exists` (a name relative to the widgt root). */
export function forbiddenFilesIn(exists: (name: string) => boolean): ForbiddenFile[] {
  return FORBIDDEN_FILES.filter((file) => exists(file.name));
}

/**
 * The environment for `npm ci`: the current one without `NODE_OPTIONS` or any `npm_config_*`
 * setting (in any case), which a parent npm process may have set from a `.npmrc`.
 */
export function installEnv(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || key.toUpperCase() === 'NODE_OPTIONS' || /^npm_config_/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export interface GuardOptions {
  readonly exists: (name: string) => boolean;
  /** Reinstalls the dependencies and returns the exit code. */
  readonly install: () => number;
  readonly print: (line: string) => void;
}

/** Refuses forbidden files (exit 1, nothing installed); otherwise reinstalls and returns its exit code. */
export function runGuard(options: GuardOptions): number {
  const forbidden = forbiddenFilesIn(options.exists);
  if (forbidden.length > 0) {
    options.print('guard: the workspace has files that would change how the review tools run:');
    for (const file of forbidden) options.print(`  ${file.name}: ${file.why}`);
    options.print('guard: remove them (they are not the widget\'s code), then run the guard again.');
    return 1;
  }
  return options.install();
}

/** `npm ci` without install scripts, without inherited npm settings. */
function npmCi(root: string): number {
  const run = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
    env: installEnv(process.env),
  });
  return run.status ?? 1;
}

function main(): number {
  const { values } = parseArgs({
    options: { root: { type: 'string' }, 'check-only': { type: 'boolean', default: false } },
  });
  const root = resolve(values.root ?? fileURLToPath(new URL('../..', import.meta.url)));
  const checkOnly = values['check-only'];
  const code = runGuard({
    exists: (name) => existsSync(join(root, name)),
    install: () => (checkOnly ? 0 : npmCi(root)),
    print: (line) => {
      console.error(line);
    },
  });
  if (code === 0) console.log(checkOnly ? 'guard: workspace clean' : 'guard: workspace clean, dependencies reinstalled');
  return code;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
