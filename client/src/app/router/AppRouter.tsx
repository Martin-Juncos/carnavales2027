import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LoginPage } from '../../features/auth/LoginPage'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { RoleHome } from '../../features/common/RoleHome'
import { JudgePage } from '../../features/voting/JudgePage'
import { SupervisionPage } from '../../features/supervision/SupervisionPage'
import { AdminPage } from '../../features/admin/AdminPage'
import { EscribaniaPage } from '../../features/escribania/EscribaniaPage'
import { AppShell } from '../shell/AppShell'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RoleHome /> },
          { path: '/jurado', element: <ProtectedRoute roles={['jurado']} />, children: [{ index: true, element: <JudgePage /> }] },
          { path: '/supervision', element: <ProtectedRoute roles={['fiscal', 'escribano', 'admin']} />, children: [{ index: true, element: <SupervisionPage /> }] },
          { path: '/escribania', element: <ProtectedRoute roles={['escribano', 'admin']} />, children: [{ index: true, element: <EscribaniaPage /> }] },
          { path: '/admin', element: <ProtectedRoute roles={['admin']} />, children: [{ index: true, element: <AdminPage /> }] },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
