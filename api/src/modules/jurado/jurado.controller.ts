import type { Request } from 'express'
import { errors } from '../../shared/errors/app-error'
import { asyncHandler } from '../../shared/http/async-handler'
import { validated } from '../../shared/http/validate'
import type { CloseComparsaInput, SyncInput, VoteInput } from './jurado.schemas'
import { JuradoService } from './jurado.service'
import { SyncService } from './sync.service'

interface Body<T> { body: T }
interface CloseRequest { params: { id: number }; body: Omit<CloseComparsaInput, 'comparsaId'> }

function user(request: Request) {
  if (!request.auth) throw errors.authRequired()
  return request.auth
}

function context(request: Request) {
  return {
    requestId: request.requestId,
    ...(request.ip ? { ip: request.ip } : {}),
  }
}

export function createJuradoController(service = new JuradoService()) {
  const sync = new SyncService(service)
  return {
    context: asyncHandler(async (request, response) => {
      response.json({ data: await service.context(user(request)), meta: {} })
    }),

    listVotes: asyncHandler(async (request, response) => {
      response.json({ data: await service.listVotes(user(request)), meta: {} })
    }),

    createVote: asyncHandler(async (request, response) => {
      const input = validated<Body<VoteInput>>(request).body
      const result = await service.createVote(user(request), input, context(request))
      response.status(result.replayed ? 200 : 201).json({ data: result.vote, meta: { replayed: result.replayed } })
    }),

    closeComparsa: asyncHandler(async (request, response) => {
      const input = validated<CloseRequest>(request)
      const result = await service.closeComparsa(
        user(request),
        { ...input.body, comparsaId: input.params.id },
        context(request),
      )
      response.status(result.replayed ? 200 : 201).json({ data: result.close, meta: { replayed: result.replayed } })
    }),

    reconcile: asyncHandler(async (request, response) => {
      const input = validated<Body<SyncInput>>(request).body
      const results = await sync.reconcile(user(request), input, context(request))
      response.json({ data: { operations: results }, meta: { count: results.length } })
    }),
  }
}
