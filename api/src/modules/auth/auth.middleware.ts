import type { RequestHandler } from 'express'
import { env } from '../../config/env'
import { AppError, errors } from '../../shared/errors/app-error'
import { asyncHandler } from '../../shared/http/async-handler'
import { hashSessionToken } from '../../shared/security/crypto'
import * as repository from './auth.repository'
import type { Role } from './auth.types'

export function sessionToken(request: Express.Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined
  const value = cookies?.[env.SESSION_COOKIE_NAME]
  return typeof value === 'string' ? value : undefined
}

export const requireAuth: RequestHandler = asyncHandler(async (request, _response, next) => {
  const token = sessionToken(request)
  if (!token) throw errors.authRequired()

  const session = await repository.findSession(hashSessionToken(token))
  if (!session || session.revoked_at) throw errors.authRequired()

  const idleDeadline = session.last_seen_at.getTime() + env.SESSION_IDLE_TIMEOUT_MINUTES * 60_000
  if (session.expires_at.getTime() <= Date.now() || idleDeadline <= Date.now()) {
    await repository.revokeSession(hashSessionToken(token))
    throw new AppError('SESSION_EXPIRED', 'La sesión expiró.', 401)
  }

  const user = await repository.findUserById(session.user_id)
  if (!user || !user.activo) {
    await repository.revokeSession(hashSessionToken(token))
    throw errors.authRequired()
  }

  request.auth = { id: user.id, nombre: user.nombre, email: user.email, role: user.role, sessionId: session.id }
  await repository.touchSession(session.id)
  next()
})

export function requireRoles(...allowed: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) { next(errors.authRequired()); return; }
    if (!allowed.includes(request.auth.role)) { next(errors.forbidden()); return; }
    next()
  }
}
