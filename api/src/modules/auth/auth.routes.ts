import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../../config/env'
import { AppError } from '../../shared/errors/app-error'
import { validate } from '../../shared/http/validate'
import { createAuthController } from './auth.controller'
import { requireAuth } from './auth.middleware'
import { requestOtpSchema, verifyOtpSchema } from './auth.schemas'
import { AuthService } from './auth.service'
import { SmtpOtpDelivery, type OtpDelivery } from './otp-delivery'

export function createAuthRouter(delivery: OtpDelivery = new SmtpOtpDelivery()): Router {
  const router = Router()
  const controller = createAuthController(new AuthService(delivery))
  const limiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => { next(new AppError('RATE_LIMITED', 'Demasiados intentos.', 429)); },
  })

  router.post('/login', limiter, validate(requestOtpSchema), controller.requestOtp)
  router.post('/otp/request', limiter, validate(requestOtpSchema), controller.requestOtp)
  router.post('/otp/verify', limiter, validate(verifyOtpSchema), controller.verifyOtp)
  router.post('/logout', requireAuth, controller.logout)
  router.get('/me', requireAuth, controller.me)
  return router
}
