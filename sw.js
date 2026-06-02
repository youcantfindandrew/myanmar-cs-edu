// Service Worker — Cache-first strategy
// Bump CACHE_NAME to force a fresh cache on next visit.
const CACHE_NAME = 'myanmar-cs-v2';

// Every file the app needs to work fully offline.
// Keep this list in sync with the actual files in the repo.
const CACHE_MANIFEST = [
  './',
  './index.html',
  './manifest.json',

  // Styles
  './css/main.css',
  './css/lessons.css',
  './css/editor.css',
  './css/tutor.css',

  // App JS
  './js/app.js',
  './js/router.js',
  './js/db.js',
  './js/progress.js',
  './js/lessons.js',
  './js/editor.js',
  './js/tutor.js',
  './js/stats.js',

  // Pyodide sandbox
  './pyodide-sandbox.html',

  // CodeMirror 6 vendor bundle
  './vendor/codemirror/codemirror.min.js',

  // Lesson manifest + all lessons
  './lessons/index.json',
  './lessons/01-what-is-code.json',
  './lessons/02-variables.json',
  './lessons/03-data-types.json',
  './lessons/04-input-output.json',
  './lessons/05-conditionals.json',
  './lessons/06-loops.json',
  './lessons/07-functions.json',
  './lessons/08-lists.json',
  './lessons/09-debugging.json',
  './lessons/10-mini-project-calculator.json',
  './lessons/11-strings.json',
  './lessons/12-dictionaries.json',
  './lessons/13-final-project.json',

  // Assets — icons
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',

  // Fonts (self-hosted IBM Plex)
  './assets/fonts/IBMPlexSans-Regular.woff2',
  './assets/fonts/IBMPlexSans-Medium.woff2',
  './assets/fonts/IBMPlexSans-Bold.woff2',
  './assets/fonts/IBMPlexMono-Regular.woff2',
  './assets/fonts/IBMPlexMono-Bold.woff2',
];

// ─── Install: pre-cache everything ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_MANIFEST);
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch: cache-first, network fallback ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests; skip cross-origin requests (e.g. model files)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Don't intercept requests to other origins (WebLLM CDN fallback, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Not in cache — try network, then cache the result
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Network also failed — return a minimal offline page for navigation
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
