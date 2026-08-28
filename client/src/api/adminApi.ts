import { apiClient } from './apiClient'
import type { Role } from '../types/domain'

export interface AdminUser {
  id: string
  nombre: string
  dni: string
  email: string
  role: Role
  activo: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AdminNight {
  id: number
  nombre: string
  fecha: string
  estado: string
  createdAt?: string
  updatedAt?: string
}

export interface AdminComparsa {
  id: number
  nombre: string
  nocheId: number
  nocheNombre?: string
  orden: number
  activo: boolean
}

export interface AdminItem {
  id: number
  nombre: string
  parentItemId: number | null
  orden: number
  activo: boolean
}

export interface AdminAssignment {
  id: string
  juradoId: string
  juradoNombre: string
  nocheId: number
  nocheNombre: string
  estado: string
  reemplazaAsignacionId?: string | null
  motivo?: string | null
  asignadoAt: string
  finalizadoAt?: string | null
}

export const adminApi = {
  users: () => apiClient.get<AdminUser[]>('/admin/users'),
  createUser: (body: { nombre: string; dni: string; email: string; role: Role; activo: boolean }) => apiClient.post<AdminUser>('/admin/users', body),
  updateUser: (id: string, body: Partial<Omit<AdminUser, 'id' | 'dni' | 'createdAt' | 'updatedAt'>>) => apiClient.patch<AdminUser>(`/admin/users/${id}`, body),
  nights: () => apiClient.get<AdminNight[]>('/admin/noches'),
  createNight: (body: { nombre: string; fecha: string }) => apiClient.post<AdminNight>('/admin/noches', body),
  updateNight: (id: number, body: Partial<{ nombre: string; fecha: string }>) => apiClient.patch<AdminNight>(`/admin/noches/${id}`, body),
  openNight: (id: number) => apiClient.post<AdminNight>(`/admin/noches/${id}/abrir`),
  closeNight: (id: number) => apiClient.post<AdminNight>(`/admin/noches/${id}/cerrar`),
  comparsas: () => apiClient.get<AdminComparsa[]>('/admin/comparsas'),
  createComparsa: (body: { nombre: string; nocheId: number; orden: number; activo: boolean }) => apiClient.post<AdminComparsa>('/admin/comparsas', body),
  reorderComparsas: (nightId: number, body: { comparsas: Array<{ comparsaId: number; orden: number }> }) => apiClient.patch<AdminComparsa[]>(`/admin/noches/${nightId}/comparsas/orden`, body),
  items: () => apiClient.get<AdminItem[]>('/admin/items'),
  createItem: (body: { nombre: string; parentItemId?: number | null; orden: number; activo: boolean }) => apiClient.post<AdminItem>('/admin/items', body),
  assignments: () => apiClient.get<AdminAssignment[]>('/admin/asignaciones'),
  createAssignment: (body: { juradoId: string; nocheId: number; motivo?: string }) => apiClient.post<AdminAssignment>('/admin/asignaciones', body),
  replaceAssignment: (id: string, body: { replacementJurorId: string; motivo: string }) => apiClient.post<AdminAssignment>(`/admin/asignaciones/${id}/reemplazar`, body),
}
