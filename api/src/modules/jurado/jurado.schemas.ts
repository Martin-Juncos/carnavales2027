import { z } from 'zod'

export const voteBodySchema = z.object({
  operationUuid: z.uuid(),
  comparsaId: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
  valor: z.number().int().min(0).max(5),
  clientCreatedAt: z.iso.datetime({ offset: true }),
}).strict()

export const createVoteSchema = z.object({ body: voteBodySchema })

export const closeComparsaBodySchema = z.object({
  operationUuid: z.uuid(),
  clientCreatedAt: z.iso.datetime({ offset: true }),
}).strict()

export const closeComparsaSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: closeComparsaBodySchema,
})

const syncOperationSchema = z.discriminatedUnion('type', [
  z.object({ operationId: z.uuid(), type: z.literal('vote'), payload: voteBodySchema.omit({ operationUuid: true }) }),
  z.object({
    operationId: z.uuid(),
    type: z.literal('close_comparsa'),
    payload: closeComparsaBodySchema.omit({ operationUuid: true }).extend({ comparsaId: z.coerce.number().int().positive() }),
  }),
])

export const syncSchema = z.object({
  body: z.object({
    deviceId: z.uuid(),
    operations: z.array(syncOperationSchema).min(1).max(100),
  }).strict(),
})

export type VoteInput = z.infer<typeof voteBodySchema>
export type CloseComparsaInput = z.infer<typeof closeComparsaBodySchema> & { comparsaId: number }
export type SyncInput = z.infer<typeof syncSchema>['body']
