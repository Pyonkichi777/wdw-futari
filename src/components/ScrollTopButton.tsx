import { useEffect, useState } from "react";

/** この距離より下までスクロールしたらボタンを出す（px） */
const SHOW_AFTER = 600;

export const scrollToTop = (): void => window.scrollTo({ top: 0, behavior: "smooth" });

/** 画面右下の「一番上へ戻る」ボタン。下の方まで見たときだけ出る */
export function ScrollTopButton() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = (): void => setShown(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button className={shown ? "scroll-top shown" : "scroll-top"} onClick={scrollToTop} aria-label="一番上へ戻る" tabIndex={shown ? 0 : -1} aria-hidden={!shown}>
      <span aria-hidden="true">↑</span>
      <small>上へ</small>
    </button>
  );
}
