// アプリ本体（HTML・JS・CSS）を端末に保存し、電波がなくても開けるようにする。
// データ（投票など）はFirestoreが端末内に別途保存・同期する。
const CACHE = "wdw-futari-v3";
const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];
// 地図の画像（OpenStreetMap）は、一度見たものを端末に保存する（パーク内で電波が弱くても地図が出るように）
const TILE_CACHE = "wdw-futari-tiles-v1";
const TILE_ORIGIN = "https://tile.openstreetmap.org";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  // Webフォントは一度読んだら端末に保存（電波がなくても同じ見た目に）
  if (FONT_ORIGINS.includes(url.origin)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  if (url.origin === TILE_ORIGIN) {
    e.respondWith(
      caches.open(TILE_CACHE).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ??
            fetch(req).then((res) => {
              if (res.ok) c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // ニュースは毎朝更新されるので、つながるときは必ず最新を取りに行く（圏外なら最後に読んだもの）
  const feedName = ["news.json", "crowd.json", "hours.json"].find((n) => url.pathname.endsWith(`/${n}`));
  if (feedName) {
    const key = new Request(new URL(feedName, self.registration.scope).href);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((r) => r ?? Response.error())),
    );
    return;
  }
  // HTMLは最新を優先（更新を早く届ける）。取れなければ保存しておいたものを使う
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r ?? caches.match(self.registration.scope))),
    );
    return;
  }
  // JS・CSS・画像は、保存済みならそれを使う（ファイル名に版が入るので古くならない）
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
