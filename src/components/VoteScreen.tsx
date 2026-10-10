import { useState } from "react";
import { RIDES } from "../data/rides";
import { VOTE_LABELS, VOTE_ORDER, answeredCount, isComplete, type AllVotes } from "../lib/consensus";
import { PERSON_LABEL, partnerOf } from "../lib/store";
import type { PersonId, VoteLevel } from "../types";
import { KindFilter, type KindFilterValue } from "./KindFilter";
import { ParkFilter, type ParkFilterValue } from "./ParkFilter";
import { RideCard } from "./RideCard";

interface Props {
  me: PersonId;
  votes: AllVotes;
  onVote: (rideId: string, level: VoteLevel) => void;
  /** まだ答えていないものをまとめて同じ回答にする */
  onBulkVote: (rideIds: string[], level: VoteLevel) => void;
}

/** A2 2人の「乗りたい」投票。相手の回答は、自分が全部答えるまで見えない */
export function VoteScreen({ me, votes, onVote, onBulkVote }: Props) {
  const [park, setPark] = useState<ParkFilterValue>("ALL");
  const [kind, setKind] = useState<KindFilterValue>("ALL");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const partner = partnerOf(me);
  const mine = votes[me];
  const done = answeredCount(mine, RIDES);
  const partnerDone = answeredCount(votes[partner], RIDES);
  const revealed = isComplete(mine, RIDES);

  const rides = RIDES.filter(
    (r) => (park === "ALL" || r.park === park) && (kind === "ALL" || r.kind === kind) && (!onlyUnanswered || mine[r.id] === undefined),
  );
  const unanswered = RIDES.filter((r) => mine[r.id] === undefined).map((r) => r.id);
  const fillRest = (): void => {
    if (unanswered.length === 0) return;
    if (window.confirm(`まだ答えていない${unanswered.length}件を、まとめて「${VOTE_LABELS.either}」にします。あとから1件ずつ変更できます。よろしいですか？`)) {
      onBulkVote(unanswered, "either");
    }
  };

  return (
    <section>
      <h2>乗りたい投票</h2>
      <div className="progress-box">
        <Progress label={`${PERSON_LABEL[me]}（あなた）`} value={done} total={RIDES.length} />
        <Progress label={PERSON_LABEL[partner]} value={partnerDone} total={RIDES.length} />
        <p className="note">
          {revealed
            ? `全部答えたので、${PERSON_LABEL[partner]}の回答も表示しています。`
            : `相手に引っ張られないよう、${PERSON_LABEL[partner]}の回答は、あなたが全部答えると表示されます。`}
        </p>
      </div>
      <ParkFilter value={park} onChange={setPark} />
      <KindFilter value={kind} onChange={setKind} />
      {unanswered.length > 0 && (
        <button className="wide" onClick={fillRest}>
          未回答の{unanswered.length}件をまとめて「{VOTE_LABELS.either}」にする
        </button>
      )}
      <label className="toggle">
        <input type="checkbox" checked={onlyUnanswered} onChange={(e) => setOnlyUnanswered(e.target.checked)} />
        まだ答えていないものだけ
      </label>
      <div className="list">
        {rides.map((r) => {
          const partnerVote = votes[partner][r.id];
          return (
            <RideCard key={r.id} ride={r}>
              <p className="desc">{r.description}</p>
              <div className="vote-buttons" role="radiogroup" aria-label={`${r.nameJa}の投票`}>
                {VOTE_ORDER.map((lv) => (
                  <button key={lv} role="radio" aria-checked={mine[r.id] === lv} className={`vote vote-${lv}${mine[r.id] === lv ? " on" : ""}`} onClick={() => onVote(r.id, lv)}>
                    {VOTE_LABELS[lv]}
                  </button>
                ))}
              </div>
              {revealed && (
                <p className="partner-vote">
                  {PERSON_LABEL[partner]}: {partnerVote ? <strong className={`pv-${partnerVote}`}>{VOTE_LABELS[partnerVote]}</strong> : "まだ"}
                </p>
              )}
            </RideCard>
          );
        })}
        {rides.length === 0 && <p className="empty">この条件で答えていないものはありません。</p>}
      </div>
    </section>
  );
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="progress">
      <span>{label}</span>
      <progress value={value} max={total} />
      <span className="num">
        {value}/{total}
      </span>
    </div>
  );
}
