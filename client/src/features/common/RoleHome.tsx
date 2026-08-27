import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'jurado') return <Navigate to="/jurado" replace />
  if (user.role === 'fiscal') return <Navigate to="/supervision" replace />
  if (user.role === 'escribano') return <Navigate to="/escribania" replace />
  return <Navigate to="/admin" replace />
}
