import { useState } from "react";
import { DINING, MEAL_LABEL } from "../data/dining";
import { voteLabel } from "../lib/consensus";
import { BOOKING_DAYS_BEFORE, bookingOpensJst, filterDining, type DiningArea, type DiningFilter, type DiningType } from "../lib/dining";
import type { MealPeriod, Votes } from "../types";
import { RideCard } from "./RideCard";

const KEY = "wdw-futari:filters:dining";
const EMPTY: DiningFilter = { type: "ALL", area: "ALL", meal: "ALL", q: "" };
const TYPES: readonly { id: DiningType; label: string }[] = [
  { id: "ALL", label: "すべての店" },
  { id: "character", label: "キャラクターに会える" },
  { id: "plain", label: "ふつうのレストラン" },
];
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
      type: TYPES.some((t) => t.id === r.type) ? (r.type as DiningType) : "ALL",
      area: AREAS.some((a) => a.id === r.area) ? (r.area as DiningArea) : "ALL",
      meal: MEALS.includes(r.meal as MealPeriod) ? (r.meal as MealPeriod | "ALL") : "ALL",
      q: typeof r.q === "string" ? r.q.slice(0, 100) : "",
    };
  } catch {
    return EMPTY;
  }
}

interface Props {
  myVotes: Votes;
  onGoVote: (rideId: string) => void;
}

/** レストランの一覧（キャラクターダイニング＋ホテルのレストラン）。投票は「投票」タブで乗り物と一緒に行う */
export function DiningScreen({ myVotes, onGoVote }: Props) {
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
      <h2>レストラン</h2>
      <p className="note">
        キャラクターがテーブルを回ってくる「キャラクターダイニング」{DINING.filter((d) => d.dining?.characters).length}店と、ホテルの中のふつうのレストラン{DINING.filter((d) => !d.dining?.characters).length}店。人気店は予約なしではまず入れません。ホテルの店は入園チケットなしで行けて、そのホテルから行きやすいパークのエリアに入れています。
      </p>

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
          placeholder="店名・キャラクター・料理で検索（例: スティッチ、ステーキ）"
          aria-label="店名・キャラクター・料理で検索"
          value={filter.q}
          onChange={(e) => update({ q: e.target.value })}
        />
        {filter.q !== "" && (
          <button className="search-clear" aria-label="検索の言葉を消す" onClick={() => update({ q: "" })}>
            ×
          </button>
        )}
      </div>
      <div className="chips" role="tablist" aria-label="キャラクターの有無で絞り込む">
        {TYPES.map((t) => (
          <button key={t.id} role="tab" aria-selected={filter.type === t.id} className={filter.type === t.id ? "chip on" : "chip"} onClick={() => update({ type: t.id })}>
            {t.label}
          </button>
        ))}
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
        {list.map((r) => {
          const mine = myVotes[r.id];
          return (
            <RideCard
              key={r.id}
              ride={r}
              detail
              jump={{ label: mine ? `⭐ 投票済み「${voteLabel(r, mine)}」を変える` : "⭐ これに投票する（行くならいつ？も選べる）", onClick: () => onGoVote(r.id) }}
            />
          );
        })}
        {list.length === 0 && <p className="empty">この条件に当てはまる店はありません。</p>}
      </div>
    </section>
  );
}
