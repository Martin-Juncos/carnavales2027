import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { Role } from '../../types/domain'

interface ProtectedRouteProps {
  roles?: Role[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const auth = useAuth()
  if (auth.status === 'checking') {
    return <main className="grid min-h-screen place-items-center bg-night-950 p-6 text-slate-100">Recuperando sesión...</main>
  }
  if (!auth.user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(auth.user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
