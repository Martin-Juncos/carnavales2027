import { Card } from '../ui/Card'
import type { SyncSummary } from '../../offline/syncRepository'

export function ConflictBanner({ summary }: { summary: SyncSummary }) {
  if (summary.conflicts === 0 && summary.rejected === 0) return null
  return (
    <Card className="border-rose-500/50 bg-rose-500/10">
      <h2 className="text-lg font-bold text-rose-100">Hay operaciones que requieren revisión</h2>
      <p className="mt-2 text-sm text-rose-50">
        Puede haber una noche cerrada, jurado reemplazado, voto ya confirmado o una regla de dominio rechazada. La evidencia local se conserva y no se sobrescribe automáticamente.
      </p>
    </Card>
  )
}
