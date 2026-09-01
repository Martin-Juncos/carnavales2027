import type { JuradoContext, ScoringItem, VoteDraft } from '../../src/types/domain'
import { buildItemTree, calculateParentTotal, missingScorableItems, progressForComparsa } from '../../src/features/voting/voteCalculations'

const items: ScoringItem[] = [
  { id: 1, nombre: 'Carroza', parentItemId: null, orden: 1 },
  { id: 2, nombre: 'Diseño', parentItemId: 1, orden: 1 },
  { id: 3, nombre: 'Terminación', parentItemId: 1, orden: 2 },
  { id: 4, nombre: 'Música', parentItemId: null, orden: 2 },
]

const context: JuradoContext = {
  assignment: { id: 'assignment-1', night: { id: 1, name: 'Noche 1', status: 'open', fecha: '2027-02-06' } },
  comparsas: [{ id: 10, nombre: 'Ará Berá', orden: 1 }],
  items,
  votes: [{ id: 'vote-1', operationUuid: 'op-server', comparsaId: 10, itemId: 2, valor: 4, serverReceivedAt: '2027-02-06T22:00:00Z' }],
  closes: [],
}

describe('vote calculations', () => {
  it('calculates parent items from children and never treats parents as manually missing', () => {
    const tree = buildItemTree(items)
    const values = new Map<number, number>([[2, 4], [3, 5]])

    const root = tree[0]
    expect(root?.nombre).toBe('Carroza')
    if (!root) throw new Error('Expected root item')
    expect(calculateParentTotal(root, values)).toBe(9)
  })

  it('detects missing leaf items using server votes plus local drafts', () => {
    const drafts: VoteDraft[] = [{ id: '10:3', operationId: 'op-local', comparsaId: 10, itemId: 3, valor: 5, syncStatus: 'PENDING', confirmedAt: '2027-02-06T22:01:00Z' }]

    expect(missingScorableItems(10, items, drafts, context.votes).map((item) => item.nombre)).toEqual(['Música'])
  })

  it('separates local confirmation from server confirmation in progress', () => {
    const drafts: VoteDraft[] = [{ id: '10:3', operationId: 'op-local', comparsaId: 10, itemId: 3, valor: 5, syncStatus: 'PENDING', confirmedAt: '2027-02-06T22:01:00Z' }]

    const progress = progressForComparsa(context, 10, drafts, [])

    expect(progress.confirmed).toBe(2)
    expect(progress.synced).toBe(1)
    expect(progress.pending).toBe(1)
  })
})
