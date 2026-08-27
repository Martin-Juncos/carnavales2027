import { useEffect, useState } from 'react'
import { SYNC_EVENT_NAME } from '../offline/db'
import { getSyncSummary, type SyncSummary } from '../offline/syncRepository'

const emptySummary: SyncSummary = { pending: 0, syncing: 0, synced: 0, conflicts: 0, rejected: 0 }

export function useSyncSummary(): SyncSummary {
  const [summary, setSummary] = useState<SyncSummary>(emptySummary)

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      void getSyncSummary().then((next) => {
        if (active) setSummary(next)
      })
    }
    refresh()
    window.addEventListener(SYNC_EVENT_NAME, refresh)
    const interval = window.setInterval(refresh, 5_000)
    return () => {
      active = false
      window.removeEventListener(SYNC_EVENT_NAME, refresh)
      window.clearInterval(interval)
    }
  }, [])

  return summary
}
