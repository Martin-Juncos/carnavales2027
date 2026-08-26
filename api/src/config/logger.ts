import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'carnavales2027-api' },
  serializers: {
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'otp',
      '*.otp',
      'token',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
})
