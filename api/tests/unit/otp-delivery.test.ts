import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mocks.sendMail }),
  },
}))

import { SmtpOtpDelivery } from '../../src/modules/auth/otp-delivery'

describe('SMTP OTP delivery', () => {
  beforeEach(() => {
    mocks.sendMail.mockReset()
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
})
