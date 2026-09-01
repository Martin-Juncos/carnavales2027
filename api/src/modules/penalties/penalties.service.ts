import { withTransaction, query } from '../../database/pool'
import { errors } from '../../shared/errors/app-error'
import { writeAudit } from '../audit/audit.repository'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { AnnulPenaltyInput, CreatePenaltyInput, ListPenaltiesInput } from './penalties.schemas'

interface Context { requestId: string; ip?: string }

export class PenaltiesService {
  async list(input: ListPenaltiesInput) {
    const result = await query(
      `SELECT p.id, p.comparsa_id AS "comparsaId", c.nombre AS "comparsaNombre",
              c.noche_id AS "nocheId", n.nombre AS "nocheNombre",
              p.puntos, p.motivo_codigo AS "motivoCodigo",
              p.motivo_descripcion AS "motivoDescripcion", p.estado,
              p.created_at AS "createdAt", p.anulada_at AS "anuladaAt"
       FROM penalizaciones p
       JOIN comparsas c ON c.id = p.comparsa_id
       JOIN noches n ON n.id = c.noche_id
       WHERE ($1::bigint IS NULL OR c.noche_id = $1)
         AND ($2::text IS NULL OR p.estado = $2)
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [input.nocheId ?? null, input.estado ?? null, input.limit],
    )
    return result.rows
  }

  async create(actor: AuthenticatedUser, input: CreatePenaltyInput, context: Context) {
    return withTransaction(async (client) => {
      const result = await query(
        `INSERT INTO penalizaciones (comparsa_id, puntos, motivo_codigo, motivo_descripcion, registrada_por)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, comparsa_id AS "comparsaId", puntos, motivo_codigo AS "motivoCodigo",
                   motivo_descripcion AS "motivoDescripcion", estado, created_at AS "createdAt"`,
        [input.comparsaId, input.puntos, input.motivoCodigo ?? null, input.motivoDescripcion, actor.id],
        client,
      )
      const penalty = result.rows[0]
      if (!penalty) throw new Error('Penalty insert returned no row')
      await writeAudit({
        actorUserId: actor.id, actorRole: actor.role, action: 'penalty.created', entity: 'penalizaciones',
        entityId: String(penalty.id), requestId: context.requestId, ip: context.ip,
        metadata: { comparsaId: input.comparsaId, points: input.puntos },
      }, client)
      return penalty
    })
  }

  async annul(actor: AuthenticatedUser, id: string, input: AnnulPenaltyInput, context: Context) {
    return withTransaction(async (client) => {
      const result = await query(
        `UPDATE penalizaciones SET estado = 'annulled', anulada_por = $2, anulada_at = now(), anulacion_motivo = $3
         WHERE id = $1 AND estado = 'active'
         RETURNING id, comparsa_id AS "comparsaId", puntos, estado, anulada_at AS "anuladaAt"`,
        [id, actor.id, input.motivo],
        client,
      )
      const penalty = result.rows[0]
      if (!penalty) throw errors.notFound('Penalización activa')
      await writeAudit({
        actorUserId: actor.id, actorRole: actor.role, action: 'penalty.annulled', entity: 'penalizaciones',
        entityId: id, requestId: context.requestId, ip: context.ip, metadata: { reason: input.motivo },
      }, client)
      return penalty
    })
  }
}
