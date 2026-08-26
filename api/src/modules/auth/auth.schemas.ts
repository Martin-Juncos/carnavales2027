import { z } from 'zod'

export const requestOtpSchema = z.object({
  body: z.object({
    identity: z.string().trim().min(3).max(254),
    password: z.string().min(8).max(200),
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
