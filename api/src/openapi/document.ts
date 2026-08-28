import { OpenAPIRegistry, OpenApiGeneratorV31, type RouteConfig } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { env } from '../config/env'
import { requestOtpSchema, verifyOtpSchema } from '../modules/auth/auth.schemas'
import { closeComparsaSchema, createVoteSchema, nightIdSchema, syncSchema } from '../modules/jurado/jurado.schemas'
import { annulPenaltySchema, createPenaltySchema } from '../modules/penalties/penalties.schemas'
import {
  createAssignmentSchema,
  createComparsaSchema,
  createItemSchema,
  createNightSchema,
  createUserSchema,
  numericIdSchema,
  replaceAssignmentSchema,
  reorderComparsasSchema,
  updateComparsaSchema,
  updateItemSchema,
  updateNightSchema,
  updateUserSchema,
  uuidIdSchema,
} from '../modules/admin/admin.schemas'
import { actIdSchema, generateActSchema } from '../modules/acts/acts.schemas'

const registry = new OpenAPIRegistry()
registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: env.SESSION_COOKIE_NAME,
})

const successSchema = z.object({ data: z.unknown(), meta: z.record(z.string(), z.unknown()) })
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.uuid(),
    retryable: z.boolean().optional(),
    details: z.unknown().optional(),
  }),
})

function responses(created = false) {
  return {
    [created ? 201 : 200]: {
      description: created ? 'Creado' : 'Operación exitosa',
      content: { 'application/json': { schema: successSchema } },
    },
    400: { description: 'Solicitud inválida', content: { 'application/json': { schema: errorSchema } } },
    401: { description: 'Autenticación requerida', content: { 'application/json': { schema: errorSchema } } },
    403: { description: 'No autorizado', content: { 'application/json': { schema: errorSchema } } },
    409: { description: 'Conflicto', content: { 'application/json': { schema: errorSchema } } },
    422: { description: 'Regla de negocio incumplida', content: { 'application/json': { schema: errorSchema } } },
  }
}

type Method = 'get' | 'post' | 'patch' | 'delete'
type RequestConfig = NonNullable<RouteConfig['request']>
interface RouteDefinition {
  method: Method
  path: string
  summary: string
  request?: {
    body?: z.ZodType
    params?: RequestConfig['params']
    query?: RequestConfig['query']
  }
  created?: boolean
  secured?: boolean
  requestExample?: unknown
}

function route(definition: RouteDefinition) {
  const request = definition.request
    ? {
        ...(definition.request.params ? { params: definition.request.params } : {}),
        ...(definition.request.query ? { query: definition.request.query } : {}),
        ...(definition.request.body
          ? {
              body: {
                content: {
                  'application/json': {
                    schema: definition.request.body,
                    ...(definition.requestExample === undefined ? {} : { example: definition.requestExample }),
                  },
                },
              },
            }
          : {}),
      }
    : undefined

  registry.registerPath({
    method: definition.method,
    path: definition.path,
    summary: definition.summary,
    ...(definition.secured === false ? {} : { security: [{ sessionCookie: [] }] }),
    ...(request ? { request } : {}),
    responses: responses(definition.created),
  })
}

route({
  method: 'post',
  path: '/auth/login',
  summary: 'Validar credenciales y solicitar OTP',
  request: { body: requestOtpSchema.shape.body },
  requestExample: { nombre: 'Martín Juncos', email: 'jurado@example.com', dni: '25609038' },
  secured: false,
})
route({ method: 'post', path: '/auth/otp/request', summary: 'Solicitar desafío OTP', request: { body: requestOtpSchema.shape.body }, secured: false })
route({ method: 'post', path: '/auth/otp/verify', summary: 'Verificar OTP y crear sesión', request: { body: verifyOtpSchema.shape.body }, secured: false })
route({ method: 'post', path: '/auth/logout', summary: 'Revocar sesión' })
route({ method: 'get', path: '/auth/me', summary: 'Recuperar sesión actual' })
route({ method: 'get', path: '/jurado/noches', summary: 'Listar noches creadas para selección del jurado' })
route({ method: 'get', path: '/jurado/noches/{nocheId}/contexto', summary: 'Obtener contexto de la noche elegida', request: { params: nightIdSchema.shape.params } })
route({ method: 'get', path: '/jurado/contexto', summary: 'Obtener contexto por asignación activa heredada' })
route({ method: 'get', path: '/jurado/votos', summary: 'Reconciliar votos del jurado' })
route({
  method: 'post',
  path: '/jurado/votos',
  summary: 'Confirmar voto idempotente',
  request: { body: createVoteSchema.shape.body },
  requestExample: {
    operationUuid: 'f2b6cb41-6f38-4728-ae30-c82d03c6996a',
    comparsaId: 1,
    itemId: 10,
    valor: 4,
    clientCreatedAt: '2027-02-06T22:00:00-03:00',
  },
  created: true,
})
route({ method: 'post', path: '/jurado/comparsas/{id}/cerrar', summary: 'Cerrar comparsa', request: { params: closeComparsaSchema.shape.params, body: closeComparsaSchema.shape.body }, created: true })
route({ method: 'post', path: '/jurado/sync/reconcile', summary: 'Procesar lote offline', request: { body: syncSchema.shape.body } })

const adminRoutes: RouteDefinition[] = [
  { method: 'get', path: '/admin/users', summary: 'Listar usuarios' },
  { method: 'post', path: '/admin/users', summary: 'Crear usuario', request: { body: createUserSchema.shape.body }, created: true },
  { method: 'patch', path: '/admin/users/{id}', summary: 'Actualizar usuario', request: { params: updateUserSchema.shape.params, body: updateUserSchema.shape.body } },
  { method: 'delete', path: '/admin/users/{id}', summary: 'Dar de baja usuario', request: { params: uuidIdSchema.shape.params } },
  { method: 'get', path: '/admin/noches', summary: 'Listar noches' },
  { method: 'post', path: '/admin/noches', summary: 'Crear noche', request: { body: createNightSchema.shape.body }, created: true },
  { method: 'patch', path: '/admin/noches/{id}', summary: 'Actualizar noche', request: { params: updateNightSchema.shape.params, body: updateNightSchema.shape.body } },
  { method: 'delete', path: '/admin/noches/{id}', summary: 'Borrar noche sin evidencia asociada', request: { params: numericIdSchema.shape.params } },
  { method: 'post', path: '/admin/noches/{id}/abrir', summary: 'Abrir noche' },
  { method: 'post', path: '/admin/noches/{id}/cerrar', summary: 'Cerrar noche' },
  { method: 'get', path: '/admin/comparsas', summary: 'Listar comparsas' },
  { method: 'post', path: '/admin/comparsas', summary: 'Crear comparsa', request: { body: createComparsaSchema.shape.body }, created: true },
  { method: 'patch', path: '/admin/comparsas/{id}', summary: 'Actualizar comparsa', request: { params: updateComparsaSchema.shape.params, body: updateComparsaSchema.shape.body } },
  { method: 'delete', path: '/admin/comparsas/{id}', summary: 'Dar de baja comparsa', request: { params: numericIdSchema.shape.params } },
  { method: 'patch', path: '/admin/noches/{id}/comparsas/orden', summary: 'Actualizar orden de comparsas de una noche', request: { params: reorderComparsasSchema.shape.params, body: reorderComparsasSchema.shape.body } },
  { method: 'get', path: '/admin/items', summary: 'Listar items' },
  { method: 'post', path: '/admin/items', summary: 'Crear item', request: { body: createItemSchema.shape.body }, created: true },
  { method: 'patch', path: '/admin/items/{id}', summary: 'Actualizar item', request: { params: updateItemSchema.shape.params, body: updateItemSchema.shape.body } },
  { method: 'delete', path: '/admin/items/{id}', summary: 'Dar de baja item', request: { params: numericIdSchema.shape.params } },
  { method: 'get', path: '/admin/asignaciones', summary: 'Listar asignaciones' },
  { method: 'post', path: '/admin/asignaciones', summary: 'Asignar jurado', request: { body: createAssignmentSchema.shape.body }, created: true },
  { method: 'post', path: '/admin/asignaciones/{id}/reemplazar', summary: 'Reemplazar jurado', request: { params: replaceAssignmentSchema.shape.params, body: replaceAssignmentSchema.shape.body } },
]
adminRoutes.forEach(route)

route({ method: 'get', path: '/supervision/noches/{id}/estado', summary: 'Consultar avance de noche' })
route({ method: 'get', path: '/supervision/eventos', summary: 'Consultar eventos por cursor' })
route({ method: 'get', path: '/reportes/jurado/{juradoId}/noche/{nocheId}', summary: 'Planilla de jurado' })
route({ method: 'get', path: '/reportes/noche/{nocheId}', summary: 'Planilla de noche' })
route({ method: 'get', path: '/reportes/general', summary: 'Planilla general' })
route({ method: 'post', path: '/penalizaciones', summary: 'Registrar penalización', request: { body: createPenaltySchema.shape.body }, created: true })
route({ method: 'post', path: '/penalizaciones/{id}/anular', summary: 'Anular penalización', request: { params: annulPenaltySchema.shape.params, body: annulPenaltySchema.shape.body } })
route({ method: 'post', path: '/actas/noche/{nocheId}/generar', summary: 'Generar acta PDF/CSV', request: { params: generateActSchema.shape.params, body: generateActSchema.shape.body }, created: true })
route({ method: 'get', path: '/actas/{id}', summary: 'Consultar acta', request: { params: actIdSchema.shape.params } })
route({ method: 'post', path: '/actas/{id}/certificar', summary: 'Certificar acta', request: { params: actIdSchema.shape.params } })
route({ method: 'get', path: '/actas/{id}/verificar', summary: 'Verificar hash de acta', request: { params: actIdSchema.shape.params } })
route({ method: 'get', path: '/audit', summary: 'Consultar auditoría' })

const generator = new OpenApiGeneratorV31(registry.definitions)
export const openApiDocument = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Carnavales 2027 API',
    version: '0.1.0',
    description: 'API transaccional, idempotente y auditable del sistema de votación.',
  },
  servers: [{ url: env.API_PREFIX }],
})
