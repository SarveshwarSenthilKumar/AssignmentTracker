const cacheName = 'assignmenttracker-shell-__REVISION__'
const assets = __ASSETS__

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys())
      .filter(name => name.startsWith('assignmenttracker-shell-') && name !== cacheName)
      .map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.open(cacheName)).match('/')))
  } else if (assets.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)))
  }
})
