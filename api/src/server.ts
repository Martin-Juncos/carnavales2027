import { createServer } from 'node:http'
import { createApp } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { pool } from './database/pool'
import { assertDatabaseReady } from './database/readiness'

const server = createServer(createApp())

async function start(): Promise<void> {
  const database = await assertDatabaseReady()
  logger.info({ database }, 'Database ready')
  server.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT, prefix: env.API_PREFIX }, 'API listening')
  })
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown started')
  await new Promise<void>((resolve) => {
    server.close((error) => {
      if (error) {
        logger.error({ error }, 'HTTP server shutdown failed')
        process.exitCode = 1
      }
      resolve()
    })
  })
  await pool.end()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

void start().catch(async (error: unknown) => {
  logger.fatal({ error }, 'API startup failed')
  await pool.end()
  process.exitCode = 1
})
