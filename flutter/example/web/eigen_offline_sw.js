// The app shell's cache, so a game can be opened with no network.
//
// Flutter stopped generating a service worker in 2025, and the browser cache it
// left behind is not a promise: it is evicted on its own terms and never
// answers a cold start offline. Offline play needs the opposite guarantee, so
// this worker is the app's own, small and readable rather than generated.
//
// Runtime caching, not a precache manifest. Flutter's build emits hashed file
// names that a checked-in manifest would have to track release by release; what
// this does instead is remember what the app actually asked for, which after one
// online visit is exactly the shell.

const CACHE = "eigen-shell-v1";

// Never cached: the engine's own API and socket. They are the live truth, and a
// stale answer from here would be worse than an honest failure the app already
// knows how to render.
const isApi = (url) => url.pathname.startsWith("/api/");

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready; there is no migration to stage.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;

  // A navigation is the app opening. Prefer the network so a deploy is picked
  // up, and fall back to whatever shell was cached, which is what makes a cold
  // start offline work at all.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
          return response;
        } catch (error) {
          const cached = (await caches.match(request)) || (await caches.match("/"));
          if (cached) return cached;
          throw error;
        }
      })(),
    );
    return;
  }

  // Everything else the shell is built from: answer from the cache instantly and
  // refresh it in the background, so a release lands on the next load.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch((error) => {
          if (cached) return cached;
          throw error;
        });
      return cached || network;
    })(),
  );
});
