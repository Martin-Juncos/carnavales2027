import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../shared/http/async-handler'
import { validate, validated } from '../../shared/http/validate'
import { requireAuth, requireRoles } from '../auth/auth.middleware'
import { generalReport, reportByJurorNight, reportByNight } from './scoring.repository'

const jurorNightParams = z.object({ params: z.object({ juradoId: z.uuid(), nocheId: z.coerce.number().int().positive() }) })
const nightParams = z.object({ params: z.object({ nocheId: z.coerce.number().int().positive() }) })

export function createScoringRouter(): Router {
  const router = Router()
  router.use(requireAuth, requireRoles('fiscal', 'escribano', 'admin'))
  router.get('/jurado/:juradoId/noche/:nocheId', validate(jurorNightParams), asyncHandler(async (req, res) => {
    const { params } = validated<{ params: { juradoId: string; nocheId: number } }>(req)
    res.json({ data: await reportByJurorNight(params.juradoId, params.nocheId), meta: {} })
  }))
  router.get('/noche/:nocheId', validate(nightParams), asyncHandler(async (req, res) => {
    const { params } = validated<{ params: { nocheId: number } }>(req)
    res.json({ data: await reportByNight(params.nocheId), meta: {} })
  }))
  router.get('/general', asyncHandler(async (_req, res) => {
    res.json({ data: await generalReport(), meta: { tieBreakApplied: false } })
  }))
  return router
}
