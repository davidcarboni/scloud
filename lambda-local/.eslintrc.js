module.exports = {
  env: {
    es2021: true,
    node: true,
    mocha: true,
  },
  extends: [
    'airbnb-base',
    'plugin:import/typescript',
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
    'import/prefer-default-export': 'off', // So we can import everythng in the same way from index.ts
    'no-console': 'off', // So we can log activity to stdout.
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
        // Can't fathom how to resolve imprts in tests so heigh-ho, whatever, mystery
        // 'import/no-unresolved': 'off',

        // Avoid mocha/chai "Expected an assignment or function call and instead saw an expression"
        'no-unused-expressions': 'off',

        // Avoid "* should be listed in the project's dependencies, not devDependencies"
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
