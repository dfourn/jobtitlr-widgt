// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forbiddenFilesIn, installEnv, runGuard } from './guard';

const GUARD = fileURLToPath(new URL('./guard.ts', import.meta.url));

/** An `exists` that knows only `names`, all at the widgt root. */
const only =
  (...names: string[]) =>
  (name: string): boolean =>
    names.includes(name);

describe('AC-L12 workspace guard', () => {
  it.each([
    '.npmrc',
    'vitest.config.ts',
    'vitest.config.mjs',
    'vite.config.js',
    'vite.config.mjs',
    'postcss.config.cjs',
    '.postcssrc',
    '.postcssrc.json',
  ])('AC-L12 refuses a %s', (name) => {
    expect(forbiddenFilesIn(only(name)).map((file) => file.name)).toEqual([name]);
  });

  it('AC-L12 allows the locked configs and ordinary files', () => {
    expect(forbiddenFilesIn(only('vite.config.ts', 'eslint.config.js', 'package.json', 'tsconfig.json', 'index.html'))).toEqual([]);
  });

  it('AC-L12 names every forbidden file with its reason and does not reinstall', () => {
    const lines: string[] = [];
    let installs = 0;
    const code = runGuard({
      exists: only('.npmrc', 'vitest.config.ts'),
      install: () => {
        installs += 1;
        return 0;
      },
      print: (line) => lines.push(line),
    });
    expect(code).toBe(1);
    expect(installs).toBe(0);
    expect(lines.join('\n')).toMatch(/\.npmrc: .*node-options/);
    expect(lines.join('\n')).toMatch(/vitest\.config\.ts: .*vite\.config\.ts/);
  });

  it.each([0, 3])('AC-L12 reinstalls the dependencies in a clean workspace and returns the install exit code %i', (exitCode) => {
    let installs = 0;
    const code = runGuard({
      exists: only('package.json'),
      install: () => {
        installs += 1;
        return exitCode;
      },
      print: () => undefined,
    });
    expect([code, installs]).toEqual([exitCode, 1]);
  });

  it('AC-L12 installs without NODE_OPTIONS or npm_config_ settings inherited from the environment', () => {
    expect(
      installEnv({
        PATH: '/bin',
        HOME: '/home/dev',
        NODE_OPTIONS: '--require ./src/hook.cjs',
        npm_config_node_options: '--require ./src/hook.cjs',
        NPM_CONFIG_SCRIPT_SHELL: '/bin/evil',
        UNSET: undefined,
      }),
    ).toEqual({ PATH: '/bin', HOME: '/home/dev' });
  });

  describe('run with plain Node', () => {
    let dir = '';
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'widgt-guard-'));
      writeFileSync(join(dir, 'package.json'), '{}\n');
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    const guard = () =>
      spawnSync(process.execPath, [GUARD, '--root', dir, '--check-only'], {
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' },
      });

    it('AC-L12 runs under plain Node and refuses a .npmrc', () => {
      writeFileSync(join(dir, '.npmrc'), 'node-options=--require ./src/hook.cjs\n');
      const run = guard();
      expect(run.status).toBe(1);
      expect(`${run.stdout}${run.stderr}`).toContain('.npmrc');
    });

    it('AC-L12 runs under plain Node and passes a clean workspace', () => {
      const run = guard();
      expect(`${run.stdout}${run.stderr}`).not.toContain('Error');
      expect(run.status).toBe(0);
    });
  });
});
