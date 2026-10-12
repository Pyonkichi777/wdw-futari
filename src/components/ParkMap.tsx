import { COORDS } from "../data/coords";
import { parkName } from "../data/parks";
import { RIDES, rideById } from "../data/rides";
import type { PlanItem } from "../lib/plan";
import type { ParkId, Rank } from "../types";

const W = 340;
const H = 260;
const PAD = 22;

const RANK_COLOR: Record<Rank, string> = { S: "#ff4f6d", A: "#1d7fc4", B: "#9a8fb8" };

/** パークの中にある点だけ（ホテルのレストランは地図に入れない） */
const inParkPoint = (id: string, park: ParkId): readonly [number, number] | null => {
  const r = rideById(id);
  if (!r || r.park !== park || (r.dining && !r.dining.inPark)) return null;
  return COORDS[id] ?? null;
};

/**
 * パーク内の地図（簡略図）と、その日に回る順番の線。公式の地図画像は使わず、
 * 公式サイトのピンの緯度・経度から位置関係だけを描く。灰色の点はそのパークのほかの乗り物。
 */
export function ParkMap({ park, items, rankOf }: { park: ParkId; items: readonly PlanItem[]; rankOf: (id: string) => Rank | undefined }) {
  const background = RIDES.flatMap((r) => {
    const p = inParkPoint(r.id, park);
    return p && r.kind !== "dining" ? [{ id: r.id, p }] : [];
  });
  const route = items.flatMap((it) => {
    const p = inParkPoint(it.rideId, park);
    return p ? [{ it, p }] : [];
  });
  const all = [...background.map((b) => b.p), ...route.map((r) => r.p)];
  if (all.length === 0) return null;

  // 緯度・経度を画面の座標に（経度は緯度に合わせて縮める）
  const lat0 = all.reduce((s, p) => s + p[0], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[1] * k);
  const ys = all.map((p) => p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - PAD * 2) / Math.max(maxX - minX, 1e-6), (H - PAD * 2) / Math.max(maxY - minY, 1e-6));
  const offX = (W - (maxX - minX) * scale) / 2;
  const offY = (H - (maxY - minY) * scale) / 2;
  const toXY = (p: readonly [number, number]): [number, number] => [offX + (p[1] * k - minX) * scale, H - (offY + (p[0] - minY) * scale)];

  const pts = route.map((r) => toXY(r.p));
  return (
    <figure className="park-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${parkName(park)}の回る順番の地図`}>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="18" className="pm-bg" />
        {background.map((b) => {
          const [x, y] = toXY(b.p);
          return <circle key={b.id} cx={x} cy={y} r="3" className="pm-dot" />;
        })}
        {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} className="pm-route" />}
        {route.map((r, i) => {
          const [x, y] = toXY(r.p);
          const rank = rankOf(r.it.rideId);
          return (
            <g key={r.it.rideId}>
              <circle cx={x} cy={y} r="11" fill={rank ? RANK_COLOR[rank] : "#c9a227"} className="pm-stop" />
              <text x={x} y={y + 4} textAnchor="middle" className="pm-num">
                {i + 1}
              </text>
            </g>
          );
        })}
        <text x={W - 14} y={22} textAnchor="end" className="pm-north">
          ↑北
        </text>
      </svg>
      <figcaption>
        <ol className="pm-legend">
          {route.map((r) => (
            <li key={r.it.rideId}>{rideById(r.it.rideId)?.nameJa}</li>
          ))}
        </ol>
        <p className="note">位置は公式サイトの地図のピンをもとにした簡略図です（道は描いていません）。灰色の点はほかの乗り物。</p>
      </figcaption>
    </figure>
  );
}
