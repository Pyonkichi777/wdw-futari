// ビルド時に版とアプリ本体のファイル一覧を埋め込む。保存データはここでは扱わない
const VERSION = __BUILD__;
const PRECACHE = __PRECACHE__;
const CACHE = `wdw-futari-shell-${VERSION}`;
const DATA_CACHE = "wdw-futari-data-v1";
const TILE_CACHE = "wdw-futari-tiles-v1";
const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  // 全ファイルの保存成功後にだけ更新待ちにする。自動で旧画面を置き換えない
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((file) => new URL(file, self.registration.scope).href))));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => (key.startsWith("wdw-futari-shell-") && key !== CACHE) || /^wdw-futari-v\d+$/.test(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function cachedFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
  return response;
}
async function networkFirst(request, name, key, fallback) {
  const cache = await caches.open(name);
  try {
    const response = await fetch(request);
    if (response.ok) { await cache.put(key, response.clone()); return response; }
    return (await cache.match(key)) ?? response;
  } catch {
    return (await cache.match(key)) ?? (fallback ? await cache.match(fallback) : undefined) ?? Response.error();
  }
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (FONT_ORIGINS.includes(url.origin) || url.origin === "https://tile.openstreetmap.org") {
    event.respondWith(cachedFirst(request, url.origin === "https://tile.openstreetmap.org" ? TILE_CACHE : DATA_CACHE));
    return;
  }
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // 更新確認は必ずネットワークへ（過去の版情報は返さない）
  if (url.pathname.endsWith("/version.json")) { event.respondWith(fetch(request)); return; }
  const feed = ["news.json", "crowd.json", "hours.json"].find((name) => url.pathname.endsWith(`/${name}`));
  if (feed) {
    event.respondWith(networkFirst(request, DATA_CACHE, new URL(feed, self.registration.scope).href));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CACHE, request, new URL("index.html", self.registration.scope).href));
    return;
  }
  event.respondWith(cachedFirst(request, CACHE));
});
