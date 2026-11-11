import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['lib/', 'docs/', 'coverage/']),
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // The model is assembled from many files that add methods to its prototype, which needs
      // `this` aliases, `arguments` and `any`. Typing it properly is a larger refactoring.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-rest-params': 'off',
      // `{}` is used on purpose to constrain generics to any non-nullish value
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // Type parameters in the public declarations are kept as they are, prefixed with `_` when unused
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.mocha },
    },
  },
  {
    files: ['*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
]);
