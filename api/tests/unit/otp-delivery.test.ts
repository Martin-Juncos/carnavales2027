import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  resendSend: vi.fn(),
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    OTP_DEV_LOG: false,
    RESEND_API_KEY: undefined as string | undefined,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: undefined as string | undefined,
    SMTP_PASSWORD: undefined as string | undefined,
    MAIL_FROM: 'no-reply@carnavales2027.local',
  },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mocks.sendMail }),
  },
}))

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function Resend() {
    return { emails: { send: mocks.resendSend } }
  }),
}))

vi.mock('../../src/config/env', () => ({
  env: mocks.env,
}))

import { SmtpOtpDelivery } from '../../src/modules/auth/otp-delivery'

describe('SMTP OTP delivery', () => {
  beforeEach(() => {
    mocks.env.NODE_ENV = 'test'
    mocks.env.OTP_DEV_LOG = false
    mocks.env.RESEND_API_KEY = undefined
    mocks.sendMail.mockReset()
    mocks.resendSend.mockReset()
  })

  it('returns a stable retryable error without exposing transport details', async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:1025'))

    await expect(new SmtpOtpDelivery().send('jurado@test.local', '123456')).rejects.toMatchObject({
      code: 'OTP_DELIVERY_UNAVAILABLE',
      status: 503,
      retryable: true,
      message: 'No se pudo enviar el código de acceso. Intentá nuevamente.',
    })
  })

  it('uses Resend instead of SMTP when RESEND_API_KEY is configured', async () => {
    mocks.env.RESEND_API_KEY = 're_test'
    mocks.resendSend.mockResolvedValueOnce({ data: { id: 'email-id' }, error: null })

    await new SmtpOtpDelivery().send('jurado@test.local', '123456')

    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['jurado@test.local'],
      subject: 'Código de acceso - Carnavales 2027',
      text: 'Tu código de acceso es 123456. No lo compartas.',
    }))
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
})
