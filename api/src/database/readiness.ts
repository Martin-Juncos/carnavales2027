import { pool } from './pool'

const requiredRelations = [
  'schema_migrations',
  'users',
  'noches',
  'jurado_asignaciones',
  'puntuaciones',
  'audit_log',
] as const

export interface DatabaseTarget {
  database: string
  username: string
  address: string | null
  port: number | null
}

export async function assertDatabaseReady(): Promise<DatabaseTarget> {
  const targetResult = await pool.query<DatabaseTarget>(
    `SELECT current_database() AS database, current_user AS username,
            inet_server_addr()::text AS address, inet_server_port() AS port`,
  )
  const target = targetResult.rows[0]
  if (!target) throw new Error('No se pudo identificar la base PostgreSQL efectiva.')

  const relations = await pool.query<{ name: string; relation: string | null }>(
    `SELECT name, to_regclass(name) AS relation
     FROM unnest($1::text[]) AS required(name)`,
    [requiredRelations],
  )
  const missing = relations.rows.filter((row) => row.relation === null).map((row) => row.name)
  if (missing.length > 0) {
    throw new Error(`La base "${target.database}" no tiene el esquema de Carnavales 2027. Faltan: ${missing.join(', ')}.`)
  }

  const migration = await pool.query<{ applied: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM schema_migrations WHERE version = '001_initial'
     ) AS applied`,
  )
  if (!migration.rows[0]?.applied) {
    throw new Error(`La base "${target.database}" no tiene aplicada la migración 001_initial.`)
  }

  return target
}
