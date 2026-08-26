import type { ErrorRequestHandler, RequestHandler } from 'express'
import type { DatabaseError } from 'pg'
import { ZodError } from 'zod'
import { logger } from '../../config/logger'
import { AppError, errors } from '../errors/app-error'

function databaseError(error: unknown): AppError | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const dbError = error as DatabaseError
  if (dbError.code === '23505') return errors.conflict('IDEMPOTENCY_CONFLICT', 'La operación viola una restricción de unicidad.')
  if (dbError.code === '23503' || dbError.code === '23514' || dbError.code === '22P02') return errors.validation()
  if (dbError.code === 'P0001' && dbError.message.includes('JUDGE_CAPACITY_EXCEEDED')) {
    return new AppError('JUDGE_CAPACITY_EXCEEDED', 'La noche ya tiene tres jurados activos.', 409)
  }
  return undefined
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError('RESOURCE_NOT_FOUND', 'Ruta no encontrada.', 404))
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const normalized = error instanceof ZodError
    ? errors.validation(error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })))
    : error instanceof AppError
      ? error
      : databaseError(error) ?? new AppError('INTERNAL_ERROR', 'Ocurrió un error interno.', 500, undefined, true)

  if (normalized.status >= 500) {
    logger.error({ error, requestId: request.requestId }, 'Unhandled request error')
  }

  response.status(normalized.status).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      requestId: request.requestId,
      retryable: normalized.retryable,
      ...(normalized.details === undefined ? {} : { details: normalized.details }),
    },
  })
}
