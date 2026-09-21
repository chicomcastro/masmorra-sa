// Service worker mínimo: depois da primeira visita, o app abre em modo avião.
// Cache-first para tudo que é do próprio app; a rede nunca é consultada em
// tempo de jogo.
// Injetados no build: o nome do cache muda a cada publicação, e a lista traz os
// arquivos com hash no nome, que o service worker não teria como adivinhar.
const CACHE = 'masmorra-__BUILD_ID__'
const CORE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // `reload` evita guardar uma resposta que já estava velha no cache HTTP.
        cache.addAll(
          CORE.map(
            (path) => new Request(new URL(path, self.registration.scope).href, { cache: 'reload' }),
          ),
        ),
      )
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
    // ignoreVary e a busca por URL cobrem os pedidos que chegam com `crossorigin`
    // ou com query: o que está em cache é o mesmo arquivo.
    caches
      .match(request, { ignoreVary: true })
      .then((hit) => hit ?? caches.match(url.href, { ignoreVary: true, ignoreSearch: true }))
      .then((hit) => {
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
