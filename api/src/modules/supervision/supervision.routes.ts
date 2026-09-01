import { Router } from 'express'
import { z } from 'zod'
import { query } from '../../database/pool'
import { asyncHandler } from '../../shared/http/async-handler'
import { validate, validated } from '../../shared/http/validate'
import { requireAuth, requireRoles } from '../auth/auth.middleware'

const nightParams = z.object({ params: z.object({ id: z.coerce.number().int().positive() }) })
const eventsQuery = z.object({ query: z.object({ after: z.coerce.number().int().nonnegative().default(0) }) })

export function createSupervisionRouter(): Router {
  const router = Router()
  router.use(requireAuth, requireRoles('fiscal', 'escribano', 'admin'))
  router.get('/noches', asyncHandler(async (_req, res) => {
    const nights = await query(
      'SELECT id, nombre, fecha, estado FROM noches ORDER BY fecha',
    )
    res.json({ data: nights.rows, meta: {} })
  }))
  router.get('/noches/:id/estado', validate(nightParams), asyncHandler(async (req, res) => {
    const { params } = validated<{ params: { id: number } }>(req)
    const [night, progress] = await Promise.all([
      query('SELECT id, nombre, fecha, estado FROM noches WHERE id = $1', [params.id]),
      query(
        `SELECT c.id AS "comparsaId", c.nombre AS "comparsaNombre",
                COUNT(DISTINCT p.id)::int AS "votesReceived", COUNT(DISTINCT cc.id)::int AS "jurorCloses"
         FROM comparsas c
         LEFT JOIN puntuaciones p ON p.comparsa_id = c.id
         LEFT JOIN cierres_comparsa cc ON cc.comparsa_id = c.id
         WHERE c.noche_id = $1 GROUP BY c.id ORDER BY c.orden`,
        [params.id],
      ),
    ])
    res.json({ data: { night: night.rows[0] ?? null, progress: progress.rows }, meta: {} })
  }))
  router.get('/eventos', validate(eventsQuery), asyncHandler(async (req, res) => {
    const { query: input } = validated<{ query: { after: number } }>(req)
    const events = await query<{ id: number } & Record<string, unknown>>(
      `SELECT id, tipo, jurado_id AS "juradoId", comparsa_id AS "comparsaId", noche_id AS "nocheId", payload, created_at AS "createdAt"
       FROM eventos_fiscal WHERE id > $1 ORDER BY id LIMIT 200`,
      [input.after],
    )
    res.json({ data: events.rows, meta: { nextCursor: events.rows.at(-1)?.id ?? input.after } })
  }))
  return router
}
