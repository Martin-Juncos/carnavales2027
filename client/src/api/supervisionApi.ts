import { apiClient } from './apiClient'
import type { AuditRow, FiscalEvent, ReportRow, SupervisionNightState } from '../types/domain'

export interface PenaltyRecord {
  id: string
  comparsaId: number
  comparsaNombre?: string
  nocheId?: number
  nocheNombre?: string
  puntos: number
  motivoCodigo?: string
  motivoDescripcion: string
  estado: string
  createdAt?: string
  anuladaAt?: string
}

export interface ActRecord {
  id: string
  nocheId: number
  tipo: 'pdf' | 'csv'
  version: number
  sha256: string
  byteSize?: number
  estado: string
  generadaAt?: string
  certificadaAt?: string
}

export const supervisionApi = {
  nightState: (nightId: number) => apiClient.get<SupervisionNightState>(`/supervision/noches/${nightId}/estado`),
  events: (after = 0) => apiClient.get<FiscalEvent[]>(`/supervision/eventos?after=${after}`),
  jurorReport: (juradoId: string, nocheId: number) => apiClient.get<ReportRow[]>(`/reportes/jurado/${juradoId}/noche/${nocheId}`),
  nightReport: (nocheId: number) => apiClient.get<ReportRow[]>(`/reportes/noche/${nocheId}`),
  generalReport: () => apiClient.get<ReportRow[]>('/reportes/general'),
  penalties: (params: { nocheId?: number; estado?: 'active' | 'annulled'; limit?: number } = {}) => {
    const search = new URLSearchParams()
    if (params.nocheId) search.set('nocheId', String(params.nocheId))
    if (params.estado) search.set('estado', params.estado)
    search.set('limit', String(params.limit ?? 50))
    return apiClient.get<PenaltyRecord[]>(`/penalizaciones?${search.toString()}`)
  },
  createPenalty: (body: { comparsaId: number; puntos: number; motivoCodigo?: string; motivoDescripcion: string }) => apiClient.post<PenaltyRecord>('/penalizaciones', body),
  annulPenalty: (id: string, body: { motivo: string }) => apiClient.post<PenaltyRecord>(`/penalizaciones/${id}/anular`, body),
  acts: (params: { nocheId?: number; limit?: number } = {}) => {
    const search = new URLSearchParams()
    if (params.nocheId) search.set('nocheId', String(params.nocheId))
    search.set('limit', String(params.limit ?? 50))
    return apiClient.get<ActRecord[]>(`/actas?${search.toString()}`)
  },
  generateAct: (nocheId: number, type: 'pdf' | 'csv') => apiClient.post<ActRecord>(`/actas/noche/${nocheId}/generar`, { type }),
  getAct: (id: string) => apiClient.get<ActRecord>(`/actas/${id}`),
  certifyAct: (id: string) => apiClient.post<ActRecord>(`/actas/${id}/certificar`),
  verifyAct: (id: string) => apiClient.get<{ id: string; expectedSha256: string; actualSha256: string; valid: boolean }>(`/actas/${id}/verificar`),
  audit: (after = 0, limit = 100) => apiClient.get<AuditRow[]>(`/audit?after=${after}&limit=${limit}`),
}
