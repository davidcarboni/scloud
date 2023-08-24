module.exports = {
  env: {
    es2021: true,
    node: true,
    mocha: true,
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      },
    ],
    'import/no-import-module-exports': [0], // Unclear whether we should re-enable this: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-import-module-exports.md
    quotes: [2, 'single', 'avoid-escape'],
    'max-len': [ // Allow a longer line length
      'error',
      {
        code: 150,
        tabWidth: 2,
        ignoreComments: true, // comments: 80
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    'no-console': 'off', // Because lambda logging goes to stdout.
    'guard-for-in': [0], // May want to re-enable: https://eslint.org/docs/latest/rules/guard-for-in
    'no-restricted-syntax': [0], // Might want to re-enable to keep things simple https://eslint.org/docs/latest/rules/no-restricted-syntax
    // 'no-nested-ternary': [0], // on the rare occasion they're needed, they're needed [Carbs: massively unreadable though, probably a design smell]
    'no-plusplus': [0], // plus plus is useful
    'no-param-reassign': [0], // This could be a side-effect hygiene factor so may want to re-enable
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.js'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  overrides: [
    {
      // We lint unit tests differently.
      files: ['*.spec.ts'],
      rules: {

        // Avoid mocha/chai "Expected an assignment or function call and instead saw an expression"
        'no-unused-expressions': 'off',

        // Avoid "* should be listed in the project's dependencies, not devDependencies"
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
