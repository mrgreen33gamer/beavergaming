// Helicopter game — music asset service worker.
//
// Scope is intentionally narrow: only requests to /music/* are touched.
// Everything else passes straight through to the network so this can never
// interfere with the Next.js app shell, HTML, JS, or any other asset.
//
// The tricky bit is that <audio> elements load media via HTTP Range
// requests ("Range: bytes=0-..." etc). If a service worker intercepts those
// and responds with a 200 + full body, Chrome strictly rejects it and aborts
// playback. So we keep the FULL response in cache and slice a 206 Partial
// Content response out of it for Range requests — same contract the network
// would normally honour.

const CACHE = "heli-music-v2";
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
      // allSettled so a single missing/404 file doesn't abort install.
      Promise.allSettled(MUSIC_ASSETS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("heli-music-") && k !== CACHE)
          .map((k) => caches.delete(k))
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

  event.respondWith(handleMusic(event.request));
});

async function handleMusic(request) {
  const cache = await caches.open(CACHE);
  // Cache lookup uses the bare URL — the precached entry has no Range header.
  const cacheKey = new Request(request.url);
  let cached = await cache.match(cacheKey);

  if (!cached) {
    // Not in cache yet: fetch the FULL file (strip any Range header from the
    // outgoing request so the server gives us 200 + complete body, which is
    // what makes future Range slicing possible).
    try {
      const fullRes = await fetch(request.url, { cache: "no-store" });
      if (fullRes && fullRes.ok) {
        await cache.put(cacheKey, fullRes.clone());
        cached = fullRes;
      } else {
        return fetch(request); // last resort: forward the original request
      }
    } catch {
      return fetch(request);
    }
  }

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) return cached;

  return makeRangeResponse(cached, rangeHeader);
}

async function makeRangeResponse(fullResponse, rangeHeader) {
  // Read the full body. We .clone() so the cached Response stays unconsumed
  // and can answer subsequent Range requests too.
  const buffer = await fullResponse.clone().arrayBuffer();
  const total = buffer.byteLength;

  // Parse "bytes=START-END". Either side may be empty (e.g. "bytes=0-",
  // "bytes=100-499", "bytes=-500"). We support the open-ended forms.
  const match = /bytes=(\d*)-(\d*)/i.exec(rangeHeader);
  if (!match) {
    return new Response(buffer, {
      status: 200,
      headers: passThroughHeaders(fullResponse, total),
    });
  }
  let start = match[1] !== "" ? parseInt(match[1], 10) : NaN;
  let end = match[2] !== "" ? parseInt(match[2], 10) : NaN;
  if (Number.isNaN(start) && !Number.isNaN(end)) {
    // suffix form: bytes=-N  →  last N bytes
    start = Math.max(0, total - end);
    end = total - 1;
  } else {
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;
  }

  if (start > end || start >= total) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${total}` },
    });
  }

  const slice = buffer.slice(start, end + 1);
  const headers = new Headers();
  headers.set(
    "Content-Type",
    fullResponse.headers.get("Content-Type") || "audio/mpeg"
  );
  headers.set("Content-Length", String(slice.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

function passThroughHeaders(res, total) {
  const h = new Headers();
  h.set("Content-Type", res.headers.get("Content-Type") || "audio/mpeg");
  h.set("Content-Length", String(total));
  h.set("Accept-Ranges", "bytes");
  return h;
}
