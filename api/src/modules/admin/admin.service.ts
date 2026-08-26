import argon2 from 'argon2'
import type { DatabaseError, PoolClient } from 'pg'
import { withTransaction } from '../../database/pool'
import { AppError, errors } from '../../shared/errors/app-error'
import { writeAudit } from '../audit/audit.repository'
import type { AuthenticatedUser } from '../auth/auth.types'
import * as repository from './admin.repository'
import type {
  CreateAssignmentInput,
  CreateComparsaInput,
  CreateItemInput,
  CreateNightInput,
  CreateUserInput,
  ReplaceAssignmentInput,
  UpdateComparsaInput,
  UpdateItemInput,
  UpdateNightInput,
  UpdateUserInput,
} from './admin.schemas'

interface Context { requestId: string; ip?: string }

function databaseCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as DatabaseError).code)
    : undefined
}

function mapDatabaseError(error: unknown): never {
  if (databaseCode(error) === '23505') throw errors.conflict('IDEMPOTENCY_CONFLICT', 'El recurso viola una restricción de unicidad.')
  if (databaseCode(error) === '23503') throw errors.validation({ reason: 'invalid_reference' })
  if (databaseCode(error) === 'P0001' && error instanceof Error && error.message.includes('JUDGE_CAPACITY_EXCEEDED')) {
    throw new AppError('JUDGE_CAPACITY_EXCEEDED', 'La noche ya tiene tres jurados activos.', 409)
  }
  if (databaseCode(error) === 'P0001' && error instanceof Error && error.message.includes('JUROR_TOTAL_CAPACITY_EXCEEDED')) {
    throw new AppError('JUDGE_CAPACITY_EXCEEDED', 'El sistema ya tiene nueve jurados activos.', 409)
  }
  throw error
}

async function audit(
  user: AuthenticatedUser,
  context: Context,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  client?: PoolClient,
) {
  await writeAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action,
    entity,
    entityId,
    requestId: context.requestId,
    ip: context.ip,
    metadata,
  }, client)
}

export class AdminService {
  listUsers = repository.listUsers
  listNights = repository.listNights
  listComparsas = repository.listComparsas
  listItems = repository.listItems
  listAssignments = repository.listAssignments

  async createUser(actor: AuthenticatedUser, input: CreateUserInput, context: Context) {
    const passwordHash = await argon2.hash(input.password)
    try {
      return await withTransaction(async (client) => {
        const created = await repository.createUser(input, passwordHash, client)
        if (!created) throw new Error('User insert returned no row')
        await audit(actor, context, 'admin.user_created', 'users', created.id, { role: created.role }, client)
        return created
      })
    } catch (error) {
      mapDatabaseError(error)
    }
  }

  async updateUser(actor: AuthenticatedUser, id: string, input: UpdateUserInput, context: Context) {
    const passwordHash = input.password ? await argon2.hash(input.password) : undefined
    try {
      return await withTransaction(async (client) => {
        if (!await repository.lockUser(id, client)) throw errors.notFound('Usuario')
        if (
          (input.activo === false || (input.role && input.role !== 'jurado'))
          && await repository.hasActiveAssignment(id, client)
        ) {
          throw errors.conflict('ASSIGNMENT_INACTIVE', 'Debe reemplazar o finalizar la asignación activa antes de modificar al jurado.')
        }
        const updated = await repository.updateUser(id, input, passwordHash, client)
        if (!updated) throw errors.notFound('Usuario')
        if (input.activo === false) await repository.revokeUserSessions(id, client)
        await audit(actor, context, 'admin.user_updated', 'users', id, { changedFields: Object.keys(input) }, client)
        return updated
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }

  async createNight(actor: AuthenticatedUser, input: CreateNightInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const created = await repository.createNight(input, client)
        if (!created) throw new Error('Night insert returned no row')
        await audit(actor, context, 'admin.night_created', 'noches', String(created.id), undefined, client)
        return created
      })
    } catch (error) { mapDatabaseError(error) }
  }

  async updateNight(actor: AuthenticatedUser, id: number, input: UpdateNightInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const updated = await repository.updateNight(id, input, client)
        if (!updated) throw errors.notFound('Noche')
        await audit(actor, context, 'admin.night_updated', 'noches', String(id), { changedFields: Object.keys(input) }, client)
        return updated
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }

  async transitionNight(actor: AuthenticatedUser, id: number, action: 'open' | 'close', context: Context) {
    return withTransaction(async (client) => {
      const expected = action === 'open' ? 'draft' : 'open'
      const next = action === 'open' ? 'open' : 'closed'
      const current = await repository.lockNight(id, client)
      if (!current || current.estado !== expected) {
        throw errors.conflict('NIGHT_CLOSED', `La noche no puede pasar de ${expected} a ${next}.`)
      }
      if (action === 'open' && await repository.countActiveAssignments(id, client) !== 3) {
        throw new AppError('JUDGE_CAPACITY_EXCEEDED', 'La noche debe tener exactamente tres jurados activos para abrirse.', 409)
      }
      const night = await repository.transitionNight(id, expected, next, client)
      if (!night) throw errors.conflict('NIGHT_CLOSED', `La noche no puede pasar de ${expected} a ${next}.`)
      await writeAudit({
        actorUserId: actor.id, actorRole: actor.role, action: `admin.night_${action}ed`, entity: 'noches',
        entityId: String(id), requestId: context.requestId, ip: context.ip,
      }, client)
      return night
    })
  }

  async createComparsa(actor: AuthenticatedUser, input: CreateComparsaInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const created = await repository.createComparsa(input, client)
        if (!created) throw new Error('Comparsa insert returned no row')
        await audit(actor, context, 'admin.comparsa_created', 'comparsas', String(created.id), undefined, client)
        return created
      })
    } catch (error) { mapDatabaseError(error) }
  }

  async updateComparsa(actor: AuthenticatedUser, id: number, input: UpdateComparsaInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const updated = await repository.updateComparsa(id, input, client)
        if (!updated) throw errors.notFound('Comparsa')
        await audit(actor, context, 'admin.comparsa_updated', 'comparsas', String(id), { changedFields: Object.keys(input) }, client)
        return updated
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }

  async createItem(actor: AuthenticatedUser, input: CreateItemInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const created = await repository.createItem(input, client)
        if (!created) throw new Error('Item insert returned no row')
        await audit(actor, context, 'admin.item_created', 'items', String(created.id), undefined, client)
        return created
      })
    } catch (error) { mapDatabaseError(error) }
  }

  async updateItem(actor: AuthenticatedUser, id: number, input: UpdateItemInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const updated = await repository.updateItem(id, input, client)
        if (!updated) throw errors.notFound('Item')
        await audit(actor, context, 'admin.item_updated', 'items', String(id), { changedFields: Object.keys(input) }, client)
        return updated
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }

  async createAssignment(actor: AuthenticatedUser, input: CreateAssignmentInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const night = await repository.lockNight(input.nocheId, client)
        if (!night) throw errors.notFound('Noche')
        if (!await repository.ensureJuror(input.juradoId, client)) throw errors.validation({ reason: 'invalid_juror' })
        const created = await repository.insertAssignment({ ...input, actorId: actor.id }, client)
        if (!created) throw new Error('Assignment insert returned no row')
        await writeAudit({
          actorUserId: actor.id, actorRole: actor.role, action: 'admin.assignment_created', entity: 'jurado_asignaciones',
          entityId: String(created.id), requestId: context.requestId, ip: context.ip,
          metadata: { jurorId: input.juradoId, nightId: input.nocheId },
        }, client)
        return created
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }

  async replaceAssignment(actor: AuthenticatedUser, id: string, input: ReplaceAssignmentInput, context: Context) {
    try {
      return await withTransaction(async (client) => {
        const current = await repository.lockAssignment(id, client)
        if (!current) throw errors.notFound('Asignación')
        if (current.estado !== 'active') throw new AppError('ASSIGNMENT_INACTIVE', 'La asignación no está activa.', 409)
        await repository.lockNight(Number(current.noche_id), client)
        if (!await repository.ensureJuror(input.replacementJurorId, client)) throw errors.validation({ reason: 'invalid_replacement_juror' })
        await repository.finalizeAssignment(id, actor.id, input.motivo, client)
        const replacement = await repository.insertAssignment({
          juradoId: input.replacementJurorId,
          nocheId: Number(current.noche_id),
          motivo: input.motivo,
          actorId: actor.id,
          replacesId: id,
        }, client)
        if (!replacement) throw new Error('Replacement insert returned no row')
        await writeAudit({
          actorUserId: actor.id, actorRole: actor.role, action: 'admin.assignment_replaced', entity: 'jurado_asignaciones',
          entityId: String(replacement.id), requestId: context.requestId, ip: context.ip,
          metadata: { previousAssignmentId: id, originalJurorId: current.jurado_id, replacementJurorId: input.replacementJurorId },
        }, client)
        return replacement
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      mapDatabaseError(error)
    }
  }
}
