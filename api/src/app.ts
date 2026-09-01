import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import { query } from './database/pool'
import { createActsRouter } from './modules/acts/acts.routes'
import { createAdminRouter } from './modules/admin/admin.routes'
import { createAuditRouter } from './modules/audit/audit.routes'
import { createAuthRouter } from './modules/auth/auth.routes'
import type { OtpDelivery } from './modules/auth/otp-delivery'
import { createJuradoRouter } from './modules/jurado/jurado.routes'
import { createPenaltiesRouter } from './modules/penalties/penalties.routes'
import { createScoringRouter } from './modules/scoring/scoring.routes'
import { createSupervisionRouter } from './modules/supervision/supervision.routes'
import { openApiDocument } from './openapi/document'
import { AppError } from './shared/errors/app-error'
import { asyncHandler } from './shared/http/async-handler'
import { errorHandler, notFoundHandler } from './shared/http/error-handler'
import { exposeRequestId, requestContext } from './shared/http/request-context'
import { enforceTrustedOrigin } from './shared/http/security'

interface AppDependencies { otpDelivery?: OtpDelivery }

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)
  app.use(requestContext, exposeRequestId)
  app.use(helmet())
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) { callback(null, true); return; }
      callback(new AppError('FORBIDDEN', 'Origen no permitido.', 403))
    },
  }))
  app.use(express.json({ limit: env.BODY_LIMIT }))
  app.use(cookieParser())
  app.use(enforceTrustedOrigin)
  app.get('/health', asyncHandler(async (_request, response) => {
    await query('SELECT 1')
    response.json({ data: { status: 'ok' }, meta: {} })
  }))
  app.use(rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => { next(new AppError('RATE_LIMITED', 'Demasiadas solicitudes.', 429)); },
  }))

  app.get('/openapi.json', (_request, response) => response.json(openApiDocument))
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))

  const api = express.Router()
  api.use('/auth', createAuthRouter(dependencies.otpDelivery))
  api.use('/jurado', createJuradoRouter())
  api.use('/admin', createAdminRouter())
  api.use('/supervision', createSupervisionRouter())
  api.use('/reportes', createScoringRouter())
  api.use('/penalizaciones', createPenaltiesRouter())
  api.use('/actas', createActsRouter())
  api.use('/audit', createAuditRouter())
  app.use(env.API_PREFIX, api)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
