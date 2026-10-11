// @vitest-environment node
import { ESLint } from 'eslint';

/**
 * AC-7.3 keeps the domain framework-free: src/domain must not import React or
 * react-dom, nor read `import.meta` (which would tie it to Vite). These tests
 * lint small snippets with the project's own ESLint config, as if they were
 * files at the given paths, so the guard itself is under test.
 */

/**
 * The widgt root (where eslint.config.js lives), two levels above this file.
 * Plain string handling, because tsconfig.app.json has no Node types for `node:path`.
 */
function widgtRoot(): string {
  const { testPath } = expect.getState();
  const root = testPath?.replace(/[\\/]src[\\/]domain[\\/][^\\/]+$/, '');
  if (root === undefined || root === testPath) {
    throw new Error(`Cannot find the widgt root from the test path ${String(testPath)}`);
  }
  return root;
}

const ROOT = widgtRoot();
const eslint = new ESLint({ cwd: ROOT });

/** Lints `code` as if it were the file at `relativePath`, and returns the rule IDs reported. */
async function ruleIdsFor(code: string, relativePath: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}/${relativePath}` });
  if (result === undefined) {
    throw new Error(`ESLint returned no result for ${relativePath}`);
  }
  return result.messages.map((message) => message.ruleId);
}

describe('src/domain boundaries', () => {
  it.each<[string, string]>([
    ['react', "import React from 'react';\nexport const lib = React;\n"],
    [
      'react-dom/client',
      "import { createRoot } from 'react-dom/client';\nexport const mount = createRoot;\n",
    ],
    ['react/jsx-runtime', "import { jsx } from 'react/jsx-runtime';\nexport const make = jsx;\n"],
  ])('AC-7.3 rejects an import of %s in src/domain', async (_module, code) => {
    const ruleIds = await ruleIdsFor(code, 'src/domain/pretend.ts');
    expect(ruleIds).toContain('no-restricted-imports');
  });

  it('AC-7.3 rejects import.meta in src/domain', async () => {
    const ruleIds = await ruleIdsFor(
      'export const mode = import.meta.env.MODE;\n',
      'src/domain/pretend.ts',
    );
    expect(ruleIds).toContain('no-restricted-syntax');
  });

  it('AC-7.3 accepts plain TypeScript in src/domain', async () => {
    const ruleIds = await ruleIdsFor(
      'export const double = (value: number): number => value * 2;\n',
      'src/domain/pretend.ts',
    );
    expect(ruleIds).toEqual([]);
  });

  it('AC-7.3 allows a React import outside src/domain', async () => {
    const ruleIds = await ruleIdsFor(
      "import React from 'react';\nexport const lib = React;\n",
      'src/components/Pretend.tsx',
    );
    expect(ruleIds).not.toContain('no-restricted-imports');
  });
});
