import { useEffect, useState } from 'react'
import { apiClient } from '../api/apiClient'

export interface ConnectionStatusState {
  browserOnline: boolean
  apiReachable: boolean
  checking: boolean
  label: string
}

export function useConnectionStatus(pollMs = 20_000): ConnectionStatusState {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine)
  const [apiReachable, setApiReachable] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    const check = (): void => {
      if (!navigator.onLine) {
        setBrowserOnline(false)
        setApiReachable(false)
        setChecking(false)
        return
      }
      setChecking(true)
      void apiClient.health().then((healthy) => {
        if (!active) return
        setBrowserOnline(navigator.onLine)
        setApiReachable(healthy)
        setChecking(false)
      })
    }
    const online = (): void => { setBrowserOnline(true); check() }
    const offline = (): void => { setBrowserOnline(false); setApiReachable(false); setChecking(false) }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    check()
    const interval = window.setInterval(check, pollMs)
    return () => {
      active = false
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.clearInterval(interval)
    }
  }, [pollMs])

  const label = !browserOnline
    ? 'Sin conexión'
    : checking
      ? 'Verificando API'
      : apiReachable
        ? 'Conectado'
        : 'API no responde'

  return { browserOnline, apiReachable, checking, label }
}
