import { randomInt, randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { env } from '../../config/env'
import { withTransaction } from '../../database/pool'
import { AppError } from '../../shared/errors/app-error'
import { hashOtp, hashSessionToken, safeEqualHex, secureToken } from '../../shared/security/crypto'
import { writeAudit } from '../audit/audit.repository'
import * as repository from './auth.repository'
import type { RequestOtpInput, VerifyOtpInput } from './auth.schemas'
import type { AuthenticatedUser } from './auth.types'
import type { OtpDelivery } from './otp-delivery'

interface RequestContext {
  requestId: string
  ip?: string
  userAgent?: string
}

const dummyPasswordHash = argon2.hash('invalid-credential-placeholder')

export class AuthService {
  constructor(private readonly delivery: OtpDelivery) {}

  async requestOtp(input: RequestOtpInput, context: RequestContext): Promise<{ challengeId: string; expiresIn: number }> {
    const user = await repository.findUserByIdentity(input.identity)
    const passwordHash = user?.password_hash ?? (await dummyPasswordHash)
    const validPassword = await argon2.verify(passwordHash, input.password)

    if (!user || !user.activo || !validPassword) {
      await writeAudit({
        action: 'auth.login_failed',
        entity: 'auth',
        requestId: context.requestId,
        ip: context.ip,
        metadata: { reason: 'invalid_credentials' },
      })
      throw new AppError('INVALID_CREDENTIALS', 'Credenciales inválidas.', 401)
    }

    const challengeId = randomUUID()
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000)

    await repository.createChallenge({
      id: challengeId,
      userId: user.id,
      codeHash: hashOtp(challengeId, code),
      expiresAt,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
    })

    try {
      await this.delivery.send(user.email, code)
    } catch (error) {
      await repository.consumeChallenge(challengeId)
      throw error
    }

    await writeAudit({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'auth.otp_requested',
      entity: 'otp_challenge',
      entityId: challengeId,
      requestId: context.requestId,
      ip: context.ip,
    })

    return { challengeId, expiresIn: env.OTP_TTL_MINUTES * 60 }
  }

  async verifyOtp(
    input: VerifyOtpInput,
    context: RequestContext,
  ): Promise<{ token: string; user: AuthenticatedUser; expiresAt: Date }> {
    const outcome = await withTransaction(async (client) => {
      const challenge = await repository.lockChallenge(input.challengeId, client)
      if (!challenge) {
        return { error: new AppError('INVALID_OTP', 'Código inválido.', 401) } as const
      }

      const user = await repository.findUserById(challenge.user_id, client)
      if (!user || !user.activo) {
        return { error: new AppError('INVALID_CREDENTIALS', 'Credenciales inválidas.', 401) } as const
      }
      if (challenge.consumed_at) {
        return { error: new AppError('OTP_ALREADY_USED', 'El código ya fue utilizado.', 401) } as const
      }
      if (challenge.expires_at.getTime() <= Date.now()) {
        await repository.markChallengeConsumed(challenge.id, client)
        return { error: new AppError('OTP_EXPIRED', 'El código expiró.', 401) } as const
      }
      if (challenge.attempts >= challenge.max_attempts) {
        await repository.markChallengeConsumed(challenge.id, client)
        return { error: new AppError('OTP_ATTEMPTS_EXCEEDED', 'Se agotaron los intentos.', 429) } as const
      }

      const validCode = safeEqualHex(challenge.code_hash, hashOtp(challenge.id, input.code))
      if (!validCode) {
        const consume = challenge.attempts + 1 >= challenge.max_attempts
        await repository.registerFailedAttempt(challenge.id, consume, client)
        await writeAudit({
          actorUserId: user.id,
          actorRole: user.role,
          action: 'auth.otp_invalid',
          entity: 'otp_challenge',
          entityId: challenge.id,
          requestId: context.requestId,
          ip: context.ip,
        }, client)
        return {
          error: consume
            ? new AppError('OTP_ATTEMPTS_EXCEEDED', 'Se agotaron los intentos.', 429)
            : new AppError('INVALID_OTP', 'Código inválido.', 401),
        } as const
      }

      await repository.markChallengeConsumed(challenge.id, client)
      const token = secureToken()
      const expiresAt = new Date(Date.now() + env.SESSION_TTL_MINUTES * 60_000)
      const session = await repository.createSession({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        ...(context.ip ? { ip: context.ip } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      }, client)
      await writeAudit({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'auth.login_succeeded',
        entity: 'session',
        entityId: session.id,
        requestId: context.requestId,
        ip: context.ip,
      }, client)

      return {
        value: {
          token,
          expiresAt,
          user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role, sessionId: session.id },
        },
      } as const
    })

    if ('error' in outcome) throw outcome.error
    return outcome.value
  }

  async logout(token: string | undefined, context: RequestContext): Promise<void> {
    if (!token) return
    const revoked = await repository.revokeSession(hashSessionToken(token))
    if (!revoked) return
    await writeAudit({
      actorUserId: revoked.userId,
      action: 'auth.logout',
      entity: 'session',
      entityId: revoked.id,
      requestId: context.requestId,
      ip: context.ip,
    })
  }
}
