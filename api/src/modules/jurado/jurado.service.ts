import type { DatabaseError } from 'pg'
import { withTransaction } from '../../database/pool'
import { AppError, errors } from '../../shared/errors/app-error'
import { hashPayload } from '../../shared/security/crypto'
import { writeAudit } from '../audit/audit.repository'
import type { AuthenticatedUser } from '../auth/auth.types'
import * as repository from './jurado.repository'
import type { CloseComparsaInput, VoteInput } from './jurado.schemas'

interface OperationContext {
  requestId: string
  ip?: string
  deviceId?: string
}

function serializeVote(vote: repository.VoteRecord) {
  return {
    id: vote.id,
    operationUuid: vote.operation_uuid,
    comparsaId: vote.comparsa_id,
    itemId: vote.item_id,
    valor: vote.valor,
    clientCreatedAt: vote.client_created_at.toISOString(),
    serverReceivedAt: vote.server_received_at.toISOString(),
  }
}

function serializeClose(close: repository.CloseRecord) {
  return {
    id: close.id,
    operationUuid: close.operation_uuid,
    comparsaId: close.comparsa_id,
    clientCreatedAt: close.client_created_at.toISOString(),
    serverReceivedAt: close.server_received_at.toISOString(),
  }
}

function isUniqueViolation(error: unknown): error is DatabaseError {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

async function auditIdempotencyConflict(
  user: AuthenticatedUser,
  operationUuid: string,
  context: OperationContext,
  operationType: 'vote' | 'close_comparsa',
): Promise<void> {
  await writeAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'idempotency.conflict',
    entity: operationType,
    entityId: operationUuid,
    operationUuid,
    requestId: context.requestId,
    ip: context.ip,
    deviceId: context.deviceId,
    metadata: { operationType },
  })
}

export class JuradoService {
  nights() {
    return repository.listAvailableNights()
  }

  async context(user: AuthenticatedUser) {
    const result = await repository.getJurorContext(user.id)
    if (!result) throw new AppError('JUROR_NOT_ASSIGNED', 'El jurado no tiene una asignación activa.', 403)
    return result
  }

  async contextForNight(user: AuthenticatedUser, nightId: number) {
    const result = await repository.getJurorContextForNight(user.id, nightId)
    if (!result) throw errors.notFound('Noche')
    return result
  }

  listVotes(user: AuthenticatedUser) {
    return repository.listJurorVotes(user.id)
  }

  async createVote(user: AuthenticatedUser, input: VoteInput, context: OperationContext) {
    const requestHash = hashPayload({ ...input, jurorId: user.id })
    const existing = await repository.findVoteByOperation(input.operationUuid)
    if (existing) {
      if (existing.request_hash !== requestHash) {
        await auditIdempotencyConflict(user, input.operationUuid, context, 'vote')
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El operationUuid ya representa otra operación.')
      }
      return { vote: serializeVote(existing), replayed: true }
    }

    try {
      const outcome = await withTransaction(async (client) => {
        await repository.lockJurorComparsaScope(user.id, input.comparsaId, client)

        const concurrentOperation = await repository.findVoteByOperation(input.operationUuid, client)
        if (concurrentOperation) {
          if (concurrentOperation.request_hash !== requestHash) {
            return { kind: 'idempotency_conflict' as const }
          }
          return { kind: 'vote' as const, record: concurrentOperation, replayed: true }
        }

        const comparsa = await repository.lockComparsa(input.comparsaId, client)
        if (!comparsa || !comparsa.activo) throw errors.forbidden()
        const item = await repository.lockScorableItem(input.itemId, client)
        if (!item || !item.activo || !item.scorable) {
          throw new AppError('ITEM_NOT_SCORABLE', 'El item no es puntuable.', 422)
        }
        if (await repository.findLogicalClose(user.id, input.comparsaId, client)) {
          throw new AppError('COMPARSA_CLOSED', 'La comparsa ya fue cerrada por el jurado.', 409)
        }
        const logicalVote = await repository.findLogicalVote(user.id, input.comparsaId, input.itemId, client)
        if (logicalVote) {
          throw errors.conflict('VOTE_ALREADY_CONFIRMED', 'La puntuación ya fue confirmada.')
        }

        const created = await repository.insertVote({
          operationUuid: input.operationUuid,
          requestHash,
          jurorId: user.id,
          comparsaId: input.comparsaId,
          itemId: input.itemId,
          value: input.valor,
          clientCreatedAt: input.clientCreatedAt,
        }, client)
        await writeAudit({
          actorUserId: user.id,
          actorRole: user.role,
          action: 'vote.confirmed',
          entity: 'puntuaciones',
          entityId: created.id,
          requestId: context.requestId,
          operationUuid: input.operationUuid,
          ip: context.ip,
          deviceId: context.deviceId,
          metadata: { comparsaId: input.comparsaId, itemId: input.itemId, nightId: comparsa.noche_id, value: input.valor },
        }, client)
        return { kind: 'vote' as const, record: created, replayed: false }
      })
      if (outcome.kind === 'idempotency_conflict') {
        await auditIdempotencyConflict(user, input.operationUuid, context, 'vote')
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El operationUuid ya representa otra operación.')
      }
      return { vote: serializeVote(outcome.record), replayed: outcome.replayed }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const concurrent = await repository.findVoteByOperation(input.operationUuid)
      if (concurrent) {
        if (concurrent.request_hash !== requestHash) {
          await auditIdempotencyConflict(user, input.operationUuid, context, 'vote')
          throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El operationUuid ya representa otra operación.')
        }
        return { vote: serializeVote(concurrent), replayed: true }
      }
      throw errors.conflict('VOTE_ALREADY_CONFIRMED', 'La puntuación ya fue confirmada.')
    }
  }

  async closeComparsa(user: AuthenticatedUser, input: CloseComparsaInput, context: OperationContext) {
    const requestHash = hashPayload({ ...input, jurorId: user.id })
    const existing = await repository.findCloseByOperation(input.operationUuid)
    if (existing) {
      if (existing.request_hash !== requestHash) {
        await auditIdempotencyConflict(user, input.operationUuid, context, 'close_comparsa')
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El operationUuid ya representa otra operación.')
      }
      return { close: serializeClose(existing), replayed: true }
    }

    try {
      const outcome = await withTransaction(async (client) => {
        await repository.lockJurorComparsaScope(user.id, input.comparsaId, client)

        const concurrentOperation = await repository.findCloseByOperation(input.operationUuid, client)
        if (concurrentOperation) {
          if (concurrentOperation.request_hash !== requestHash) {
            return { kind: 'idempotency_conflict' as const }
          }
          return { kind: 'close' as const, record: concurrentOperation, replayed: true }
        }

        const comparsa = await repository.lockComparsa(input.comparsaId, client)
        if (!comparsa || !comparsa.activo) throw errors.forbidden()

        const logicalClose = await repository.findLogicalClose(user.id, input.comparsaId, client)
        if (logicalClose) throw new AppError('COMPARSA_CLOSED', 'La comparsa ya fue cerrada por el jurado.', 409)
        const missing = await repository.missingScorableItems(user.id, input.comparsaId, client)
        if (missing.length > 0) {
          throw new AppError('COMPARSA_INCOMPLETE', 'Faltan items por puntuar.', 409, { missing })
        }

        const created = await repository.insertClose({
          operationUuid: input.operationUuid,
          requestHash,
          jurorId: user.id,
          comparsaId: input.comparsaId,
          clientCreatedAt: input.clientCreatedAt,
        }, client)
        await writeAudit({
          actorUserId: user.id,
          actorRole: user.role,
          action: 'comparsa.closed_by_juror',
          entity: 'cierres_comparsa',
          entityId: created.id,
          requestId: context.requestId,
          operationUuid: input.operationUuid,
          ip: context.ip,
          deviceId: context.deviceId,
          metadata: { comparsaId: input.comparsaId, nightId: comparsa.noche_id },
        }, client)
        await repository.insertFiscalEvent({
          type: 'comparsa_closed',
          jurorId: user.id,
          comparsaId: input.comparsaId,
          nightId: comparsa.noche_id,
          payload: { closeId: created.id },
        }, client)
        return { kind: 'close' as const, record: created, replayed: false }
      })
      if (outcome.kind === 'idempotency_conflict') {
        await auditIdempotencyConflict(user, input.operationUuid, context, 'close_comparsa')
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El operationUuid ya representa otra operación.')
      }
      return { close: serializeClose(outcome.record), replayed: outcome.replayed }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const concurrent = await repository.findCloseByOperation(input.operationUuid)
      if (concurrent && concurrent.request_hash === requestHash) {
        return { close: serializeClose(concurrent), replayed: true }
      }
      if (concurrent) await auditIdempotencyConflict(user, input.operationUuid, context, 'close_comparsa')
      throw errors.conflict('IDEMPOTENCY_CONFLICT', 'La operación de cierre entra en conflicto.')
    }
  }
}
