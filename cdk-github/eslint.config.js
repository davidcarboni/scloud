const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

// https://typescript-eslint.io/getting-started/

const ignores = [
  '**/*.js',
];

module.exports = tseslint.config(
  {
    ...eslint.configs.recommended,
    ignores,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores,
  })),
);
