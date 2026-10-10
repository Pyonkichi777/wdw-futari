import { useState } from "react";
import { DATA_AS_OF, RIDES } from "../data/rides";
import { KindFilter, type KindFilterValue } from "./KindFilter";
import { ParkFilter, type ParkFilterValue } from "./ParkFilter";
import { RideCard } from "./RideCard";

/** A1 アトラクション図鑑 */
export function Encyclopedia() {
  const [park, setPark] = useState<ParkFilterValue>("ALL");
  const [kind, setKind] = useState<KindFilterValue>("ALL");
  const rides = RIDES.filter((r) => (park === "ALL" || r.park === park) && (kind === "ALL" || r.kind === kind));
  return (
    <section>
      <h2>アトラクション図鑑</h2>
      <p className="note">
        4パークの乗り物・ショー・パレード・夜のショー・散策路の全{RIDES.length}件（{rides.length}件を表示）。身長制限・時短パス・開園前入園は{DATA_AS_OF}に公式サイトで確認した内容で、出発1ヶ月前に再確認します。
      </p>
      <ParkFilter value={park} onChange={setPark} />
      <KindFilter value={kind} onChange={setKind} />
      <div className="list">
        {rides.map((r) => (
          <RideCard key={r.id} ride={r} detail />
        ))}
      </div>
    </section>
  );
}
