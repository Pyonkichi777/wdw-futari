import { parkName } from "../data/parks";
import { RIDES, rideById } from "../data/rides";
import {
  MAX_S,
  VOTE_LABELS,
  answeredCount,
  buildCandidates,
  countRank,
  isComplete,
  move,
  removeItem,
  setRank,
  sortByRank,
  suggestedConsensus,
  warnings,
  type AllVotes,
} from "../lib/consensus";
import { PERSON_LABEL } from "../lib/store";
import type { Consensus, ConsensusItem, PersonId, Rank } from "../types";

interface Props {
  me: PersonId;
  votes: AllVotes;
  consensus: Consensus;
  onSave: (c: Consensus) => void;
}

const RANK_INFO: Record<Rank, { title: string; hint: string }> = {
  S: { title: "S 何があっても乗る", hint: `朝イチか優先パスで必ず確保する（${MAX_S}本まで）` },
  A: { title: "A なるべく乗る", hint: "優先パスや空いた時間で狙う" },
  B: { title: "B 乗れたら乗る", hint: "執着しない。予備日や夜に拾う" },
};

/** A3 合意リスト（優先順位）。2人とも投票し終えると作れる */
export function ConsensusScreen({ me, votes, consensus, onSave }: Props) {
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
          <button className="primary" onClick={() => save(suggestedConsensus(candidates))}>
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
                              {parkName(ride.park)}
                              {c && `　${PERSON_LABEL.toshi}: ${VOTE_LABELS[c.toshi]} ／ ${PERSON_LABEL.tsuma}: ${VOTE_LABELS[c.tsuma]}`}
                            </span>
                            {c?.soloOnly && <span className="badge">片方だけ乗る</span>}
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
                          {PERSON_LABEL.toshi}: {VOTE_LABELS[c.toshi]} ／ {PERSON_LABEL.tsuma}: {VOTE_LABELS[c.tsuma]}
                        </span>
                      </div>
                    </div>
                    <div className="rank-actions">
                      <button className="mini" onClick={() => save(sortByRank([...items, { rideId: c.ride.id, rank: "B" }]))}>
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
