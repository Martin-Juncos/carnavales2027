import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pool } from './pool'
import { logger } from '../config/logger'

const direction = process.argv[2] === 'down' ? 'down' : 'up'
const migrationsDirectory = path.resolve(process.cwd(), 'migrations')

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function migrateUp(): Promise<void> {
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.up.sql')).sort()
  const applied = await pool.query<{ version: string }>('SELECT version FROM schema_migrations')
  const appliedVersions = new Set(applied.rows.map((row) => row.version))

  for (const file of files) {
    const version = file.replace('.up.sql', '')
    if (appliedVersions.has(version)) continue
    const sql = await readFile(path.join(migrationsDirectory, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version])
      await client.query('COMMIT')
      logger.info({ version }, 'Migration applied')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

async function migrateDown(): Promise<void> {
  const latest = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1',
  )
  const version = latest.rows[0]?.version
  if (!version) return
  const sql = await readFile(path.join(migrationsDirectory, `${version}.down.sql`), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [version])
    await client.query('COMMIT')
    logger.info({ version }, 'Migration reverted')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function main(): Promise<void> {
  const target = await pool.query<{
    database: string
    username: string
    address: string | null
    port: number | null
  }>(
    `SELECT current_database() AS database, current_user AS username,
            inet_server_addr()::text AS address, inet_server_port() AS port`,
  )
  logger.info({ target: target.rows[0] }, 'Migration target')
  await pool.query("SELECT pg_advisory_lock(hashtext('carnavales2027_migrations'))")
  try {
    await ensureTable()
    await (direction === 'up' ? migrateUp() : migrateDown())
  } finally {
    await pool.query("SELECT pg_advisory_unlock(hashtext('carnavales2027_migrations'))")
    await pool.end()
  }
}

main().catch((error: unknown) => {
  logger.fatal({ error }, 'Migration failed')
  process.exitCode = 1
})
