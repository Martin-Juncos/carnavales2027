import { z } from 'zod'

export const generateActSchema = z.object({
  params: z.object({ nocheId: z.coerce.number().int().positive() }),
  body: z.object({ type: z.enum(['pdf', 'csv']) }).strict(),
})

export const actIdSchema = z.object({ params: z.object({ id: z.uuid() }) })

export const listActsSchema = z.object({
  query: z.object({
    nocheId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
})
