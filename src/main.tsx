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

// Service Worker の登録・利用者による更新切替は AppUpdate で管理する
