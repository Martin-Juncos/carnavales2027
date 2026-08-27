const CACHE_NAME = 'carnavales2027-shell-v2'
const APP_SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)
    const shellResponse = await fetch('/')
    if (!shellResponse.ok) throw new Error('No se pudo precachear la aplicación')
    const html = await shellResponse.clone().text()
    await cache.put('/', shellResponse)
    const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.pathname)
    await cache.addAll([...new Set(assets)])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => undefined)
          return response
        })
        .catch(() => caches.match('/')
          .then((cached) => cached || caches.match('/offline.html'))
          .then((response) => response || new Response('Offline', { status: 503 }))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok && (url.origin === self.location.origin)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => cached)
      return cached || fetched
    }),
  )
})
