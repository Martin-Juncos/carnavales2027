import { z } from 'zod'
import { roles } from '../auth/auth.types'

const uuidParams = z.object({ id: z.uuid() })
const numericParams = z.object({ id: z.coerce.number().int().positive() })

const createUserBody = z.object({
  nombre: z.string().trim().min(2).max(150),
  dni: z.string().trim().min(5).max(20),
  email: z.email(),
  role: z.enum(roles),
  activo: z.boolean().default(true),
}).strict()

const updateUserBody = createUserBody.omit({ dni: true }).partial().refine((value) => Object.keys(value).length > 0)
const createNightBody = z.object({ nombre: z.string().trim().min(2).max(50), fecha: z.iso.date() }).strict()
const updateNightBody = createNightBody.partial().refine((value) => Object.keys(value).length > 0)
const createComparsaBody = z.object({
  nombre: z.string().trim().min(2).max(150),
  nocheId: z.coerce.number().int().positive(),
  orden: z.coerce.number().int().positive(),
  activo: z.boolean().default(true),
}).strict()
const updateComparsaBody = z.object({
  orden: z.coerce.number().int().positive(),
}).strict()
const reorderComparsasBody = z.object({
  comparsas: z.array(z.object({
    comparsaId: z.coerce.number().int().positive(),
    orden: z.coerce.number().int().positive(),
  }).strict()).min(1),
}).strict()
const createItemBody = z.object({
  nombre: z.string().trim().min(2).max(200),
  parentItemId: z.coerce.number().int().positive().nullable().optional(),
  orden: z.coerce.number().int().positive(),
  activo: z.boolean().default(true),
}).strict()
const updateItemBody = createItemBody.partial().refine((value) => Object.keys(value).length > 0)

export const createUserSchema = z.object({ body: createUserBody })
export const updateUserSchema = z.object({ params: uuidParams, body: updateUserBody })
export const createNightSchema = z.object({ body: createNightBody })
export const updateNightSchema = z.object({ params: numericParams, body: updateNightBody })
export const createComparsaSchema = z.object({ body: createComparsaBody })
export const updateComparsaSchema = z.object({ params: numericParams, body: updateComparsaBody })
export const reorderComparsasSchema = z.object({ params: numericParams, body: reorderComparsasBody })
export const createItemSchema = z.object({ body: createItemBody })
export const updateItemSchema = z.object({ params: numericParams, body: updateItemBody })
export const numericIdSchema = z.object({ params: numericParams })
export const uuidIdSchema = z.object({ params: uuidParams })

export const createAssignmentSchema = z.object({
  body: z.object({
    juradoId: z.uuid(),
    nocheId: z.coerce.number().int().positive(),
    motivo: z.string().trim().min(3).max(1000).optional(),
  }).strict(),
})

export const replaceAssignmentSchema = z.object({
  params: uuidParams,
  body: z.object({
    replacementJurorId: z.uuid(),
    motivo: z.string().trim().min(3).max(1000),
  }).strict(),
})

export type CreateUserInput = z.infer<typeof createUserBody>
export type UpdateUserInput = z.infer<typeof updateUserBody>
export type CreateNightInput = z.infer<typeof createNightBody>
export type UpdateNightInput = z.infer<typeof updateNightBody>
export type CreateComparsaInput = z.infer<typeof createComparsaBody>
export type UpdateComparsaInput = z.infer<typeof updateComparsaBody>
export type ReorderComparsasInput = z.infer<typeof reorderComparsasBody>
export type CreateItemInput = z.infer<typeof createItemBody>
export type UpdateItemInput = z.infer<typeof updateItemBody>
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>['body']
export type ReplaceAssignmentInput = z.infer<typeof replaceAssignmentSchema>['body']
