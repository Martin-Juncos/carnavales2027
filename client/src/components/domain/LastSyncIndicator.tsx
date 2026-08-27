interface LastSyncIndicatorProps {
  lastSyncAt: string | undefined
}

export function LastSyncIndicator({ lastSyncAt }: LastSyncIndicatorProps) {
  if (!lastSyncAt) return <p className="text-xs text-slate-400">A?n no hubo sincronizaci?n exitosa.</p>
  return <p className="text-xs text-slate-400">?ltima sincronizaci?n: {new Date(lastSyncAt).toLocaleString()}</p>
}
