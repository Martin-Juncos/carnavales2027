import { Badge } from '../ui/Badge'
import type { ConnectionStatusState } from '../../hooks/useConnectionStatus'

interface ConnectionStatusProps {
  connection: ConnectionStatusState
}

export function ConnectionStatus({ connection }: ConnectionStatusProps) {
  const tone = !connection.browserOnline ? 'warning' : connection.apiReachable ? 'success' : 'neutral'

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <Badge tone={tone}>{connection.label}</Badge>
    </div>
  )
}
