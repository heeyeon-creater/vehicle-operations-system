const CACHE_NAME = 'vehicle-ops-shell-v1';

const APP_SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/auth.js',
  'js/router.js',
  'js/supabaseClient.js',
  'js/utils.js',
  'js/views/login.js',
  'js/views/dashboard.js',
  'js/views/vehicles.js',
  'js/views/vehicleDetail.js',
  'js/views/reservationForm.js',
  'js/views/myReservations.js',
  'js/views/adminVehicles.js',
  'js/views/adminReservations.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Supabase(API)/esm.sh(CDN 모듈)처럼 다른 출처로 나가는 요청은 항상
// 네트워크로 직접 보낸다. 여기서 가로채면 로그인/실시간 데이터가 캐시되어
// 오작동할 수 있다. 우리 앱 셸(HTML/CSS/JS/아이콘) 요청만 처리한다.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      // stale-while-revalidate: 캐시가 있으면 즉시 반환하고 백그라운드로 갱신,
      // 캐시가 없으면 네트워크를 기다린다(오프라인이면 index.html로 폴백).
      if (cached) {
        networkFetch;
        return cached;
      }
      const network = await networkFetch;
      if (network) return network;
      return cache.match('index.html');
    })
  );
});
