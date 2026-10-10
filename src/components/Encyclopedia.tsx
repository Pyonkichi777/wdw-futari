import { useState } from "react";
import { DATA_AS_OF, RIDES } from "../data/rides";
import { ParkFilter, type ParkFilterValue } from "./ParkFilter";
import { RideCard } from "./RideCard";

/** A1 アトラクション図鑑 */
export function Encyclopedia() {
  const [park, setPark] = useState<ParkFilterValue>("ALL");
  const rides = RIDES.filter((r) => park === "ALL" || r.park === park);
  return (
    <section>
      <h2>アトラクション図鑑</h2>
      <p className="note">
        {RIDES.length}件。情報は{DATA_AS_OF}時点で、出発1ヶ月前に再確認します。身長制限はインチ表記をcmに直した目安です。
      </p>
      <ParkFilter value={park} onChange={setPark} />
      <div className="list">
        {rides.map((r) => (
          <RideCard key={r.id} ride={r} detail />
        ))}
      </div>
    </section>
  );
}
