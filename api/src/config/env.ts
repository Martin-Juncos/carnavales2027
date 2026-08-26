import 'dotenv/config'
import { z } from 'zod'

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().regex(/^\//).default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: booleanString.default(false),
  BODY_LIMIT: z.string().default('256kb'),
  DATABASE_URL: z.url().default('postgresql://postgres:postgres@localhost:5432/carnavales2027'),
  TEST_DATABASE_URL: z.url().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32).default('dev-session-secret-change-before-production'),
  OTP_PEPPER: z.string().min(32).default('dev-otp-pepper-change-before-production'),
  SESSION_COOKIE_NAME: z.string().min(1).default('carnavales2027.sid'),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('no-reply@carnavales2027.local'),
  ACTA_STORAGE_DIR: z.string().default('./storage/actas'),
})

export type Environment = z.infer<typeof schema> & { corsOrigins: string[] }

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = schema.parse(source)

  if (parsed.NODE_ENV === 'production') {
    if (parsed.SESSION_SECRET.startsWith('dev-') || parsed.OTP_PEPPER.startsWith('dev-')) {
      throw new Error('Production secrets must be explicitly configured')
    }
    if (!parsed.COOKIE_SECURE) {
      throw new Error('COOKIE_SECURE must be true in production')
    }
    if (!parsed.SMTP_HOST) {
      throw new Error('SMTP_HOST is required in production')
    }
  }

  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  }
}

export const env = loadEnvironment()
