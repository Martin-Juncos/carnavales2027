import { db, resetClientDatabaseForTests } from '../../src/offline/db'
import { enqueueVoteOperation, getSyncSummary } from '../../src/offline/syncRepository'

describe('sync repository', () => {
  beforeEach(async () => {
    await resetClientDatabaseForTests()
  })

  it('persists a confirmed vote locally before network synchronization', async () => {
    const draft = await enqueueVoteOperation({ comparsaId: 10, itemId: 2, valor: 4 })
    const operation = await db.syncOperations.get(draft.operationId)

    expect(operation).toMatchObject({ operationId: draft.operationId, type: 'vote', status: 'PENDING', attempts: 0 })
    expect(draft.syncStatus).toBe('PENDING')
    expect(operation?.payload).toMatchObject({ comparsaId: 10, itemId: 2, valor: 4 })
  })

  it('reports pending operations without claiming everything is synced', async () => {
    await enqueueVoteOperation({ comparsaId: 10, itemId: 2, valor: 4 })

    await expect(getSyncSummary()).resolves.toMatchObject({ pending: 1, syncing: 0, conflicts: 0 })
  })
})
