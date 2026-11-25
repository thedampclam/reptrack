// RepTrack service worker. Change VERSION on every release: a new value makes installed copies fetch the new files.
const VERSION = '1.0.0';
const CACHE = 'reptrack-' + VERSION;
const CORE = [
  './', 'index.html', 'engine.js', 'library.js', 'asset-shim.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'mp/pose.js', 'mp/pose_solution_packed_assets_loader.js',
  'mp/pose_solution_simd_wasm_bin.js', 'mp/pose_solution_simd_wasm_bin.wasm',
  'mp/pose_landmark_lite.tflite.b64.txt', 'mp/pose_solution_packed_assets.data.b64.txt', 'mp/pose_web.binarypb.b64.txt'
];
// Not precached (devices without WebAssembly SIMD only): cached the first time they are used.

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));   // waits for the user to accept the update
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('reptrack-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
