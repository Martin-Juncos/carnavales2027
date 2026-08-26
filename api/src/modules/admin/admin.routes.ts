import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { validate } from '../../shared/http/validate'
import {
  createAssignmentSchema,
  createComparsaSchema,
  createItemSchema,
  createNightSchema,
  createUserSchema,
  numericIdSchema,
  replaceAssignmentSchema,
  updateComparsaSchema,
  updateItemSchema,
  updateNightSchema,
  updateUserSchema,
} from './admin.schemas'
import { createAdminController } from './admin.controller'

export function createAdminRouter(): Router {
  const router = Router()
  const controller = createAdminController()
  router.use(requireAuth, requireRoles('admin'))

  router.get('/users', controller.listUsers)
  router.post('/users', validate(createUserSchema), controller.createUser)
  router.patch('/users/:id', validate(updateUserSchema), controller.updateUser)
  router.get('/noches', controller.listNights)
  router.post('/noches', validate(createNightSchema), controller.createNight)
  router.patch('/noches/:id', validate(updateNightSchema), controller.updateNight)
  router.post('/noches/:id/abrir', validate(numericIdSchema), controller.openNight)
  router.post('/noches/:id/cerrar', validate(numericIdSchema), controller.closeNight)
  router.get('/comparsas', controller.listComparsas)
  router.post('/comparsas', validate(createComparsaSchema), controller.createComparsa)
  router.patch('/comparsas/:id', validate(updateComparsaSchema), controller.updateComparsa)
  router.get('/items', controller.listItems)
  router.post('/items', validate(createItemSchema), controller.createItem)
  router.patch('/items/:id', validate(updateItemSchema), controller.updateItem)
  router.get('/asignaciones', controller.listAssignments)
  router.post('/asignaciones', validate(createAssignmentSchema), controller.createAssignment)
  router.post('/asignaciones/:id/reemplazar', validate(replaceAssignmentSchema), controller.replaceAssignment)
  return router
}
