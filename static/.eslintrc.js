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
    quotes: [2, 'single', 'avoid-escape'],
    'no-console': 'off', // Because container logging goes to stdout.
  },
  settings: {
    'import/resolver': {
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
  ignorePatterns: ['node_modules', 'dist'],
};
