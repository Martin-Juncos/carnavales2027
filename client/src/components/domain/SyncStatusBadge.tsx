import { Badge } from '../ui/Badge'
import type { VoteSyncStatus } from '../../types/domain'
import { operationStatusLabel } from '../../offline/syncRepository'

interface SyncStatusBadgeProps {
  status: VoteSyncStatus
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const tone = status === 'SYNCED'
    ? 'success'
    : status === 'CONFLICT' || status === 'REJECTED'
      ? 'danger'
      : status === 'SYNCING'
        ? 'info'
        : 'warning'
  const icon = status === 'SYNCED' ? '?' : status === 'SYNCING' ? '?' : status === 'CONFLICT' || status === 'REJECTED' ? '!' : '?'
  return <Badge tone={tone}><span aria-hidden="true">{icon}</span>{operationStatusLabel(status)}</Badge>
}
