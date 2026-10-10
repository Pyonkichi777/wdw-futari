import type { ReactNode } from "react";
import { parkName } from "../data/parks";
import { rideLinks } from "../lib/links";
import type { Ride } from "../types";

const LL_LABEL: Record<Ride["lightningLane"], string> = {
  single: "優先パス: 個別購入（Single）",
  multi: "優先パス: Multi Pass",
  none: "優先パスなし",
};

export function RideMeta({ ride }: { ride: Ride }) {
  return (
    <ul className="meta">
      <li className={`park park-${ride.park}`}>{parkName(ride.park)}</li>
      <li className={`intensity intensity-${ride.intensity}`}>負担: {ride.intensity}</li>
      <li>{ride.minHeightCm ? `身長${ride.minHeightCm}cm以上` : "身長制限なし"}</li>
      {ride.multiPassTier === 1 && <li className="accent">Multi Pass 人気グループ</li>}
      {ride.singleRider && <li className="accent">1人乗り専用の列あり</li>}
      <li>{ride.inTokyo ? "東京にもある" : "東京にない"}</li>
      {ride.tags.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
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
          <p className="sub">
            {LL_LABEL[ride.lightningLane]}
            {ride.multiPassTier === 1 && "（人気グループ：事前予約はこのグループから1日1つまで）"}
          </p>
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
