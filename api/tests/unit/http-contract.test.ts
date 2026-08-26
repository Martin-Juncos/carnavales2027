import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import type { OtpDelivery } from '../../src/modules/auth/otp-delivery'

const delivery: OtpDelivery = { send: () => Promise.resolve() }
const app = createApp({ otpDelivery: delivery })

describe('HTTP contract', () => {
  it('returns the stable error envelope with a requestId', async () => {
    const response = await request(app).get('/missing')
    const body = response.body as { error: { code: string; message: string; requestId: string } }

    expect(response.status).toBe(404)
    expect(body).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ruta no encontrada.' },
    })
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers['x-request-id']).toBe(body.error.requestId)
  })

  it('rejects malformed OTP verification before touching persistence', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ challengeId: 'invalid', code: '12' })
    const body = response.body as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('publishes an OpenAPI document', async () => {
    const response = await request(app).get('/openapi.json')
    const body = response.body as { openapi: string; paths: Record<string, { post?: unknown }> }

    expect(response.status).toBe(200)
    expect(body.openapi).toBe('3.1.0')
    expect(body.paths['/jurado/votos']?.post).toBeDefined()
  })

  it('protects juror routes without consulting client-provided roles', async () => {
    const response = await request(app)
      .get('/api/v1/jurado/contexto')
      .set('x-role', 'jurado')
    const body = response.body as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })
})
