import { useEffect, useState } from "react";
import { rideById } from "../data/rides";
import { CATEGORY_LABEL, IMPACT_LABEL, OVERLAP_LABEL, type NewsItem } from "../lib/news";
import { useNews } from "./NewsContext";
import type { HoursFeed } from "../lib/hours";
import type { CrowdFeed } from "../lib/crowd";
import { patrolStatus } from "../lib/patrol";
import type { Plan } from "../lib/plan";
import { placeText, placesInPlan } from "../lib/planLookup";
import { optimizePlan } from "../lib/route";

/** 旅行の計画に影響する最新ニュース（毎朝の自動巡回で更新） */
export function NewsScreen({ plan: stored, hours, crowd }: { plan: Plan; hours: HoursFeed | null; crowd: CrowdFeed | null }) {
  // 作戦タブと同じ並び・時刻で見る（ニュースの文章には日付を書かず、ここで今の作戦と結びつける）
  const plan = optimizePlan(stored);
  const { feed, error, reload, seen, markAllSeen } = useNews();
  const [hideOutside, setHideOutside] = useState(true);
  // 開いた時点で未読だったもの（「NEW」の印に使う）。表示したら既読にしてバッジを消す
  const [fresh, setFresh] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!feed || fresh) return;
    setFresh(new Set(feed.items.filter((n) => !seen.has(n.id)).map((n) => n.id)));
    markAllSeen();
  }, [feed, fresh, seen, markAllSeen]);
  const items = (feed?.items ?? []).filter((n) => !hideOutside || n.overlapsTrip !== "no");
  const hidden = (feed?.items.length ?? 0) - items.length;

  return (
    <section>
      <h2>旅のニュース</h2>
      <p className="note">
        ゴンドラ・アトラクションの運休、パレードの変更など、計画に影響するニュースを毎朝6:48に自動で確認しています（新しいニュースがない日は、この一覧は変わりません）。
        {feed?.updatedAt && `ニュースを最後に追加・更新した日: ${new Date(feed.updatedAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" })}`}
      </p>
      <PatrolStatus crowd={crowd} />
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
          <NewsCard key={n.id} n={n} isNew={fresh?.has(n.id) ?? false} plan={plan} hours={hours} />
        ))}
        {feed && items.length === 0 && <p className="empty">いまのところ、旅行に影響するニュースはありません。</p>}
      </div>
    </section>
  );
}

function NewsCard({ n, isNew, plan, hours }: { n: NewsItem; isNew: boolean; plan: Plan; hours: HoursFeed | null }) {
  return (
    <article className={`card news impact-${n.impact}`}>
      <div className="news-head">
        {isNew && <span className="news-new">NEW</span>}
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
        <ul className="news-plan">
          {n.rideIds.map((id) => {
            const places = placesInPlan(plan, id, rideById, hours);
            return (
              <li key={id}>
                <strong>{rideById(id)?.nameJa ?? id}</strong>
                {places.length > 0 ? (
                  <span>📅 今の作戦: {places.map(placeText).join(" ／ ")}</span>
                ) : (
                  <span className="muted">今の作戦には入っていません（今の予定への直接の影響なし）</span>
                )}
              </li>
            );
          })}
        </ul>
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

/** 毎朝の巡回が動いているか（混雑予想の取得日＝最後に巡回できた日）。止まっていたら知らせる */
function PatrolStatus({ crowd }: { crowd: CrowdFeed | null }) {
  const st = patrolStatus(crowd?.fetchedAt ?? null, new Date());
  return (
    <p className={st.stale ? "banner warn" : "note patrol-ok"}>
      {st.last === null
        ? "⚠️ 毎朝の巡回の記録が読めません（電波を確認してから開き直してください）"
        : st.stale
          ? `⚠️ 毎朝の巡回が${st.daysAgo}日止まっています（最後に巡回できた日: ${st.last}）。ニュース・混雑予想が古い可能性があります`
          : `✅ 最後に巡回できた日: ${st.last}（新しいニュースがなくても、毎朝この日付が進みます）`}
    </p>
  );
}
