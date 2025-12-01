// Service Worker for PWA
const CACHE_NAME = 'couple-ordering-v1';
const BASE_PATH = '/couple-ordering/';
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json'
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 缓存命中，返回缓存
        if (response) {
          return response;
        }
        
        // 网络请求
        return fetch(event.request).then(
          (response) => {
            // 检查是否是有效响应
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 克隆响应
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// 监听推送通知事件
self.addEventListener('push', (event) => {
  console.log('收到推送通知:', event);
  
  let notificationData = {
    title: '新通知',
    body: '您有新的消息',
    icon: '/couple-ordering/icon-192.png',
    badge: '/couple-ordering/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  // 如果推送包含数据，解析数据
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      requireInteraction: notificationData.requireInteraction,
      tag: 'order-notification',
      data: notificationData.data
    })
  );
});

// 监听通知点击事件
self.addEventListener('notificationclick', (event) => {
  console.log('通知被点击:', event);
  event.notification.close();

  // 打开或聚焦应用
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已有窗口打开，聚焦它
      for (const client of clientList) {
        if (client.url.includes(BASE_PATH) && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(BASE_PATH);
      }
    })
  );
});

