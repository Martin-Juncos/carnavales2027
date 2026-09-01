import type { PoolClient } from 'pg'
import { query } from '../../database/pool'

export interface AssignmentContext {
  assignment_id: string
  noche_id: string
  noche_nombre: string
  noche_estado: 'draft' | 'open' | 'closed' | 'certified'
  fecha: string
  assignment_status: 'active' | 'replaced' | 'cancelled' | 'completed'
}

export async function lockJurorComparsaScope(jurorId: string, comparsaId: number, client: PoolClient): Promise<void> {
  await query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`vote:${jurorId}:${comparsaId}`],
    client,
  )
}

export async function lockComparsa(comparsaId: number, client: PoolClient): Promise<{ id: string; noche_id: string; noche_estado: string; activo: boolean } | undefined> {
  const result = await query<{ id: string; noche_id: string; noche_estado: string; activo: boolean }>(
    `SELECT c.id, c.noche_id, n.estado AS noche_estado, c.activo
     FROM comparsas c
     JOIN noches n ON n.id = c.noche_id
     WHERE c.id = $1
     FOR SHARE OF c, n`,
    [comparsaId],
    client,
  )
  return result.rows[0]
}

export async function listAvailableNights() {
  const result = await query(
    `SELECT id, nombre AS name, estado AS status, fecha
     FROM noches
     ORDER BY fecha, id`,
  )
  return result.rows
}

export async function lockScorableItem(itemId: number, client: PoolClient): Promise<{ id: string; activo: boolean; scorable: boolean } | undefined> {
  const result = await query<{ id: string; activo: boolean; scorable: boolean }>(
    `SELECT i.id, i.activo,
      NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_item_id = i.id AND child.activo) AS scorable
     FROM items i WHERE i.id = $1 FOR SHARE OF i`,
    [itemId],
    client,
  )
  return result.rows[0]
}

export interface VoteRecord {
  id: string
  operation_uuid: string
  request_hash: string
  jurado_id: string
  comparsa_id: string
  item_id: string
  valor: number
  client_created_at: Date
  server_received_at: Date
}

export async function findVoteByOperation(operationUuid: string, client?: PoolClient): Promise<VoteRecord | undefined> {
  const result = await query<VoteRecord>('SELECT * FROM puntuaciones WHERE operation_uuid = $1', [operationUuid], client)
  return result.rows[0]
}

export async function findLogicalVote(
  jurorId: string,
  comparsaId: number,
  itemId: number,
  client: PoolClient,
): Promise<VoteRecord | undefined> {
  const result = await query<VoteRecord>(
    `SELECT * FROM puntuaciones
     WHERE jurado_id = $1 AND comparsa_id = $2 AND item_id = $3`,
    [jurorId, comparsaId, itemId],
    client,
  )
  return result.rows[0]
}

export async function insertVote(
  input: { operationUuid: string; requestHash: string; jurorId: string; comparsaId: number; itemId: number; value: number; clientCreatedAt: string },
  client: PoolClient,
): Promise<VoteRecord> {
  const result = await query<VoteRecord>(
    `INSERT INTO puntuaciones (
      operation_uuid, request_hash, jurado_id, comparsa_id, item_id, valor, client_created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.operationUuid, input.requestHash, input.jurorId, input.comparsaId, input.itemId, input.value, input.clientCreatedAt],
    client,
  )
  const vote = result.rows[0]
  if (!vote) throw new Error('Vote insert returned no row')
  return vote
}

export interface CloseRecord {
  id: string
  operation_uuid: string
  request_hash: string
  jurado_id: string
  comparsa_id: string
  client_created_at: Date
  server_received_at: Date
}

export async function findCloseByOperation(operationUuid: string, client?: PoolClient): Promise<CloseRecord | undefined> {
  const result = await query<CloseRecord>('SELECT * FROM cierres_comparsa WHERE operation_uuid = $1', [operationUuid], client)
  return result.rows[0]
}

export async function findLogicalClose(jurorId: string, comparsaId: number, client: PoolClient): Promise<CloseRecord | undefined> {
  const result = await query<CloseRecord>(
    'SELECT * FROM cierres_comparsa WHERE jurado_id = $1 AND comparsa_id = $2',
    [jurorId, comparsaId],
    client,
  )
  return result.rows[0]
}

export async function missingScorableItems(jurorId: string, comparsaId: number, client: PoolClient): Promise<Array<{ id: string; nombre: string }>> {
  const result = await query<{ id: string; nombre: string }>(
    `SELECT i.id, i.nombre
     FROM items i
     WHERE i.activo
       AND NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_item_id = i.id AND child.activo)
       AND NOT EXISTS (
         SELECT 1 FROM puntuaciones p
         WHERE p.jurado_id = $1 AND p.comparsa_id = $2 AND p.item_id = i.id
       )
     ORDER BY i.orden, i.id`,
    [jurorId, comparsaId],
    client,
  )
  return result.rows
}

export async function insertClose(
  input: { operationUuid: string; requestHash: string; jurorId: string; comparsaId: number; clientCreatedAt: string },
  client: PoolClient,
): Promise<CloseRecord> {
  const result = await query<CloseRecord>(
    `INSERT INTO cierres_comparsa (
      operation_uuid, request_hash, jurado_id, comparsa_id, client_created_at
    ) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.operationUuid, input.requestHash, input.jurorId, input.comparsaId, input.clientCreatedAt],
    client,
  )
  const close = result.rows[0]
  if (!close) throw new Error('Close insert returned no row')
  return close
}

export async function insertFiscalEvent(
  input: { type: string; jurorId: string; comparsaId: number; nightId: string; payload?: Record<string, unknown> },
  client: PoolClient,
): Promise<void> {
  await query(
    `INSERT INTO eventos_fiscal (tipo, jurado_id, comparsa_id, noche_id, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [input.type, input.jurorId, input.comparsaId, input.nightId, input.payload ?? {}],
    client,
  )
}

export async function getJurorContext(jurorId: string) {
  const assignment = await query<AssignmentContext>(
    `SELECT ja.id AS assignment_id, n.id AS noche_id, n.nombre AS noche_nombre, n.estado AS noche_estado, n.fecha,
            ja.estado AS assignment_status
     FROM jurado_asignaciones ja JOIN noches n ON n.id = ja.noche_id
     WHERE ja.jurado_id = $1 AND ja.estado = 'active'`,
    [jurorId],
  )
  const current = assignment.rows[0]
  if (!current) return undefined

  const [comparsas, items, votes, closes] = await Promise.all([
    query('SELECT id, nombre, orden FROM comparsas WHERE noche_id = $1 AND activo ORDER BY orden', [current.noche_id]),
    query('SELECT id, nombre, parent_item_id AS "parentItemId", orden FROM items WHERE activo ORDER BY orden, id'),
    query(
      `SELECT id, operation_uuid AS "operationUuid", comparsa_id AS "comparsaId", item_id AS "itemId",
              valor, server_received_at AS "serverReceivedAt"
       FROM puntuaciones WHERE jurado_id = $1 ORDER BY server_received_at`,
      [jurorId],
    ),
    query(
      `SELECT id, operation_uuid AS "operationUuid", comparsa_id AS "comparsaId",
              server_received_at AS "serverReceivedAt"
       FROM cierres_comparsa WHERE jurado_id = $1`,
      [jurorId],
    ),
  ])

  return {
    assignment: {
      id: current.assignment_id,
      night: { id: current.noche_id, name: current.noche_nombre, status: current.noche_estado, fecha: current.fecha },
    },
    comparsas: comparsas.rows,
    items: items.rows,
    votes: votes.rows,
    closes: closes.rows,
  }
}

export async function getJurorContextForNight(jurorId: string, nightId: number) {
  const night = await query<{ id: string; name: string; status: 'draft' | 'open' | 'closed' | 'certified'; fecha: string }>(
    `SELECT id, nombre AS name, estado AS status, fecha
     FROM noches
     WHERE id = $1`,
    [nightId],
  )
  const current = night.rows[0]
  if (!current) return undefined

  const [comparsas, items, votes, closes] = await Promise.all([
    query('SELECT id, nombre, orden FROM comparsas WHERE noche_id = $1 AND activo ORDER BY orden', [current.id]),
    query('SELECT id, nombre, parent_item_id AS "parentItemId", orden FROM items WHERE activo ORDER BY orden, id'),
    query(
      `SELECT p.id, p.operation_uuid AS "operationUuid", p.comparsa_id AS "comparsaId", p.item_id AS "itemId",
              p.valor, p.server_received_at AS "serverReceivedAt"
       FROM puntuaciones p
       JOIN comparsas c ON c.id = p.comparsa_id
       WHERE p.jurado_id = $1 AND c.noche_id = $2
       ORDER BY p.server_received_at`,
      [jurorId, current.id],
    ),
    query(
      `SELECT cc.id, cc.operation_uuid AS "operationUuid", cc.comparsa_id AS "comparsaId",
              cc.server_received_at AS "serverReceivedAt"
       FROM cierres_comparsa cc
       JOIN comparsas c ON c.id = cc.comparsa_id
       WHERE cc.jurado_id = $1 AND c.noche_id = $2`,
      [jurorId, current.id],
    ),
  ])

  return {
    assignment: {
      id: `selected-night-${current.id}`,
      night: current,
    },
    comparsas: comparsas.rows,
    items: items.rows,
    votes: votes.rows,
    closes: closes.rows,
  }
}

export async function listJurorVotes(jurorId: string) {
  const result = await query(
    `SELECT id, operation_uuid AS "operationUuid", comparsa_id AS "comparsaId", item_id AS "itemId",
            valor, client_created_at AS "clientCreatedAt", server_received_at AS "serverReceivedAt"
     FROM puntuaciones WHERE jurado_id = $1 ORDER BY server_received_at`,
    [jurorId],
  )
  return result.rows
}
