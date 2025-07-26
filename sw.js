const CACHE_NAME = 'islamic-habit-tracker-v1';
const urlsToCache = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing Islamic Habit Tracker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: App shell cached successfully');
      })
      .catch(error => {
        console.error('Service Worker: Caching failed', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Cleanup complete');
    })
  );
  
  // Claim clients to make service worker take effect immediately
  return self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip requests for extensions and chrome://
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('chrome://') ||
      event.request.url.startsWith('moz-extension://')) {
    return;
  }

  // Handle Firebase requests - always try network first
  if (event.request.url.includes('firebaseapp.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        })
        .catch(() => {
          // Try to return cached version if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // For CDN resources, try cache first
  if (event.request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
        })
    );
    return;
  }

  // For everything else, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched response for future use
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('Service Worker: Caching new resource:', event.request.url);
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(error => {
        console.log('Service Worker: Fetch failed, serving offline fallback');
        // Return the cached index.html for navigation requests when offline
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        // For other requests, just return a generic offline response
        return new Response('Offline - Please check your internet connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// Handle app updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting...');
    self.skipWaiting();
  }
});

// Background sync for habit data
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync:', event.tag);
  if (event.tag === 'sync-habit-data') {
    event.waitUntil(
      // Could implement background habit data sync here
      console.log('Service Worker: Syncing habit data')
    );
  }
});

// Push notifications for habit reminders (future enhancement)
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Time to complete your Islamic habits',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1,
        url: data.url || './index.html'
      },
      actions: [
        {
          action: 'view-habits',
          title: 'View Habits'
        },
        {
          action: 'mark-complete',
          title: 'Mark Complete'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ],
      tag: 'habit-reminder',
      renotify: true,
      requireInteraction: false
    };

    event.waitUntil(
      self.registration.showNotification('⏱️ Islamic Habit Tracker', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || './index.html';

  if (event.action === 'view-habits') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          // Check if app is already open
          for (const client of clients) {
            if (client.url.includes('index.html') && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if app not already open
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen + '#today');
          }
        })
    );
  } else if (event.action === 'mark-complete') {
    // Could implement quick habit marking here
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          if (clients.length > 0) {
            clients[0].postMessage({ type: 'QUICK_MARK_HABIT' });
            return clients[0].focus();
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen + '#today');
          }
        })
    );
  } else {
    // Default action - just open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          if (clients.length > 0) {
            return clients[0].focus();
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('Service Worker: Notification closed');
});