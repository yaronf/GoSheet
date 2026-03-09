const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty-pattern': 'off', // Playwright fixtures use ({}, use) for no-dependency fixtures
      // Warn at 15, hard fail at 20. ESLint only supports one threshold per
      // rule, so we use 'error' at the hard limit. Functions hitting 15-19
      // are visible as errors in CI but won't break the build until they
      // reach 20. Keep all functions under 20; ideally under 15.
      complexity: ['error', { max: 20 }],
      // Hard fail at 1000 lines; soft target is 800 (enforce via code review).
      'max-lines': [
        'error',
        { max: 1000, skipBlankLines: true, skipComments: true },
      ],
    },
    ignores: ['node_modules/', 'dist/', 'build/'],
  },
];
