import { Badge } from '../ui/Badge'
import type { ConnectionStatusState } from '../../hooks/useConnectionStatus'
import type { SyncSummary } from '../../offline/syncRepository'

interface ConnectionStatusProps {
  connection: ConnectionStatusState
  sync: SyncSummary
}

export function ConnectionStatus({ connection, sync }: ConnectionStatusProps) {
  const hasProblems = sync.conflicts > 0 || sync.rejected > 0
  const pending = sync.pending + sync.syncing
  const tone = !connection.apiReachable ? 'warning' : hasProblems ? 'danger' : pending > 0 ? 'info' : 'success'
  const syncText = hasProblems
    ? `${sync.conflicts + sync.rejected} operaciones requieren revisión`
    : sync.syncing > 0
      ? 'Sincronizando'
      : pending > 0
        ? `${pending} pendientes`
        : 'Todo sincronizado'

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <Badge tone={tone}>{connection.label}</Badge>
      <Badge tone={pending > 0 ? 'warning' : hasProblems ? 'danger' : 'success'}>{syncText}</Badge>
    </div>
  )
}
