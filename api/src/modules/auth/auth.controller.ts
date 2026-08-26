import type { Request } from 'express'
import { env } from '../../config/env'
import { asyncHandler } from '../../shared/http/async-handler'
import { validated } from '../../shared/http/validate'
import type { RequestOtpInput, VerifyOtpInput } from './auth.schemas'
import type { AuthService } from './auth.service'
import { sessionToken } from './auth.middleware'

interface Body<T> { body: T }

function context(request: Request) {
  const userAgent = request.get('user-agent')
  return {
    requestId: request.requestId,
    ...(request.ip ? { ip: request.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  }
}

export function createAuthController(service: AuthService) {
  return {
    requestOtp: asyncHandler(async (request, response) => {
      const input = validated<Body<RequestOtpInput>>(request).body
      const result = await service.requestOtp(input, context(request))
      response.status(202).json({ data: result, meta: {} })
    }),

    verifyOtp: asyncHandler(async (request, response) => {
      const input = validated<Body<VerifyOtpInput>>(request).body
      const result = await service.verifyOtp(input, context(request))
      response.cookie(env.SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: env.SESSION_TTL_MINUTES * 60_000,
        path: '/',
      })
      response.status(200).json({
        data: { user: result.user, expiresAt: result.expiresAt.toISOString() },
        meta: {},
      })
    }),

    logout: asyncHandler(async (request, response) => {
      await service.logout(sessionToken(request), context(request))
      response.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
      response.status(204).send()
    }),

    me: asyncHandler((request, response) => {
      response.json({ data: { user: request.auth }, meta: {} })
    }),
  }
}
