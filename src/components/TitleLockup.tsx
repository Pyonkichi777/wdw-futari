/** アプリ名のロゴ（英字の小見出し＋日本語の2段組み） */
export function TitleLockup({ center = false }: { center?: boolean }) {
  return (
    <div className={center ? "title-lockup center" : "title-lockup"}>
      <span className="eyebrow">Florida Landing Tour</span>
      <h1 aria-label="ぞうたんフロリダ上陸ツアー">
        <span className="t1">ぞうたん</span>
        <span className="t2">フロリダ上陸ツアー</span>
      </h1>
    </div>
  );
}
