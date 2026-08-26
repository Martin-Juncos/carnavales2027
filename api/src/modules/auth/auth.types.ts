export const roles = ['jurado', 'fiscal', 'escribano', 'admin'] as const
export type Role = (typeof roles)[number]

export interface AuthenticatedUser {
  id: string
  nombre: string
  email: string
  role: Role
  sessionId: string
}
