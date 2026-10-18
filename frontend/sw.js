const CACHE_NAME = 'finance-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/css/main.css',
  '/css/dashboard.css',
  '/js/main.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/store.js',
  '/js/modules/budget.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retorna do cache se encontrar, senão vai para a rede
        return response || fetch(event.request);
      })
  );
});
