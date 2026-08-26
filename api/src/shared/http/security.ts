import type { RequestHandler } from 'express'
import { env } from '../../config/env'
import { errors } from '../errors/app-error'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export const enforceTrustedOrigin: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method)) { next(); return; }
  const origin = request.get('origin')
  if (!origin) { next(); return; }
  if (!env.corsOrigins.includes(origin)) { next(errors.forbidden()); return; }
  next()
}
