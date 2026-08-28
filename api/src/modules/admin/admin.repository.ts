import type { PoolClient } from 'pg'
import { query, type DatabaseClient } from '../../database/pool'
import type { Role } from '../auth/auth.types'
import type {
  CreateAssignmentInput,
  CreateComparsaInput,
  CreateItemInput,
  CreateNightInput,
  ReorderComparsasInput,
  CreateUserInput,
  UpdateComparsaInput,
  UpdateItemInput,
  UpdateNightInput,
  UpdateUserInput,
} from './admin.schemas'
import { fixedComparsaNames } from './fixed-comparsas'

export interface PublicUserRow {
  id: string
  nombre: string
  dni: string
  email: string
  role: Role
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

const publicUserColumns = `id, nombre, dni, email, role, activo,
  created_at AS "createdAt", updated_at AS "updatedAt"`

export async function listUsers() {
  return (await query<PublicUserRow>(`SELECT ${publicUserColumns} FROM users ORDER BY nombre`)).rows
}

export async function createUser(input: CreateUserInput, passwordHash: string, client?: DatabaseClient) {
  const result = await query<PublicUserRow>(
    `INSERT INTO users (nombre, dni, email, password_hash, role, activo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${publicUserColumns}`,
    [input.nombre, input.dni, input.email.toLowerCase(), passwordHash, input.role, input.activo],
    client,
  )
  return result.rows[0]
}

export async function updateUser(id: string, input: UpdateUserInput, client?: DatabaseClient) {
  const result = await query<PublicUserRow>(
    `UPDATE users SET
      nombre = COALESCE($2, nombre),
      email = COALESCE($3, email),
      role = COALESCE($4, role),
      activo = COALESCE($5, activo)
     WHERE id = $1 RETURNING ${publicUserColumns}`,
    [id, input.nombre ?? null, input.email?.toLowerCase() ?? null, input.role ?? null, input.activo ?? null],
    client,
  )
  return result.rows[0]
}

export async function lockUser(userId: string, client: PoolClient): Promise<boolean> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1 FOR UPDATE',
    [userId],
    client,
  )
  return result.rowCount === 1
}

export async function hasActiveAssignment(userId: string, client?: DatabaseClient): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM jurado_asignaciones WHERE jurado_id = $1 AND estado = 'active') AS \"exists\"",
    [userId],
    client,
  )
  return result.rows[0]?.exists ?? false
}

export async function revokeUserSessions(userId: string, client?: DatabaseClient): Promise<void> {
  await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId], client)
}

export async function listNights() {
  return (await query('SELECT id, nombre, fecha, estado, created_at AS "createdAt", updated_at AS "updatedAt" FROM noches ORDER BY fecha')).rows
}

export async function createNight(input: CreateNightInput, client?: DatabaseClient) {
  return (await query(
    `INSERT INTO noches (nombre, fecha) VALUES ($1,$2)
     RETURNING id, nombre, fecha, estado, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [input.nombre, input.fecha],
    client,
  )).rows[0]
}

export async function seedFixedComparsasForNight(nightId: number, client: DatabaseClient) {
  const result = await query(
    `WITH fixed(nombre, orden) AS (
       SELECT * FROM unnest($2::text[], $3::int[])
     )
     INSERT INTO comparsas (nombre, noche_id, orden, activo)
     SELECT fixed.nombre, $1, fixed.orden, true
     FROM fixed
     WHERE NOT EXISTS (
       SELECT 1 FROM comparsas c
       WHERE c.noche_id = $1 AND lower(c.nombre) = lower(fixed.nombre)
     )
     RETURNING id, nombre, noche_id AS "nocheId", orden, activo,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [nightId, fixedComparsaNames, fixedComparsaNames.map((_, index) => index + 1)],
    client,
  )
  return result.rows
}

export async function updateNight(id: number, input: UpdateNightInput, client?: DatabaseClient) {
  return (await query(
    `UPDATE noches SET nombre = COALESCE($2,nombre), fecha = COALESCE($3,fecha)
     WHERE id = $1 RETURNING id, nombre, fecha, estado, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, input.nombre ?? null, input.fecha ?? null],
    client,
  )).rows[0]
}

export async function listComparsas() {
  return (await query(
    `SELECT c.id, c.nombre, c.noche_id AS "nocheId", n.nombre AS "nocheNombre", c.orden, c.activo,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt"
     FROM comparsas c JOIN noches n ON n.id = c.noche_id ORDER BY n.fecha, c.orden`,
  )).rows
}

export async function createComparsa(input: CreateComparsaInput, client?: DatabaseClient) {
  return (await query(
    `INSERT INTO comparsas (nombre, noche_id, orden, activo) VALUES ($1,$2,$3,$4)
     RETURNING id, nombre, noche_id AS "nocheId", orden, activo, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [input.nombre, input.nocheId, input.orden, input.activo],
    client,
  )).rows[0]
}

export async function updateComparsa(id: number, input: UpdateComparsaInput, client?: DatabaseClient) {
  return (await query(
    `UPDATE comparsas SET orden = $2
     WHERE id = $1 RETURNING id, nombre, noche_id AS "nocheId", orden, activo, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, input.orden],
    client,
  )).rows[0]
}

export async function getComparsasForNight(nightId: number, client: PoolClient) {
  return (await query<{ id: string; nombre: string }>(
    'SELECT id, nombre FROM comparsas WHERE noche_id = $1 FOR UPDATE',
    [nightId],
    client,
  )).rows
}

export async function reorderComparsas(
  nightId: number,
  input: ReorderComparsasInput,
  client: PoolClient,
) {
  for (const item of input.comparsas) {
    await query('UPDATE comparsas SET orden = $3 + 10000 WHERE noche_id = $1 AND id = $2', [nightId, item.comparsaId, item.orden], client)
  }
  for (const item of input.comparsas) {
    await query('UPDATE comparsas SET orden = $3 WHERE noche_id = $1 AND id = $2', [nightId, item.comparsaId, item.orden], client)
  }
  return (await query(
    `SELECT c.id, c.nombre, c.noche_id AS "nocheId", n.nombre AS "nocheNombre", c.orden, c.activo,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt"
     FROM comparsas c JOIN noches n ON n.id = c.noche_id
     WHERE c.noche_id = $1
     ORDER BY c.orden`,
    [nightId],
    client,
  )).rows
}

export async function listItems() {
  return (await query(
    `SELECT id, nombre, parent_item_id AS "parentItemId", orden, activo,
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM items ORDER BY orden, id`,
  )).rows
}

export async function createItem(input: CreateItemInput, client?: DatabaseClient) {
  return (await query(
    `INSERT INTO items (nombre, parent_item_id, orden, activo) VALUES ($1,$2,$3,$4)
     RETURNING id, nombre, parent_item_id AS "parentItemId", orden, activo,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [input.nombre, input.parentItemId ?? null, input.orden, input.activo],
    client,
  )).rows[0]
}

export async function updateItem(id: number, input: UpdateItemInput, client?: DatabaseClient) {
  return (await query(
    `UPDATE items SET nombre = COALESCE($2,nombre), parent_item_id = CASE WHEN $3 THEN $4 ELSE parent_item_id END,
                      orden = COALESCE($5,orden), activo = COALESCE($6,activo)
     WHERE id = $1 RETURNING id, nombre, parent_item_id AS "parentItemId", orden, activo,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, input.nombre ?? null, Object.hasOwn(input, 'parentItemId'), input.parentItemId ?? null, input.orden ?? null, input.activo ?? null],
    client,
  )).rows[0]
}

export async function listAssignments() {
  return (await query(
    `SELECT ja.id, ja.jurado_id AS "juradoId", u.nombre AS "juradoNombre", ja.noche_id AS "nocheId",
            n.nombre AS "nocheNombre", ja.estado, ja.reemplaza_asignacion_id AS "reemplazaAsignacionId",
            ja.motivo, ja.asignado_at AS "asignadoAt", ja.finalizado_at AS "finalizadoAt"
     FROM jurado_asignaciones ja
     JOIN users u ON u.id = ja.jurado_id JOIN noches n ON n.id = ja.noche_id
     ORDER BY n.fecha, ja.asignado_at`,
  )).rows
}

export async function lockNight(id: number, client: PoolClient) {
  const result = await query<{ id: string; estado: string }>('SELECT id, estado FROM noches WHERE id = $1 FOR UPDATE', [id], client)
  return result.rows[0]
}

export async function ensureJuror(id: string, client: PoolClient) {
  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND role = 'jurado' AND activo FOR SHARE",
    [id],
    client,
  )
  return result.rows[0]
}

export async function countActiveAssignments(nightId: number, client: PoolClient): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT count(*)::int AS count
     FROM jurado_asignaciones
     WHERE noche_id = $1 AND estado = 'active'`,
    [nightId],
    client,
  )
  return result.rows[0]?.count ?? 0
}

export async function insertAssignment(input: CreateAssignmentInput & { actorId: string; replacesId?: string }, client: PoolClient) {
  const result = await query(
    `INSERT INTO jurado_asignaciones (
      jurado_id, noche_id, motivo, asignado_por, reemplaza_asignacion_id
     ) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, jurado_id AS "juradoId", noche_id AS "nocheId", estado,
               reemplaza_asignacion_id AS "reemplazaAsignacionId", motivo, asignado_at AS "asignadoAt"`,
    [input.juradoId, input.nocheId, input.motivo ?? null, input.actorId, input.replacesId ?? null],
    client,
  )
  return result.rows[0]
}

export async function lockAssignment(id: string, client: PoolClient) {
  const result = await query<{ id: string; jurado_id: string; noche_id: string; estado: string }>(
    'SELECT id, jurado_id, noche_id, estado FROM jurado_asignaciones WHERE id = $1 FOR UPDATE',
    [id],
    client,
  )
  return result.rows[0]
}

export async function finalizeAssignment(id: string, actorId: string, reason: string, client: PoolClient): Promise<void> {
  await query(
    `UPDATE jurado_asignaciones SET estado = 'replaced', finalizado_at = now(), finalizado_por = $2, motivo = $3
     WHERE id = $1`,
    [id, actorId, reason],
    client,
  )
}

export async function transitionNight(id: number, expected: string, next: string, client: PoolClient) {
  const result = await query(
    `UPDATE noches SET estado = $3 WHERE id = $1 AND estado = $2
     RETURNING id, nombre, fecha, estado, updated_at AS "updatedAt"`,
    [id, expected, next],
    client,
  )
  return result.rows[0]
}
