// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import noOnlyTests from 'eslint-plugin-no-only-tests';

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
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
);