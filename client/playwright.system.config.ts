import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/system',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-mobile', use: { ...devices['Pixel 7'] } }],
})
