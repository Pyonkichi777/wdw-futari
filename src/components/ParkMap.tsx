import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COORDS } from "../data/coords";
import { parkName } from "../data/parks";
import { rideById } from "../data/rides";
import type { PlanItem } from "../lib/plan";
import type { ParkId, Rank } from "../types";

const RANK_COLOR: Record<Rank, string> = { S: "#ff4f6d", A: "#1d7fc4", B: "#8e7fb8" };

/** パークの中にある点だけ（ホテルのレストランは入れない） */
const inParkPoint = (id: string, park: ParkId): readonly [number, number] | null => {
  const r = rideById(id);
  if (!r || r.park !== park || (r.dining && !r.dining.inPark)) return null;
  return COORDS[id] ?? null;
};

/**
 * 実際の地図（OpenStreetMap）の上に、その日に回る順番を番号つきのピンと線で描く。
 * 位置は公式サイトのピンの緯度・経度。地図を指で動かしたり拡大したりできる。
 */
export function ParkMap({ park, items, rankOf }: { park: ParkId; items: readonly PlanItem[]; rankOf: (id: string) => Rank | undefined }) {
  const el = useRef<HTMLDivElement>(null);
  const route = items.flatMap((it) => {
    const p = inParkPoint(it.rideId, park);
    return p ? [{ it, p }] : [];
  });
  const key = route.map((r) => r.it.rideId).join(",");

  useEffect(() => {
    if (!el.current || route.length === 0) return;
    const map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    const latlngs = route.map((r) => L.latLng(r.p[0], r.p[1]));
    L.polyline(latlngs, { color: "#3b2479", weight: 4, opacity: 0.85, dashArray: "8 7" }).addTo(map);
    route.forEach((r, i) => {
      const rank = rankOf(r.it.rideId);
      const icon = L.divIcon({
        className: "pm-pin",
        html: `<span style="background:${rank ? RANK_COLOR[rank] : "#c9a227"}">${i + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker(latlngs[i]!, { icon, title: rideById(r.it.rideId)?.nameJa ?? "" })
        .bindPopup(`${i + 1}. ${rideById(r.it.rideId)?.nameJa ?? ""}`)
        .addTo(map);
    });
    if (latlngs.length === 1) map.setView(latlngs[0]!, 17);
    else map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 18 });
    return () => {
      map.remove();
    };
    // ルート（順番）が変わったときだけ描き直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, park]);

  if (route.length === 0) return <p className="note">このパークで地図に出せる予定はありません（ホテルのレストランなど）。</p>;
  return (
    <figure className="park-map">
      <div ref={el} className="pm-leaflet" role="img" aria-label={`${parkName(park)}の地図と回る順番`} />
      <figcaption>
        <ol className="pm-legend">
          {route.map((r) => (
            <li key={r.it.rideId}>{rideById(r.it.rideId)?.nameJa}</li>
          ))}
        </ol>
        <p className="note">地図は OpenStreetMap、ピンの位置は公式サイトの地図のピン。2本指で拡大・移動できます。電波がないと地図は表示されません。</p>
      </figcaption>
    </figure>
  );
}
