import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'review/runs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.strict],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The locked contract and review harness run in Node (Playwright), never in the browser bundle.
    files: ['review/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Mirrors gate G5 (spec 03): a contract test can never be focused or skipped.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(only|skip|fixme)$/]',
          message: 'Contract tests must not use .only, .skip or .fixme (spec 03, gate G5).',
        },
      ],
    },
  },
);
