// ESLint flat config for AroWā project
// See: https://eslint.org/docs/latest/use/configure/

import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

function cleanGlobals(obj: object) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k.trim() === k));
}

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
      ecmaVersion: 2022,
      globals: {
        ...cleanGlobals(globals.node),
        NodeJS: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        Hashes: true,
        NoSleep: true,
        QrCreator: true,
        ...cleanGlobals(globals.browser),
      },
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'src/public/js/libs/', 'tests/'],
  },
];
