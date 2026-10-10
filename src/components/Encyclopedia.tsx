import { useState } from "react";
import { DATA_AS_OF, RIDES } from "../data/rides";
import { matchesFeatures, type FeatureId } from "../lib/filters";
import { FeatureFilter } from "./FeatureFilter";
import { KindFilter, type KindFilterValue } from "./KindFilter";
import { ParkFilter, type ParkFilterValue } from "./ParkFilter";
import { VOTE_LABELS } from "../lib/consensus";
import type { Votes } from "../types";
import { RideCard } from "./RideCard";
import { useRideFocus, type RideFocus } from "./useRideFocus";

interface Props {
  /** 自分の投票（リンクの文言に今の回答を出す） */
  myVotes: Votes;
  focus: RideFocus | null;
  onGoVote: (rideId: string) => void;
}

/** A1 アトラクション図鑑 */
export function Encyclopedia({ myVotes, focus, onGoVote }: Props) {
  const [park, setPark] = useState<ParkFilterValue>("ALL");
  const [kind, setKind] = useState<KindFilterValue>("ALL");
  const [features, setFeatures] = useState<Set<FeatureId>>(() => new Set());
  const lit = useRideFocus(focus);
  const rides = RIDES.filter((r) => (park === "ALL" || r.park === park) && (kind === "ALL" || r.kind === kind) && matchesFeatures(r, features));
  return (
    <section>
      <h2>アトラクション図鑑</h2>
      <p className="note">
        4パークの乗り物・ショー・パレード・夜のショー・散策路の全{RIDES.length}件。身長制限・時短パス・開園前入園は{DATA_AS_OF}に公式サイトで確認した内容で、出発1ヶ月前に再確認します。
      </p>
      <ParkFilter value={park} onChange={setPark} />
      <KindFilter value={kind} onChange={setKind} />
      <FeatureFilter value={features} onChange={setFeatures} />
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
              label: mine ? `⭐ 投票済み「${VOTE_LABELS[mine]}」を変える` : "⭐ これに投票する",
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
