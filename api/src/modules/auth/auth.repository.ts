import type { PoolClient } from 'pg'
import { query, type DatabaseClient } from '../../database/pool'
import type { Role } from './auth.types'

export interface UserRecord {
  id: string
  nombre: string
  dni: string
  email: string
  password_hash: string
  role: Role
  activo: boolean
}

export interface ChallengeRecord {
  id: string
  user_id: string
  code_hash: string
  expires_at: Date
  attempts: number
  max_attempts: number
  consumed_at: Date | null
}

export async function findUserByIdentity(identity: string): Promise<UserRecord | undefined> {
  const result = await query<UserRecord>(
    `SELECT id, nombre, dni, email, password_hash, role, activo
     FROM users WHERE lower(email) = lower($1) OR dni = $1 LIMIT 1`,
    [identity],
  )
  return result.rows[0]
}

export async function findUserById(id: string, client?: DatabaseClient): Promise<UserRecord | undefined> {
  const result = await query<UserRecord>(
    'SELECT id, nombre, dni, email, password_hash, role, activo FROM users WHERE id = $1',
    [id],
    client,
  )
  return result.rows[0]
}

export async function createChallenge(
  input: { id: string; userId: string; codeHash: string; expiresAt: Date; maxAttempts: number },
): Promise<void> {
  await query(
    `INSERT INTO otp_challenges (id, user_id, code_hash, expires_at, max_attempts)
     VALUES ($1,$2,$3,$4,$5)`,
    [input.id, input.userId, input.codeHash, input.expiresAt, input.maxAttempts],
  )
}

export async function consumeChallenge(id: string): Promise<void> {
  await query('UPDATE otp_challenges SET consumed_at = COALESCE(consumed_at, now()) WHERE id = $1', [id])
}

export async function lockChallenge(id: string, client: PoolClient): Promise<ChallengeRecord | undefined> {
  const result = await query<ChallengeRecord>(
    `SELECT id, user_id, code_hash, expires_at, attempts, max_attempts, consumed_at
     FROM otp_challenges WHERE id = $1 FOR UPDATE`,
    [id],
    client,
  )
  return result.rows[0]
}

export async function registerFailedAttempt(id: string, consume: boolean, client: PoolClient): Promise<void> {
  await query(
    `UPDATE otp_challenges
     SET attempts = attempts + 1,
         consumed_at = CASE WHEN $2 THEN now() ELSE consumed_at END
     WHERE id = $1`,
    [id, consume],
    client,
  )
}

export async function markChallengeConsumed(id: string, client: PoolClient): Promise<void> {
  await query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [id], client)
}

export async function createSession(
  input: { userId: string; tokenHash: string; expiresAt: Date; ip?: string; userAgent?: string },
  client: PoolClient,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [input.userId, input.tokenHash, input.expiresAt, input.ip ?? null, input.userAgent ?? null],
    client,
  )
  const session = result.rows[0]
  if (!session) throw new Error('Session insert returned no row')
  return session
}

export interface SessionRecord {
  id: string
  user_id: string
  expires_at: Date
  last_seen_at: Date
  revoked_at: Date | null
}

export async function findSession(tokenHash: string): Promise<SessionRecord | undefined> {
  const result = await query<SessionRecord>(
    `SELECT id, user_id, expires_at, last_seen_at, revoked_at
     FROM sessions WHERE token_hash = $1`,
    [tokenHash],
  )
  return result.rows[0]
}

export async function touchSession(id: string): Promise<void> {
  await query('UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND revoked_at IS NULL', [id])
}

export async function revokeSession(tokenHash: string): Promise<{ id: string; userId: string } | undefined> {
  const result = await query<{ id: string; userId: string }>(
    `UPDATE sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id, user_id AS "userId"`,
    [tokenHash],
  )
  return result.rows[0]
}
