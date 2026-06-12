// Helicopter game — music asset service worker.
// Intentionally narrow: it only caches the biome music under /music/ and
// passes every other request straight through to the network, so it can make
// the soundtrack available offline without interfering with the Next.js app
// shell, HTML, JS, or any other asset.

const CACHE = "heli-music-v1";
const MUSIC_ASSETS = [
  "/music/cave.mp3",
  "/music/dawn.mp3",
  "/music/deep-ocean.mp3",
  "/music/storm.mp3",
  "/music/volcano.mp3",
  "/music/neon-city.mp3",
  "/music/deep-space.mp3",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // allSettled: a single missing file must not abort the whole install.
      Promise.allSettled(MUSIC_ASSETS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop older versions of this cache.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("heli-music-") && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isMusic =
    url.origin === self.location.origin && url.pathname.startsWith("/music/");
  if (!isMusic) return; // passthrough — default browser handling

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res && res.ok) cache.put(event.request, res.clone());
        return res;
      } catch (err) {
        const fallback = await cache.match(event.request);
        if (fallback) return fallback;
        throw err;
      }
    })
  );
});
