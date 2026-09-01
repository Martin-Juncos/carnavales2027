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

export const adminApi = {
  users: () => apiClient.get<AdminUser[]>('/admin/users'),
  createUser: (body: { nombre: string; dni: string; email: string; role: Role; activo: boolean }) => apiClient.post<AdminUser>('/admin/users', body),
  updateUser: (id: string, body: Partial<Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>>) => apiClient.patch<AdminUser>(`/admin/users/${id}`, body),
  deleteUser: (id: string) => apiClient.delete<AdminUser>(`/admin/users/${id}`),
  nights: () => apiClient.get<AdminNight[]>('/admin/noches'),
  createNight: (body: { nombre: string; fecha: string }) => apiClient.post<AdminNight>('/admin/noches', body),
  updateNight: (id: number, body: Partial<{ nombre: string; fecha: string }>) => apiClient.patch<AdminNight>(`/admin/noches/${id}`, body),
  deleteNight: (id: number) => apiClient.delete<AdminNight>(`/admin/noches/${id}`),
  openNight: (id: number) => apiClient.post<AdminNight>(`/admin/noches/${id}/abrir`),
  closeNight: (id: number) => apiClient.post<AdminNight>(`/admin/noches/${id}/cerrar`),
  comparsas: () => apiClient.get<AdminComparsa[]>('/admin/comparsas'),
  createComparsa: (body: { nombre: string; nocheId: number; orden: number; activo: boolean }) => apiClient.post<AdminComparsa>('/admin/comparsas', body),
  updateComparsa: (id: number, body: Partial<{ nombre: string; nocheId: number; orden: number; activo: boolean }>) => apiClient.patch<AdminComparsa>(`/admin/comparsas/${id}`, body),
  deleteComparsa: (id: number) => apiClient.delete<AdminComparsa>(`/admin/comparsas/${id}`),
  reorderComparsas: (nightId: number, body: { comparsas: Array<{ comparsaId: number; orden: number }> }) => apiClient.patch<AdminComparsa[]>(`/admin/noches/${nightId}/comparsas/orden`, body),
  items: () => apiClient.get<AdminItem[]>('/admin/items'),
  createItem: (body: { nombre: string; parentItemId?: number | null; orden: number; activo: boolean }) => apiClient.post<AdminItem>('/admin/items', body),
  updateItem: (id: number, body: Partial<{ nombre: string; parentItemId: number | null; orden: number; activo: boolean }>) => apiClient.patch<AdminItem>(`/admin/items/${id}`, body),
  deleteItem: (id: number) => apiClient.delete<AdminItem>(`/admin/items/${id}`),
}
