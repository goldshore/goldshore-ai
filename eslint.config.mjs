import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      '.astro/**',
      '.turbo/**',
      'node_modules/**',
      '.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/node_modules/**',
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
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
