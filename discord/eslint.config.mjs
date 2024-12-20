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
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
