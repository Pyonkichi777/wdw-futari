/** 画面の明るさ（自動＝スマホの設定に合わせる／ライト／ダーク）。端末ごとに覚える */
export type Theme = "auto" | "light" | "dark";

const KEY = "wdw-futari:theme";
export const THEMES: readonly Theme[] = ["auto", "light", "dark"];
export const THEME_LABEL: Record<Theme, string> = { auto: "🌓 自動", light: "☀️ ライト", dark: "🌙 ダーク" };

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

/** <html data-theme="…"> を付け外しする（CSS は data-theme があればそれを、なければスマホの設定を使う） */
export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function saveTheme(t: Theme): void {
  try {
    if (t === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // 保存できない環境では、その場だけ切り替える
  }
  applyTheme(t);
}

/** 自動 → ライト → ダーク → 自動 */
export const nextTheme = (t: Theme): Theme => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length] ?? "auto";
