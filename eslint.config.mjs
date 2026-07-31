import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astroPlugin from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.next/**',
      '**/*.astro',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  ...astroPlugin.configs['flat/recommended'],
];
