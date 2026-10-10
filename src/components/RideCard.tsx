import type { ReactNode } from "react";
import { parkName } from "../data/parks";
import { KIND_LABEL, accessLines } from "../lib/access";
import { rideLinks } from "../lib/links";
import type { Ride } from "../types";

const LL_CHIP: Record<Ride["lightningLane"], string> = {
  single: "Single Pass（有料・個別）",
  multi: "Multi Pass",
  none: "時短パスなし",
};

export function RideMeta({ ride }: { ride: Ride }) {
  return (
    <ul className="meta">
      <li className={`park park-${ride.park}`}>{parkName(ride.park)}</li>
      <li>{KIND_LABEL[ride.kind]}</li>
      <li className={`intensity intensity-${ride.intensity}`}>負担: {ride.intensity}</li>
      <li>{ride.minHeightCm ? `身長${ride.minHeightCm}cm以上` : "身長制限なし"}</li>
      <li className={ride.lightningLane === "single" ? "accent" : undefined}>{LL_CHIP[ride.lightningLane]}</li>
      {ride.multiPassTier === 1 && <li className="accent">人気グループ</li>}
      {ride.kind === "ride" && ride.earlyEntry && <li className="accent">開園前入園OK</li>}
      {ride.singleRider && <li className="accent">1人乗り専用の列あり</li>}
      <li>{ride.inTokyo ? "東京にもある" : "東京にない"}</li>
      {ride.tags
        .filter((t) => t !== "ショー")
        .map((t) => (
          <li key={t}>{t}</li>
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

export function RideCard({ ride, children, detail = false }: { ride: Ride; children?: ReactNode; detail?: boolean }) {
  return (
    <article className="card">
      <header className="card-head">
        {ride.top10 !== undefined && <span className="top10">TOP{ride.top10}</span>}
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
        </>
      )}
      {ride.caution && <p className="caution">⚠ {ride.caution}</p>}
      <RideLinks ride={ride} />
      {children}
    </article>
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
