import { z } from 'zod'

export const requestOtpSchema = z.object({
  body: z.object({
    nombre: z.string().trim().min(2).max(150),
    email: z.email(),
    dni: z.string().trim().min(5).max(20),
  }).strict(),
})

export const verifyOtpSchema = z.object({
  body: z.object({
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/),
  }).strict(),
})

export type RequestOtpInput = z.infer<typeof requestOtpSchema>['body']
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body']
