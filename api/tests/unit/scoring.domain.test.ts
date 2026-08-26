import { describe, expect, it } from 'vitest'
import { calculateFinalTotal, calculateParentItem } from '../../src/modules/scoring/scoring.domain'

describe('scoring domain', () => {
  it('sums every score without discarding extremes', () => {
    expect(calculateFinalTotal([0, 2, 5], [])).toEqual({
      grossTotal: 7,
      penaltyTotal: 0,
      finalTotal: 7,
    })
  })

  it('subtracts fixed penalties from the gross total', () => {
    expect(calculateFinalTotal([5, 4, 3], [2, 1])).toEqual({
      grossTotal: 12,
      penaltyTotal: 3,
      finalTotal: 9,
    })
  })

  it('calculates a parent item as the sum of its children', () => {
    expect(calculateParentItem([3, 4, 5])).toBe(12)
  })
})

