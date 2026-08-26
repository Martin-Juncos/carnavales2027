import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { voteBodySchema } from '../../src/modules/jurado/jurado.schemas'
import { hashPayload } from '../../src/shared/security/crypto'

const baseVote = {
  operationUuid: randomUUID(),
  comparsaId: 1,
  itemId: 1,
  clientCreatedAt: '2027-02-06T22:00:00-03:00',
}

describe('vote contract', () => {
  it.each([0, 5])('accepts boundary score %s', (valor) => {
    expect(voteBodySchema.safeParse({ ...baseVote, valor }).success).toBe(true)
  })

  it.each([-1, 6, 2.5])('rejects invalid score %s', (valor) => {
    expect(voteBodySchema.safeParse({ ...baseVote, valor }).success).toBe(false)
  })

  it('hashes equivalent payloads independently of property order', () => {
    expect(hashPayload({ b: 2, a: { d: 4, c: 3 } })).toBe(hashPayload({ a: { c: 3, d: 4 }, b: 2 }))
  })
})

