import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { validate, validated } from '../../shared/http/validate'
import { asyncHandler } from '../../shared/http/async-handler'
import { errors } from '../../shared/errors/app-error'
import { annulPenaltySchema, createPenaltySchema, listPenaltiesSchema, type AnnulPenaltyInput, type CreatePenaltyInput, type ListPenaltiesInput } from './penalties.schemas'
import { PenaltiesService } from './penalties.service'

export function createPenaltiesRouter(): Router {
  const router = Router()
  const service = new PenaltiesService()
  router.use(requireAuth)
  router.get('/', requireRoles('fiscal', 'escribano', 'admin'), validate(listPenaltiesSchema), asyncHandler(async (req, res) => {
    const input = validated<{ query: ListPenaltiesInput }>(req)
    res.json({ data: await service.list(input.query), meta: {} })
  }))
  router.post('/', requireRoles('fiscal', 'escribano'), validate(createPenaltySchema), asyncHandler(async (req, res) => {
    if (!req.auth) throw errors.authRequired()
    const input = validated<{ body: CreatePenaltyInput }>(req)
    const data = await service.create(req.auth, input.body, { requestId: req.requestId, ...(req.ip ? { ip: req.ip } : {}) })
    res.status(201).json({ data, meta: {} })
  }))
  router.post('/:id/anular', requireRoles('escribano'), validate(annulPenaltySchema), asyncHandler(async (req, res) => {
    if (!req.auth) throw errors.authRequired()
    const input = validated<{ params: { id: string }; body: AnnulPenaltyInput }>(req)
    const data = await service.annul(req.auth, input.params.id, input.body, { requestId: req.requestId, ...(req.ip ? { ip: req.ip } : {}) })
    res.json({ data, meta: {} })
  }))
  return router
}
