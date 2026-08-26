import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { env } from '../config/env'

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'test' ? 5 : 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: env.NODE_ENV === 'test',
})

export type DatabaseClient = Pool | PoolClient

export function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
  client?: DatabaseClient,
): Promise<QueryResult<T>> {
  return (client ?? pool).query<T>(text, [...values])
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
