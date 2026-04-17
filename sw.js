const CACHE = "wardrobe-v1";
const ASSETS = [
  "/wardrobe-planner/",
  "/wardrobe-planner/index.html",
  "/wardrobe-planner/manifest.json",
  "/wardrobe-planner/icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});