/* Block Lands: Adventure - Service Worker (atualizado)
   - Precache tolerante (não falha se 1 arquivo der 404)
   - Runtime caching por pasta/tipo (ideal pra jogo)
*/

const CACHE_VERSION = 'v4';
const CACHE_STATIC = `bl-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `bl-runtime-${CACHE_VERSION}`;

// App Shell (mínimo para iniciar offline)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',

  // CSS
  './assets/css/style.css',

  // Entradas JS (conforme sua estrutura)
  './js/app.js',
  './js/game.js',

  // Módulos (conforme pastas que você mostrou)
  './js/modules/audio.js',
  './js/modules/effects.js',
  './js/modules/i18n.js',
  './js/modules/powers.js',
  './js/modules/shapes.js',
  './js/modules/logic/bosses.js',
  './js/modules/logic/mechanics.js',
  './js/modules/data/levels.js',

  // Idiomas (i18n)
  './assets/lang/en.json',
  './assets/lang/pt-BR.json',

  // Ícones do PWA (mantém os do manifest)
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',

  // Assets críticos para “primeiro quadro”
  './assets/img/logo.png',
  './assets/img/loading_screen.webp',
  './assets/img/bg_story.png',

  // Imagens usadas em modais/resultados (pasta assets/images)
  './assets/images/image_e0b0c7.png',
  './assets/images/image_e0b124.png',

  // Sons mínimos (resto entra via runtime cache)
  './assets/sounds/click.mp3',
  './assets/sounds/back.mp3',
];

// ---------- Install / Activate ----------

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);

    // Precache tolerante: não derruba instalação se algum asset não existir
    await Promise.allSettled(
      PRECACHE_URLS.map(async (url) => {
        try {
          const req = new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          if (res.ok) await cache.put(url, res);
        } catch {
          // ignora falhas individuais
        }
      })
    );
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();

    // Limpa caches antigos
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
        .map((k) => caches.delete(k))
    );
  })());
});

// ---------- Fetch Routing ----------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Navegação (PWA / rotas): network-first + fallback no index
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Imagens e ícones do jogo: Cache First
  if (path.startsWith('/assets/img/') || path.startsWith('/assets/images/') || path.startsWith('/assets/icons/')) {
    event.respondWith(cacheFirst(request, CACHE_RUNTIME));
    return;
  }

  // Sons: Cache First (ótimo pra SFX)
  if (path.startsWith('/assets/sounds/')) {
    event.respondWith(cacheFirst(request, CACHE_RUNTIME));
    return;
  }

  // Idiomas JSON: Stale While Revalidate (atualiza sem travar)
  if (path.startsWith('/assets/lang/') && path.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_RUNTIME));
    return;
  }

  // CSS/JS: Stale While Revalidate
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(staleWhileRevalidate(request, CACHE_RUNTIME));
    return;
  }

  // Default: network-first com fallback ao cache
  event.respondWith(networkFirst(request, CACHE_RUNTIME));
});

// ---------- Estratégias ----------

async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    // Mantém index atualizado em cache (offline consistente)
    const cache = await caches.open(CACHE_STATIC);
    cache.put('./index.html', networkResponse.clone());
    return networkResponse;
  } catch {
    const cache = await caches.open(CACHE_STATIC);
    const cached = await cache.match('./index.html');
    return cached || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkPromise) || Response.error();
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}
