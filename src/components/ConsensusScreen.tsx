import { parkName } from "../data/parks";
import { RIDES, rideById } from "../data/rides";
import {
  MAX_S,
  answeredCount,
  buildCandidates,
  countRank,
  isComplete,
  move,
  removeItem,
  setMeal,
  setRank,
  sortByRank,
  suggestedConsensus,
  toItem,
  voteLabel,
  warnings,
  type AllVotes,
} from "../lib/consensus";
import { MEAL_LABEL } from "../data/dining";
import { diningPlace } from "../lib/dining";
import { suggestMeal, type AllMeals } from "../lib/meals";
import { mealText } from "./MealPicker";
import { PERSON_LABEL } from "../lib/store";
import type { Consensus, ConsensusItem, PersonId, Rank, Ride } from "../types";

interface Props {
  me: PersonId;
  votes: AllVotes;
  meals: AllMeals;
  consensus: Consensus;
  onSave: (c: Consensus) => void;
}

const RANK_INFO: Record<Rank, { title: string; hint: string }> = {
  S: { title: "S 何があっても乗る・行く", hint: `朝イチか優先パス（レストランは予約）で必ず確保する（${MAX_S}本まで）` },
  A: { title: "A なるべく乗る", hint: "優先パスや空いた時間で狙う" },
  B: { title: "B 乗れたら乗る", hint: "執着しない。予備日や夜に拾う" },
};

/** A3 合意リスト（優先順位）。2人とも投票し終えると作れる */
export function ConsensusScreen({ me, votes, meals, consensus, onSave }: Props) {
  const ready = isComplete(votes.toshi, RIDES) && isComplete(votes.tsuma, RIDES);
  if (!ready) {
    return (
      <section>
        <h2>合意リスト</h2>
        <div className="empty-state">
          <p>2人とも投票し終えると、ここで優先順位を決められます。</p>
          <p>
            {PERSON_LABEL.toshi}: {answeredCount(votes.toshi, RIDES)}/{RIDES.length}　{PERSON_LABEL.tsuma}: {answeredCount(votes.tsuma, RIDES)}/{RIDES.length}
          </p>
        </div>
      </section>
    );
  }

  const candidates = buildCandidates(RIDES, votes);
  const byId = new Map(candidates.map((c) => [c.ride.id, c]));
  const items = consensus.items;
  const save = (next: ConsensusItem[], confirmed = false): void =>
    onSave({ items: next, confirmed, updatedBy: me, updatedAt: Date.now() });
  const notListed = candidates.filter((c) => !items.some((it) => it.rideId === c.ride.id));
  const locked = consensus.confirmed;

  return (
    <section>
      <h2>合意リスト</h2>
      {consensus.updatedBy && consensus.updatedAt && (
        <p className="note">
          最終更新: {PERSON_LABEL[consensus.updatedBy]}（{new Date(consensus.updatedAt).toLocaleString("ja-JP")}）
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>2人の投票から、おすすめの順番を作ります。そのあと2人で並べ替えて確定します。</p>
          <button className="primary" onClick={() => save(suggestedConsensus(candidates, meals))}>
            投票結果からおすすめで並べる
          </button>
        </div>
      ) : (
        <>
          {locked ? (
            <div className="banner ok">
              <strong>2人で確定済み</strong>
              <button onClick={() => save(items, false)}>変更する</button>
            </div>
          ) : (
            <>
              {warnings(items).map((w) => (
                <p key={w.kind} className="banner warn">
                  {w.message}
                </p>
              ))}
              <div className="banner">
                <span>
                  S {countRank(items, "S")}本 ／ A {countRank(items, "A")}本 ／ B {countRank(items, "B")}本
                </span>
                <button className="primary" onClick={() => save(items, true)} disabled={warnings(items).length > 0}>
                  この順番で確定
                </button>
              </div>
            </>
          )}

          {(["S", "A", "B"] as const).map((rank) => {
            const group = items.filter((it) => it.rank === rank);
            return (
              <div key={rank} className={`rank-group rank-${rank}`}>
                <h3>{RANK_INFO[rank].title}</h3>
                <p className="note">{RANK_INFO[rank].hint}</p>
                {group.length === 0 && <p className="empty">なし</p>}
                <ol>
                  {group.map((it, idx) => {
                    const ride = rideById(it.rideId);
                    if (!ride) return null;
                    const c = byId.get(it.rideId);
                    return (
                      <li key={it.rideId} className="rank-item">
                        <div className="rank-main">
                          <span className="order">{idx + 1}</span>
                          <div>
                            <strong>{ride.nameJa}</strong>
                            <span className="sub">
                              {ride.dining ? diningPlace(ride) : parkName(ride.park)}
                              {c && `　${PERSON_LABEL.toshi}: ${voteLabel(ride, c.toshi)} ／ ${PERSON_LABEL.tsuma}: ${voteLabel(ride, c.tsuma)}`}
                            </span>
                            {c?.soloOnly && <span className="badge">{ride.dining ? "片方だけ行きたい" : "片方だけ乗る"}</span>}
                            {ride.dining && <MealChoice ride={ride} item={it} meals={meals} locked={locked} onPick={(m) => save(setMeal(items, it.rideId, m))} />}
                          </div>
                        </div>
                        {!locked && (
                          <div className="rank-actions">
                            {(["S", "A", "B"] as const).map((r) => (
                              <button key={r} className={r === it.rank ? "mini on" : "mini"} onClick={() => save(setRank(items, it.rideId, r))} aria-label={`${r}にする`}>
                                {r}
                              </button>
                            ))}
                            <button className="mini" onClick={() => save(move(items, it.rideId, -1))} aria-label="上へ" disabled={idx === 0}>
                              ↑
                            </button>
                            <button className="mini" onClick={() => save(move(items, it.rideId, 1))} aria-label="下へ" disabled={idx === group.length - 1}>
                              ↓
                            </button>
                            <button className="mini danger" onClick={() => save(removeItem(items, it.rideId))} aria-label="リストから外す">
                              外す
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}

          {!locked && notListed.length > 0 && (
            <div className="rank-group">
              <h3>リストに入っていない候補</h3>
              <ul>
                {notListed.map((c) => (
                  <li key={c.ride.id} className="rank-item">
                    <div className="rank-main">
                      <div>
                        <strong>{c.ride.nameJa}</strong>
                        <span className="sub">
                          {PERSON_LABEL.toshi}: {voteLabel(c.ride, c.toshi)} ／ {PERSON_LABEL.tsuma}: {voteLabel(c.ride, c.tsuma)}
                        </span>
                      </div>
                    </div>
                    <div className="rank-actions">
                      <button className="mini" onClick={() => save(sortByRank([...items, toItem(c.ride, "B", meals)]))}>
                        Bに追加
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const REASON_TEXT = {
  both: "2人とも希望",
  one: "片方が希望",
  only: "この時間帯だけ",
  none: "希望なし",
} as const;

/** レストランを朝・昼・夜のどれで入れるか。日ごとの計画を作るときに、この時間帯で枠を取る */
function MealChoice({ ride, item, meals, locked, onPick }: { ride: Ride; item: ConsensusItem; meals: AllMeals; locked: boolean; onPick: (m: NonNullable<ConsensusItem["meal"]>) => void }) {
  const options = ride.dining?.meals ?? [];
  const suggestion = suggestMeal(ride, meals);
  const current = item.meal ?? suggestion?.meal;
  return (
    <div className="meal-choice">
      <span className="sub">
        希望: {PERSON_LABEL.toshi} {mealText(meals.toshi[ride.id])} ／ {PERSON_LABEL.tsuma} {mealText(meals.tsuma[ride.id])}
      </span>
      <div className="chips">
        <span className="meal-choice-label">🍽 行く時間帯</span>
        {options.map((m) => (
          <button key={m} className={m === current ? "mini on" : "mini"} disabled={locked || options.length === 1} onClick={() => onPick(m)} aria-pressed={m === current}>
            {MEAL_LABEL[m]}
          </button>
        ))}
        {item.meal === undefined && suggestion && <span className="sub">（おすすめ: {REASON_TEXT[suggestion.reason]}）</span>}
      </div>
    </div>
  );
}
