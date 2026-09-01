import { FiAlertTriangle, FiCheck, FiClock, FiLoader } from 'react-icons/fi'
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
  const icon = status === 'SYNCED'
    ? <FiCheck size={14} aria-hidden="true" />
    : status === 'SYNCING'
      ? <FiLoader size={14} className="animate-spin" aria-hidden="true" />
      : status === 'CONFLICT' || status === 'REJECTED'
        ? <FiAlertTriangle size={14} aria-hidden="true" />
        : <FiClock size={14} aria-hidden="true" />
  return <Badge tone={tone} light><span className="inline-flex" aria-hidden="true">{icon}</span>{operationStatusLabel(status)}</Badge>
}
