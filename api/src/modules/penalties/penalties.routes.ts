import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { validate, validated } from '../../shared/http/validate'
import { asyncHandler } from '../../shared/http/async-handler'
import { errors } from '../../shared/errors/app-error'
import { annulPenaltySchema, createPenaltySchema, type AnnulPenaltyInput, type CreatePenaltyInput } from './penalties.schemas'
import { PenaltiesService } from './penalties.service'

export function createPenaltiesRouter(): Router {
  const router = Router()
  const service = new PenaltiesService()
  router.use(requireAuth)
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
