import { Card } from '../ui/Card'
import type { SyncSummary } from '../../offline/syncRepository'

interface PendingOperationsIndicatorProps {
  summary: SyncSummary
}

export function PendingOperationsIndicator({ summary }: PendingOperationsIndicatorProps) {
  const pending = summary.pending + summary.syncing
  if (pending === 0 && summary.conflicts === 0 && summary.rejected === 0) return null

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/10">
      <p className="font-semibold text-yellow-100">Estado de sincronizaci?n</p>
      <p className="mt-1 text-sm text-yellow-50">
        {pending > 0 ? `${pending} cambio(s) guardados en este dispositivo todav?a no fueron confirmados por el servidor.` : 'No hay pendientes de red.'}
      </p>
      {summary.conflicts + summary.rejected > 0 ? (
        <p className="mt-2 text-sm text-rose-100">{summary.conflicts + summary.rejected} operaci?n(es) quedaron en conflicto o rechazadas. No se eliminaron: requieren revisi?n.</p>
      ) : null}
    </Card>
  )
}
