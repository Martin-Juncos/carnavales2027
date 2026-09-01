import { FiClock } from 'react-icons/fi'

interface LastSyncIndicatorProps {
  lastSyncAt: string | undefined
}

export function LastSyncIndicator({ lastSyncAt }: LastSyncIndicatorProps) {
  if (!lastSyncAt) return <p className="inline-flex items-center gap-1 text-xs text-slate-400"><FiClock size={14} aria-hidden="true" />Aún no hubo sincronización exitosa.</p>
  return <p className="inline-flex items-center gap-1 text-xs text-slate-400"><FiClock size={14} aria-hidden="true" />Última sincronización: {new Date(lastSyncAt).toLocaleString()}</p>
}
