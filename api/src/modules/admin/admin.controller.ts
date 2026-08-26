import type { Request, Response } from 'express'
import { errors } from '../../shared/errors/app-error'
import { asyncHandler } from '../../shared/http/async-handler'
import { validated } from '../../shared/http/validate'
import type {
  CreateAssignmentInput,
  CreateComparsaInput,
  CreateItemInput,
  CreateNightInput,
  CreateUserInput,
  ReplaceAssignmentInput,
  UpdateComparsaInput,
  UpdateItemInput,
  UpdateNightInput,
  UpdateUserInput,
} from './admin.schemas'
import { AdminService } from './admin.service'

interface Body<T> { body: T }
interface Id<T, B = never> { params: { id: T }; body: B }

function actor(request: Request) {
  if (!request.auth) throw errors.authRequired()
  return request.auth
}

function context(request: Request) {
  return { requestId: request.requestId, ...(request.ip ? { ip: request.ip } : {}) }
}

function ok(response: Response, data: unknown) {
  response.json({ data, meta: {} })
}

export function createAdminController(service = new AdminService()) {
  return {
    listUsers: asyncHandler(async (_req, res) => { ok(res, await service.listUsers()); }),
    createUser: asyncHandler(async (req, res) => {
      const data = await service.createUser(actor(req), validated<Body<CreateUserInput>>(req).body, context(req))
      res.status(201).json({ data, meta: {} })
    }),
    updateUser: asyncHandler(async (req, res) => {
      const input = validated<Id<string, UpdateUserInput>>(req)
      ok(res, await service.updateUser(actor(req), input.params.id, input.body, context(req)))
    }),
    listNights: asyncHandler(async (_req, res) => { ok(res, await service.listNights()); }),
    createNight: asyncHandler(async (req, res) => {
      const data = await service.createNight(actor(req), validated<Body<CreateNightInput>>(req).body, context(req))
      res.status(201).json({ data, meta: {} })
    }),
    updateNight: asyncHandler(async (req, res) => {
      const input = validated<Id<number, UpdateNightInput>>(req)
      ok(res, await service.updateNight(actor(req), input.params.id, input.body, context(req)))
    }),
    openNight: asyncHandler(async (req, res) => {
      const input = validated<Id<number>>(req)
      ok(res, await service.transitionNight(actor(req), input.params.id, 'open', context(req)))
    }),
    closeNight: asyncHandler(async (req, res) => {
      const input = validated<Id<number>>(req)
      ok(res, await service.transitionNight(actor(req), input.params.id, 'close', context(req)))
    }),
    listComparsas: asyncHandler(async (_req, res) => { ok(res, await service.listComparsas()); }),
    createComparsa: asyncHandler(async (req, res) => {
      const data = await service.createComparsa(actor(req), validated<Body<CreateComparsaInput>>(req).body, context(req))
      res.status(201).json({ data, meta: {} })
    }),
    updateComparsa: asyncHandler(async (req, res) => {
      const input = validated<Id<number, UpdateComparsaInput>>(req)
      ok(res, await service.updateComparsa(actor(req), input.params.id, input.body, context(req)))
    }),
    listItems: asyncHandler(async (_req, res) => { ok(res, await service.listItems()); }),
    createItem: asyncHandler(async (req, res) => {
      const data = await service.createItem(actor(req), validated<Body<CreateItemInput>>(req).body, context(req))
      res.status(201).json({ data, meta: {} })
    }),
    updateItem: asyncHandler(async (req, res) => {
      const input = validated<Id<number, UpdateItemInput>>(req)
      ok(res, await service.updateItem(actor(req), input.params.id, input.body, context(req)))
    }),
    listAssignments: asyncHandler(async (_req, res) => { ok(res, await service.listAssignments()); }),
    createAssignment: asyncHandler(async (req, res) => {
      const data = await service.createAssignment(actor(req), validated<Body<CreateAssignmentInput>>(req).body, context(req))
      res.status(201).json({ data, meta: {} })
    }),
    replaceAssignment: asyncHandler(async (req, res) => {
      const input = validated<Id<string, ReplaceAssignmentInput>>(req)
      ok(res, await service.replaceAssignment(actor(req), input.params.id, input.body, context(req)))
    }),
  }
}
