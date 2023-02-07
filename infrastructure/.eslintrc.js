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
    'max-len': [ // Allow a longer line length
      'error',
      {
        code: 180,
        tabWidth: 2,
        ignoreComments: true, // comments: 80
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    'no-new': 'off', // Because CDK likes to 'new' things
    'no-console': 'off', // Because we want to print some things out about the stack.
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
  root: true,
};
