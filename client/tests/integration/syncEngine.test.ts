import { db, resetClientDatabaseForTests } from '../../src/offline/db'
import { enqueueVoteOperation } from '../../src/offline/syncRepository'
import { processSyncQueue } from '../../src/offline/syncEngine'

describe('sync engine', () => {
  beforeEach(async () => {
    await resetClientDatabaseForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks ALREADY_APPLIED as synced using the same operation id', async () => {
    const draft = await enqueueVoteOperation({ comparsaId: 10, itemId: 2, valor: 4 })
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON body')
      const body = JSON.parse(init.body) as { operations: { operationId: string }[] }
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          operations: body.operations.map((operation) => ({
            operationId: operation.operationId,
            status: 'ALREADY_APPLIED',
            resource: { id: 'server-vote-1', serverReceivedAt: '2027-02-06T22:05:00Z' },
          })),
        },
        meta: { count: body.operations.length },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await processSyncQueue()

    await expect(db.syncOperations.get(draft.operationId)).resolves.toMatchObject({ status: 'SYNCED', resultStatus: 'ALREADY_APPLIED' })
    await expect(db.voteDrafts.get(draft.id)).resolves.toMatchObject({ syncStatus: 'SYNCED', operationId: draft.operationId })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
