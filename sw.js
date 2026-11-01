const CACHE_NAME = 'gestao-acs-v26';
const CACHE_FONTES = 'gestao-acs-fontes';
const RECURSOS = [
  './',
  './index.html',
  './manifest.json',
  './icone-192.png',
  './icone-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RECURSOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (chave !== CACHE_NAME && chave !== CACHE_FONTES) return caches.delete(chave);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    return;
  }

  const url = new URL(e.request.url);

  // Fontes Inter/Roboto (Google Fonts): guarda na primeira vez e usa offline depois
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE_FONTES).then((cache) =>
        cache.match(e.request).then((guardado) => {
          const rede = fetch(e.request).then((resp) => {
            if (resp && (resp.ok || resp.type === 'opaque')) cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => guardado);
          return guardado || rede;
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
