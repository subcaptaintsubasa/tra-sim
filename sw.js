importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD3tPnB-zpvDl5wALKQhuCFsl-M3m7pKC8",
  projectId: "traindex-3b337",
  messagingSenderId: "897552477042",
  appId: "1:897552477042:web:af169c3994aa705a348beb"
});

const messaging = firebase.messaging();

// バックグラウンド通知の受信処理
messaging.onBackgroundMessage(function(payload) {
  console.log('バックグラウンド通知を受信しました: ', payload);
  
  // 【修正】ここで自前で通知を出す（showNotification）と2重通知になるため削除。
  // Firebaseが自動でペイロードの中身を読み取って通知を出してくれます。
  
  // もし送信時に画像（iconなど）が指定されていなかった場合、
  // ペイロードデータを書き換えてアイコンを強制的にセットすることも可能ですが、
  // 通常はFirebaseコンソールからの送信時に自動で適用されます。
});

const CACHE_NAME = 'tra-sim-v2.7.3'; // 更新時はここを変更すると確実です
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