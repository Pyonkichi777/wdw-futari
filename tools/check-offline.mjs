// ビルド済みのService Workerを、メモリ上の通信・キャッシュで検証する。本番データへ接続しない
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";

const scope = "https://test.example/wdw-futari/";
const handlers = new Map();
const stores = new Map();
let offline = false;
let skips = 0;
const key = (request) => typeof request === "string" ? request : request.url;
const fetchFile = async (request) => {
  if (offline) throw new Error("通信断（検証用）");
  const url = new URL(key(request));
  const path = url.pathname.replace("/wdw-futari/", "") || "index.html";
  return new Response(await readFile(new URL(`../dist/${path}`, import.meta.url)));
};
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name);
    return {
      match: async (request) => data.get(key(request))?.clone(),
      put: async (request, response) => { data.set(key(request), response.clone()); },
      addAll: async (requests) => { for (const request of requests) data.set(key(request), await fetchFile(request)); },
    };
  },
  keys: async () => [...stores.keys()],
  delete: async (name) => stores.delete(name),
};
runInNewContext(await readFile(new URL("../dist/sw.js", import.meta.url), "utf8"), {
  URL, Response, fetch: fetchFile, caches,
  self: { registration: { scope }, location: { origin: "https://test.example" }, clients: { claim: async () => {} }, skipWaiting: async () => { skips++; }, addEventListener: (name, handler) => handlers.set(name, handler) },
});
let installing;
handlers.get("install")({ waitUntil: (promise) => { installing = promise; } });
await installing;
assert.equal(skips, 0, "入力中でも勝手に切り替えるinstallにしない");
const shellName = (await caches.keys())[0];
const shell = stores.get(shellName);
assert.ok([...shell.keys()].some((url) => url.endsWith(".js")));
assert.ok([...shell.keys()].some((url) => url.endsWith(".css")));
offline = true;
const serve = async (url, mode = "navigate") => {
  let result;
  handlers.get("fetch")({ request: { method: "GET", url, mode }, respondWith: (promise) => { result = promise; } });
  return result;
};
assert.match(await (await serve(`${scope}?restart=1`)).text(), /<div id="root">/);
for (const url of shell.keys()) if (/\.(js|css)$/.test(url)) assert.ok((await serve(url, "cors")).ok);
handlers.get("message")({ data: { type: "SKIP_WAITING" } });
assert.equal(skips, 1);
await caches.open("another-app-cache");
await caches.open("wdw-futari-shell-old");
let activating;
handlers.get("activate")({ waitUntil: (promise) => { activating = promise; } });
await activating;
assert.ok(stores.has("another-app-cache"));
assert.ok(!stores.has("wdw-futari-shell-old"));
console.log("T02/R03: アプリ本体の事前保存、通信断・再起動相当のHTML/JS/CSS読出し、手動切替、他アプリのキャッシュ保持を確認");
