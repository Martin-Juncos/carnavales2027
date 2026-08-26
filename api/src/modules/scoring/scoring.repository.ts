import { query, type DatabaseClient } from '../../database/pool'

export async function reportByJurorNight(jurorId: string, nightId: number, client?: DatabaseClient) {
  const result = await query(
    `SELECT c.id AS "comparsaId", c.nombre AS "comparsaNombre", i.id AS "itemId", i.nombre AS "itemNombre",
            i.parent_item_id AS "parentItemId", p.valor, p.server_received_at AS "serverReceivedAt"
     FROM comparsas c
     JOIN puntuaciones p ON p.comparsa_id = c.id AND p.jurado_id = $1
     JOIN items i ON i.id = p.item_id
     WHERE c.noche_id = $2
     ORDER BY c.orden, i.orden, i.id`,
    [jurorId, nightId],
    client,
  )
  return result.rows
}

export async function reportByNight(nightId: number, client?: DatabaseClient) {
  const result = await query(
    `WITH score_totals AS (
       SELECT c.id AS comparsa_id, COALESCE(SUM(p.valor), 0)::int AS gross_total
       FROM comparsas c LEFT JOIN puntuaciones p ON p.comparsa_id = c.id
       WHERE c.noche_id = $1 GROUP BY c.id
     ), penalty_totals AS (
       SELECT comparsa_id, COALESCE(SUM(puntos), 0)::int AS penalty_total
       FROM penalizaciones WHERE estado = 'active' GROUP BY comparsa_id
     )
     SELECT c.id AS "comparsaId", c.nombre AS "comparsaNombre", c.orden,
            s.gross_total AS "grossTotal", COALESCE(pt.penalty_total, 0) AS "penaltyTotal",
            s.gross_total - COALESCE(pt.penalty_total, 0) AS "finalTotal"
     FROM comparsas c JOIN score_totals s ON s.comparsa_id = c.id
     LEFT JOIN penalty_totals pt ON pt.comparsa_id = c.id
     WHERE c.noche_id = $1 ORDER BY c.orden`,
    [nightId],
    client,
  )
  return result.rows
}

export async function generalReport(client?: DatabaseClient) {
  const result = await query(
    `WITH score_totals AS (
       SELECT c.id AS comparsa_id, COALESCE(SUM(p.valor), 0)::int AS gross_total
       FROM comparsas c LEFT JOIN puntuaciones p ON p.comparsa_id = c.id GROUP BY c.id
     ), penalty_totals AS (
       SELECT comparsa_id, COALESCE(SUM(puntos), 0)::int AS penalty_total
       FROM penalizaciones WHERE estado = 'active' GROUP BY comparsa_id
     )
     SELECT n.id AS "nocheId", n.nombre AS "nocheNombre", c.id AS "comparsaId", c.nombre AS "comparsaNombre",
            s.gross_total AS "grossTotal", COALESCE(pt.penalty_total, 0) AS "penaltyTotal",
            s.gross_total - COALESCE(pt.penalty_total, 0) AS "finalTotal"
     FROM comparsas c JOIN noches n ON n.id = c.noche_id JOIN score_totals s ON s.comparsa_id = c.id
     LEFT JOIN penalty_totals pt ON pt.comparsa_id = c.id
     ORDER BY n.fecha, c.orden`,
    [],
    client,
  )
  return result.rows
}
