import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import argon2 from 'argon2'
import { Pool, type DatabaseError } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '../../src/modules/auth/auth.types'
import type { AuthService as AuthServiceType } from '../../src/modules/auth/auth.service'
import type { JuradoService as JuradoServiceType } from '../../src/modules/jurado/jurado.service'
import type { SyncService as SyncServiceType } from '../../src/modules/jurado/sync.service'

function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL
  if (!value) throw new Error('TEST_DATABASE_URL es obligatoria para las pruebas de integración.')
  const databaseName = decodeURIComponent(new URL(value).pathname.slice(1))
  if (!databaseName.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL debe apuntar a una base terminada en _test; recibido: ${databaseName || '(vacía)'}.`)
  }
  return value
}

const testDatabaseUrl = requireTestDatabaseUrl()
const schemaName = `carnavales_test_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`

let bootstrapPool: Pool
let isolatedPool: Pool
let servicePool: Pool
let AuthServiceClass: typeof AuthServiceType
let JuradoServiceClass: typeof JuradoServiceType
let SyncServiceClass: typeof SyncServiceType
let nightId: number
let comparsaId: number
let parentItemId: number
let leafItemId: number
let assignedJurors: string[]
let successfulLastSlotAssignments: number

function databaseUrlForSchema(connectionString: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('options', `-c search_path=${schemaName},public`)
  return url.toString()
}

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as DatabaseError).code)
    : undefined
}

describe('PostgreSQL integrity', () => {
  beforeAll(async () => {
    bootstrapPool = new Pool({ connectionString: testDatabaseUrl })
    await bootstrapPool.query(`CREATE SCHEMA "${schemaName}"`)

    const isolatedUrl = databaseUrlForSchema(testDatabaseUrl)
    isolatedPool = new Pool({ connectionString: isolatedUrl })
    const migration = await readFile(path.resolve('migrations/001_initial.up.sql'), 'utf8')
    await isolatedPool.query(migration)

    process.env.DATABASE_URL = isolatedUrl
    AuthServiceClass = (await import('../../src/modules/auth/auth.service.js')).AuthService
    const serviceModule = await import('../../src/modules/jurado/jurado.service.js')
    JuradoServiceClass = serviceModule.JuradoService
    SyncServiceClass = (await import('../../src/modules/jurado/sync.service.js')).SyncService
    servicePool = (await import('../../src/database/pool.js')).pool

    const adminId = randomUUID()
    const adminPasswordHash = await argon2.hash('AdminPassword123!')
    await isolatedPool.query(
      `INSERT INTO users (id, nombre, dni, email, password_hash, role)
       VALUES ($1, 'Admin', 'admin-1', 'admin@test.local', $2, 'admin')`,
      [adminId, adminPasswordHash],
    )

    const jurorIds = Array.from({ length: 9 }, () => randomUUID())
    for (const [index, id] of jurorIds.entries()) {
      await isolatedPool.query(
        `INSERT INTO users (id, nombre, dni, email, password_hash, role)
         VALUES ($1,$2,$3,$4,'hash','jurado')`,
        [id, `Jurado ${index + 1}`, `dni-${index + 1}`, `jurado-${index + 1}@test.local`],
      )
    }

    const night = await isolatedPool.query<{ id: string }>(
      "INSERT INTO noches (nombre, fecha) VALUES ('Noche test', '2027-02-06') RETURNING id",
    )
    nightId = Number(night.rows[0]?.id)

    for (const jurorId of jurorIds.slice(0, 2)) {
      await isolatedPool.query(
        'INSERT INTO jurado_asignaciones (jurado_id, noche_id, asignado_por) VALUES ($1,$2,$3)',
        [jurorId, nightId, adminId],
      )
    }
    const assignmentResults = await Promise.allSettled(
      jurorIds.slice(2, 6).map((jurorId) => isolatedPool.query(
        'INSERT INTO jurado_asignaciones (jurado_id, noche_id, asignado_por) VALUES ($1,$2,$3)',
        [jurorId, nightId, adminId],
      )),
    )
    assignedJurors = jurorIds.slice(0, 2)
    successfulLastSlotAssignments = 0
    for (const [index, result] of assignmentResults.entries()) {
      if (result.status === 'fulfilled') {
        successfulLastSlotAssignments += 1
        assignedJurors.push(jurorIds[index + 2] as string)
      }
    }
    await isolatedPool.query("UPDATE noches SET estado = 'open' WHERE id = $1", [nightId])

    const comparsa = await isolatedPool.query<{ id: string }>(
      "INSERT INTO comparsas (nombre, noche_id, orden) VALUES ('Comparsa test', $1, 1) RETURNING id",
      [nightId],
    )
    comparsaId = Number(comparsa.rows[0]?.id)
    const parent = await isolatedPool.query<{ id: string }>(
      "INSERT INTO items (nombre, orden) VALUES ('Padre', 1) RETURNING id",
    )
    parentItemId = Number(parent.rows[0]?.id)
    const leaf = await isolatedPool.query<{ id: string }>(
      "INSERT INTO items (nombre, parent_item_id, orden) VALUES ('Hoja', $1, 2) RETURNING id",
      [parentItemId],
    )
    leafItemId = Number(leaf.rows[0]?.id)
  })

  afterAll(async () => {
    await servicePool.end()
    await isolatedPool.end()
    await bootstrapPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    await bootstrapPool.end()
  })

  it('enforces nine active jurors globally', async () => {
    await expect(isolatedPool.query(
      `INSERT INTO users (nombre, dni, email, password_hash, role)
       VALUES ('Jurado 10','dni-10','jurado-10@test.local','hash','jurado')`,
    )).rejects.toSatisfy((error: unknown) => pgCode(error) === 'P0001')
  })

  it('allows only three concurrent active assignments for a night', async () => {
    expect(successfulLastSlotAssignments).toBe(1)
    expect(assignedJurors).toHaveLength(3)
    const count = await isolatedPool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM jurado_asignaciones WHERE noche_id = $1 AND estado = 'active'",
      [nightId],
    )
    expect(count.rows[0]?.count).toBe(3)
  })

  it('creates, resumes and revokes an OTP-backed session', async () => {
    let deliveredCode = ''
    const auth = new AuthServiceClass({
      send: (_recipient, code) => {
        deliveredCode = code
        return Promise.resolve()
      },
    })
    const requested = await auth.requestOtp(
      { nombre: 'Admin', email: 'admin@test.local', dni: 'admin-1' },
      { requestId: randomUUID(), ip: '127.0.0.1' },
    )
    expect(deliveredCode).toMatch(/^\d{6}$/)

    const verified = await auth.verifyOtp(
      { challengeId: requested.challengeId, code: deliveredCode },
      { requestId: randomUUID(), ip: '127.0.0.1' },
    )
    expect(verified.user.role).toBe('admin')

    await expect(auth.verifyOtp(
      { challengeId: requested.challengeId, code: deliveredCode },
      { requestId: randomUUID() },
    )).rejects.toMatchObject({ code: 'OTP_ALREADY_USED' })

    await auth.logout(verified.token, { requestId: randomUUID() })
    const session = await isolatedPool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM sessions WHERE id = $1',
      [verified.user.sessionId],
    )
    expect(session.rows[0]?.revoked_at).toBeInstanceOf(Date)
  })

  it('rejects invalid credentials, expired OTPs and exhausted attempts', async () => {
    let deliveredCode = ''
    const auth = new AuthServiceClass({
      send: (_recipient, code) => {
        deliveredCode = code
        return Promise.resolve()
      },
    })

    await expect(auth.requestOtp(
      { nombre: 'Admin', email: 'admin@test.local', dni: 'dni-incorrecto' },
      { requestId: randomUUID(), ip: '127.0.0.1' },
    )).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    const expired = await auth.requestOtp(
      { nombre: 'Admin', email: 'admin@test.local', dni: 'admin-1' },
      { requestId: randomUUID() },
    )
    await isolatedPool.query(
      "UPDATE otp_challenges SET expires_at = now() - interval '1 second' WHERE id = $1",
      [expired.challengeId],
    )
    await expect(auth.verifyOtp(
      { challengeId: expired.challengeId, code: deliveredCode },
      { requestId: randomUUID() },
    )).rejects.toMatchObject({ code: 'OTP_EXPIRED' })

    const exhausted = await auth.requestOtp(
      { nombre: 'Admin', email: 'admin@test.local', dni: 'admin-1' },
      { requestId: randomUUID() },
    )
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(auth.verifyOtp(
        { challengeId: exhausted.challengeId, code: '000000' },
        { requestId: randomUUID() },
      )).rejects.toMatchObject({ code: 'INVALID_OTP' })
    }
    await expect(auth.verifyOtp(
      { challengeId: exhausted.challengeId, code: '000000' },
      { requestId: randomUUID() },
    )).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' })
    await expect(auth.verifyOtp(
      { challengeId: exhausted.challengeId, code: deliveredCode },
      { requestId: randomUUID() },
    )).rejects.toMatchObject({ code: 'OTP_ALREADY_USED' })
  })

  it('creates one auditable vote and treats an identical retry as idempotent', async () => {
    const jurorId = assignedJurors[0] as string
    const actor: AuthenticatedUser = {
      id: jurorId,
      nombre: 'Jurado 1',
      email: 'jurado-1@test.local',
      role: 'jurado',
      sessionId: randomUUID(),
    }
    const operationUuid = randomUUID()
    const input = {
      operationUuid,
      comparsaId,
      itemId: leafItemId,
      valor: 5,
      clientCreatedAt: '2027-02-06T22:00:00-03:00',
    }
    const service = new JuradoServiceClass()

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => service.createVote(actor, input, { requestId: randomUUID() })),
    )

    expect(attempts.filter((attempt) => !attempt.replayed)).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.replayed)).toHaveLength(9)
    const persisted = await isolatedPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM puntuaciones WHERE operation_uuid = $1',
      [operationUuid],
    )
    const audit = await isolatedPool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_log WHERE operation_uuid = $1 AND accion = 'vote.confirmed'",
      [operationUuid],
    )
    expect(persisted.rows[0]?.count).toBe(1)
    expect(audit.rows[0]?.count).toBe(1)

    await expect(service.createVote(actor, { ...input, valor: 4 }, { requestId: randomUUID() }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    await expect(service.createVote(actor, { ...input, operationUuid: randomUUID() }, { requestId: randomUUID() }))
      .rejects.toMatchObject({ code: 'VOTE_ALREADY_CONFIRMED' })
  })

  it('rejects direct scoring of a parent item', async () => {
    const jurorId = assignedJurors[1] as string
    const actor: AuthenticatedUser = {
      id: jurorId,
      nombre: 'Jurado 2',
      email: 'jurado-2@test.local',
      role: 'jurado',
      sessionId: randomUUID(),
    }
    const service = new JuradoServiceClass()
    await expect(service.createVote(actor, {
      operationUuid: randomUUID(), comparsaId, itemId: parentItemId, valor: 3,
      clientCreatedAt: '2027-02-06T22:01:00-03:00',
    }, { requestId: randomUUID() })).rejects.toMatchObject({ code: 'ITEM_NOT_SCORABLE' })
  })

  it('reconciles repeated offline operations without duplicating the vote', async () => {
    const jurorId = assignedJurors[1] as string
    const actor: AuthenticatedUser = {
      id: jurorId,
      nombre: 'Jurado 2',
      email: 'jurado-2@test.local',
      role: 'jurado',
      sessionId: randomUUID(),
    }
    const operationId = randomUUID()
    const operation = {
      operationId,
      type: 'vote' as const,
      payload: {
        comparsaId,
        itemId: leafItemId,
        valor: 0,
        clientCreatedAt: '2027-02-06T22:02:00-03:00',
      },
    }
    const sync = new SyncServiceClass(new JuradoServiceClass())
    const results = await sync.reconcile(actor, {
      deviceId: randomUUID(),
      operations: Array.from({ length: 5 }, () => operation),
    }, { requestId: randomUUID() })

    expect(results.filter((result) => result.status === 'APPLIED')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'ALREADY_APPLIED')).toHaveLength(4)
    const persisted = await isolatedPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM puntuaciones WHERE operation_uuid = $1',
      [operationId],
    )
    expect(persisted.rows[0]?.count).toBe(1)
  })

  it('rolls back a vote when its audit insert fails', async () => {
    const jurorId = assignedJurors[2] as string
    const actor: AuthenticatedUser = {
      id: jurorId,
      nombre: 'Jurado 3',
      email: 'jurado-3@test.local',
      role: 'jurado',
      sessionId: randomUUID(),
    }
    const operationUuid = randomUUID()
    const service = new JuradoServiceClass()
    await expect(service.createVote(actor, {
      operationUuid, comparsaId, itemId: leafItemId, valor: 0,
      clientCreatedAt: '2027-02-06T22:02:00-03:00',
    }, { requestId: 'not-a-uuid' })).rejects.toBeDefined()

    const persisted = await isolatedPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM puntuaciones WHERE operation_uuid = $1',
      [operationUuid],
    )
    expect(persisted.rows[0]?.count).toBe(0)
  })

  it('keeps confirmed votes append-only', async () => {
    const vote = await isolatedPool.query<{ id: string }>('SELECT id FROM puntuaciones LIMIT 1')
    const id = vote.rows[0]?.id
    expect(id).toBeDefined()
    await expect(isolatedPool.query('UPDATE puntuaciones SET valor = 1 WHERE id = $1', [id]))
      .rejects.toSatisfy((error: unknown) => pgCode(error) === 'P0001')
    await expect(isolatedPool.query('DELETE FROM puntuaciones WHERE id = $1', [id]))
      .rejects.toSatisfy((error: unknown) => pgCode(error) === 'P0001')
  })

  it('closes a comparsa once under concurrent retries and rejects a new logical operation', async () => {
    const jurorId = assignedJurors[0] as string
    const actor: AuthenticatedUser = {
      id: jurorId,
      nombre: 'Jurado 1',
      email: 'jurado-1@test.local',
      role: 'jurado',
      sessionId: randomUUID(),
    }
    const operationUuid = randomUUID()
    const input = {
      operationUuid,
      comparsaId,
      clientCreatedAt: '2027-02-06T22:10:00-03:00',
    }
    const service = new JuradoServiceClass()

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => service.closeComparsa(actor, input, { requestId: randomUUID() })),
    )

    expect(attempts.filter((attempt) => !attempt.replayed)).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.replayed)).toHaveLength(9)
    const persisted = await isolatedPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM cierres_comparsa WHERE operation_uuid = $1',
      [operationUuid],
    )
    const audit = await isolatedPool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM audit_log WHERE operation_uuid = $1 AND accion = 'comparsa.closed_by_juror'",
      [operationUuid],
    )
    expect(persisted.rows[0]?.count).toBe(1)
    expect(audit.rows[0]?.count).toBe(1)

    await expect(service.closeComparsa(actor, { ...input, clientCreatedAt: '2027-02-06T22:11:00-03:00' }, { requestId: randomUUID() }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    await expect(service.closeComparsa(actor, { ...input, operationUuid: randomUUID() }, { requestId: randomUUID() }))
      .rejects.toMatchObject({ code: 'COMPARSA_CLOSED' })
  })
})
