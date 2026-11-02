const CACHE_NAME = 'gestao-acs-v52';
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
          if (chave !== CACHE_NAME && chave !== CACHE_FONTES && chave !== 'guia-alertas') return caches.delete(chave);
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

// ---------- Lembretes ----------
function isoLocalSW(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'alertas-diarios') return;
  e.waitUntil((async () => {
    const cache = await caches.open('guia-alertas');
    const resp = await cache.match('./alertas.json');
    if (!resp) return;
    const lista = await resp.json();
    const hoje = new Date();
    const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);
    const hojeIso = isoLocalSW(hoje), limIso = isoLocalSW(limite);
    const prox = lista.filter(a => a.d >= hojeIso && a.d <= limIso).sort((a, b) => a.d.localeCompare(b.d));
    if (!prox.length) return;
    const aniv = prox.filter(a => a.a && a.d === hojeIso);
    const outros = prox.filter(a => !a.a);
    if (!aniv.length && !outros.length) return;
    const nomes = [...new Set(outros.map(a => a.n))];
    const partes = [];
    if (nomes.length) partes.push(`🔔 ${nomes.length} cidadão(s) com ação nos próximos 7 dias`);
    if (aniv.length) partes.push(`🎉 ${aniv.length} aniversariante(s) hoje`);
    const linhas = aniv.map(a => `🎉 ${a.n} faz aniversário hoje`).concat(outros.slice(0, 3).map(a => `${a.n.split(' ')[0]}: ${a.x}`.slice(0, 90)));
    await self.registration.showNotification(partes.join(' · '), {
      body: linhas.join('\n'),
      tag: 'resumo-diario', icon: './icone-192.png', badge: './icone-192.png',
      data: { url: './index.html#alertas' }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (lista.length) {
      lista[0].postMessage({ abrir: 'alertas' });
      return lista[0].focus();
    }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './index.html#alertas');
  })());
});
