import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://typescript-eslint.io/getting-started/

const ignores = [
  '**/*.js',
  'bundle.ts',
];

export default [
  {
    ...eslint.configs.recommended,
    ignores,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores,
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-only-tests/no-only-tests': 'error',
    },
    plugins: {
      'no-only-tests': noOnlyTests,
    },
  },
];