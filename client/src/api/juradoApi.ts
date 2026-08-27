import { apiClient } from './apiClient'
import type { JuradoContext, SyncOperation, SyncResultStatus } from '../types/domain'

function numberFrom(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return Number.NaN
}

export function normalizeJuradoContext(context: JuradoContext): JuradoContext {
  return {
    ...context,
    assignment: {
      ...context.assignment,
      night: { ...context.assignment.night, id: numberFrom(context.assignment.night.id) },
    },
    comparsas: context.comparsas.map((comparsa) => ({ ...comparsa, id: numberFrom(comparsa.id), orden: numberFrom(comparsa.orden) })),
    items: context.items.map((item) => ({ ...item, id: numberFrom(item.id), parentItemId: item.parentItemId === null ? null : numberFrom(item.parentItemId), orden: numberFrom(item.orden) })),
    votes: context.votes.map((vote) => ({ ...vote, comparsaId: numberFrom(vote.comparsaId), itemId: numberFrom(vote.itemId) })),
    closes: context.closes.map((close) => ({ ...close, comparsaId: numberFrom(close.comparsaId) })),
  }
}

export interface ReconcileRequestOperation {
  operationId: string
  type: SyncOperation['type']
  payload: SyncOperation['payload']
}

export interface ReconcileResult {
  operationId: string
  status: SyncResultStatus
  resource?: Record<string, unknown>
  error?: { code: string; message: string; retryable?: boolean }
}

export interface ReconcileResponse {
  operations: ReconcileResult[]
}

export const juradoApi = {
  async context(): Promise<JuradoContext> {
    return normalizeJuradoContext(await apiClient.get<JuradoContext>('/jurado/contexto'))
  },
  votos() {
    return apiClient.get<JuradoContext['votes']>('/jurado/votos')
  },
  reconcile(deviceId: string, operations: ReconcileRequestOperation[]): Promise<ReconcileResponse> {
    return apiClient.post<ReconcileResponse>('/jurado/sync/reconcile', { deviceId, operations })
  },
}
