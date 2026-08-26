import { Router } from 'express'
import { z } from 'zod'
import { query } from '../../database/pool'
import { asyncHandler } from '../../shared/http/async-handler'
import { validate, validated } from '../../shared/http/validate'
import { requireAuth, requireRoles } from '../auth/auth.middleware'

const auditQuery = z.object({ query: z.object({ after: z.coerce.number().int().nonnegative().default(0), limit: z.coerce.number().int().min(1).max(200).default(100) }) })

export function createAuditRouter(): Router {
  const router = Router()
  router.use(requireAuth, requireRoles('fiscal', 'escribano', 'admin'))
  router.get('/', validate(auditQuery), asyncHandler(async (req, res) => {
    const input = validated<{ query: { after: number; limit: number } }>(req).query
    const limitedFiscal = req.auth?.role === 'fiscal'
    const result = await query<{ id: number } & Record<string, unknown>>(
      `SELECT id, actor_user_id AS "actorUserId", actor_role AS "actorRole", accion, entidad,
              entidad_id AS "entityId", request_id AS "requestId", operation_uuid AS "operationUuid",
              metadata, created_at AS "createdAt"
       FROM audit_log
       WHERE id > $1 AND ($3::boolean = false OR accion IN ('vote.confirmed','comparsa.closed_by_juror','penalty.created','penalty.annulled'))
       ORDER BY id LIMIT $2`,
      [input.after, input.limit, limitedFiscal],
    )
    res.json({ data: result.rows, meta: { nextCursor: result.rows.at(-1)?.id ?? input.after } })
  }))
  return router
}
