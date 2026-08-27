import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    restoreMocks: true,
    css: true,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
})
