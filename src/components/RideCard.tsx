import type { ReactNode } from "react";
import { MEAL_LABEL } from "../data/dining";
import { parkName } from "../data/parks";
import { BOOKING_CHIP, diningPlace } from "../lib/dining";
import { LL_SHORT, llKind } from "../lib/lightningLane";
import { REVIEWS } from "../data/reviews";
import { KIND_LABEL, accessLines } from "../lib/access";
import { rideLinks } from "../lib/links";
import { IMPACT_LABEL, newsForRide } from "../lib/news";
import { useNews } from "./NewsContext";
import { MOTION_LABEL, motionDots, motionOf } from "../lib/motion";
import { scoreOf } from "../lib/reviewScore";
import type { GreetStyle, Ride } from "../types";


const GREET_CHIP: Record<GreetStyle, string> = {
  always: "時間帯内ならいつでも",
  timed: "時刻を決めて登場",
  roaming: "歩き回っている",
};

export function RideMeta({ ride }: { ride: Ride }) {
  return (
    <ul className="meta">
      <li className={`park park-${ride.dining?.inPark === false ? "resort" : ride.park}`}>{ride.dining ? diningPlace(ride) : parkName(ride.park)}</li>
      <li>{KIND_LABEL[ride.kind]}</li>
      {ride.dining ? (
        <>
          {ride.dining.meals.map((m) => (
            <li key={m} className="accent">
              {MEAL_LABEL[m]}
            </li>
          ))}
          {ride.dining.characters && <li className="accent">キャラクターに会える</li>}
          <li className={ride.dining.booking === "disney" ? "reserve-ok" : "reserve-other"}>{BOOKING_CHIP[ride.dining.booking]}</li>
          {ride.dining.walkUp && <li>当日の空き待ちリストあり</li>}
        </>
      ) : ride.greet ? (
        <li className="accent">{GREET_CHIP[ride.greet.style]}</li>
      ) : (
        <>
          <li className={`intensity intensity-${ride.intensity}`}>負担: {ride.intensity}</li>
          <li>{ride.minHeightCm ? `身長${ride.minHeightCm}cm以上` : "身長制限なし"}</li>
        </>
      )}
      <MotionChip ride={ride} />
      {!ride.dining && !ride.greet && <li className={`ll ll-${llKind(ride)}`}>{LL_SHORT[llKind(ride)]}</li>}
      {ride.kind === "ride" && ride.earlyEntry && <li className="accent">開園前入園OK</li>}
      {ride.singleRider && <li className="accent">1人乗り専用の列あり</li>}
      <ReviewChip ride={ride} />
      {!ride.dining && <li>{ride.inTokyo ? "東京にもある" : "東京にない"}</li>}
      {ride.tags
        .filter((t) => t !== "ショー")
        .map((t) => (
          <li key={t}>{t === "3D・酔いやすい" ? "映像・3D" : t}</li>
        ))}
    </ul>
  );
}

/** どのチケット・パスで利用できるか */
export function AccessBox({ ride }: { ride: Ride }) {
  return (
    <dl className="access">
      {accessLines(ride).map((l) => (
        <div key={l.label} className={l.strong ? "strong" : undefined}>
          <dt>{l.label}</dt>
          <dd>{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MotionChip({ ride }: { ride: Ride }) {
  const m = motionOf(ride);
  if (ride.kind !== "ride" && m.level === 0) return null;
  return (
    <li className={`motion motion-${m.level}`}>
      酔い度 {motionDots(m.level)} {MOTION_LABEL[m.level]}
    </li>
  );
}

function ReviewChip({ ride }: { ride: Ride }) {
  const review = REVIEWS[ride.id];
  if (!review) return null;
  const s = scoreOf(review);
  if (s.rating === null) return null;
  return <li className="review-chip">口コミ★{s.rating.toFixed(1)}</li>;
}

/** 口コミの評価と総評（TripAdvisor） */
export function ReviewBox({ ride }: { ride: Ride }) {
  const review = REVIEWS[ride.id];
  if (!review) return null;
  const s = scoreOf(review);
  return (
    <div className="review">
      <div className="review-head">
        <span className="review-label">口コミ（TripAdvisor）</span>
        {s.verdict && <span className={`verdict verdict-${s.verdict}`}>{s.verdict}</span>}
      </div>
      {s.rating !== null ? (
        <p className="review-nums">
          <strong>★{s.rating.toFixed(1)}</strong>
          <span>（{s.count?.toLocaleString("ja-JP")}件）</span>
          {s.positivePct !== null && <span>高評価率 {s.positivePct}%</span>}
          {s.lowConfidence && <span className="low">件数が少なく参考値</span>}
        </p>
      ) : (
        <p className="review-nums">
          <span>{s.count !== null && s.count > 0 ? `口コミが${s.count}件と少ないため数値なし` : "★の集計は取得できず（口コミのみ）"}</span>
        </p>
      )}
      <p className="review-summary">{review.summary}</p>
      {review.note && <p className="review-note">※{review.note}</p>}
      <a href={review.url} target="_blank" rel="noopener noreferrer">
        TripAdvisorで口コミを読む ↗
      </a>
    </div>
  );
}

/** 図鑑⇔投票の行き来ボタン */
export interface RideJump {
  label: string;
  onClick: () => void;
}

export function RideCard({ ride, children, detail = false, jump, lit = false }: { ride: Ride; children?: ReactNode; detail?: boolean; jump?: RideJump; lit?: boolean }) {
  return (
    <article id={`ride-${ride.id}`} className={`card park-${ride.park}${lit ? " lit" : ""}`}>
      <header className="card-head">
        {ride.top10 !== undefined && <span className="top10">★TOP{ride.top10}</span>}
        <div>
          <h3>{ride.nameJa}</h3>
          <p className="en">{ride.nameEn}</p>
        </div>
      </header>
      <RideMeta ride={ride} />
      {detail && (
        <>
          <p className="desc">{ride.description}</p>
          <AccessBox ride={ride} />
          <ReviewBox ride={ride} />
        </>
      )}
      <RideNews ride={ride} />
      {ride.caution && <p className="caution">⚠ {ride.caution}</p>}
      <RideLinks ride={ride} />
      {children}
      {jump && (
        <button className="ride-jump" onClick={jump.onClick}>
          {jump.label} →
        </button>
      )}
    </article>
  );
}

/** このアトラクションに関係するニュース（旅行期間外は出さない） */
function RideNews({ ride }: { ride: Ride }) {
  const { feed } = useNews();
  const list = feed ? newsForRide(ride, feed.items) : [];
  if (list.length === 0) return null;
  return (
    <ul className="ride-news">
      {list.map((n) => (
        <li key={n.id} className={`impact-${n.impact}`}>
          📰 <strong>{IMPACT_LABEL[n.impact]}</strong> {n.title}
        </li>
      ))}
    </ul>
  );
}

export function RideLinks({ ride }: { ride: Ride }) {
  return (
    <div className="ride-links" aria-label={`${ride.nameJa}を詳しく見る`}>
      {rideLinks(ride).map((l) => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer">
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
