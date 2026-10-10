import { useState } from "react";
import { DATA_AS_OF, RIDES } from "../data/rides";
import { matchesFeatures, type FeatureId } from "../lib/filters";
import { FeatureFilter } from "./FeatureFilter";
import { KindFilter, type KindFilterValue } from "./KindFilter";
import { ParkFilter, type ParkFilterValue } from "./ParkFilter";
import { RideCard } from "./RideCard";

/** A1 アトラクション図鑑 */
export function Encyclopedia() {
  const [park, setPark] = useState<ParkFilterValue>("ALL");
  const [kind, setKind] = useState<KindFilterValue>("ALL");
  const [features, setFeatures] = useState<Set<FeatureId>>(() => new Set());
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
        {rides.map((r) => (
          <RideCard key={r.id} ride={r} detail />
        ))}
        {rides.length === 0 && <p className="empty">この条件に当てはまるものはありません。</p>}
      </div>
    </section>
  );
}
