import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const tsFiles = ['**/*.{ts,tsx}']
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  crypto: 'readonly',
  localStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  AbortController: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  RequestInfo: 'readonly',
  RequestInit: 'readonly',
  URL: 'readonly',
  console: 'readonly',
  HTMLElement: 'readonly',
  KeyboardEvent: 'readonly',
  ServiceWorkerRegistration: 'readonly',
  DOMException: 'readonly',
  Headers: 'readonly',
  fetch: 'readonly',
  self: 'readonly',
  caches: 'readonly',
  Promise: 'readonly',
  process: 'readonly',
}
const testGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
}

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: browserGlobals },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: tsFiles })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({ ...config, files: tsFiles })),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...browserGlobals, ...testGlobals },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
)
