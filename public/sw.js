// Service worker mínimo: depois da primeira visita, o app abre em modo avião.
// Cache-first para tudo que é do próprio app; a rede nunca é consultada em
// tempo de jogo.
const CACHE = 'masmorra-v1'
const CORE = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'fonts/fonts.css']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE.map((path) => new URL(path, self.registration.scope).href)))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegação: devolve o index em cache, para o SPA sobreviver a um refresh.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match(new URL('index.html', self.registration.scope).href)
        .then((hit) => hit ?? fetch(request))
        .catch(() => fetch(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
