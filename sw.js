const CACHE_NAME = 'tra-sim-v1.4'; // 更新時はここを変更すると確実です
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/core_logic.js',
  './js/data_manager.js',
  './js/drive_sync.js',
  './js/ocr_logic.js',
  './js/ui_manager.js',
  './data/cards.json',
  './data/skills.json',
  './data/abilities.json'
];

self.addEventListener('install', (e) => {
  // インストール時に待機せず即座にアクティブにする
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  // 古いキャッシュを削除し、すべてのクライアント(タブ)を即座に制御下に置く
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // キャッシュ優先、なければネットワーク
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});