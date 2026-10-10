import { useState } from "react";
import { rideById } from "../data/rides";
import { CATEGORY_LABEL, IMPACT_LABEL, OVERLAP_LABEL, type NewsItem } from "../lib/news";
import { useNews } from "./NewsContext";

/** 旅行の計画に影響する最新ニュース（毎朝の自動巡回で更新） */
export function NewsScreen() {
  const { feed, error, reload } = useNews();
  const [hideOutside, setHideOutside] = useState(true);
  const items = (feed?.items ?? []).filter((n) => !hideOutside || n.overlapsTrip !== "no");
  const hidden = (feed?.items.length ?? 0) - items.length;

  return (
    <section>
      <h2>旅のニュース</h2>
      <p className="note">
        ゴンドラ・アトラクションの運休、パレードの変更など、計画に影響するニュースを毎朝自動で集めています。
        {feed?.updatedAt && `最終更新: ${new Date(feed.updatedAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" })}`}
      </p>
      <label className="toggle">
        <input type="checkbox" checked={hideOutside} onChange={(e) => setHideOutside(e.target.checked)} />
        旅行期間（4/29〜5/7）に関係ないものを隠す{hideOutside && hidden > 0 && `（${hidden}件）`}
      </label>
      {error && (
        <p className="banner warn">
          {error}
          <button onClick={reload}>もう一度</button>
        </p>
      )}
      {!feed && !error && <p className="empty">読み込み中…</p>}
      <div className="list">
        {items.map((n) => (
          <NewsCard key={n.id} n={n} />
        ))}
        {feed && items.length === 0 && <p className="empty">いまのところ、旅行に影響するニュースはありません。</p>}
      </div>
    </section>
  );
}

function NewsCard({ n }: { n: NewsItem }) {
  return (
    <article className={`card news impact-${n.impact}`}>
      <div className="news-head">
        <span className={`impact impact-${n.impact}`}>{IMPACT_LABEL[n.impact]}</span>
        <span className="news-cat">{CATEGORY_LABEL[n.category]}</span>
        <span className={`overlap overlap-${n.overlapsTrip}`}>{OVERLAP_LABEL[n.overlapsTrip]}</span>
      </div>
      <h3>{n.title}</h3>
      <p className="sub">
        {n.publishedAt}
        {n.period && `　期間: ${n.period.from ?? "?"} 〜 ${n.period.to ?? "未定"}`}
      </p>
      <p className="desc">{n.summary}</p>
      {n.action && <p className="news-action">👉 {n.action}</p>}
      {n.rideIds.length > 0 && (
        <p className="sub">関係するアトラクション: {n.rideIds.map((id) => rideById(id)?.nameJa ?? id).join("、")}</p>
      )}
      <div className="ride-links">
        {n.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
            {s.title} ↗
          </a>
        ))}
      </div>
    </article>
  );
}
