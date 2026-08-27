import { useEffect, useState } from 'react'

export function useServiceWorkerUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    let active = true
    void navigator.serviceWorker.register('/sw.js').then((nextRegistration) => {
      if (!active) return
      setRegistration(nextRegistration)
      nextRegistration.addEventListener('updatefound', () => {
        const worker = nextRegistration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })
    })
    return () => {
      active = false
    }
  }, [])

  const applyUpdate = (): void => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }

  return { updateAvailable, applyUpdate }
}
