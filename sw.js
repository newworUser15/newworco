// Service worker NEWWOR Consulting
// Strategie :
//  - navigation (chargement de la page) : reseau en priorite, secours sur le cache si hors-ligne
//  - fichiers statiques (support.js, images, manifest, icones) : cache en priorite, mise a jour en arriere-plan
//  - tout le reste (formulaires, futures API, requetes cross-origin) : jamais intercepte, toujours reseau direct

const CACHE_NAME = 'newwor-shell-v9';

const APP_SHELL = [
  './',
  './index.html',
  './support.js',
  './manifest.json',
  './assets/newwor-logo.png',
  './assets/newwor-logo-gold.png',
  './assets/newwor-logo-cropped.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.ico',
  // React / ReactDOM / Babel vendorises localement (avant : charges depuis unpkg.com a
  // chaque demarrage, ce qui cassait le mode hors-ligne et le rendait dependant d'un CDN externe)
  './assets/vendor/react.production.min.js',
  './assets/vendor/react-dom.production.min.js',
  './assets/vendor/babel.min.js',
  // Client Supabase (authentification + donnees persistantes du portail client),
  // vendorise localement pour la meme raison que React/Babel ci-dessus.
  './assets/vendor/supabase.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne touche jamais aux requetes qui modifient des donnees (login, formulaires, futures API en POST/PUT...)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // On laisse passer tout ce qui n'est pas notre propre domaine (polices, API externes, etc.)
  if (url.origin !== self.location.origin) return;

  // Chargement de la page elle-meme : reseau d'abord, cache si hors-ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const isShellAsset = APP_SHELL.some((path) => req.url.endsWith(path.replace('./', '')));

  if (isShellAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
  // Le reste (donnees dynamiques d'un futur backend) n'est jamais mis en cache.
});
