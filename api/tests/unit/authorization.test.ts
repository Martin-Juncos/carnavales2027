import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { requireRoles } from '../../src/modules/auth/auth.middleware'

function requestFor(role: 'jurado' | 'fiscal' | 'escribano' | 'admin'): Request {
  return {
    auth: {
      id: randomUUID(),
      nombre: 'Usuario test',
      email: 'user@test.local',
      role,
      sessionId: randomUUID(),
    },
  } as Request
}

describe('role authorization', () => {
  it('allows an explicitly authorized role', () => {
    const next: NextFunction = vi.fn()
    requireRoles('admin')(requestFor('admin'), {} as Response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects a role outside the endpoint allowlist', () => {
    const next: NextFunction = vi.fn()
    requireRoles('admin')(requestFor('jurado'), {} as Response, next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN', status: 403 }))
  })
})
