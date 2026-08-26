import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'
import pinoHttp from 'pino-http'
import { z } from 'zod'
import { logger } from '../../config/logger'

const uuid = z.uuid()

export const requestContext: RequestHandler = pinoHttp({
  logger,
  genReqId(request, response) {
    const incoming = request.headers['x-request-id']
    const requestId = typeof incoming === 'string' && uuid.safeParse(incoming).success ? incoming : randomUUID()
    response.setHeader('x-request-id', requestId)
    return requestId
  },
  customProps(request) {
    return typeof request.id === 'string' || typeof request.id === 'number'
      ? { requestId: request.id }
      : {}
  },
})

export const exposeRequestId: RequestHandler = (request, _response, next) => {
  request.requestId = typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : randomUUID()
  next()
}
