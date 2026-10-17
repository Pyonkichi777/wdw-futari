import { DATA_AS_OF, RIDES } from "../data/rides";
import { voteLabel } from "../lib/consensus";
import { applyFilters } from "../lib/listFilters";
import type { Votes } from "../types";
import { RideCard } from "./RideCard";
import { useRideFocus, type RideFocus } from "./useRideFocus";
import { ListFilterBar } from "./ListFilterBar";
import { useListFilters } from "./useListFilters";

interface Props {
  /** 自分の投票（リンクの文言に今の回答を出す） */
  myVotes: Votes;
  focus: RideFocus | null;
  onGoVote: (rideId: string) => void;
}

/** A1 アトラクション図鑑 */
export function Encyclopedia({ myVotes, focus, onGoVote }: Props) {
  const [filters, setFilters] = useListFilters("zukan");
  const lit = useRideFocus(focus);
  const { base, rides } = applyFilters(RIDES, filters, myVotes, focus?.rideId);
  return (
    <section>
      <h2>アトラクション図鑑</h2>
      <details className="about">
        <summary>この図鑑について</summary>
        <p className="note">
        4パークの乗り物・ショー・パレード・夜のショー・散策路・キャラクターグリーティング・キャラクターダイニングの全{RIDES.length}件。身長制限・時短パス・開園前入園は{DATA_AS_OF}に公式サイトで確認した内容で、出発1ヶ月前に再確認します。
        </p>
      </details>
      <ListFilterBar filters={filters} onChange={setFilters} base={base} myVotes={myVotes} />
      <p className="count">{rides.length}件を表示</p>
      <div className="list">
        {rides.map((r) => {
          const mine = myVotes[r.id];
          return (
          <RideCard
            key={r.id}
            ride={r}
            detail
            lit={lit === r.id}
            jump={{
              label: mine ? `⭐ 投票済み「${voteLabel(r, mine)}」を変える` : "⭐ これに投票する",
              onClick: () => onGoVote(r.id),
            }}
          />
          );
        })}
        {rides.length === 0 && <p className="empty">この条件に当てはまるものはありません。</p>}
      </div>
    </section>
  );
}
