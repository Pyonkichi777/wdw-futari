import { useEffect, useRef, useState } from "react";
import { reloadBlocked, useReloadBlocked } from "../lib/reloadSafety";
import { APP_VERSION } from "../lib/version";

/** 自動再読込はしない。入力・送信を終えた利用者が新しい版へ切り替える */
export function AppUpdate() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const blocked = useReloadBlocked();
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent): void => {
      if (reloadBlocked()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    const detect = (reg: ServiceWorkerRegistration): void => {
      if (reg.waiting && navigator.serviceWorker.controller && alive) setAvailable(true);
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller && alive) setAvailable(true);
      });
    };
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((reg) => {
      registration.current = reg;
      detect(reg);
      reg.addEventListener("updatefound", () => detect(reg));
    }).catch(() => undefined);
    const check = async (): Promise<void> => {
      if (document.visibilityState !== "visible") return;
      try {
        await registration.current?.update();
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (alive && typeof data === "object" && data !== null && "version" in data && typeof data.version === "string" && data.version !== APP_VERSION) setAvailable(true);
      } catch { /* 通信断は更新通知を消さない。今の版で閲覧を続ける */ }
    };
    const onFocus = (): void => { void check(); };
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void check();
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  const update = async (): Promise<void> => {
    if (reloadBlocked() || busy) return;
    setBusy(true); setMessage(null);
    try {
      const reg = registration.current;
      await reg?.update();
      if (reloadBlocked()) return;
      if (reg?.waiting) {
        // 入力が始まったり別の保存が発生したら、切替後も自動で再読込しない
        await new Promise<void>((resolve, reject) => {
          const done = (): void => { clearTimeout(timer); navigator.serviceWorker.removeEventListener("controllerchange", done); resolve(); };
          const timer = window.setTimeout(() => { navigator.serviceWorker.removeEventListener("controllerchange", done); reject(new Error("timeout")); }, 10_000);
          navigator.serviceWorker.addEventListener("controllerchange", done);
          reg.waiting?.postMessage({ type: "SKIP_WAITING" });
        });
      }
      if (!reloadBlocked()) window.location.reload();
    } catch { setMessage("更新できませんでした。接続を確認して、もう一度お試しください。"); }
    finally { setBusy(false); }
  };
  return <aside className="app-version" aria-label="アプリの版と更新">
    <small>アプリ版 {APP_VERSION}</small>
    {available && <div role="status"><strong>新しい版があります。</strong> 保存を終えてから切り替えてください。<button className="mini" disabled={blocked || busy} onClick={() => void update()}>{busy ? "切替中…" : "保存を終えて最新版に切り替える"}</button></div>}
    {available && blocked && <p>入力途中または保存中です。入力を保存するか戻すと切り替えられます。</p>}
    {message && <p role="status">{message}</p>}
  </aside>;
}
