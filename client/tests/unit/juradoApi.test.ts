import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { juradoApi } from '../../src/api/juradoApi'

const fetchMock = vi.fn()

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, meta: {} }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('juradoApi online-first writes', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates votes directly through POST /jurado/votos', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 'vote-1',
      operationUuid: 'op-1',
      comparsaId: 1,
      itemId: 2,
      valor: 5,
      serverReceivedAt: '2026-09-01T22:00:00.000Z',
    }, 201))

    await juradoApi.createVote({
      operationUuid: 'op-1',
      comparsaId: 1,
      itemId: 2,
      valor: 5,
      clientCreatedAt: '2026-09-01T22:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/jurado/votos',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          operationUuid: 'op-1',
          comparsaId: 1,
          itemId: 2,
          valor: 5,
          clientCreatedAt: '2026-09-01T22:00:00.000Z',
        }),
      }),
    )
  })

  it('closes comparsas directly through POST /jurado/comparsas/:id/cerrar', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 'close-1',
      operationUuid: 'op-close-1',
      comparsaId: 3,
      serverReceivedAt: '2026-09-01T22:10:00.000Z',
    }, 201))

    await juradoApi.closeComparsa(3, {
      operationUuid: 'op-close-1',
      clientCreatedAt: '2026-09-01T22:10:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/jurado/comparsas/3/cerrar',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          operationUuid: 'op-close-1',
          clientCreatedAt: '2026-09-01T22:10:00.000Z',
        }),
      }),
    )
  })
})
