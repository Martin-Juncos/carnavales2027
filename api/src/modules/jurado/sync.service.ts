import { AppError } from '../../shared/errors/app-error'
import { writeAudit } from '../audit/audit.repository'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { SyncInput } from './jurado.schemas'
import type { JuradoService } from './jurado.service'

interface SyncContext {
  requestId: string
  ip?: string
}

export class SyncService {
  constructor(private readonly juradoService: JuradoService) {}

  async reconcile(user: AuthenticatedUser, input: SyncInput, context: SyncContext) {
    const results = []

    for (const operation of input.operations) {
      try {
        if (operation.type === 'vote') {
          const result = await this.juradoService.createVote(
            user,
            { ...operation.payload, operationUuid: operation.operationId },
            { ...context, deviceId: input.deviceId },
          )
          results.push({
            operationId: operation.operationId,
            status: result.replayed ? 'ALREADY_APPLIED' : 'APPLIED',
            resource: result.vote,
          })
        } else {
          const result = await this.juradoService.closeComparsa(
            user,
            { ...operation.payload, operationUuid: operation.operationId },
            { ...context, deviceId: input.deviceId },
          )
          results.push({
            operationId: operation.operationId,
            status: result.replayed ? 'ALREADY_APPLIED' : 'APPLIED',
            resource: result.close,
          })
        }
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError('INTERNAL_ERROR', 'No se pudo procesar la operación.', 500, undefined, true)
        const conflictCodes = new Set([
          'IDEMPOTENCY_CONFLICT',
          'NIGHT_CLOSED',
          'COMPARSA_CLOSED',
          'JUROR_NOT_ASSIGNED',
          'ASSIGNMENT_INACTIVE',
        ])
        const status = conflictCodes.has(appError.code) ? 'CONFLICT' : 'REJECTED'
        results.push({
          operationId: operation.operationId,
          status,
          error: { code: appError.code, message: appError.message, retryable: appError.retryable },
        })
        await writeAudit({
          actorUserId: user.id,
          actorRole: user.role,
          action: status === 'CONFLICT' ? 'sync.operation_conflict' : 'sync.operation_rejected',
          entity: 'sync_operation',
          entityId: operation.operationId,
          requestId: context.requestId,
          operationUuid: operation.operationId,
          ip: context.ip,
          deviceId: input.deviceId,
          metadata: { operationType: operation.type, errorCode: appError.code },
        })
      }
    }

    return results
  }
}
