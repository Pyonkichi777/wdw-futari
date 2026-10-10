// アプリ本体（HTML・JS・CSS）を端末に保存し、電波がなくても開けるようにする。
// データ（投票など）はFirestoreが端末内に別途保存・同期する。
const CACHE = "wdw-futari-v2";
const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
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
  if (url.origin !== self.location.origin) return;
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
