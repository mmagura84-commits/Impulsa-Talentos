// ESLint flat config (ESLint 9+). TypeScript does the type/undefined-name
// checks (`bun run lint:types`); ESLint covers React hook rules and common
// correctness issues.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'node_modules/**', '.deploy/**', 'e2e/**', 'scripts/**',
      'supabase/functions/**', // Deno code, checked by `deno check`
      'src/routeTree.gen.ts', '**/*.gen.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['*.{js,mjs,cjs}'], // build/tool config files run in Node
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'no-undef': 'off', // TypeScript handles this
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off', // TanStack route files export `Route` alongside components
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
