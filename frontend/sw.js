const CACHE_NAME = 'finance-app-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/css/main.css',
  '/css/dashboard.css',
  '/js/config.js',
  '/js/main.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/store.js',
  '/js/modules/budget.js',
  '/js/modules/dashboard.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  // Pula a espera para ativar o Service Worker imediatamente
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Arquivos em cache com sucesso.');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.error('Erro ao fazer cache', err))
  );
});

self.addEventListener('activate', (event) => {
  // Remove caches antigos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Reivindica os clientes para assumir o controle imediatamente
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Estratégia Network First para a API, e Cache First para arquivos estáticos
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback para API offline (poderia ser uma resposta genérica JSON de erro)
        return new Response(JSON.stringify({ message: "Sem conexão com a internet" }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response; // Retorna do cache
          }
          // Caso não esteja no cache, busca na rede e já guarda no cache
          return fetch(event.request).then(
            function(response) {
              if(!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              var responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(function(cache) {
                  cache.put(event.request, responseToCache);
                });
              return response;
            }
          );
        }).catch(() => {
          // Fallback final genérico (se estiver offline e sem cache)
          // Se for HTML, pode retornar a página inicial
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        })
    );
  }
});
