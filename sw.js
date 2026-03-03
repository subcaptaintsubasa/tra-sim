const CACHE_NAME = 'tra-sim-v1';
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
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});