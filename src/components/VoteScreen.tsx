import { RIDES } from "../data/rides";
import { VOTE_LABELS, VOTE_ORDER, answeredCount, isComplete, voteLabel, type AllVotes } from "../lib/consensus";
import type { AllMeals } from "../lib/meals";
import { MealPicker, mealText } from "./MealPicker";
import { PERSON_LABEL, partnerOf } from "../lib/store";
import type { MealPeriod, PersonId, VoteLevel } from "../types";
import { applyFilters, isFiltered } from "../lib/listFilters";
import { RideCard } from "./RideCard";
import { useRideFocus, type RideFocus } from "./useRideFocus";
import { ListFilterBar } from "./ListFilterBar";
import { useListFilters } from "./useListFilters";

interface Props {
  me: PersonId;
  votes: AllVotes;
  onVote: (rideId: string, level: VoteLevel) => void;
  /** まだ答えていないものをまとめて同じ回答にする */
  onBulkVote: (rideIds: string[], level: VoteLevel) => void;
  focus: RideFocus | null;
  onGoZukan: (rideId: string) => void;
  /** レストランに「行くならいつ」の希望 */
  meals: AllMeals;
  onMeals: (rideId: string, meals: MealPeriod[]) => void;
}

/** A2 2人の「乗りたい」投票。相手の回答は、自分が全部答えるまで見えない */
export function VoteScreen({ me, votes, onVote, onBulkVote, focus, onGoZukan, meals, onMeals }: Props) {
  const [filters, setFilters] = useListFilters("vote");
  const lit = useRideFocus(focus);
  const partner = partnerOf(me);
  const mine = votes[me];
  const done = answeredCount(mine, RIDES);
  const partnerDone = answeredCount(votes[partner], RIDES);
  const revealed = isComplete(mine, RIDES);

  const { base, rides } = applyFilters(RIDES, filters, mine, focus?.rideId);
  const filtered = isFiltered(filters);
  // 絞り込み中は「表示中の未回答」、絞り込みなしなら全部の未回答が対象
  const unanswered = rides.filter((r) => mine[r.id] === undefined).map((r) => r.id);
  const fillRest = (level: VoteLevel): void => {
    if (unanswered.length === 0) return;
    const scope = filtered ? "表示中の" : "";
    if (window.confirm(`${scope}まだ答えていない${unanswered.length}件を、まとめて「${VOTE_LABELS[level]}」にします。あとから1件ずつ変更できます。よろしいですか？`)) {
      onBulkVote(unanswered, level);
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
      <ListFilterBar filters={filters} onChange={setFilters} base={base} myVotes={mine} />
      <p className="count">
        {rides.length}件を表示{filtered && `（うち未回答${unanswered.length}件）`}
      </p>
      {unanswered.length > 0 && (
        <div className="bulk">
          <span>{filtered ? "表示中の" : ""}未回答{unanswered.length}件をまとめて：</span>
          {VOTE_ORDER.map((lv) => (
            <button key={lv} className={`mini vote-${lv}`} onClick={() => fillRest(lv)}>
              {VOTE_LABELS[lv]}
            </button>
          ))}
        </div>
      )}
      <div className="list">
        {rides.map((r) => {
          const partnerVote = votes[partner][r.id];
          return (
            <RideCard key={r.id} ride={r} lit={lit === r.id} jump={{ label: "🏰 図鑑で詳しく見る", onClick: () => onGoZukan(r.id) }}>
              <p className="desc">{r.description}</p>
              <div className="vote-buttons" role="radiogroup" aria-label={`${r.nameJa}の投票`}>
                {VOTE_ORDER.map((lv) => (
                  <button key={lv} role="radio" aria-checked={mine[r.id] === lv} className={`vote vote-${lv}${mine[r.id] === lv ? " on" : ""}`} onClick={() => onVote(r.id, lv)}>
                    {voteLabel(r, lv)}
                  </button>
                ))}
              </div>
              {r.dining && mine[r.id] !== "skip" && <MealPicker ride={r} value={meals[me][r.id]} onChange={(m) => onMeals(r.id, m)} />}
              {revealed && (
                <p className="partner-vote">
                  {PERSON_LABEL[partner]}: {partnerVote ? <strong className={`pv-${partnerVote}`}>{voteLabel(r, partnerVote)}</strong> : "まだ"}
                  {r.dining && partnerVote && partnerVote !== "skip" && (r.dining.meals.length > 1 ? `（${mealText(meals[partner][r.id])}）` : "")}
                </p>
              )}
            </RideCard>
          );
        })}
        {rides.length === 0 && <p className="empty">この条件に当てはまるものはありません。</p>}
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
