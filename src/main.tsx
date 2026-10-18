import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { applyTheme, readTheme } from "./lib/theme";

// 画面を描く前に明るさを当てる（ちらつき防止）
applyTheme(readTheme());

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// オフラインでも開けるように、アプリ本体を端末に保存する
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
