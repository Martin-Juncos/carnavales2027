const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')
const viteEnv = import.meta.env as unknown as Record<string, string | undefined>

export const appConfig = {
  apiBaseUrl: trimTrailingSlash(viteEnv.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'),
  apiHealthUrl: viteEnv.VITE_API_HEALTH_URL ?? 'http://localhost:3000/health',
  syncBatchSize: 25,
  apiTimeoutMs: 10_000,
} as const
