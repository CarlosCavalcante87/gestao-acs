const CACHE_NAME = 'gestao-acs-v34';
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
  if (e.request.method !== 'GET') {
    return;
  }
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

  // Páginas e manifest: sempre tenta a versão nova primeiro (assim as atualizações chegam sozinhas)
  // e só usa a cópia guardada quando estiver sem internet.
  const ehPagina = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('manifest.json');
  if (ehPagina) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copia));
        }
        return resp;
      }).catch(() => caches.match(e.request).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Demais arquivos (ícones, imagens): usa a cópia guardada e, na primeira vez, guarda para funcionar offline
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request).then((resp) => {
      if (resp && resp.ok && url.origin === self.location.origin) {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copia));
      }
      return resp;
    }))
  );
});
