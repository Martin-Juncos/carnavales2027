import { NavLink, Outlet } from 'react-router-dom'
import { FiEye, FiFileText, FiLogOut, FiSettings, FiUser } from 'react-icons/fi'
import { Button } from '../../components/ui/Button'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useSyncSummary } from '../../hooks/useSyncSummary'
import { ConnectionStatus } from '../../components/domain/ConnectionStatus'
import { LastSyncIndicator } from '../../components/domain/LastSyncIndicator'
import { useAuth } from '../../features/auth/AuthProvider'
import { useServiceWorkerUpdate } from '../pwa/useServiceWorkerUpdate'

function navClass({ isActive }: { isActive: boolean }): string {
  return `inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-carnival-naranja-calido text-night-950' : 'text-slate-200 hover:bg-white/10'}`
}

export function AppShell() {
  const auth = useAuth()
  const sync = useSyncSummary()
  const connection = useConnectionStatus()
  const update = useServiceWorkerUpdate()

  return (
    <div className="min-h-screen text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/20 bg-night-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-display text-2xl font-black leading-none text-carnival-naranja-calido lg:text-3xl">Carnavales 2027</p>
            <h1 className="mt-1 text-lg font-bold text-slate-200">{auth.user?.nombre}</h1>
            {auth.offlineSession ? <p className="mt-1 text-xs text-carnival-amarillo-brillante">Sesión restaurada desde este dispositivo; falta validar con servidor.</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <ConnectionStatus connection={connection} sync={sync} />
            <LastSyncIndicator lastSyncAt={sync.lastSyncAt} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3" aria-label="Navegación principal">
          {auth.user?.role === 'jurado' ? <NavLink className={navClass} to="/jurado"><FiUser size={18} aria-hidden="true" />Jurado</NavLink> : null}
          {auth.user && ['fiscal', 'escribano', 'admin'].includes(auth.user.role) ? <NavLink className={navClass} to="/supervision"><FiEye size={18} aria-hidden="true" />Supervisión</NavLink> : null}
          {auth.user && ['escribano', 'admin'].includes(auth.user.role) ? <NavLink className={navClass} to="/escribania"><FiFileText size={18} aria-hidden="true" />Escribanía</NavLink> : null}
          {auth.user?.role === 'admin' ? <NavLink className={navClass} to="/admin"><FiSettings size={18} aria-hidden="true" />Admin</NavLink> : null}
          <Button variant="ghost" className="ml-auto" onClick={() => { void auth.logout() }}><FiLogOut size={18} aria-hidden="true" />Salir</Button>
        </nav>
      </header>
      {update.updateAvailable ? (
        <div className="border-b border-carnival-azul-profundo/40 bg-carnival-azul-profundo/10 px-4 py-3 text-sm text-cyan-100" role="status">
          Nueva versión disponible. Antes de actualizar verificá que tus votos estén guardados localmente. <button className="font-bold underline" onClick={update.applyUpdate}>Aplicar actualización</button>
        </div>
      ) : null}
      <Outlet />
    </div>
  )
}
