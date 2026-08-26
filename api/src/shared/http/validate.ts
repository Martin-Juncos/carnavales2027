import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export function validate(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    request.validated = schema.parse({
      body: request.body as unknown,
      params: request.params,
      query: request.query,
      headers: request.headers,
    })
    next()
  }
}

export function validated<T>(request: Express.Request): T {
  return request.validated as T
}
