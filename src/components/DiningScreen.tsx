import { useState } from "react";
import { DINING, MEAL_LABEL, PRICE_LABEL, STYLE_LABEL, type CharacterDining, type MealPeriod } from "../data/dining";
import { parkName } from "../data/parks";
import { BOOKING_DAYS_BEFORE, bookingOpensJst, filterDining, type DiningArea, type DiningFilter } from "../lib/dining";
import { OFFICIAL_SITE } from "../lib/links";

const KEY = "wdw-futari:filters:dining";
const EMPTY: DiningFilter = { area: "ALL", meal: "ALL", q: "" };
const AREAS: readonly { id: DiningArea; label: string }[] = [
  { id: "ALL", label: "すべて" },
  { id: "park", label: "パークの中" },
  { id: "resort", label: "ホテルの中" },
];
const MEALS: readonly (MealPeriod | "ALL")[] = ["ALL", "breakfast", "lunch", "dinner"];

function load(): DiningFilter {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return EMPTY;
    const r = raw as Record<string, unknown>;
    return {
      area: AREAS.some((a) => a.id === r.area) ? (r.area as DiningArea) : "ALL",
      meal: MEALS.includes(r.meal as MealPeriod) ? (r.meal as MealPeriod | "ALL") : "ALL",
      q: typeof r.q === "string" ? r.q.slice(0, 100) : "",
    };
  } catch {
    return EMPTY;
  }
}

/** キャラクターダイニング（キャラクターに会えるレストラン）の一覧 */
export function DiningScreen() {
  const [filter, setFilter] = useState<DiningFilter>(load);
  const update = (patch: Partial<DiningFilter>): void => {
    const next = { ...filter, ...patch };
    setFilter(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // 保存できなくても画面の中では効く
    }
  };
  const list = filterDining(DINING, filter);

  return (
    <section>
      <h2>キャラクターダイニング</h2>
      <p className="note">キャラクターがテーブルを回ってきて、写真やサインに応じてくれるレストラン{DINING.length}店。どの店も事前予約ができ、人気店は予約なしではまず入れません。</p>

      <div className="booking-box">
        <p className="booking-title">📅 予約はいつから？</p>
        <p>
          直営ホテル（ポップセンチュリー）に泊まる人は、<strong>チェックイン日の{BOOKING_DAYS_BEFORE}日前の朝6時（米東部時間）</strong>から、滞在中の全日分（最大10日）をまとめて予約できます。
        </p>
        <dl className="access">
          <div className="strong">
            <dt>4/30チェックイン</dt>
            <dd>{bookingOpensJst("2027-04-30")}（日本時間）</dd>
          </div>
          <div>
            <dt>4/29チェックイン</dt>
            <dd>{bookingOpensJst("2027-04-29")}（日本時間）</dd>
          </div>
        </dl>
        <p className="note">予約は公式アプリ「My Disney Experience」から。予約時にクレジットカードの登録が必要で、直前の取り消しや無断キャンセルには料金がかかります（金額は予約画面に表示）。満席でも、当日アプリの「空き待ちリスト（Walk-up List）」で入れることがあります。</p>
      </div>

      <div className="search-box" role="search">
        <span className="search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          enterKeyHint="search"
          placeholder="店名・キャラクターで検索（例: スティッチ）"
          aria-label="店名・キャラクターで検索"
          value={filter.q}
          onChange={(e) => update({ q: e.target.value })}
        />
        {filter.q !== "" && (
          <button className="search-clear" aria-label="検索の言葉を消す" onClick={() => update({ q: "" })}>
            ×
          </button>
        )}
      </div>
      <div className="chips" role="tablist" aria-label="場所で絞り込む">
        {AREAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={filter.area === a.id} className={filter.area === a.id ? "chip on" : "chip"} onClick={() => update({ area: a.id })}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="chips" role="tablist" aria-label="食事の時間帯で絞り込む">
        {MEALS.map((m) => (
          <button key={m} role="tab" aria-selected={filter.meal === m} className={filter.meal === m ? "chip on" : "chip"} onClick={() => update({ meal: m })}>
            {m === "ALL" ? "時間帯すべて" : MEAL_LABEL[m]}
          </button>
        ))}
      </div>
      <p className="count">{list.length}店を表示</p>
      <div className="list">
        {list.map((d) => (
          <DiningCard key={d.id} d={d} />
        ))}
        {list.length === 0 && <p className="empty">この条件に当てはまる店はありません。</p>}
      </div>
    </section>
  );
}

function DiningCard({ d }: { d: CharacterDining }) {
  const parkClass = d.area === "resort" ? "resort" : d.area;
  return (
    <article className={`card dining park-${parkClass}`}>
      <header className="card-head">
        <div>
          <h3>{d.nameJa}</h3>
          <p className="en">{d.nameEn}</p>
        </div>
      </header>
      <ul className="meta">
        <li className={`park park-${parkClass}`}>{d.area === "resort" ? "ホテル" : parkName(d.area)}</li>
        {d.meals.map((m) => (
          <li key={m} className="accent">
            {MEAL_LABEL[m]}
          </li>
        ))}
        <li className={d.booking === "disney" ? "reserve-ok" : "reserve-other"}>{d.booking === "disney" ? "予約できる（60日前から）" : "予約はホテル側"}</li>
        {d.walkUp && <li>当日の空き待ちリストあり</li>}
        <li>{d.needsAdmission ? "入園チケットが必要" : "入園チケット不要"}</li>
      </ul>
      <p className="desc">{d.description}</p>
      <dl className="access">
        <div className="strong">
          <dt>会えるキャラクター</dt>
          <dd>{d.characters}</dd>
        </div>
        <div>
          <dt>キャラクターが出る食事</dt>
          <dd>{d.meals.map((m) => MEAL_LABEL[m]).join("・")}</dd>
        </div>
        <div>
          <dt>予約</dt>
          <dd>
            {d.booking === "disney"
              ? `できる（公式アプリで${BOOKING_DAYS_BEFORE}日前から）${d.walkUp ? "。満席なら当日の空き待ちリストも使える" : ""}`
              : "できる（ディズニーではなくホテル側で予約。方法は公式ページで確認）"}
          </dd>
        </div>
        <div>
          <dt>場所</dt>
          <dd>{d.place}</dd>
        </div>
        <div>
          <dt>行き方</dt>
          <dd>{d.access}</dd>
        </div>
        <div>
          <dt>料理</dt>
          <dd>{STYLE_LABEL[d.style]}</dd>
        </div>
        <div>
          <dt>価格帯</dt>
          <dd>{PRICE_LABEL[d.price]}</dd>
        </div>
      </dl>
      {d.caution && <p className="caution">⚠ {d.caution}</p>}
      <div className="ride-links">
        <a href={`${OFFICIAL_SITE}${d.officialPath}`} target="_blank" rel="noopener noreferrer">
          公式サイト ↗
        </a>
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${d.nameEn} character dining`)}`} target="_blank" rel="noopener noreferrer">
          動画で見る ↗
        </a>
        <a href={`https://www.google.com/search?q=${encodeURIComponent(`${d.nameJa} キャラクターダイニング WDW`)}`} target="_blank" rel="noopener noreferrer">
          日本語で調べる ↗
        </a>
      </div>
    </article>
  );
}
