import { apiClient } from './apiClient'
import type {
  CloseComparsaOperationPayload,
  JuradoContext,
  NightSummary,
  SyncOperation,
  SyncResultStatus,
  VoteOperationPayload,
} from '../types/domain'

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

export interface CreateVoteRequest extends VoteOperationPayload {
  operationUuid: string
}

export interface CloseComparsaRequest extends Omit<CloseComparsaOperationPayload, 'comparsaId'> {
  operationUuid: string
}

export const juradoApi = {
  nights(): Promise<NightSummary[]> {
    return apiClient.get<NightSummary[]>('/jurado/noches')
  },
  async nightContext(nightId: number): Promise<JuradoContext> {
    return normalizeJuradoContext(await apiClient.get<JuradoContext>(`/jurado/noches/${nightId}/contexto`))
  },
  votos() {
    return apiClient.get<JuradoContext['votes']>('/jurado/votos')
  },
  createVote(body: CreateVoteRequest) {
    return apiClient.post<JuradoContext['votes'][number]>('/jurado/votos', body)
  },
  closeComparsa(comparsaId: number, body: CloseComparsaRequest) {
    return apiClient.post<JuradoContext['closes'][number]>(`/jurado/comparsas/${comparsaId}/cerrar`, body)
  },
  reconcile(deviceId: string, operations: ReconcileRequestOperation[]): Promise<ReconcileResponse> {
    return apiClient.post<ReconcileResponse>('/jurado/sync/reconcile', { deviceId, operations })
  },
}
