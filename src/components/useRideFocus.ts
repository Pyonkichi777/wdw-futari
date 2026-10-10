import { useEffect, useState } from "react";

/** 図鑑⇔投票のリンクで飛んできたときの「このアトラクションを見せて」という指示 */
export interface RideFocus {
  rideId: string;
  /** 同じアトラクションへ続けて飛んだときも反応させるための通し番号 */
  seq: number;
}

/** 指定のカードまでスクロールし、しばらく光らせる。光らせているカードのidを返す */
export function useRideFocus(focus: RideFocus | null): string | null {
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`ride-${focus.rideId}`);
    if (!el) return;
    // ヘッダーが画面上部に固定されている場合は、その下にカードの頭が来るようにする
    const header = document.querySelector<HTMLElement>(".top");
    const pinned = header !== null && ["sticky", "fixed"].includes(getComputedStyle(header).position);
    const offset = (pinned ? header.offsetHeight : 0) + 12;
    window.scrollTo({ top: pageTop(el) - offset, behavior: "instant" });
    setLit(focus.rideId);
    const t = window.setTimeout(() => setLit(null), 2400);
    return () => window.clearTimeout(t);
  }, [focus]);
  return lit;
}

/** ページ先頭からの位置。カードの出現アニメーション（ずらし表示）に影響されないよう offsetTop で測る */
function pageTop(el: HTMLElement): number {
  let top = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent instanceof HTMLElement ? e.offsetParent : null) top += e.offsetTop;
  return top;
}
