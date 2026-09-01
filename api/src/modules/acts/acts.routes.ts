import { Router } from 'express'
import { asyncHandler } from '../../shared/http/async-handler'
import { errors } from '../../shared/errors/app-error'
import { validate, validated } from '../../shared/http/validate'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { actIdSchema, generateActSchema, listActsSchema } from './acts.schemas'
import { ActsService } from './acts.service'

export function createActsRouter(): Router {
  const router = Router()
  const service = new ActsService()
  router.use(requireAuth)
  router.get('/', requireRoles('fiscal', 'escribano', 'admin'), validate(listActsSchema), asyncHandler(async (req, res) => {
    const input = validated<{ query: { nocheId?: number; limit: number } }>(req)
    res.json({ data: await service.list(input.query), meta: {} })
  }))
  router.post('/noche/:nocheId/generar', requireRoles('fiscal', 'escribano', 'admin'), validate(generateActSchema), asyncHandler(async (req, res) => {
    if (!req.auth) throw errors.authRequired()
    const input = validated<{ params: { nocheId: number }; body: { type: 'pdf' | 'csv' } }>(req)
    const data = await service.generate(req.auth, input.params.nocheId, input.body.type, { requestId: req.requestId, ...(req.ip ? { ip: req.ip } : {}) })
    res.status(201).json({ data, meta: {} })
  }))
  router.get('/:id', requireRoles('fiscal', 'escribano', 'admin'), validate(actIdSchema), asyncHandler(async (req, res) => {
    const input = validated<{ params: { id: string } }>(req)
    res.json({ data: await service.get(input.params.id), meta: {} })
  }))
  router.post('/:id/certificar', requireRoles('escribano'), validate(actIdSchema), asyncHandler(async (req, res) => {
    if (!req.auth) throw errors.authRequired()
    const input = validated<{ params: { id: string } }>(req)
    const data = await service.certify(req.auth, input.params.id, { requestId: req.requestId, ...(req.ip ? { ip: req.ip } : {}) })
    res.json({ data, meta: {} })
  }))
  router.get('/:id/verificar', requireRoles('fiscal', 'escribano', 'admin'), validate(actIdSchema), asyncHandler(async (req, res) => {
    const input = validated<{ params: { id: string } }>(req)
    res.json({ data: await service.verify(input.params.id), meta: {} })
  }))
  return router
}
