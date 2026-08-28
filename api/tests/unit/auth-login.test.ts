import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRecord } from '../../src/modules/auth/auth.repository'
import { AuthService } from '../../src/modules/auth/auth.service'

interface CreateChallengeInput {
  id: string
  userId: string
  codeHash: string
  expiresAt: Date
  maxAttempts: number
}

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn<(email: string) => Promise<UserRecord | undefined>>(),
  createChallenge: vi.fn<(input: CreateChallengeInput) => Promise<void>>(),
  consumeChallenge: vi.fn<(id: string) => Promise<void>>(),
  writeAudit: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../src/modules/auth/auth.repository', () => ({
  findUserByEmail: mocks.findUserByEmail,
  createChallenge: mocks.createChallenge,
  consumeChallenge: mocks.consumeChallenge,
}))

vi.mock('../../src/modules/audit/audit.repository', () => ({
  writeAudit: mocks.writeAudit,
}))

const activeUser: UserRecord = {
  id: 'bb7ae047-127b-4f55-9282-b58d7b7ad101',
  nombre: 'Martin Juncos',
  dni: '25609038',
  email: 'jurado@example.com',
  password_hash: 'dni-hash-kept-for-schema-compatibility',
  role: 'jurado',
  activo: true,
}

describe('auth login OTP request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUserByEmail.mockResolvedValue(activeUser)
    mocks.createChallenge.mockResolvedValue(undefined)
    mocks.consumeChallenge.mockResolvedValue(undefined)
    mocks.writeAudit.mockResolvedValue(undefined)
  })

  it('accepts matching name, email and DNI before sending an OTP', async () => {
    const delivery = { send: vi.fn().mockResolvedValue(undefined) }
    const service = new AuthService(delivery)

    const result = await service.requestOtp(
      { nombre: '  Martin   Juncos ', email: 'jurado@example.com', dni: '25609038' },
      { requestId: 'request-id' },
    )

    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/)
    expect(delivery.send).toHaveBeenCalledWith('jurado@example.com', expect.stringMatching(/^\d{6}$/))
    const challenge = mocks.createChallenge.mock.calls[0]?.[0]
    expect(challenge).toBeDefined()
    expect(challenge?.userId).toBe(activeUser.id)
    expect(typeof challenge?.maxAttempts).toBe('number')
  })

  it('rejects an incorrect name, email, DNI or inactive user without sending an OTP', async () => {
    const delivery = { send: vi.fn() }
    const service = new AuthService(delivery)

    await expect(service.requestOtp(
      { nombre: 'Otra Persona', email: 'jurado@example.com', dni: '25609038' },
      { requestId: 'request-id' },
    )).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    mocks.findUserByEmail.mockResolvedValueOnce(undefined)
    await expect(service.requestOtp(
      { nombre: 'Martin Juncos', email: 'nadie@example.com', dni: '25609038' },
      { requestId: 'request-id' },
    )).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    await expect(service.requestOtp(
      { nombre: 'Martin Juncos', email: 'jurado@example.com', dni: '00000000' },
      { requestId: 'request-id' },
    )).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    mocks.findUserByEmail.mockResolvedValueOnce({ ...activeUser, activo: false })
    await expect(service.requestOtp(
      { nombre: 'Martin Juncos', email: 'jurado@example.com', dni: '25609038' },
      { requestId: 'request-id' },
    )).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    expect(delivery.send).not.toHaveBeenCalled()
  })
})
