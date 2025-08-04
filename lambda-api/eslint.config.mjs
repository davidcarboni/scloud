// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// https://typescript-eslint.io/getting-started/

const ignores = [
  '**/*.js',
];

export default tseslint.config(
  {
    ...eslint.configs.recommended,
    ignores,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores,
  })),
  {
    files: ['test/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-only-tests/no-only-tests': 'error',
    },
  },
);
