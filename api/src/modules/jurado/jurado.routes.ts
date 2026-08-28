import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { validate } from '../../shared/http/validate'
import { closeComparsaSchema, createVoteSchema, nightIdSchema, syncSchema } from './jurado.schemas'
import { createJuradoController } from './jurado.controller'

export function createJuradoRouter(): Router {
  const router = Router()
  const controller = createJuradoController()
  router.use(requireAuth, requireRoles('jurado'))
  router.get('/noches', controller.nights)
  router.get('/noches/:nocheId/contexto', validate(nightIdSchema), controller.nightContext)
  router.get('/contexto', controller.context)
  router.get('/votos', controller.listVotes)
  router.post('/votos', validate(createVoteSchema), controller.createVote)
  router.post('/comparsas/:id/cerrar', validate(closeComparsaSchema), controller.closeComparsa)
  router.post('/sync/reconcile', validate(syncSchema), controller.reconcile)
  return router
}
