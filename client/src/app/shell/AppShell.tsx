import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useSyncSummary } from '../../hooks/useSyncSummary'
import { ConnectionStatus } from '../../components/domain/ConnectionStatus'
import { LastSyncIndicator } from '../../components/domain/LastSyncIndicator'
import { useAuth } from '../../features/auth/AuthProvider'
import { useServiceWorkerUpdate } from '../pwa/useServiceWorkerUpdate'

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-2xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-carnival-gold text-night-950' : 'text-slate-200 hover:bg-slate-800'}`
}

export function AppShell() {
  const auth = useAuth()
  const sync = useSyncSummary()
  const connection = useConnectionStatus()
  const update = useServiceWorkerUpdate()

  return (
    <div className="min-h-screen bg-night-950 text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-night-950/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-carnival-gold">Carnavales 2027</p>
            <h1 className="text-lg font-black">{auth.user?.nombre}</h1>
            {auth.offlineSession ? <p className="text-xs text-yellow-200">Sesi?n restaurada desde este dispositivo; falta validar con servidor.</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <ConnectionStatus connection={connection} sync={sync} />
            <LastSyncIndicator lastSyncAt={sync.lastSyncAt} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3" aria-label="Navegaci?n principal">
          {auth.user?.role === 'jurado' ? <NavLink className={navClass} to="/jurado">Jurado</NavLink> : null}
          {auth.user && ['fiscal', 'escribano', 'admin'].includes(auth.user.role) ? <NavLink className={navClass} to="/supervision">Supervisi?n</NavLink> : null}
          {auth.user && ['escribano', 'admin'].includes(auth.user.role) ? <NavLink className={navClass} to="/escribania">Escriban?a</NavLink> : null}
          {auth.user?.role === 'admin' ? <NavLink className={navClass} to="/admin">Admin</NavLink> : null}
          <Button variant="ghost" className="ml-auto" onClick={() => { void auth.logout() }}>Salir</Button>
        </nav>
      </header>
      {update.updateAvailable ? (
        <div className="border-b border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100" role="status">
          Nueva versi?n disponible. Antes de actualizar verific? que tus votos est?n guardados localmente. <button className="font-bold underline" onClick={update.applyUpdate}>Aplicar actualizaci?n</button>
        </div>
      ) : null}
      <Outlet />
    </div>
  )
}
