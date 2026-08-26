export interface ScoreSummary {
  grossTotal: number
  penaltyTotal: number
  finalTotal: number
}

export function calculateFinalTotal(scores: readonly number[], penalties: readonly number[]): ScoreSummary {
  const grossTotal = scores.reduce((total, value) => total + value, 0)
  const penaltyTotal = penalties.reduce((total, value) => total + value, 0)
  return { grossTotal, penaltyTotal, finalTotal: grossTotal - penaltyTotal }
}

export function calculateParentItem(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
