interface LastSyncIndicatorProps {
  lastSyncAt: string | undefined
}

export function LastSyncIndicator({ lastSyncAt }: LastSyncIndicatorProps) {
  if (!lastSyncAt) return <p className="text-xs text-slate-400">Aún no hubo sincronización exitosa.</p>
  return <p className="text-xs text-slate-400">Última sincronización: {new Date(lastSyncAt).toLocaleString()}</p>
}
