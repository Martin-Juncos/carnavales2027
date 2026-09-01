import { z } from 'zod'

export const createPenaltySchema = z.object({
  body: z.object({
    comparsaId: z.coerce.number().int().positive(),
    puntos: z.coerce.number().int().positive(),
    motivoCodigo: z.string().trim().min(1).max(50).optional(),
    motivoDescripcion: z.string().trim().min(3).max(2000),
  }).strict(),
})

export const annulPenaltySchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({ motivo: z.string().trim().min(3).max(2000) }).strict(),
})

export const listPenaltiesSchema = z.object({
  query: z.object({
    nocheId: z.coerce.number().int().positive().optional(),
    estado: z.enum(['active', 'annulled']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
})

export type CreatePenaltyInput = z.infer<typeof createPenaltySchema>['body']
export type AnnulPenaltyInput = z.infer<typeof annulPenaltySchema>['body']
export type ListPenaltiesInput = z.infer<typeof listPenaltiesSchema>['query']
